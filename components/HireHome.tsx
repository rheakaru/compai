'use client';

// Rhai Interviews — the generalized hiring product. Signed out: marketing +
// pricing. Signed in: company profile (text/voice, Rhai structures it) and
// the jobs list. Any Google account can use it — this is the self-serve
// product, not the operator dashboard.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useAuthedFetch } from './useAuthedFetch';
import { useVoice } from './useVoice';
import type { HireCompany, HireJob } from '@/lib/hire/types';

export function HireHome() {
  const { user, signIn, signOut } = useAuth();

  return (
    <main className="min-h-screen bg-cream text-ink-900">
      <header className="border-b border-ink-200/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-baseline gap-2 text-ink-900">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span className="font-display text-[17px] font-medium tracking-tight">Rhai</span>
            <span className="text-[13px] text-ink-400">Interviews</span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            {user ? (
              <>
                <span className="hidden text-ink-500 sm:inline">{user.email}</span>
                <button type="button" onClick={() => signOut()} className="text-ink-400 hover:text-ink-700">
                  sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => signIn().catch(() => undefined)}
                className="rounded-md bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent-600"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </header>

      {user ? <Dashboard /> : <Marketing onStart={() => signIn().catch(() => undefined)} />}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Marketing (signed out)
// ---------------------------------------------------------------------------

function Marketing({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <p className="eyebrow">Rhai Interviews</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            Every applicant interviewed. Every interview structured. Ranked before you wake up.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-700">
            Upload a job description. Rhai designs a structured first-round interview with you — you edit every
            question. Share one link; every candidate gets a real, consistent interview, and you get transcripts
            ranked for fit.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="mt-8 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-600"
          >
            Start free — first job on us →
          </button>
        </div>
      </section>

      <section className="border-b border-ink-200/60">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ['01 · Set up', 'Tell Rhai about your company (type or talk). Upload a JD — Rhai drafts a best-practice structured interview and asks what it still needs to know.'],
              ['02 · Make it yours', 'Edit, add, delete, and reorder every question. Chat with Rhai to refine — “add a question on managing juniors”, “make it shorter”.'],
              ['03 · Share one link', 'Candidates interview with Rhai any time of day. You see completed transcripts summarised, scored, and ranked — with filters for fit, rejected, and incomplete.']
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-ink-200 bg-white p-6">
                <p className="eyebrow text-accent">{t}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-5xl px-6 py-16">
          <p className="eyebrow">Pricing</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <p className="font-display text-2xl">Free</p>
              <p className="mt-1 text-sm text-ink-600">Your first job, up to 10 applications. No card needed.</p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <p className="font-display text-2xl">₹1,000 <span className="text-sm text-ink-400">/ job</span></p>
              <p className="mt-1 text-sm text-ink-600">Each additional role you open.</p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <p className="font-display text-2xl">₹3,000 – ₹5,000</p>
              <p className="mt-1 text-sm text-ink-600">Per job: up to 50 applications, or unlimited.</p>
            </div>
          </div>
          <p className="mt-6 text-xs text-ink-400">
            A product by <a href="/" className="text-accent hover:underline">Rhai</a> — Rhea Karuturi&apos;s AI practice.
          </p>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard (signed in): company profile + jobs
// ---------------------------------------------------------------------------

function Dashboard() {
  const authedFetch = useAuthedFetch();
  const [company, setCompany] = useState<HireCompany | null | 'none'>(null);

  useEffect(() => {
    (async () => {
      const res = await authedFetch('/api/hire/company');
      if (res.status === 404) setCompany('none');
      else if (res.ok) setCompany(((await res.json()) as { company: HireCompany }).company);
    })().catch(() => setCompany('none'));
  }, [authedFetch]);

  if (company === null)
    return <p className="mx-auto max-w-5xl px-6 py-16 text-sm text-ink-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <CompanyCard company={company === 'none' ? null : company} onSaved={setCompany} />
      {company !== 'none' && company && <JobsSection />}
    </div>
  );
}

function CompanyCard({ company, onSaved }: { company: HireCompany | null; onSaved: (c: HireCompany) => void }) {
  const authedFetch = useAuthedFetch();
  const [editing, setEditing] = useState(!company);
  const [name, setName] = useState(company?.name ?? '');
  const [website, setWebsite] = useState(company?.website ?? '');
  const [about, setAbout] = useState(company?.about ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const voice = useVoice(t => setAbout(prev => (prev ? `${prev} ${t}` : t)));

  useEffect(() => {
    if (company) {
      setName(company.name);
      setWebsite(company.website ?? '');
      setAbout(company.about);
    }
  }, [company]);

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const res = await authedFetch('/api/hire/company', {
        method: 'PUT',
        body: JSON.stringify({ name, website, about })
      });
      if (!res.ok) {
        setErr(await res.text());
        return;
      }
      onSaved(((await res.json()) as { company: HireCompany }).company);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing && company) {
    return (
      <div className="mb-8 rounded-lg border border-ink-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Your company</p>
            <h1 className="mt-1 font-display text-2xl tracking-tight">{company.name}</h1>
            {company.website && <p className="text-xs text-ink-400">{company.website}</p>}
          </div>
          <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50">
            Edit
          </button>
        </div>
        {company.profile && (
          <p className="mt-3 whitespace-pre-wrap rounded-md bg-cream-50 p-3 text-[13px] leading-relaxed text-ink-700">{company.profile}</p>
        )}
        {company.gaps && company.gaps.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Rhai would love to know</p>
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
              {company.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-amber-700">Edit the description above to add these — it makes every interview sharper.</p>
          </div>
        )}
      </div>
    );
  }

  const field = 'w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none';
  return (
    <div className="mb-8 rounded-lg border border-accent/30 bg-white p-5">
      <p className="eyebrow">{company ? 'Edit your company' : 'Set up your company'}</p>
      <p className="mt-1 text-sm text-ink-600">
        Rhai uses this in every interview — what you do, who you serve, how you work. Rough is fine; type or talk.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Company name *" className={field} />
        <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="Website (Rhai reads it)" className={field} />
      </div>
      <div className="relative mt-3">
        <textarea
          value={about}
          onChange={e => setAbout(e.target.value)}
          rows={5}
          placeholder="What does the company do? Products, customers, team size, stage, culture — a few honest paragraphs. *"
          className={`${field} resize-y`}
        />
        {voice.supported && (
          <button
            type="button"
            onClick={voice.toggle}
            className={`absolute bottom-2.5 right-2.5 rounded-full border px-2.5 py-1.5 text-sm ${
              voice.listening ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
            }`}
            title="Talk instead of typing"
          >
            {voice.listening ? '●' : '🎙'}
          </button>
        )}
      </div>
      {voice.error && <p className="mt-1 text-[11px] text-rose-600">{voice.error}</p>}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || !name.trim() || about.trim().length < 40}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50"
        >
          {saving ? 'Rhai is reading…' : company ? 'Save & re-structure' : 'Create company'}
        </button>
        {company && (
          <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-ink-200 px-4 py-2 text-sm text-ink-600 hover:bg-ink-50">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function JobsSection() {
  const authedFetch = useAuthedFetch();
  const { getToken } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<HireJob[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [jdText, setJdText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/api/hire/jobs');
    if (res.ok) setJobs(((await res.json()) as { jobs: HireJob[] }).jobs);
  }, [authedFetch]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const create = async () => {
    setErr(null);
    setBusy(true);
    try {
      const token = await getToken();
      const fd = new FormData();
      fd.append('title', title);
      if (jdText.trim()) fd.append('jdText', jdText);
      else if (file) fd.append('file', file);
      const res = await fetch('/api/hire/jobs', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: fd
      });
      if (!res.ok) {
        setErr(await res.text());
        return;
      }
      const { job } = (await res.json()) as { job: HireJob };
      router.push(`/hire/jobs/${job.id}`);
    } finally {
      setBusy(false);
    }
  };

  const statusChip = (j: HireJob) =>
    j.status === 'open'
      ? 'bg-emerald-50 text-emerald-700'
      : j.status === 'closed'
        ? 'bg-ink-100 text-ink-400'
        : 'bg-amber-50 text-amber-800';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">Your roles</p>
        <button
          type="button"
          onClick={() => setCreating(c => !c)}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600"
        >
          {creating ? 'Close' : '+ New role'}
        </button>
      </div>

      {creating && (
        <div className="mb-4 rounded-lg border border-accent/30 bg-white p-4">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Role title — e.g. Senior Backend Engineer *"
            className="w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none"
          />
          <textarea
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            rows={5}
            placeholder="Paste the job description here…"
            className="mt-2 w-full resize-y rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-ink-400 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-400">or</span>
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-md border border-ink-200 px-2.5 py-1 text-ink-600 hover:bg-ink-50">
              {file ? `📄 ${file.name}` : '↑ Upload JD (PDF / txt / md)'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/*"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={create}
              disabled={busy || !title.trim() || (!jdText.trim() && !file)}
              className="ml-auto rounded-md bg-accent px-4 py-1.5 font-medium text-white hover:bg-accent-600 disabled:opacity-50"
            >
              {busy ? 'Rhai is designing the interview…' : 'Create — Rhai drafts the interview →'}
            </button>
          </div>
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
        </div>
      )}

      {jobs === null ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-400">
          No roles yet — create one and Rhai will draft the interview from your JD. Your first job is free.
        </p>
      ) : (
        <div className="space-y-2">
          {jobs.map(j => (
            <Link
              key={j.id}
              href={`/hire/jobs/${j.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 hover:border-ink-300"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{j.title}</p>
                <p className="text-[11px] text-ink-400">
                  {j.questions.length} questions · {j.applicationsCount} application{j.applicationsCount === 1 ? '' : 's'}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusChip(j)}`}>
                {j.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
