import type { TourStep } from './Tour';

/**
 * Onboarding tour for anyone who lands on /leads for the first time — built
 * for Yeshoda joining the practice, but useful anytime we bring someone in.
 * Auto-launches once per user (localStorage sentinel); the "Take the tour"
 * pill in the workspace header replays it on demand.
 *
 * Each step anchors to a DOM element by data-tour attribute — see the tabs
 * and the briefing strip. Empty selector = centred welcome/closing card.
 */
export const RHAI_TOUR_STEPS: TourStep[] = [
  {
    selector: '',
    title: 'Meet Rhai, your AI cofounder',
    body: (
      <>
        <p>
          This dashboard isn&apos;t just a leads tracker — it&apos;s where Rhea and{' '}
          <strong>Rhai</strong> (Rhea + AI, get it) run the consultancy together.
        </p>
        <p className="mt-2">
          Rhai reads the notes, researches people, drafts emails, prepares decks, and files
          suggestions — but nothing goes out to a client without Rhea&apos;s approval.
          Draft-only autonomy is the rule.
        </p>
        <p className="mt-2 text-[11px] text-ink-500">
          You&apos;ll click through a few quick steps. Use ← → to navigate, Esc to skip.
        </p>
      </>
    )
  },
  {
    selector: '[data-tour="briefing"]',
    title: 'The morning briefing',
    body: (
      <>
        <p>
          When you open the dashboard each day, Rhai reads the whole pipeline, the smart
          notes, and the parked ideas and proposes the 4-8 highest-leverage moves for the
          day.
        </p>
        <p className="mt-2">
          It auto-runs once per day (never twice — saves API credits) and caches. Hit{' '}
          <em>↻ Refresh</em> to force a rerun.
        </p>
      </>
    ),
    placement: 'bottom'
  },
  {
    selector: '[data-tour="tab-pipeline"]',
    title: 'Pipeline — the leads',
    body: (
      <>
        <p>
          Every lead is a card. The colored left border shows heat (red = hot, amber =
          warm). Click <strong>↗</strong> on any card to open its full workspace.
        </p>
        <p className="mt-2">
          The <strong>ⓘ</strong> next to a name opens Rhai&apos;s profile for that person —
          researched summary, connection map, intel log.
        </p>
      </>
    ),
    placement: 'bottom'
  },
  {
    selector: '[data-tour="tab-plan"]',
    title: 'Plan — today, this week, parked ideas',
    body: (
      <>
        <p>
          All the planning surfaces in one place. <strong>Today</strong> is Rhai&apos;s
          suggested moves — approve to queue for execution, dismiss what doesn&apos;t fit —
          plus the <strong>Quick to-dos</strong> box for fast capture. <strong>This
          week</strong> holds everyone&apos;s weekly plan.
        </p>
        <p className="mt-2">
          <strong>Parked ideas</strong> is Rhai&apos;s scratchpad: park a rough thought,
          Rhai researches it, and <em>Promote to lead</em> lands the whole thread on the
          pipeline.
        </p>
      </>
    ),
    placement: 'bottom'
  },
  {
    selector: '[data-tour="tab-tasks"]',
    title: 'Tasks — work assigned to Rhai',
    body: (
      <>
        <p>
          Give Rhai work here — research a company, draft a proposal, prep session notes.
          Link a client and their full context (notes, understanding, meeting history) rides
          along automatically.
        </p>
        <p className="mt-2">
          Tasks run in parallel; results come back inline. Research task results also flow
          back into that client&apos;s notes.
        </p>
      </>
    ),
    placement: 'bottom'
  },
  {
    selector: '[data-tour="tab-people"]',
    title: 'People — the directory',
    body: (
      <>
        <p>
          88 people from the Hang w AI community pre-loaded, plus everyone Rhai has met
          since. Click any person → drawer with Rhai&apos;s profile, your notes, the intel
          log, and their <strong>connection map</strong> (who introduced them, mutuals).
        </p>
        <p className="mt-2">
          &ldquo;<em>Rhai, research them</em>&rdquo; web-searches and builds a profile — or
          asks you for their LinkedIn if it can&apos;t confidently identify them. The{' '}
          <strong>Voices</strong> and <strong>Party</strong> sections here hold the
          testimonials and the launch-party guest list.
        </p>
      </>
    ),
    placement: 'bottom'
  },
  {
    selector: '[data-tour="tab-plumbing"]',
    title: 'Plumbing — Rhai&apos;s brain & skills',
    body: (
      <>
        <p>
          The plumbing for Rhai. <strong>Context</strong> is what Rhai always knows:
          Rhea&apos;s background, networks, teaching modules, the Hoovu demo library,
          projects Rhea&apos;s built, community directory.
        </p>
        <p className="mt-2">
          Green &ldquo;Always loaded&rdquo; sections ride in every prompt. Indigo &ldquo;On
          demand&rdquo; sections are big reference docs — Rhai reads a short index card of
          each and pulls the full text only when a task needs it. <strong>Skills</strong>{' '}
          is the registry of what Rhai can reach for, each with a default model.
        </p>
      </>
    ),
    placement: 'bottom'
  },
  {
    selector: '[data-tour="chat-fab"]',
    title: 'The standing chat',
    body: (
      <>
        <p>
          The <strong>R·</strong> button (bottom-right, on every tab) opens your standing
          conversation with Rhai. Text or voice. It <em>never disappears</em> — the whole
          history is saved forever.
        </p>
        <p className="mt-2">
          Tell it anything — &ldquo;met Kartekeya at YPO, wants a demo dashboard&rdquo; —
          and it routes to the right place: updates his people profile, files a suggestion
          on Today. It shows you what it did as ✓ notes in the thread.
        </p>
      </>
    ),
    placement: 'left'
  },
  {
    selector: '[data-tour="nav-clients"]',
    title: 'Clients — get up to speed fast',
    body: (
      <>
        <p>
          <strong>Clients</strong> is a focused walkthrough of the companies we&apos;re actually working with right
          now — not the whole noisy leads list. Each one shows where it stands, recent calls and documents, and a link
          to the full page.
        </p>
        <p className="mt-2">Built for getting someone new up to speed.</p>
      </>
    ),
    placement: 'bottom'
  },
  {
    selector: '[data-tour="nav-content"]',
    title: 'Content — the social calendar',
    body: (
      <>
        <p>
          <strong>Content</strong> is a drag-and-drop calendar. Drag pieces from the bank onto dates or between dates,
          mark them posted, write the caption, and set who&apos;s giving the idea and who&apos;s posting.
        </p>
        <p className="mt-2">It autosaves, so the whole team sees the same plan.</p>
      </>
    ),
    placement: 'bottom'
  },
  {
    selector: '[data-tour="nav-resources"]',
    title: 'Resources — how we write & sell',
    body: (
      <>
        <p>
          <strong>Resources</strong> holds the team learning library — the communication standards, the sales
          playbook, the sales motion, and a curated watch &amp; read list. Read these before writing to a client or
          taking a call.
        </p>
        <p className="mt-2 text-[11px] text-ink-500">
          New teammates get all of this, plus a guided orientation, at their own onboarding link.
        </p>
      </>
    ),
    placement: 'bottom'
  },
  {
    selector: '',
    title: 'That&apos;s it — welcome',
    body: (
      <>
        <p>
          The whole platform is designed so information moves freely between pages —
          ideas, people, leads, tasks, chat all feed the same intelligence, and Rhai
          notices when something is ready to act on.
        </p>
        <p className="mt-2">
          You can replay this tour anytime with the <strong>Take the tour</strong> pill at
          the top-right of the workspace. Have fun.
        </p>
      </>
    )
  }
];
