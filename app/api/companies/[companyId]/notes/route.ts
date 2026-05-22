import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { getUserFromAuthHeader } from '@/lib/firebase/auth-server';
import { getOrCreateSessionId } from '@/lib/firebase/session';
import { loadCompanyForAccess } from '@/lib/model/access';
import { consumeEdit, editLockedResponse } from '@/lib/limits/edits';
import { logFunnelEvent } from '@/lib/funnel/events';
import type { CompanyStack, Suite } from '@/lib/model/stack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const StackInput = z.object({
  erp: z.string().max(200).optional(),
  accounting: z.string().max(200).optional(),
  suite: z.string().max(200).optional(),
  suiteOther: z.string().max(200).optional(),
  meetings: z.string().max(200).optional(),
  transcriber: z.string().max(200).optional(),
  messaging: z.string().max(200).optional(),
  operatingFiles: z.string().max(2000).optional()
});

const Body = z.object({
  userNotes: z.string().max(8000).optional(),
  stack: StackInput.optional()
});

const KNOWN_SUITES: Suite[] = ['google_workspace', 'microsoft_365', 'zoho', 'other', 'none'];

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ companyId: string }> }
) {
  const sessionId = await getOrCreateSessionId();
  const user = await getUserFromAuthHeader(req.headers.get('authorization'));
  if (!user) return json({ error: 'auth_required' }, 401);
  const { companyId } = await ctx.params;

  const access = await loadCompanyForAccess({
    companyId,
    uid: user.uid,
    sessionId
  });
  if (!access) return json({ error: 'company not found' }, 404);
  if (!access.canEdit) return json({ error: 'forbidden' }, 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad request' }, 400);

  // Only consume an edit if there's something to save.
  const hasNotes = typeof parsed.data.userNotes === 'string';
  const hasStack = !!parsed.data.stack;
  if (!hasNotes && !hasStack) {
    return json({ ok: true, noop: true });
  }

  const edit = await consumeEdit(companyId);
  if (!edit.ok) return editLockedResponse(edit.state);

  const update: Record<string, unknown> = {};
  if (hasNotes) update.userNotes = parsed.data.userNotes;
  if (hasStack) {
    // Merge with whatever stack is already there so partial saves don't wipe
    // earlier fields.
    const existing = (await adminDb()
      .collection('companies')
      .doc(companyId)
      .get()).data() as { stack?: CompanyStack } | undefined;
    const prev: Partial<CompanyStack> = existing?.stack ?? {};
    const s = parsed.data.stack!;
    const suiteVal = (KNOWN_SUITES as string[]).includes(s.suite ?? '')
      ? (s.suite as Suite)
      : (prev.suite ?? 'none');
    const next: CompanyStack = {
      erp: s.erp ?? prev.erp ?? '',
      accounting: s.accounting ?? prev.accounting ?? '',
      suite: suiteVal,
      suiteOther: s.suiteOther ?? prev.suiteOther ?? '',
      meetings: s.meetings ?? prev.meetings ?? '',
      transcriber: s.transcriber ?? prev.transcriber ?? '',
      messaging: s.messaging ?? prev.messaging ?? '',
      operatingFiles: s.operatingFiles ?? prev.operatingFiles ?? '',
      notes: prev.notes ?? '',
      extraDetail: prev.extraDetail ?? '',
      submittedAt: Date.now()
    };
    update.stack = next;
  }

  await adminDb().collection('companies').doc(companyId).set(update, { merge: true });

  if (hasStack) {
    void logFunnelEvent({
      sessionId,
      ownerUid: user.uid,
      companyId,
      companyUrl: access.company.url,
      stage: 'stack_submitted',
      meta: {
        source: 'diagnosis',
        fields: Object.keys(parsed.data.stack ?? {}).filter(
          k => (parsed.data.stack as Record<string, string | undefined>)[k]
        )
      }
    });
  }

  return json({ ok: true, editState: edit.state });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
