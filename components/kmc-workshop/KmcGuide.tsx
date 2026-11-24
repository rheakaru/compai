'use client';

// /kmc-workshop — the public walk-through for KMC Constructions' heads of
// department. Download the interview → open Claude → attach it → say the
// phrase → answer → refine the live preview → email Rhea three files.
// Same shape and drawn-in-CSS "screens" as components/cos-workshop/WorkshopGuide.

import { useState } from 'react';

// Must match KMC_FILE_NAME in lib/kmc-workshop/files.ts (not imported, so the
// 43KB document stays out of the client bundle).
const KMC_FILE_NAME = 'KMC_Rhai_Dashboard_Interview.md';
const DOWNLOAD_HREF = '/api/kmc-workshop/file';
const START_PHRASE = 'Start my dashboard interview';
const PROJECT_NAME = 'My KMC Dashboard';
const EMAIL = 'rhea@heyrhai.com';
const OUTPUTS = [
  { name: 'KMC_Needfinding_<Department>_<YourName>.md', what: 'your answers about how your work runs today' },
  { name: 'KMC_PageSpec_<Department>_<YourName>.md', what: 'the build instructions for your page' },
  { name: 'KMC_Preview_<Department>_<YourName>.html', what: 'the preview you approved (opens in any browser)' }
];

export function KmcGuide() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:pt-14">
      <p className="eyebrow">Rhai × KMC · Workshop</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">Design your dashboard page.</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-600">
        Claude interviews you about how your department runs, then builds a live preview of the dashboard page you
        wish you had. You shape it until it feels right, and send the result to Rhea so she can build it for real.
      </p>

      <div className="mt-6 rounded-lg border border-accent/40 bg-white p-4">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-400">The interview</p>
        <p className="mt-1 break-all font-mono text-[13px] text-ink-900">{KMC_FILE_NAME}</p>
        <p className="mt-1.5 text-[13px] leading-snug text-ink-600">
          The only file you need. You give it to Claude, and Claude runs the whole interview from it.
        </p>
        <DownloadButton className="mt-3" />
      </div>

      <div className="mt-5 rounded-md border border-ink-100 bg-cream-50 p-4 text-[13px] leading-relaxed text-ink-600">
        <span className="font-medium text-ink-800">Before you start:</span> it takes about <b>40–60 minutes</b>. You can
        stop any time and pick it up later in the same chat. A laptop is best, because you&apos;ll see a live preview of
        your page.
      </div>

      <Step n={1} title="Download the interview">
        <p>
          Tap <b>Download</b> above. The file lands in your Downloads folder. No need to open it; it&apos;s written for
          Claude, not for you.
        </p>
      </Step>

      <Step n={2} title="Open Claude">
        <p>
          Go to{' '}
          <a href="https://claude.ai" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
            claude.ai
          </a>{' '}
          or open the Claude app. If you can pick a model, choose <b>Opus</b> (otherwise Sonnet is fine).
        </p>
        <ScreenModel />
      </Step>

      <Step n={3} title="Start a new chat (or a project)">
        <p>
          A plain new chat works. Better still: find <b>Projects</b> in the left sidebar, click <b>New project</b>, and
          call it <b>{PROJECT_NAME}</b>. Then start a chat inside it.
        </p>
        <ScreenNewProject />
      </Step>

      <Step n={4} title="Attach the file and say the magic words">
        <p>
          In the chat box, click <b>+</b> (or the paperclip), attach <b>{KMC_FILE_NAME}</b>, and type:
        </p>
        <Phrase text={START_PHRASE} />
        <ScreenChat />
      </Step>

      <Step n={5} title="Answer one question at a time">
        <p>
          Claude asks one short question at a time about your work: what you track, where it lives, what goes wrong.
          Answer in your own words. You can say <i>skip</i>, <i>not sure</i>, or <i>come back to this</i> whenever you
          like.
        </p>
        <Tips
          items={[
            'Rough answers are fine. Real examples (a real site, a real delay) help most.',
            'Use the mic button if your Claude app has one. Talking is faster than typing.',
            'Need a break? Leave the chat and come back to the same chat later. It picks up where you stopped.'
          ]}
        />
      </Step>

      <Step n={6} title="Shape the preview of your page">
        <p>
          Near the end, Claude builds a <b>preview of your dashboard page</b> right in the chat. Tell it what to change:
          &ldquo;put pending approvals at the top&rdquo;, &ldquo;show this by site&rdquo;, &ldquo;make it simpler&rdquo;. Keep
          going until you&apos;re happy.
        </p>
        <ScreenPreview />
      </Step>

      <Step n={7} title="Email Rhea your three files">
        <p>Claude finishes by giving you three files. Download all three:</p>
        <ul className="space-y-2">
          {OUTPUTS.map(o => (
            <li key={o.name} className="rounded-md border border-ink-200 bg-white px-3 py-2">
              <span className="block break-all font-mono text-[12px] text-ink-900">{o.name}</span>
              <span className="text-[13px] text-ink-600">{o.what}</span>
            </li>
          ))}
        </ul>
        <p>Then email all three to Rhea, ideally the same day:</p>
        <EmailBox />
      </Step>

      <p className="mt-12 text-center text-xs text-ink-400">
        Screens are drawn to show roughly where things are; Claude&apos;s own layout may look a little different.
      </p>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
function DownloadButton({ className = '' }: { className?: string }) {
  return (
    <a
      href={DOWNLOAD_HREF}
      download={KMC_FILE_NAME}
      className={`inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600 ${className}`}
    >
      ↓ Download the interview
    </a>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 flex gap-3 sm:gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 font-mono text-sm text-white">{n}</div>
      <div className="min-w-0 flex-1 space-y-3 text-[15px] leading-relaxed text-ink-700">
        <h2 className="pt-0.5 font-display text-xl tracking-tight text-ink-900">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return { copied, copy };
}

function Phrase({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex items-center gap-2 rounded-md border border-ink-200 bg-white p-2 pl-3">
      <code className="min-w-0 flex-1 break-words font-mono text-[13px] text-ink-900">{text}</code>
      <button
        type="button"
        onClick={() => copy(text)}
        className="shrink-0 rounded border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:border-ink-400"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function EmailBox() {
  const { copied, copy } = useCopy();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/40 bg-white p-3">
      <a href={`mailto:${EMAIL}?subject=${encodeURIComponent('My KMC dashboard files')}`} className="min-w-0 flex-1 break-all font-mono text-[15px] text-accent underline underline-offset-2">
        {EMAIL}
      </a>
      <button
        type="button"
        onClick={() => copy(EMAIL)}
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
function Screen({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-lg border border-ink-200 bg-[#faf9f5] shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-ink-200 bg-white/60 px-3 py-2">
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

function ScreenModel() {
  return (
    <Screen caption="The model picker sits by the chat box: choose Opus if it's there">
      <div className="space-y-2">
        <div className="text-center font-display text-[14px] text-ink-900">How can I help you today?</div>
        <div className="rounded-lg border border-ink-200 bg-white p-2">
          <div className="h-5 text-ink-400">Reply…</div>
          <div className="flex items-center justify-between pt-1">
            <span className="px-1 text-[13px] text-ink-500">+</span>
            <Hl className="bg-white px-1.5 py-0.5 text-[11px] text-ink-800">Opus ▾</Hl>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function ScreenNewProject() {
  return (
    <Screen caption={`Optional: Projects → New project → "${PROJECT_NAME}"`}>
      <div className="flex gap-3">
        <div className="w-[34%] space-y-2 border-r border-ink-200 pr-2 text-ink-600">
          <div className="text-ink-400">+ New chat</div>
          <div>Chats</div>
          <Hl className="block bg-white px-1.5 py-0.5 font-medium text-ink-900">Projects</Hl>
          <div className="pt-2 text-[10px] text-ink-400">Recents</div>
          <Bar w="w-full" />
          <Bar w="w-3/4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="font-display text-[14px] text-ink-900">Create a project</div>
          <div className="text-ink-500">What are you working on?</div>
          <Hl className="block border border-ink-300 bg-white px-2 py-1.5 text-ink-900">{PROJECT_NAME}</Hl>
          <div className="flex justify-end pt-1">
            <Hl className="bg-ink-900 px-2 py-1 text-white">Create project</Hl>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function ScreenChat() {
  return (
    <Screen caption="Attach the file, send the phrase, and the interview begins">
      <div className="space-y-2">
        <div className="ml-auto w-fit max-w-[85%] space-y-1 rounded-lg bg-[#efe9dc] px-2.5 py-1.5 text-ink-900">
          <div className="w-fit break-all rounded border border-ink-300 bg-white px-1.5 py-0.5 font-mono text-[10px]">📄 {KMC_FILE_NAME}</div>
          <div>{START_PHRASE}</div>
        </div>
        <div className="max-w-[90%] space-y-1 text-ink-700">
          <p>Hi! I&apos;ll ask you about how your work runs, one question at a time, then we&apos;ll design your page together…</p>
          <p>First: what&apos;s your name, and which department are you in?</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-ink-400">Reply…</div>
      </div>
    </Screen>
  );
}

function ScreenPreview() {
  return (
    <Screen caption="The preview appears in the chat. Ask for changes until it's right">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="space-y-2 sm:w-[40%]">
          <div className="ml-auto w-fit max-w-[95%] rounded-lg bg-[#efe9dc] px-2.5 py-1.5 text-ink-900">
            Put pending approvals at the top, and show them by site
          </div>
          <div className="text-ink-700">Done. Approvals are now first, grouped by site.</div>
        </div>
        <Hl className="block min-w-0 flex-1 border border-ink-200 bg-white p-2">
          <div className="flex items-center justify-between">
            <span className="font-display text-[13px] text-ink-900">Projects · this week</span>
            <span className="font-mono text-[9px] text-ink-400">preview</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {['Approvals', 'At risk', 'On track'].map((t, i) => (
              <div key={t} className="rounded border border-ink-200 p-1.5">
                <div className="text-[9px] text-ink-400">{t}</div>
                <div className={`font-display text-[14px] ${i === 0 ? 'text-accent' : 'text-ink-900'}`}>{[7, 2, 11][i]}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1.5">
            <Bar w="w-full" />
            <Bar w="w-5/6" />
            <Bar w="w-2/3" />
          </div>
        </Hl>
      </div>
    </Screen>
  );
}
