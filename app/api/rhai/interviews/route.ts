import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { DEFAULT_INTERVIEWS, type InterviewConfig, type InterviewSession } from '@/lib/rhai/types';
import { buildInterviewSuggestion, evaluateInterview, needsSummary } from '@/lib/rhai/interview-eval';
import { draftRoleConfig, previewTranscript } from '@/lib/rhai/interview-authoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BACKFILL_CAP = 25; // safety bound per run

// Operator view of the hiring pipeline: all configs (roles) + all sessions
// (candidates), newest first. PATCH toggles a role open/closed.

export async function GET(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;

  const db = adminDb();
  const [configsSnap, sessionsSnap] = await Promise.all([
    db.collection('rhaiInterviews').get(),
    db.collection('rhaiInterviewSessions').orderBy('createdAt', 'desc').limit(100).get()
  ]);

  const stored = configsSnap.docs.map(d => ({ ...(d.data() as InterviewConfig), id: d.id }));
  const storedIds = new Set(stored.map(c => c.id));
  const configs = [...stored, ...DEFAULT_INTERVIEWS.filter(d => !storedIds.has(d.id))];

  const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<InterviewSession, 'id'>) }));
  return Response.json({ configs, sessions });
}

/**
 * POST { action: 'backfill' } — generate summaries for any session that
 * finished OR got 8+ questions in but never got evaluated (abandoned tabs, or
 * the completion marker never fired). Idempotent: skips sessions that already
 * have a summary. Files a Today suggestion per newly-evaluated interview.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    // create
    title?: string;
    brief?: string;
    // preview / scheduling-link
    id?: string;
    link?: string;
    // shortlist
    sessionId?: string;
    stage?: InterviewSession['stage'] | null;
  };

  const db = adminDb();

  // ---- create: plain-English role → full interview config (model-authored) --
  if (body.action === 'create') {
    const title = body.title?.trim().slice(0, 120);
    const brief = body.brief?.trim().slice(0, 6000);
    if (!title || !brief) return new Response('expected { title, brief }', { status: 400 });

    // Slug from the title, made unique against stored + default roles.
    const configsSnap = await db.collection('rhaiInterviews').get();
    const taken = new Set([...configsSnap.docs.map(d => d.id), ...DEFAULT_INTERVIEWS.map(d => d.id)]);
    const base =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'role';
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;

    const drafted = await draftRoleConfig(title, brief);
    const config: InterviewConfig = { id, title, active: true, ...drafted, createdAt: Date.now() };
    await db.collection('rhaiInterviews').doc(id).set(config);
    return Response.json({ config });
  }

  // ---- preview: representative sample transcript for a role -----------------
  if (body.action === 'preview') {
    if (!body.id) return new Response('expected { id }', { status: 400 });
    const snap = await db.collection('rhaiInterviews').doc(body.id).get();
    const config = snap.exists
      ? ({ ...(snap.data() as InterviewConfig), id: body.id })
      : DEFAULT_INTERVIEWS.find(d => d.id === body.id);
    if (!config) return new Response('not found', { status: 404 });
    const transcript = await previewTranscript(config);
    return Response.json({ transcript });
  }

  // ---- scheduling-link: store the operator's booking link on a role --------
  if (body.action === 'scheduling-link') {
    if (!body.id) return new Response('expected { id }', { status: 400 });
    const link = (body.link ?? '').trim().slice(0, 500);
    if (link && !/^https?:\/\//i.test(link))
      return new Response('link must start with http(s)://', { status: 400 });
    const ref = db.collection('rhaiInterviews').doc(body.id);
    const snap = await ref.get();
    if (!snap.exists) {
      const def = DEFAULT_INTERVIEWS.find(d => d.id === body.id);
      if (!def) return new Response('not found', { status: 404 });
      await ref.set({ ...def, schedulingLink: link, createdAt: Date.now() });
    } else {
      await ref.set({ schedulingLink: link }, { merge: true });
    }
    return Response.json({ ok: true, schedulingLink: link });
  }

  // ---- shortlist: move a candidate between hiring stages -------------------
  if (body.action === 'shortlist') {
    if (!body.sessionId) return new Response('expected { sessionId, stage }', { status: 400 });
    if (body.stage != null && body.stage !== 'shortlisted' && body.stage !== 'invited')
      return new Response('stage must be "shortlisted", "invited", or null', { status: 400 });
    const ref = db.collection('rhaiInterviewSessions').doc(body.sessionId);
    if (!(await ref.get()).exists) return new Response('session not found', { status: 404 });
    // Null clears the stage (back to the applied inbox); FieldValue.delete()
    // keeps the document clean rather than storing null.
    await ref.set({ stage: body.stage ?? FieldValue.delete() }, { merge: true });
    return Response.json({ ok: true, stage: body.stage ?? null });
  }

  if (body.action !== 'backfill') return new Response('unknown action', { status: 400 });

  const [sessionsSnap, configsSnap] = await Promise.all([
    db.collection('rhaiInterviewSessions').orderBy('createdAt', 'desc').limit(300).get(),
    db.collection('rhaiInterviews').get()
  ]);

  const configMap = new Map<string, InterviewConfig>();
  configsSnap.docs.forEach(d => configMap.set(d.id, { ...(d.data() as InterviewConfig), id: d.id }));
  DEFAULT_INTERVIEWS.forEach(d => { if (!configMap.has(d.id)) configMap.set(d.id, d); });

  const targets = sessionsSnap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<InterviewSession, 'id'>) }))
    .filter(s => needsSummary(s))
    .slice(0, BACKFILL_CAP);

  let generated = 0;
  // Sequential — keeps well under model rate limits; the set is small.
  for (const s of targets) {
    const config = configMap.get(s.interviewId);
    if (!config) continue;
    try {
      const evaluated = await evaluateInterview(config, s);
      const now = Date.now();
      await db
        .collection('rhaiInterviewSessions')
        .doc(s.id)
        .set(
          { summary: evaluated.summary, ...(evaluated.questionsForRhea ? { questionsForRhea: evaluated.questionsForRhea } : {}) },
          { merge: true }
        );
      await db.collection('rhaiSuggestions').add(buildInterviewSuggestion(config, s, evaluated, now));
      generated++;
    } catch {
      // best-effort; move on
    }
  }
  return Response.json({ generated, scanned: targets.length });
}

/** PATCH { id, active } — open/close a role. */
export async function PATCH(req: NextRequest) {
  const { error } = await requireOperator(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string; active?: boolean };
  if (!body.id || typeof body.active !== 'boolean') return new Response('expected { id, active }', { status: 400 });

  const ref = adminDb().collection('rhaiInterviews').doc(body.id);
  const snap = await ref.get();
  if (!snap.exists) {
    const def = DEFAULT_INTERVIEWS.find(d => d.id === body.id);
    if (!def) return new Response('not found', { status: 404 });
    await ref.set({ ...def, active: body.active, createdAt: Date.now() });
  } else {
    await ref.set({ active: body.active }, { merge: true });
  }
  return Response.json({ ok: true });
}
