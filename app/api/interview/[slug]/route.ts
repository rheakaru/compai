import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { adminDb } from '@/lib/firebase/admin';
import { modelFor } from '@/lib/rhai/models';
import {
  APPLY_TYPE_OPTIONS,
  DEFAULT_INTERVIEWS,
  type InterviewCandidate,
  type InterviewConfig,
  type InterviewMessage,
  type InterviewSession
} from '@/lib/rhai/types';
import { validateContactFormat, firstError, normalizePhone } from '@/lib/validation/contact';
import { checkMailDomain } from '@/lib/validation/email-dns';
import { EVAL_MIN_TURNS, buildInterviewSuggestion, evaluateInterview } from '@/lib/rhai/interview-eval';
import { buildInterviewerPrompt } from '@/lib/rhai/interview-authoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// PUBLIC, SANDBOXED interview endpoint. Candidates are strangers on the
// internet, so the security posture is different from every other route:
//  - No auth (by design), but also NO access to anything: the system prompt
//    is built ONLY from the role brief. No context vault, no tools, no
//    pipeline, no web search. There is nothing to leak because nothing else
//    is in the model's context — prompt injection can't exfiltrate what
//    isn't there.
//  - The internal rubric (criteria) is used only in the post-interview
//    summary call, which the candidate never sees.
//  - Caps everywhere: message length, turn count, sessions are unlisted
//    Firestore ids.

const COL_CONFIGS = 'rhaiInterviews';
const COL_SESSIONS = 'rhaiInterviewSessions';
const MAX_MSG_CHARS = 2000;

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return client;
}

// Config CONTENT is code-managed (DEFAULT_INTERVIEWS); only the `active`
// open/closed toggle is runtime state. So a stored config always takes its
// brief/criteria/fitAreas/etc. fresh from code — editing the code updates
// behaviour immediately — while preserving the operator's active toggle.
async function loadConfig(slug: string): Promise<InterviewConfig | null> {
  const db = adminDb();
  const def = DEFAULT_INTERVIEWS.find(d => d.id === slug);
  const snap = await db.collection(COL_CONFIGS).doc(slug).get();

  if (def) {
    const stored = snap.exists ? (snap.data() as Partial<InterviewConfig>) : undefined;
    const merged: InterviewConfig = {
      ...def,
      active: stored?.active ?? def.active,
      createdAt: stored?.createdAt ?? Date.now()
    };
    // Persist so the operator list + toggle work; content mirrors code.
    await db.collection(COL_CONFIGS).doc(slug).set(merged);
    return merged;
  }

  // Custom role with no code default (future UI-created): stored is truth.
  return snap.exists ? { ...(snap.data() as InterviewConfig), id: slug } : null;
}

/** Public subset only — never ship the brief/criteria to the browser. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const config = await loadConfig(slug);
  if (!config) return new Response('not found', { status: 404 });
  return Response.json({
    interview: { id: config.id, title: config.title, active: config.active, publicIntro: config.publicIntro }
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const config = await loadConfig(slug);
  if (!config) return new Response('not found', { status: 404 });
  if (!config.active) return new Response('This position is no longer accepting interviews.', { status: 410 });

  const db = adminDb();
  const body = (await req.json().catch(() => ({}))) as {
    action?: 'start' | 'message';
    candidate?: Partial<InterviewCandidate>;
    sessionId?: string;
    text?: string;
    audioUrl?: string;
  };

  // ---- start: contact info → session, static opening (no model call) ----
  if (body.action === 'start') {
    const c = body.candidate ?? {};
    const name = c.name?.trim().slice(0, 80) ?? '';
    const email = c.email?.trim().slice(0, 120) ?? '';
    const phone = c.phone?.trim().slice(0, 30) ?? '';
    const applyType = c.applyType?.trim().slice(0, 60) ?? '';
    const agencyName = c.agencyName?.trim().slice(0, 80) ?? '';
    const resumeUrl = c.resumeUrl?.trim().slice(0, 500) ?? '';
    const resumeName = c.resumeName?.trim().slice(0, 120) ?? '';

    // Layer 1 — format (mirrors the client). Phone is a 10-digit mobile here.
    const fmt = firstError(validateContactFormat({ name, email, phone }, { phoneMode: 'in10' }));
    if (fmt) return new Response(fmt, { status: 400 });
    // Layer 2 — the email domain can actually receive mail (catches
    // x@fgdfg.com; fails open on DNS trouble).
    if ((await checkMailDomain(email)) === 'no_domain')
      return new Response("That email address doesn't look like it can receive mail — please check it.", {
        status: 400
      });
    // CV is mandatory, and must be a file we stored (not an arbitrary link).
    if (!/^https:\/\/storage\.googleapis\.com\/[^"'\s]+$/.test(resumeUrl))
      return new Response('Please upload your CV (PDF, DOC, or DOCX) before starting.', { status: 400 });
    // Apply Type is mandatory and must be one of the known options.
    if (!APPLY_TYPE_OPTIONS.includes(applyType as (typeof APPLY_TYPE_OPTIONS)[number]))
      return new Response('Please select how you found this role.', { status: 400 });
    // Agency name is mandatory when the source is an agency.
    if (applyType === 'Agency' && !agencyName)
      return new Response('Please select the agency.', { status: 400 });

    const opening: InterviewMessage = { role: 'rhai', text: config.openingMessage, at: Date.now() };
    const session: Omit<InterviewSession, 'id'> = {
      interviewId: slug,
      candidate: {
        name,
        email,
        phone: normalizePhone(phone),
        resumeUrl,
        ...(resumeName ? { resumeName } : {}),
        applyType,
        ...(applyType === 'Agency' && agencyName ? { agencyName } : {})
      },
      messages: [opening],
      status: 'in_progress',
      createdAt: Date.now()
    };
    const ref = await db.collection(COL_SESSIONS).add(session);
    return Response.json({ sessionId: ref.id, message: opening.text });
  }

  // ---- message: one candidate turn → one Rhai turn ----
  if (body.action === 'message') {
    const text = body.text?.trim().slice(0, MAX_MSG_CHARS);
    if (!body.sessionId || !text) return new Response('expected { sessionId, text }', { status: 400 });

    const ref = db.collection(COL_SESSIONS).doc(body.sessionId);
    const snap = await ref.get();
    if (!snap.exists) return new Response('session not found', { status: 404 });
    const session = { id: snap.id, ...(snap.data() as Omit<InterviewSession, 'id'>) };
    if (session.interviewId !== slug) return new Response('session mismatch', { status: 400 });
    if (session.status === 'completed') return new Response('interview already completed', { status: 410 });

    const candidateTurns = session.messages.filter(m => m.role === 'candidate').length;
    if (candidateTurns >= config.maxTurns + 4) return new Response('turn limit reached', { status: 429 });

    const messages: Anthropic.Messages.MessageParam[] = [
      ...session.messages.map(m => ({
        role: m.role === 'rhai' ? ('assistant' as const) : ('user' as const),
        content: m.text
      })),
      { role: 'user', content: text }
    ];
    // Past the soft limit, force the wrap-up.
    if (candidateTurns >= config.maxTurns) {
      messages.push({
        role: 'user',
        content:
          '[system note: turn limit reached — ask your "questions for Rhea" question now if not yet asked, otherwise deliver your closing + marker]'
      });
    }

    const msg = await anthropic().messages.create({
      model: modelFor('suggest'),
      max_tokens: 500,
      system: buildInterviewerPrompt(config, session.candidate),
      messages
    });
    let reply = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    const done = reply.includes('[INTERVIEW_COMPLETE]');
    reply = reply.replace(/\[INTERVIEW_COMPLETE\]/g, '').trim();

    const now = Date.now();
    // Only accept audioUrl if it's from our own bucket — belt-and-braces so a
    // client can't slip an arbitrary link into the message record.
    const audioUrl =
      body.audioUrl && /^https:\/\/storage\.googleapis\.com\/[^"'\s]+$/.test(body.audioUrl)
        ? body.audioUrl.slice(0, 500)
        : undefined;
    const newMessages: InterviewMessage[] = [
      ...session.messages,
      { role: 'candidate', text, at: now, ...(audioUrl ? { audioUrl } : {}) },
      { role: 'rhai', text: reply, at: now }
    ];
    const update: Record<string, unknown> = { messages: newMessages };

    if (done) {
      update.status = 'completed';
      update.completedAt = now;
    }

    // Evaluate on completion OR once the candidate is deep enough in that Rhea
    // deserves a read even if they never formally finish. Re-evaluate on
    // completion (fuller transcript), but only file the Today suggestion the
    // first time a summary is created, so a threshold-then-completion sequence
    // doesn't double-notify.
    const newCandidateTurns = candidateTurns + 1;
    const firstSummary = !session.summary;
    if (done || (newCandidateTurns >= EVAL_MIN_TURNS && firstSummary)) {
      try {
        const sessionForEval: InterviewSession = {
          ...session,
          messages: newMessages,
          status: done ? 'completed' : session.status
        };
        const evaluated = await evaluateInterview(config, sessionForEval);
        update.summary = evaluated.summary;
        if (evaluated.questionsForRhea) update.questionsForRhea = evaluated.questionsForRhea;
        if (firstSummary) {
          // "Rhai sends it to me" — file it on Rhea's Today panel.
          await db.collection('rhaiSuggestions').add(buildInterviewSuggestion(config, sessionForEval, evaluated, now));
        }
      } catch {
        // summary is best-effort; transcript is safely stored regardless
      }
    }

    await ref.set(update, { merge: true });
    return Response.json({ message: reply, done });
  }

  return new Response('unknown action', { status: 400 });
}
