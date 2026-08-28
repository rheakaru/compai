import { NextRequest } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { DOC_SKILLS, loadContextSections } from '@/lib/rhai/server';
import { DEFAULT_SKILLS, type RhaiSkill } from '@/lib/rhai/types';
import { effectiveStatus, type RhaiInvoice } from '@/lib/rhai/invoices';
import { COL_INVOICES } from '@/lib/rhai/invoice-server';
import {
  BILLING_LABELS,
  LIKELIHOOD_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  DEAD_STAGES,
  leadOrder,
  type LeadDocument,
  type LeadNoteSession,
  type WorkshopLead
} from '@/lib/leads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Rhai MCP server — lets Rhea query the dashboard from ANY Claude chat
// (claude.ai custom connector), and lets a Claude project chat sync its work
// back onto a lead. Streamable-HTTP MCP, stateless JSON mode: every request
// is one JSON-RPC POST; no sessions, no SSE, no state.
//
// SECURITY MODEL — capability URL:
//  - The route lives at /api/mcp/<token>. The token is a long random secret
//    (RHAI_MCP_TOKEN env). Anyone without it gets a 404 indistinguishable
//    from a missing route; comparison is timing-safe.
//  - This is operator-equivalent READ access to the pipeline plus a narrow,
//    append-only WRITE (note sessions + document records on a lead). It can't
//    delete anything, can't touch auth/config, can't run model calls.
//  - Rotate by setting a new secret and updating the connector URL once.
//  - Mint a token: openssl rand -hex 32
// ---------------------------------------------------------------------------

function authorized(token: string): boolean {
  const secret = process.env.RHAI_MCP_TOKEN;
  if (!secret || secret.length < 24) return false; // refuse weak/unset config
  // Hash both sides so lengths always match for timingSafeEqual.
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

async function loadLeads(): Promise<WorkshopLead[]> {
  const snap = await adminDb().collection('workshopLeads').get();
  return snap.docs.map(d => ({ ...(d.data() as Omit<WorkshopLead, 'id'>), id: d.id }));
}

/** Resolve a lead by id, or by case-insensitive substring on company/person. */
async function resolveLead(query: string): Promise<{ lead?: WorkshopLead; candidates?: WorkshopLead[] }> {
  const leads = await loadLeads();
  const byId = leads.find(l => l.id === query);
  if (byId) return { lead: byId };
  const q = query.trim().toLowerCase();
  const matches = leads.filter(
    l => l.company.toLowerCase().includes(q) || l.person.toLowerCase().includes(q)
  );
  if (matches.length === 1) return { lead: matches[0] };
  return { candidates: matches.length ? matches : leads };
}

function leadLine(l: WorkshopLead): string {
  const est = l.estimatedDays * l.dayRate;
  return [
    `- **${l.company}** (${l.person}) — ${STAGE_LABELS[l.stage]} · ${LIKELIHOOD_LABELS[l.likelihood]} · ${BILLING_LABELS[l.billing]}`,
    `  id: \`${l.id}\` · ${l.dateLabel || 'no date'} · est ${l.estimatedDays}d @ ${inr(l.dayRate)}/d = ${inr(est)}${l.paymentReceived ? ' · PAID' : ''}`,
    l.nextSteps ? `  next: ${l.nextSteps.slice(0, 200)}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

async function toolSetProjectPrice(args: {
  client?: string;
  total_price_inr?: number;
  estimated_days?: number;
}): Promise<string> {
  if (!args.client) return 'Error: pass { client, total_price_inr }';
  const total = Number(args.total_price_inr);
  if (!Number.isFinite(total) || total <= 0) {
    return 'Error: total_price_inr must be a positive rupee amount (e.g. 500000 for a ₹5,00,000 project).';
  }
  const { lead, candidates } = await resolveLead(args.client);
  if (!lead) {
    const names = (candidates ?? []).slice(0, 8).map(l => `${l.company} (id: ${l.id})`);
    return `Error: couldn't resolve "${args.client}". Did you mean one of:\n${names.join('\n') || '(no leads)'}`;
  }
  // The dashboard models value as estimatedDays × dayRate. Keep that shape so
  // the pipeline totals, proposals and invoices all stay consistent: hold the
  // days (given, else the lead's own, else 1) and back out the day rate so the
  // computed value equals the price asked for.
  const days = Math.max(1, Math.round(Number(args.estimated_days) || lead.estimatedDays || 1));
  const dayRate = Math.round(total / days);
  const before = (lead.estimatedDays || 0) * (lead.dayRate || 0);
  await adminDb().collection('workshopLeads').doc(lead.id).set(
    { estimatedDays: days, dayRate, updatedAt: Date.now() },
    { merge: true }
  );
  return [
    `Updated the price on **${lead.company}** (id: \`${lead.id}\`).`,
    `Was ${inr(before)} → now ${inr(days * dayRate)} (${days}d @ ${inr(dayRate)}/day).`,
    days === 1
      ? 'Recorded as a single-day engagement. Pass estimated_days if this should be spread over more days.'
      : ''
  ]
    .filter(Boolean)
    .join('\n');
}

async function toolPipelineOverview(): Promise<string> {
  const leads = await loadLeads();
  const sorted = [...leads].sort(
    (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || leadOrder(a) - leadOrder(b)
  );
  const active = sorted.filter(l => !DEAD_STAGES.includes(l.stage));
  const dead = sorted.filter(l => DEAD_STAGES.includes(l.stage));
  const banked = leads.filter(l => l.paymentReceived).reduce((s, l) => s + l.estimatedDays * l.dayRate, 0);
  const potential = active
    .filter(l => !l.paymentReceived)
    .reduce((s, l) => s + l.estimatedDays * l.dayRate, 0);

  return [
    `# Pipeline — ${active.length} active lead${active.length === 1 ? '' : 's'} (${dead.length} dead/cold)`,
    `Banked (paid): ${inr(banked)} · Open potential: ${inr(potential)} · Standard rate ${inr(100_000)}/day`,
    ``,
    ...active.map(leadLine),
    ...(dead.length ? ['', '## Dead / gone cold', ...dead.map(leadLine)] : []),
    ``,
    `Use get_client with an id or company name for full detail on any lead.`
  ].join('\n');
}

async function toolGetClient(args: { client?: string }): Promise<string> {
  if (!args.client) return 'Error: pass { client: "<lead id or company/person name>" }';
  const { lead, candidates } = await resolveLead(args.client);
  if (!lead)
    return `No single match for "${args.client}". Candidates:\n${(candidates ?? [])
      .map(l => `- ${l.company} (${l.person}) — id \`${l.id}\``)
      .join('\n')}`;

  const ref = adminDb().collection('workshopLeads').doc(lead.id);
  const [docsSnap, notesSnap, invSnap] = await Promise.all([
    ref.collection('documents').orderBy('createdAt', 'desc').limit(40).get(),
    ref.collection('noteSessions').orderBy('at', 'desc').limit(12).get(),
    adminDb().collection(COL_INVOICES).where('leadId', '==', lead.id).get()
  ]);
  const docs = docsSnap.docs.map(d => ({ ...(d.data() as Omit<LeadDocument, 'id'>), id: d.id }));
  const notes = notesSnap.docs.map(d => d.data() as LeadNoteSession);
  const invoices = invSnap.docs.map(d => ({ ...(d.data() as Omit<RhaiInvoice, 'id'>), id: d.id }));

  const c = lead.checklist as unknown as Record<string, unknown> | undefined;
  const checklistDone = c ? Object.entries(c).filter(([, v]) => v).map(([k]) => k) : [];

  return [
    `# ${lead.company} — ${lead.person}`,
    `Stage: ${STAGE_LABELS[lead.stage]} · ${LIKELIHOOD_LABELS[lead.likelihood]} · ${BILLING_LABELS[lead.billing]} · id \`${lead.id}\``,
    `Engagement: ${lead.dateLabel || 'no date yet'} · est ${lead.estimatedDays}d @ ${inr(lead.dayRate)}/d = ${inr(lead.estimatedDays * lead.dayRate)} · payment ${lead.paymentReceived ? 'RECEIVED' : 'not yet'}`,
    lead.workshopDate ? `Workshop date: ${lead.workshopDate}` : '',
    lead.nextSteps ? `Next steps: ${lead.nextSteps}` : '',
    checklistDone.length ? `Journey done: ${checklistDone.join(', ')}` : '',
    lead.jobConnect ? `Job-connect goal: yes${lead.jobConnectNotes ? ` — ${lead.jobConnectNotes}` : ''}` : '',
    lead.notes ? `Notes: ${lead.notes.slice(0, 500)}` : '',
    ``,
    lead.understanding
      ? `## Rhai's understanding (as of ${fmtDate(lead.understanding.updatedAt)})\n${lead.understanding.summary}\n${lead.understanding.bullets.map(b => `- ${b}`).join('\n')}`
      : '',
    lead.smartNotes ? `## Live notes (latest)\n${lead.smartNotes.slice(-3000)}` : '',
    ``,
    `## Documents (${docs.length})`,
    docs.length
      ? docs
          .map(
            d =>
              `- \`${d.id}\` **${d.name}** — ${d.origin}/${d.kind} · ${fmtDate(d.docDate ?? d.createdAt)}${d.text ? ` · ${d.text.length} chars` : ''}`
          )
          .join('\n')
      : 'none',
    ``,
    `## Note sessions (latest ${notes.length})`,
    notes.length
      ? notes
          .map(n => `- ${fmtDate(n.at)} · ${n.label || n.source}: ${n.text.slice(0, 300).replace(/\n+/g, ' ')}${n.text.length > 300 ? '…' : ''}`)
          .join('\n')
      : 'none',
    ``,
    `## Invoices (${invoices.length})`,
    invoices.length
      ? invoices
          .map(
            i =>
              `- ${i.invoiceNumber} · ${i.currency} ${i.amount.toLocaleString('en-IN')} · ${effectiveStatus(i, Date.now())} · issued ${i.issueDate}${i.paidDate ? ` · paid ${i.paidDate}` : ''}`
          )
          .join('\n')
      : 'none',
    ``,
    `Full text of any document: get_document { client: "${lead.id}", document_id: "<id>" }`
  ]
    .filter(s => s !== '')
    .join('\n');
}

async function toolGetDocument(args: { client?: string; document_id?: string }): Promise<string> {
  if (!args.client || !args.document_id) return 'Error: pass { client, document_id }';
  const { lead } = await resolveLead(args.client);
  if (!lead) return `No single lead match for "${args.client}" — use get_client to find the id.`;
  const snap = await adminDb()
    .collection('workshopLeads')
    .doc(lead.id)
    .collection('documents')
    .doc(args.document_id)
    .get();
  if (!snap.exists) return `No document ${args.document_id} on ${lead.company}.`;
  const d = snap.data() as LeadDocument;
  return [
    `# ${d.name}`,
    `${d.origin}/${d.kind} · ${fmtDate(d.docDate ?? d.createdAt)} · lead: ${lead.company}`,
    ``,
    (d.text || '(no extracted text)').slice(0, 60_000)
  ].join('\n');
}

async function toolListInvoices(): Promise<string> {
  const snap = await adminDb().collection(COL_INVOICES).orderBy('createdAt', 'desc').get();
  const invoices = snap.docs.map(d => ({ ...(d.data() as Omit<RhaiInvoice, 'id'>), id: d.id }));
  const now = Date.now();
  const by = (s: string) => invoices.filter(i => effectiveStatus(i, now) === s);
  const sum = (list: RhaiInvoice[]) =>
    list.filter(i => i.currency === 'INR').reduce((s, i) => s + i.amount, 0);
  return [
    `# Invoices — ${invoices.length} total`,
    `Paid: ${by('paid').length} (${inr(sum(by('paid') as RhaiInvoice[]))}) · Sent: ${by('sent').length} (${inr(sum(by('sent') as RhaiInvoice[]))}) · Overdue: ${by('overdue').length} (${inr(sum(by('overdue') as RhaiInvoice[]))}) · Draft: ${by('draft').length}`,
    ``,
    ...invoices.map(
      i =>
        `- ${i.invoiceNumber} · **${i.client}**${i.leadLabel ? ` (${i.leadLabel})` : ''} · ${i.currency} ${i.amount.toLocaleString('en-IN')} · ${effectiveStatus(i, now)} · issued ${i.issueDate}${i.dueDate ? ` · due ${i.dueDate}` : ''}${i.paidDate ? ` · paid ${i.paidDate}` : ''}`
    )
  ].join('\n');
}

async function toolListSkills(): Promise<string> {
  const snap = await adminDb().doc(DOC_SKILLS).get();
  const skills = snap.exists ? ((snap.data()?.skills ?? []) as RhaiSkill[]) : DEFAULT_SKILLS;
  const enabled = skills.filter(s => s.enabled !== false);
  return [
    `# Skills Rhea offers / runs (${enabled.length})`,
    ...enabled.map(s => `- **${s.name}**${s.stage ? ` [${s.stage}]` : ''} — ${s.description}`)
  ].join('\n');
}

async function toolBusinessContext(args: { section_id?: string }): Promise<string> {
  const sections = await loadContextSections();
  if (args.section_id) {
    const s = sections.find(x => x.id === args.section_id);
    if (!s) return `No context section "${args.section_id}". Available: ${sections.map(x => x.id).join(', ')}`;
    return `# ${s.title || s.id}\n\n${s.body.slice(0, 40_000)}`;
  }
  return [
    `# Business context vault — ${sections.length} sections`,
    `(Pass { section_id } for any section's full text.)`,
    ``,
    ...sections.map(s => `## ${s.title || s.id} (\`${s.id}\`)\n${(s.digest || s.body.slice(0, 400)).trim()}`)
  ].join('\n\n');
}

interface SyncDoc {
  name?: string;
  kind?: string;
  url?: string;
  note?: string;
}

async function toolSyncClientContext(args: {
  client?: string;
  summary?: string;
  label?: string;
  documents?: SyncDoc[];
  next_steps?: string;
}): Promise<string> {
  if (!args.client || !args.summary?.trim())
    return 'Error: pass { client, summary } — summary is the markdown recap of the work done in this Claude project.';
  const { lead, candidates } = await resolveLead(args.client);
  if (!lead)
    return `No single match for "${args.client}". Candidates:\n${(candidates ?? [])
      .map(l => `- ${l.company} (${l.person}) — id \`${l.id}\``)
      .join('\n')}\nCall again with the exact id.`;

  const db = adminDb();
  const ref = db.collection('workshopLeads').doc(lead.id);
  const now = Date.now();

  // 1. The summary lands as its own note session — the event-log home for
  //    "what happened with this client", visible in the lead workspace.
  const session: Omit<LeadNoteSession, 'id'> = {
    text: args.summary.trim().slice(0, 20_000),
    source: 'claude-sync',
    label:
      args.label?.trim().slice(0, 120) ||
      `Claude project sync — ${new Date(now).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
    at: now
  };
  await ref.collection('noteSessions').add(session);

  // 2. Each produced doc is recorded by name/link (not re-uploaded). Same-name
  //    records update in place so re-syncing stays idempotent.
  // Normalize the kind onto the deal-timeline vocabulary where recognizable —
  // 'proposal' / 'nda' / 'nda-signed' drive the Docs page milestone tracker.
  const normalizeDocKind = (kind: string | undefined, name: string): string => {
    const k = (kind ?? '').trim().toLowerCase();
    const n = name.toLowerCase();
    if (k.includes('nda') || /(^|[^a-z])nda([^a-z]|$)/.test(n)) {
      return k.includes('signed') || n.includes('signed') ? 'nda-signed' : 'nda';
    }
    if (k.includes('proposal') || k.includes('scope') || k.includes('costing') || n.includes('proposal') || n.includes('scope'))
      return 'proposal';
    return k.slice(0, 60) || 'claude-project';
  };

  const docs = (args.documents ?? []).filter(d => d?.name?.trim()).slice(0, 25);
  let docsAdded = 0;
  let docsUpdated = 0;
  for (const d of docs) {
    const name = d.name!.trim().slice(0, 200);
    const text = [
      `Produced in the Claude project chat for ${lead.company}.`,
      d.url ? `Link: ${d.url.trim().slice(0, 500)}` : '',
      d.note ? `\n${d.note.trim().slice(0, 2000)}` : ''
    ]
      .filter(Boolean)
      .join('\n');
    const existing = await ref.collection('documents').where('name', '==', name).limit(1).get();
    if (!existing.empty) {
      await existing.docs[0].ref.set({ text, updatedAt: now }, { merge: true });
      docsUpdated++;
    } else {
      const doc: Omit<LeadDocument, 'id'> = {
        name,
        origin: 'generated',
        kind: normalizeDocKind(d.kind, name),
        text,
        createdAt: now,
        updatedAt: now
      };
      await ref.collection('documents').add(doc);
      docsAdded++;
    }
  }

  // 3. Optional pipeline nudge + freshness stamp.
  const patch: Record<string, unknown> = { updatedAt: now };
  if (args.next_steps?.trim()) patch.nextSteps = args.next_steps.trim().slice(0, 1000);
  await ref.set(patch, { merge: true });

  return [
    `Synced to **${lead.company}** (\`${lead.id}\`):`,
    `- note session "${session.label}" added (${session.text.length} chars)`,
    docs.length ? `- documents: ${docsAdded} added, ${docsUpdated} updated (${docs.map(d => d.name).join(', ')})` : '- no documents listed',
    args.next_steps?.trim() ? `- next steps updated` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, never>) => Promise<string>;
}

const TOOLS: ToolDef[] = [
  {
    name: 'pipeline_overview',
    description:
      "Rhea's full workshop-leads pipeline: every lead with stage, likelihood, billing, estimated revenue, and next steps, plus banked/potential totals. Start here for business planning.",
    inputSchema: { type: 'object', properties: {} },
    run: () => toolPipelineOverview()
  },
  {
    name: 'get_client',
    description:
      'Everything on one client/lead: understanding, live notes, note sessions, documents (proposals, NDAs, briefs — listed with ids), invoices, journey checklist, next steps.',
    inputSchema: {
      type: 'object',
      properties: { client: { type: 'string', description: 'Lead id, or company/person name (substring ok)' } },
      required: ['client']
    },
    run: a => toolGetClient(a)
  },
  {
    name: 'get_document',
    description: 'Full text of one document attached to a lead (proposal, NDA, uploaded brief…). Get ids from get_client.',
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'Lead id or name' },
        document_id: { type: 'string', description: 'Document id from get_client' }
      },
      required: ['client', 'document_id']
    },
    run: a => toolGetDocument(a)
  },
  {
    name: 'list_invoices',
    description: 'All invoices across clients with paid/sent/overdue/draft status and INR totals.',
    inputSchema: { type: 'object', properties: {} },
    run: () => toolListInvoices()
  },
  {
    name: 'list_skills',
    description: "The registry of skills/services Rhea offers and runs her practice with (deck assembly, proposals, NDAs, dashboards…).",
    inputSchema: { type: 'object', properties: {} },
    run: () => toolListSkills()
  },
  {
    name: 'get_business_context',
    description:
      "Rhea's business context vault — who she is, how the practice runs, pricing, positioning. Without args: all section digests. With section_id: that section's full text.",
    inputSchema: {
      type: 'object',
      properties: { section_id: { type: 'string', description: 'Optional — a section id from the digest listing' } }
    },
    run: a => toolBusinessContext(a)
  },
  {
    name: 'set_project_price',
    description:
      "Change the price/value of a client's project (lead) in the Rhai dashboard. Use when Rhea says to reprice a deal — e.g. \"set Halol to 5 lakhs\", \"the Dodla workshop is now ₹3,00,000\", \"quote them for 3 days\". Give total_price_inr as the whole rupee amount (500000 = ₹5,00,000). The dashboard stores value as days × day-rate, so it keeps the lead's existing day count (or estimated_days if you pass it) and adjusts the rate to match. This moves pipeline totals and flows into proposals/invoices, so confirm the amount with Rhea before calling.",
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'Lead id, or company/person name (substring ok)' },
        total_price_inr: {
          type: 'number',
          description: 'The whole project price in rupees. 500000 = ₹5,00,000. This becomes the lead value.'
        },
        estimated_days: {
          type: 'number',
          description: 'Optional. Number of engagement days to spread the price across. Defaults to the lead\'s current day count, or 1.'
        }
      },
      required: ['client', 'total_price_inr']
    },
    run: a => toolSetProjectPrice(a)
  },
  {
    name: 'sync_client_context',
    description:
      'Write-back from a Claude chat to the Rhai dashboard: append a summarized recap of the work done for a client onto their lead (as a note session), record documents produced by name/link (not re-uploaded), and optionally update next steps. Idempotent per document name. CALL THIS PROACTIVELY whenever you create or materially revise a document (proposal, deck, brief, NDA, research note, artifact) for a specific client in this conversation — do not wait to be asked; the dashboard is the system of record and unsynced work is invisible to it. One call at the end of the work session covering everything produced is ideal.',
    inputSchema: {
      type: 'object',
      properties: {
        client: { type: 'string', description: 'Lead id or company name' },
        summary: {
          type: 'string',
          description:
            'Markdown recap of the project work: what was discussed/produced, decisions made, current state. This becomes a note session on the lead.'
        },
        label: { type: 'string', description: 'Optional session label, e.g. "Proposal drafting — Claude project"' },
        documents: {
          type: 'array',
          description: 'Documents produced or referenced in the project chat, captured by name (+ link if published).',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              kind: {
                type: 'string',
                description:
                  'Doc type. Use the canonical values where they fit — "proposal", "nda", "nda-signed" (these drive the deal timeline on the Docs page) — else freeform: deck, research, one-pager, brief, invoice.'
              },
              url: { type: 'string', description: 'Public/share link if one exists' },
              note: { type: 'string', description: 'One-line status, e.g. "sent to client 24 Jul"' }
            },
            required: ['name']
          }
        },
        next_steps: { type: 'string', description: 'Optional — replaces the lead\'s next-steps line' }
      },
      required: ['client', 'summary']
    },
    run: a => toolSyncClientContext(a)
  }
];

// ---------------------------------------------------------------------------
// MCP protocol (Streamable HTTP, stateless JSON responses)
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

async function handleRpc(msg: JsonRpcRequest): Promise<Record<string, unknown> | null> {
  const { id, method, params } = msg;

  // Notifications (no id) get no response body.
  if (id === undefined || id === null) return null;

  const reply = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });

  switch (method) {
    case 'initialize': {
      const requested = String((params?.protocolVersion as string) ?? '');
      return reply({
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'rhai-dashboard', version: '1.0.0' }
      });
    }
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({
        tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
      });
    case 'tools/call': {
      const name = String(params?.name ?? '');
      const tool = TOOLS.find(t => t.name === name);
      if (!tool) return fail(-32602, `unknown tool: ${name}`);
      try {
        const text = await tool.run((params?.arguments ?? {}) as Record<string, never>);
        return reply({ content: [{ type: 'text', text }], isError: text.startsWith('Error:') });
      } catch (e) {
        return reply({
          content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : 'tool failed'}` }],
          isError: true
        });
      }
    }
    case 'resources/list':
      return reply({ resources: [] });
    case 'prompts/list':
      return reply({ prompts: [] });
    default:
      return fail(-32601, `method not found: ${method}`);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!authorized(token)) return new Response('not found', { status: 404 });

  const body = (await req.json().catch(() => null)) as JsonRpcRequest | JsonRpcRequest[] | null;
  if (!body) return new Response('invalid JSON', { status: 400 });

  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map(handleRpc))).filter(Boolean);
    if (!replies.length) return new Response(null, { status: 202 });
    return Response.json(replies);
  }

  const res = await handleRpc(body);
  if (!res) return new Response(null, { status: 202 });
  return Response.json(res);
}

// Clients probing for an SSE stream: we're stateless JSON-only, which the
// Streamable HTTP spec allows a server to signal with 405 on GET.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!authorized(token)) return new Response('not found', { status: 404 });
  return new Response('method not allowed', { status: 405 });
}

export async function DELETE() {
  return new Response(null, { status: 202 });
}
