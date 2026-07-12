import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { parseJsonLoose } from '@/lib/rhai/server';
import { extractText } from '@/lib/rhai/extract';
import { loadMyCompany, requireUser, runHire } from '@/lib/hire/server';
import { INTERVIEW_DESIGN_SYSTEM, sanitizeQuestions } from '@/lib/hire/questions';
import { COL_HIRE_JOBS, type HireJob, type HireQuestion } from '@/lib/hire/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_JD_CHARS = 20_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const snap = await adminDb().collection(COL_HIRE_JOBS).where('companyId', '==', user!.uid).get();
  const jobs = snap.docs
    .map(d => {
      const j = { id: d.id, ...(d.data() as Omit<HireJob, 'id'>) } as HireJob;
      // List view: drop heavy fields.
      return { ...j, jd: '', chat: undefined };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  return Response.json({ jobs });
}

// POST — create a job. multipart/form-data { title, file? , jdText? } or JSON
// { title, jdText }. Rhai reads the JD + company profile and drafts the
// interview script (best-practice structured interview) + its open questions.
export async function POST(req: NextRequest) {
  const { user, error } = await requireUser(req);
  if (error) return error;
  const company = await loadMyCompany(user!.uid);
  if (!company) return new Response('Create your company profile first.', { status: 400 });

  let title = '';
  let jd = '';
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    if (!form) return new Response('bad form', { status: 400 });
    title = String(form.get('title') ?? '').trim().slice(0, 140);
    jd = String(form.get('jdText') ?? '').trim();
    const file = form.get('file');
    if (!jd && file instanceof File) {
      if (file.size > MAX_FILE_BYTES) return new Response('file too large (max 15MB)', { status: 413 });
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        jd = await extractText(buffer, file.name, file.type || 'application/octet-stream');
      } catch {
        return new Response("Couldn't read that file — paste the JD as text instead.", { status: 400 });
      }
    }
  } else {
    const body = (await req.json().catch(() => ({}))) as { title?: string; jdText?: string };
    title = body.title?.trim().slice(0, 140) ?? '';
    jd = body.jdText?.trim() ?? '';
  }

  jd = jd.slice(0, MAX_JD_CHARS);
  if (!title) return new Response('Give the role a title.', { status: 400 });
  if (jd.length < 80)
    return new Response('The job description looks too thin — paste or upload the full JD.', { status: 400 });

  // Draft the interview script.
  let questions: HireQuestion[] = [];
  let gaps: string[] = [];
  try {
    const raw = await runHire({
      system: INTERVIEW_DESIGN_SYSTEM,
      user: [
        `COMPANY: ${company.name}`,
        `COMPANY BRIEF:\n${(company.profile || company.about).slice(0, 3000)}`,
        ``,
        `ROLE TITLE: ${title}`,
        `JOB DESCRIPTION:\n${jd.slice(0, 12_000)}`,
        ``,
        `Design the first-round screening interview. Return ONLY JSON:`,
        `{"questions": [{"text": "<the question, as the interviewer would say it>", "purpose": "<what it probes — for the hiring team only>", "kind": "logistics|experience|behavioral|role|culture|closing"}],`,
        ` "gaps": ["<up to 4 short questions for the HIRING TEAM about info you're missing (salary band? remote policy? seniority? team size?) that would make this interview sharper>"]}`
      ].join('\n'),
      maxTokens: 3000
    });
    const parsed = parseJsonLoose<{ questions?: Partial<HireQuestion>[]; gaps?: string[] }>(raw);
    questions = sanitizeQuestions(parsed.questions ?? []);
    gaps = (parsed.gaps ?? []).map(g => String(g).slice(0, 200)).slice(0, 4);
  } catch {
    // fail-soft: empty script; owner can generate via chat
  }
  if (questions.length === 0) {
    return new Response('Rhai could not draft the interview from this JD — try again.', { status: 502 });
  }

  const now = Date.now();
  const job: Omit<HireJob, 'id'> = {
    companyId: user!.uid,
    title,
    jd,
    questions,
    gaps,
    status: 'draft',
    paidJob: false,
    applicationTier: 'free',
    applicationsCount: 0,
    createdAt: now,
    updatedAt: now
  };
  const ref = await adminDb().collection(COL_HIRE_JOBS).add(job);
  return Response.json({ job: { id: ref.id, ...job } });
}
