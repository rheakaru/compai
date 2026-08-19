import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { requireSessions } from '@/lib/rhai/server';
import {
  CHECKLIST_KEYS,
  CHECKLIST_META,
  seedChecklist,
  type ChecklistItem,
  type ChecklistKey,
  type RhaiSession,
  type SessionStatus
} from '@/lib/rhai/sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const COL_SESSIONS_LOGISTICS = 'rhaiSessions';
const TEMPLATES_DOC = 'rhaiConfig/sessionChecklists';

type Templates = Record<ChecklistKey, string[]>;

async function loadTemplates(): Promise<Templates> {
  const snap = await adminDb().doc(TEMPLATES_DOC).get();
  const d = (snap.data() ?? {}) as Partial<Record<ChecklistKey, string[]>>;
  return Object.fromEntries(
    CHECKLIST_KEYS.map(k => [k, d[k]?.length ? d[k]! : CHECKLIST_META[k].template])
  ) as Templates;
}

function cleanChecklist(raw: unknown): ChecklistItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map(i => ({
      text: String(i.text ?? '').slice(0, 300),
      done: i.done === true,
      ...(i.custom === true ? { custom: true } : {})
    }))
    .filter(i => i.text)
    .slice(0, 60);
}

const STATUSES: SessionStatus[] = ['tentative', 'confirmed', 'done', 'cancelled'];

// GET → sessions (upcoming first) + templates + a travel summary per session
// (trips for the same client overlapping the date) + a short-lived outfit URL.
export async function GET(req: NextRequest) {
  const { error } = await requireSessions(req);
  if (error) return error;

  const [snap, templates, tripsSnap] = await Promise.all([
    adminDb().collection(COL_SESSIONS_LOGISTICS).orderBy('date', 'asc').limit(200).get(),
    loadTemplates(),
    adminDb().collection('rhaiTravel').orderBy('updatedAt', 'desc').limit(100).get()
  ]);
  const trips = tripsSnap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as Array<{
    id: string;
    client?: string;
    startDate?: string;
    endDate?: string;
    done?: boolean;
    items?: Array<{ kind: string; status: string; detail?: string; confirmation?: string }>;
  }>;

  const sessions = await Promise.all(
    snap.docs.map(async d => {
      const s = { id: d.id, ...(d.data() as Omit<RhaiSession, 'id'>) };
      // Outfit: mint a 1h signed URL on read.
      let outfitUrl: string | undefined;
      if (s.outfitPath) {
        try {
          const [url] = await adminBucket()
            .file(s.outfitPath)
            .getSignedUrl({ action: 'read', expires: Date.now() + 3600_000 });
          outfitUrl = url;
        } catch {
          /* image missing */
        }
      }
      // Travel: same-client trip overlapping the session date (±2 days).
      const clientTok = (s.client ?? '').toLowerCase().split(/\s+/)[0] ?? '';
      const trip = trips.find(t => {
        if (t.done) return false;
        const tClient = (t.client ?? '').toLowerCase();
        const clientMatch = clientTok && (tClient.includes(clientTok) || (s.client ?? '').toLowerCase().includes(tClient.split(/\s+/)[0] ?? '~'));
        const start = t.startDate ?? '';
        const end = t.endDate || start;
        const dateMatch = start && s.date >= addDays(start, -2) && s.date <= addDays(end, 2);
        return clientMatch && dateMatch;
      });
      return {
        ...s,
        ...(outfitUrl ? { outfitUrl } : {}),
        ...(trip ? { travel: { tripId: trip.id, items: trip.items ?? [] } } : {})
      };
    })
  );

  return Response.json({ sessions, templates });
}

// POST JSON → create a session (checklists seeded from templates).
// POST multipart (file + sessionId) → outfit photo upload.
export async function POST(req: NextRequest) {
  const { error } = await requireSessions(req);
  if (error) return error;
  const now = Date.now();
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    const sessionId = String(form?.get('sessionId') ?? '');
    if (!(file instanceof File) || !sessionId) {
      return new Response('expected file + sessionId', { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) return new Response('file too large (max 15MB)', { status: 413 });
    const ref = adminDb().collection(COL_SESSIONS_LOGISTICS).doc(sessionId);
    if (!(await ref.get()).exists) return new Response('session not found', { status: 404 });
    const ext = (file.type.split('/')[1] || 'jpg').slice(0, 5);
    const outfitPath = `sessionOutfits/${sessionId}/outfit-${now}.${ext}`;
    await adminBucket()
      .file(outfitPath)
      .save(Buffer.from(await file.arrayBuffer()), { contentType: file.type, resumable: false });
    await ref.set({ outfitPath, updatedAt: now }, { merge: true });
    const [url] = await adminBucket()
      .file(outfitPath)
      .getSignedUrl({ action: 'read', expires: now + 3600_000 });
    return Response.json({ ok: true, outfitUrl: url });
  }

  const body = (await req.json().catch(() => ({}))) as Partial<RhaiSession> & { templates?: boolean };
  if (!body.client?.trim() || !body.date) {
    return new Response('client and date required', { status: 400 });
  }
  const templates = await loadTemplates();
  const session: Omit<RhaiSession, 'id'> = {
    client: body.client.trim(),
    ...(body.leadId?.trim() ? { leadId: body.leadId.trim() } : {}),
    ...(body.title?.trim() ? { title: body.title.trim() } : {}),
    date: body.date,
    ...(body.startTime ? { startTime: body.startTime } : {}),
    ...(body.endTime ? { endTime: body.endTime } : {}),
    ...(body.venue?.trim() ? { venue: body.venue.trim() } : {}),
    status: STATUSES.includes(body.status as SessionStatus) ? (body.status as SessionStatus) : 'confirmed',
    car: {
      status:
        body.car?.status === 'booked' || body.car?.status === 'not-needed' ? body.car.status : 'needed',
      ...(body.car?.notes ? { notes: body.car.notes } : {})
    },
    ...(body.outfitNote?.trim() ? { outfitNote: body.outfitNote.trim() } : {}),
    ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
    prep: cleanChecklist(body.prep) ?? seedChecklist(templates.prep),
    packing: cleanChecklist(body.packing) ?? seedChecklist(templates.packing),
    followUp: cleanChecklist(body.followUp) ?? seedChecklist(templates.followUp),
    createdAt: now,
    updatedAt: now
  };
  const ref = await adminDb().collection(COL_SESSIONS_LOGISTICS).add(session);
  return Response.json({ session: { id: ref.id, ...session } });
}

// PATCH {id, ...fields} — field updates incl. checklist state.
// PATCH {templates: {prep?, packing?, followUp?}} — edit the permanent templates.
export async function PATCH(req: NextRequest) {
  const { error } = await requireSessions(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as Partial<RhaiSession> & {
    id?: string;
    templates?: Partial<Templates>;
  };

  if (body.templates) {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const key of CHECKLIST_KEYS) {
      const list = body.templates[key];
      if (Array.isArray(list)) {
        patch[key] = list.map(t => String(t).slice(0, 300)).filter(Boolean).slice(0, 60);
      }
    }
    await adminDb().doc(TEMPLATES_DOC).set(patch, { merge: true });
    return Response.json({ ok: true });
  }

  if (!body.id) return new Response('id required', { status: 400 });
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of ['client', 'title', 'date', 'startTime', 'endTime', 'venue', 'notes', 'outfitNote', 'leadId'] as const) {
    if (typeof body[k] === 'string') patch[k] = body[k];
  }
  if (body.status && STATUSES.includes(body.status)) patch.status = body.status;
  if (body.car && typeof body.car === 'object') {
    patch.car = {
      status: ['not-needed', 'needed', 'booked'].includes(body.car.status) ? body.car.status : 'needed',
      ...(body.car.notes ? { notes: String(body.car.notes).slice(0, 500) } : {})
    };
  }
  for (const key of CHECKLIST_KEYS) {
    const list = cleanChecklist(body[key]);
    if (list) patch[key] = list;
  }
  await adminDb().collection(COL_SESSIONS_LOGISTICS).doc(body.id).set(patch, { merge: true });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireSessions(req);
  if (error) return error;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return new Response('id required', { status: 400 });
  await adminDb().collection(COL_SESSIONS_LOGISTICS).doc(body.id).delete();
  return Response.json({ ok: true });
}

function addDays(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`).getTime();
  return Number.isNaN(t) ? iso : new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}
