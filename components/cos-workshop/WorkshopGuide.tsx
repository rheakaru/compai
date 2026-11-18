'use client';

// /chief-of-staff-workshop — the self-serve path. Email in (no account), then
// a numbered walk-through: download the setup guide → make a Claude project →
// add the guide → start the setup chat → export → hand it to Claude Code.
// The "screens" are drawn in CSS, not screenshots, so they stay legible on a
// phone and don't go stale pixel-for-pixel; each is captioned as approximate.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SETUP = 'CHIEF_OF_STAFF_SETUP.md';
const MIGRATION = 'CLAUDE_CODE_MIGRATION.md';
const SETUP_PHRASE = 'Start my chief of staff setup';
const EXPORT_PHRASE = 'Export my chief of staff';
const CODE_PHRASE = 'Read CLAUDE_CODE_MIGRATION.md and start the migration.';

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------
export function WorkshopGate() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/cos-workshop/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email })
    }).catch(() => null);
    if (res?.ok) {
      router.refresh();
      return;
    }
    setError((await res?.text().catch(() => '')) || 'Something went wrong. Try again.');
    setBusy(false);
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:py-20">
      <form onSubmit={submit} className="rounded-lg border border-ink-200 bg-white p-6 sm:p-8">
        <p className="eyebrow">Rhai workshop</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">Build your own chief of staff.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
          Two guides and a step-by-step walk-through. You&apos;ll set up an AI chief of staff inside Claude in about an
          hour, then (when you&apos;re ready) move it to Claude Code so it can live on WhatsApp.
        </p>
        <label htmlFor="ws-email" className="mt-6 block font-mono text-xs text-ink-500">
          Your email
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="ws-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="min-w-0 flex-1 rounded-md border border-ink-200 bg-white px-3 py-3 text-[15px] text-ink-900 outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
          >
            {busy ? 'Opening…' : 'Get the guides →'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        <p className="mt-4 text-xs text-ink-400">No password or account. Just so we know who came.</p>
      </form>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Guide
// ---------------------------------------------------------------------------
export function WorkshopGuide({ email }: { email: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:pt-14">
      <p className="eyebrow">Rhai workshop · Chief of Staff</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">Build your own chief of staff.</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600">
        Part one happens in a Claude project: it interviews you, connects your tools, and builds your chief of staff.
        Part two (later, when you&apos;re happy with it) moves it to Claude Code so it runs on its own and talks to you
        on WhatsApp.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <FileCard
          name={SETUP}
          label="Guide 1 · Setup"
          blurb="Goes into your Claude project. Runs the interview and builds your chief of staff."
          primary
        />
        <FileCard
          name={MIGRATION}
          label="Guide 2 · Claude Code"
          blurb="For later. Packages your chief of staff for Claude Code, AWS and WhatsApp."
        />
      </div>

      <div className="mt-5 rounded-md border border-ink-100 bg-cream-50 p-4 text-[13px] leading-relaxed text-ink-600">
        <span className="font-medium text-ink-800">Before you start:</span> use Claude on a laptop at{' '}
        <a href="https://claude.ai" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
          claude.ai
        </a>{' '}
        or the Claude desktop app, on a paid plan (Pro or above). The setup takes 45–60 minutes and you can stop and
        pick it up any time.
      </div>

      <Part label="Part one" title="Set it up in Claude" />

      <Step n={1} title="Download the setup guide">
        <p>
          Tap <b>{SETUP}</b> above. It lands in your Downloads folder. Don&apos;t open or edit it; it&apos;s written
          for Claude, not for you.
        </p>
      </Step>

      <Step n={2} title="Create a new project in Claude">
        <p>
          Open Claude and find <b>Projects</b> in the left sidebar. Click <b>New project</b> (top right), call it{' '}
          <b>Chief of Staff</b>, and create it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ScreenProjectsList />
          <ScreenNewProject />
        </div>
      </Step>

      <Step n={3} title="Add the setup guide to the project">
        <p>
          Inside the project, look for the project&apos;s files or knowledge panel (on the right on a laptop). Click{' '}
          <b>+</b>, choose upload from your device, and pick <b>{SETUP}</b>.
        </p>
        <p className="text-ink-500">
          Paste nothing into the project&apos;s instructions box yet. Claude writes those for you at the end of setup.
        </p>
        <ScreenProjectKnowledge />
      </Step>

      <Step n={4} title="Start a new chat and say the magic words">
        <p>Start a new chat inside the project (the chat box on the project page) and type:</p>
        <Phrase text={SETUP_PHRASE} />
        <p>
          It then interviews you one question at a time. You can say <i>skip</i>, <i>not sure</i>, or <i>come back to
          this</i> whenever you like. Need a break? Close it, come back, and say <b>resume setup</b>.
        </p>
        <ScreenChat />
        <Tips
          items={[
            'When it asks to connect Gmail, Calendar or Drive, say yes. It reads instead of making you type.',
            'Answer by voice if your Claude app has a mic button. Rambling is fine.',
            'At the end it gives you instructions to paste into the project settings. Do that, then test it: "prep me for my next meeting".'
          ]}
        />
      </Step>

      <Part label="Part two · later" title="Move it to Claude Code (for WhatsApp)" />

      <Step n={5} title="When you're happy with it, export it">
        <p>
          Download <b>{MIGRATION}</b>, go back to your Chief of Staff project, attach the file in the same chat, and
          type:
        </p>
        <Phrase text={EXPORT_PHRASE} />
        <p>
          Claude gives you back one file, <b>cos-export.md</b>, holding your whole chief of staff: its instructions,
          skills, schedules and connectors. Download it.
        </p>
        <div className="flex flex-wrap gap-2">
          <DownloadButton name={MIGRATION} />
        </div>
        <ScreenExport />
      </Step>

      <Step n={6} title="Hand both files to Claude Code">
        <p>
          Make an empty folder on your computer and put <b>cos-export.md</b> and <b>{MIGRATION}</b> in it. Open Claude
          Code in that folder and type:
        </p>
        <Phrase text={CODE_PHRASE} />
        <p>
          It walks you through the rest one step at a time and checks with you before anything that costs money.
          You&apos;ll need an AWS account, an Anthropic API key (billed separately from your Claude plan), and a phone
          number for WhatsApp Business.
        </p>
        <ScreenTerminal />
      </Step>

      <p className="mt-12 text-center text-xs text-ink-400">
        Signed in as {email}. Screens are drawn to show roughly where things are; Claude&apos;s own layout may look a
        little different.
      </p>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
function FileCard({ name, label, blurb, primary }: { name: string; label: string; blurb: string; primary?: boolean }) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${primary ? 'border-accent/40' : 'border-ink-200'}`}>
      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-1 break-all font-mono text-[13px] text-ink-900">{name}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-ink-600">{blurb}</p>
      <DownloadButton name={name} primary={primary} className="mt-3" />
    </div>
  );
}

function DownloadButton({ name, primary, className = '' }: { name: string; primary?: boolean; className?: string }) {
  return (
    <a
      href={`/api/cos-workshop/file/${name}`}
      download={name}
      className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium ${
        primary ? 'bg-accent text-white hover:bg-accent-600' : 'border border-ink-200 bg-white text-ink-800 hover:border-ink-400'
      } ${className}`}
    >
      ↓ Download {name}
    </a>
  );
}

function Part({ label, title }: { label: string; title: string }) {
  return (
    <div className="mt-14 border-t border-ink-200 pt-6">
      <p className="font-mono text-[11px] uppercase tracking-wider text-accent">{label}</p>
      <h2 className="mt-1 font-display text-2xl tracking-tight text-ink-900">{title}</h2>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 font-mono text-sm text-white">{n}</div>
      <div className="min-w-0 flex-1 space-y-3 text-[15px] leading-relaxed text-ink-700">
        <h3 className="pt-0.5 font-display text-xl tracking-tight text-ink-900">{title}</h3>
        {children}
      </div>
    </section>
  );
}

function Phrase({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-ink-200 bg-white p-2 pl-3">
      <code className="min-w-0 flex-1 break-words font-mono text-[13px] text-ink-900">{text}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="shrink-0 rounded border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:border-ink-400"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Tips({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 rounded-md border border-ink-100 bg-cream-50 p-3 text-[13px] text-ink-600">
      {items.map(t => (
        <li key={t} className="flex gap-2">
          <span className="text-accent">●</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Drawn "screens"
// ---------------------------------------------------------------------------
function Screen({ caption, children, dark }: { caption: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <figure className="m-0">
      <div className={`overflow-hidden rounded-lg border shadow-sm ${dark ? 'border-ink-800 bg-[#1f1e1b]' : 'border-ink-200 bg-[#faf9f5]'}`}>
        <div className={`flex items-center gap-1.5 border-b px-3 py-2 ${dark ? 'border-ink-800' : 'border-ink-200 bg-white/60'}`}>
          <span className="h-2 w-2 rounded-full bg-ink-300" />
          <span className="h-2 w-2 rounded-full bg-ink-300" />
          <span className="h-2 w-2 rounded-full bg-ink-300" />
        </div>
        <div className="p-3 text-[12px] leading-snug">{children}</div>
      </div>
      <figcaption className="mt-1.5 text-[12px] text-ink-400">{caption}</figcaption>
    </figure>
  );
}

function Hl({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded ring-2 ring-accent ring-offset-2 ring-offset-[#faf9f5] ${className}`}>{children}</span>;
}

function Bar({ w }: { w: string }) {
  return <div className={`h-2 rounded bg-ink-200 ${w}`} />;
}

function ScreenProjectsList() {
  return (
    <Screen caption="Projects in the sidebar → New project">
      <div className="flex gap-3">
        <div className="w-[34%] space-y-2 border-r border-ink-200 pr-2 text-ink-600">
          <div className="text-ink-400">+ New chat</div>
          <div>Chats</div>
          <Hl className="block bg-white px-1.5 py-0.5 font-medium text-ink-900">Projects</Hl>
          <div className="pt-2 text-[10px] text-ink-400">Recents</div>
          <Bar w="w-full" />
          <Bar w="w-3/4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-display text-[14px] text-ink-900">Projects</span>
            <Hl className="bg-ink-900 px-2 py-1 text-[11px] text-white">+ New project</Hl>
          </div>
          <div className="mt-3 space-y-2">
            <div className="rounded border border-ink-200 bg-white p-2">
              <Bar w="w-2/3" />
              <div className="mt-1.5">
                <Bar w="w-1/2" />
              </div>
            </div>
            <div className="rounded border border-ink-200 bg-white p-2">
              <Bar w="w-1/2" />
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function ScreenNewProject() {
  return (
    <Screen caption="Name it Chief of Staff and create it">
      <div className="mx-auto max-w-[95%] space-y-2 py-1">
        <div className="font-display text-[14px] text-ink-900">Create a personal project</div>
        <div className="text-ink-500">What are you working on?</div>
        <Hl className="block border border-ink-300 bg-white px-2 py-1.5 text-ink-900">Chief of Staff</Hl>
        <div className="pt-1 text-ink-500">What are you trying to achieve?</div>
        <div className="h-8 rounded border border-ink-200 bg-white" />
        <div className="flex justify-end gap-2 pt-1">
          <span className="px-2 py-1 text-ink-500">Cancel</span>
          <Hl className="bg-ink-900 px-2 py-1 text-white">Create project</Hl>
        </div>
      </div>
    </Screen>
  );
}

function ScreenProjectKnowledge() {
  return (
    <Screen caption="Project page: the files panel is on the right. + → upload from device">
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <div className="font-display text-[14px] text-ink-900">Chief of Staff</div>
          <div className="rounded-lg border border-ink-200 bg-white p-2 text-ink-400">How can I help you today?</div>
          <div className="pt-1 text-[10px] text-ink-400">Chats in this project</div>
          <div className="text-ink-400">Start a chat to keep conversations organised…</div>
        </div>
        <div className="w-[42%] space-y-2 rounded-md border border-ink-200 bg-white p-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink-800">Files</span>
            <Hl className="px-1.5 text-[13px] text-ink-900">+</Hl>
          </div>
          <div className="text-[10px] text-ink-400">Instructions · leave for now</div>
          <div className="rounded border border-accent/40 bg-cream-50 px-2 py-1.5 font-mono text-[10px] text-ink-800">
            📄 CHIEF_OF_STAFF_SETUP.md
          </div>
        </div>
      </div>
    </Screen>
  );
}

function ScreenChat() {
  return (
    <Screen caption="A new chat inside the project">
      <div className="space-y-2">
        <div className="ml-auto w-fit max-w-[80%] rounded-lg bg-[#efe9dc] px-2.5 py-1.5 text-ink-900">{SETUP_PHRASE}</div>
        <div className="max-w-[90%] space-y-1 text-ink-700">
          <p>Hi! Here&apos;s how this works: first I&apos;ll show you what I already know about you, then a short interview…</p>
          <p className="font-mono text-[10px] text-ink-400">Part 1 of 7 · Q1</p>
          <p>Your name, your role, and your company? One line is fine.</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-ink-400">Reply…</div>
      </div>
    </Screen>
  );
}

function ScreenExport() {
  return (
    <Screen caption="Same project chat: attach the migration guide, ask for the export">
      <div className="space-y-2">
        <div className="ml-auto w-fit max-w-[85%] space-y-1 rounded-lg bg-[#efe9dc] px-2.5 py-1.5 text-ink-900">
          <div className="w-fit rounded border border-ink-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">📄 {MIGRATION}</div>
          <div>{EXPORT_PHRASE}</div>
        </div>
        <div className="text-ink-700">Here&apos;s your export. Give this file and the migration guide to Claude Code.</div>
        <Hl className="inline-flex items-center gap-2 border border-ink-200 bg-white px-2 py-1.5 font-mono text-[10px] text-ink-900">
          📄 cos-export.md <span className="text-accent">↓</span>
        </Hl>
      </div>
    </Screen>
  );
}

function ScreenTerminal() {
  return (
    <Screen caption="Claude Code, opened in your new folder" dark>
      <div className="space-y-1 font-mono text-[11px] text-[#d8d4c8]">
        <div className="text-[#8f8a7c]">~/chief-of-staff $ ls</div>
        <div>cos-export.md  CLAUDE_CODE_MIGRATION.md</div>
        <div className="text-[#8f8a7c]">~/chief-of-staff $ claude</div>
        <div className="mt-2 rounded border border-[#3a3833] px-2 py-1.5">
          <span className="text-[#e07a52]">&gt;</span> {CODE_PHRASE}
        </div>
        <div className="pt-1 text-[#8f8a7c]">Unpacking 9 files… Found 3 skills, 2 schedules. First question: do you have an AWS account?</div>
      </div>
    </Screen>
  );
}
