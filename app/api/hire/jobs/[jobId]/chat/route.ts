import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { parseJsonLoose } from '@/lib/rhai/server';
import { loadMyCompany, loadOwnedJob, requireUser, runHire } from '@/lib/hire/server';
import { INTERVIEW_DESIGN_SYSTEM, sanitizeQuestions } from '@/lib/hire/questions';
import { COL_HIRE_JOBS, type HireQuestion } from '@/lib/hire/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Q_MARKER = '---QUESTIONS---';

// Collaborate with Rhai on the interview script. The owner chats ("add a
// question about managing junior devs", "make it shorter", "here's the salary
// band: 12-15 LPA"); Rhai replies, updates the full question list when asked,
// and keeps its list of gaps (missing info) current. Answers to gaps get
// folded into the JD context so the interviewer knows them.
export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const { jobId } = await ctx.params;
  const owned = await loadOwnedJob(user!.uid, jobId);
  if (owned.error) return owned.error;
  const job = owned.job!;
  const company = await loadMyCompany(user!.uid);

  const message = ((await req.json().catch(() => ({}))) as { message?: string }).message?.trim().slice(0, 3000);
  if (!message) return new Response('expected { message }', { status: 400 });

  const priorChat = (job.chat ?? [])
    .slice(-8)
    .map(m => `${m.role === 'rhai' ? 'RHAI' : 'OWNER'}: ${m.text}`)
    .join('\n');

  const raw = await runHire({
    system: INTERVIEW_DESIGN_SYSTEM,
    maxTokens: 3000,
    user: [
      `You're collaborating with the hiring team on the interview script for "${job.title}" at ${company?.name ?? 'their company'}.`,
      `COMPANY BRIEF:\n${(company?.profile || company?.about || '').slice(0, 2500)}`,
      `JOB DESCRIPTION:\n${job.jd.slice(0, 8000)}`,
      `CURRENT QUESTION SCRIPT (in order):\n${job.questions.map((q, i) => `${i + 1}. [${q.kind}] ${q.text}${q.purpose ? ` — purpose: ${q.purpose}` : ''}`).join('\n')}`,
      job.gaps?.length ? `YOUR OPEN QUESTIONS FOR THE TEAM (gaps):\n${job.gaps.map(g => `- ${g}`).join('\n')}` : '',
      priorChat ? `\nEARLIER IN THIS CHAT:\n${priorChat}` : '',
      ``,
      `THE HIRING TEAM NOW SAYS:\n${message}`,
      ``,
      `RESPOND IN THIS EXACT SHAPE:`,
      `- A brief conversational reply (1-3 sentences). If their message ANSWERED one of your gaps, acknowledge it. If you still lack info that matters, ask for it here.`,
      `- If (and only if) the script should change, a line containing ONLY "${Q_MARKER}", then ONLY JSON: {"questions":[{"id":"<keep existing ids for kept questions>","text":"…","purpose":"…","kind":"logistics|experience|behavioral|role|culture|closing"}], "gaps":["<your remaining open questions — drop answered ones>"], "context":"<OPTIONAL one-line fact worth remembering for the interviewer, e.g. 'Salary band: 12-15 LPA', or omit>"}`,
      `The questions array is the COMPLETE new script in order.`
    ]
      .filter(Boolean)
      .join('\n')
  });

  const idx = raw.indexOf(Q_MARKER);
  let reply = (idx === -1 ? raw : raw.slice(0, idx)).trim();
  let questions: HireQuestion[] | undefined;
  let gaps: string[] | undefined;
  let extraContext: string | undefined;
  if (idx !== -1) {
    try {
      const parsed = parseJsonLoose<{ questions?: Partial<HireQuestion>[]; gaps?: string[]; context?: string }>(
        raw.slice(idx + Q_MARKER.length)
      );
      if (Array.isArray(parsed.questions)) {
        const qs = sanitizeQuestions(parsed.questions);
        if (qs.length >= 3) questions = qs;
      }
      if (Array.isArray(parsed.gaps)) gaps = parsed.gaps.map(g => String(g).slice(0, 200)).slice(0, 6);
      if (parsed.context && typeof parsed.context === 'string') extraContext = parsed.context.slice(0, 300);
    } catch {
      // keep reply; script unchanged
    }
  }
  if (!reply) reply = questions ? 'Updated the script above.' : '…';

  const now = Date.now();
  const chat = [
    ...(job.chat ?? []),
    { role: 'user' as const, text: message, at: now },
    { role: 'rhai' as const, text: reply, at: now }
  ].slice(-30);

  const update: Record<string, unknown> = { chat, updatedAt: now };
  if (questions) update.questions = questions;
  if (gaps) update.gaps = gaps;
  // Facts the owner supplied (salary band, remote policy…) get appended to the
  // JD context so the candidate-facing interviewer can answer honestly.
  if (extraContext) update.jd = `${job.jd}\n\n[Hiring team note: ${extraContext}]`.slice(0, 22_000);

  await adminDb().collection(COL_HIRE_JOBS).doc(jobId).set(update, { merge: true });
  return Response.json({
    reply,
    questions: questions ?? null,
    gaps: gaps ?? null
  });
}
