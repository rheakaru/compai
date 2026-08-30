import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

// The team content calendar — pieces of content that can be dragged onto dates,
// a bank of ready content not yet scheduled, mark-as-posted, and captions +
// role assignment (who's the idea owner, who posts). Persisted whole at
// rhaiConfig/contentCalendar. Seeded once from the existing calendar + the
// ready pieces so the team starts from where they already are.

export const CONTENT_CAL_DOC = 'rhaiConfig/contentCalendar';

export type ContentType = 'post' | 'reel' | 'story' | 'testimonial';
export type ContentStatus = 'planned' | 'posted';

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  /** YYYY-MM-DD, or null when it's sitting in the bank (unscheduled). */
  date: string | null;
  status: ContentStatus;
  caption: string;
  /** Who's giving the idea (Shriya / Rhea / Yeshoda). */
  owner: string;
  /** Who's posting it (Disha / Shriya). */
  poster: string;
  notes: string;
}

export interface ContentCalendar {
  items: ContentItem[];
  updatedAt: number;
}

// A post + its next-day story repost, on consecutive dates.
function post(id: string, date: string, title: string, caption = '', type: ContentType = 'post'): ContentItem[] {
  return [{ id, title, type, date, status: 'planned', caption, owner: '', poster: '', notes: '' }];
}

// The existing schedule (Aug–Oct 2026). Past dates seed as already posted.
const TODAY = '2026-08-30';
const RAW: Array<{ id: string; date: string; title: string; type: ContentType; caption?: string }> = [
  { id: 's3', date: '2026-08-18', title: 'Script 3 — "We\'re firing you from your second job" (Kasper, colourful dress)', type: 'post' },
  { id: 's3r', date: '2026-08-19', title: 'Story repost — Script 3', type: 'story' },
  { id: 's6', date: '2026-08-21', title: 'Script 6 — "Humans serving AI needs to swap" (shirt/pant, front room)', type: 'post' },
  { id: 's6r', date: '2026-08-22', title: 'Story repost — Script 6', type: 'story' },
  { id: 'dodla', date: '2026-08-24', title: 'Come with me to Dodla Dairy', type: 'post' },
  { id: 'dodlar', date: '2026-08-25', title: 'Story repost — Dodla Dairy', type: 'story' },
  { id: 'tShiv', date: '2026-08-26', title: 'Testimonial: Shiv (story)', type: 'testimonial' },
  { id: 's4', date: '2026-08-27', title: 'Script 4 — "AI is cheap — $60"', type: 'post' },
  { id: 's4r', date: '2026-08-28', title: 'Story repost — Script 4', type: 'story' },
  { id: 'cahoots', date: '2026-08-30', title: 'App reel: CAHOOTS', type: 'reel', caption: 'Comment "plot" and I\'ll send you the link.\nMost apps assume you\'re doing this alone. This one assumes you\'re not.\nfollow @heyrhai for more updates.' },
  { id: 'cahootsr', date: '2026-08-31', title: 'Story repost — CAHOOTS', type: 'story' },
  { id: 's16', date: '2026-09-02', title: 'Script 16 — "If everyone can build it, what\'s left"', type: 'post' },
  { id: 's16r', date: '2026-09-03', title: 'Story repost — Script 16', type: 'story' },
  { id: 'chapel', date: '2026-09-05', title: 'App reel: CHAPEL', type: 'reel', caption: 'Comment "chapel" and I\'ll send you the link.\nYour notes app has never once asked what a piece of art meant to you. This one does, then remembers.\nfollow @heyrhai for more updates.' },
  { id: 'chapelr', date: '2026-09-06', title: 'Story repost — CHAPEL', type: 'story' },
  { id: 's2', date: '2026-09-08', title: 'Script 2 — "How do we get people to use it" (desk, red dress)', type: 'post' },
  { id: 's2r', date: '2026-09-09', title: 'Story repost — Script 2', type: 'story' },
  { id: 'brief', date: '2026-09-11', title: 'App reel: THE BRIEF', type: 'reel', caption: 'Comment "brief" and I\'ll send you the link.\nThe news industry\'s whole business model is your anxiety. We built the opposite of that.\nfollow @heyrhai for more updates.' },
  { id: 'briefr', date: '2026-09-12', title: 'Story repost — THE BRIEF', type: 'story' },
  { id: 's11', date: '2026-09-14', title: 'Script 11 — "What a company actually is"', type: 'post' },
  { id: 's11r', date: '2026-09-15', title: 'Story repost — Script 11', type: 'story' },
  { id: 'tAnanya', date: '2026-09-16', title: 'Testimonial: Ananya (story)', type: 'testimonial' },
  { id: 'comprice', date: '2026-09-17', title: 'App reel: COMPRICE', type: 'reel', caption: 'Comment "mandi" and I\'ll send you the link.\nFarmers and traders have been pricing crops on rumours and phone calls for decades. Turns out the data was public the whole time.\nfollow @heyrhai for more updates.' },
  { id: 'compricer', date: '2026-09-18', title: 'Story repost — COMPRICE', type: 'story' },
  { id: 's10', date: '2026-09-20', title: 'Script 10 — "From structure to reasoning" (blue shirt)', type: 'post' },
  { id: 's10r', date: '2026-09-21', title: 'Story repost — Script 10', type: 'story' },
  { id: 'vanaja', date: '2026-09-23', title: 'App reel: VANAJA', type: 'reel' },
  { id: 'vanajar', date: '2026-09-24', title: 'Story repost — VANAJA', type: 'story' },
  { id: 's17', date: '2026-09-26', title: 'Script 17 — "Typing in English is a class barrier"', type: 'post' },
  { id: 's17r', date: '2026-09-27', title: 'Story repost — Script 17', type: 'story' },
  { id: 'hoovu', date: '2026-09-29', title: 'App reel: HOOVU', type: 'reel' },
  { id: 'hoovur', date: '2026-09-30', title: 'Story repost — HOOVU', type: 'story' },
  { id: 's8', date: '2026-10-02', title: 'Script 8 — "You already know how to do this" (shirt/pant, front room)', type: 'post' },
  { id: 's8r', date: '2026-10-03', title: 'Story repost — Script 8', type: 'story' },
  { id: 'agent', date: '2026-10-05', title: 'App reel: THE AGENT FIELD GUIDE', type: 'reel' },
  { id: 'agentr', date: '2026-10-06', title: 'Story repost — THE AGENT FIELD GUIDE', type: 'story' },
  { id: 's5', date: '2026-10-08', title: 'Script 5 — "I build dashboards for a living"', type: 'post' },
  { id: 's5r', date: '2026-10-09', title: 'Story repost — Script 5', type: 'story' },
  { id: 'vendetta', date: '2026-10-11', title: 'App reel: VENDETTA', type: 'reel' },
  { id: 'vendettar', date: '2026-10-12', title: 'Story repost — VENDETTA', type: 'story' },
  { id: 's15', date: '2026-10-14', title: 'Script 15 — "But what happens to our data"', type: 'post' },
  { id: 's15r', date: '2026-10-15', title: 'Story repost — Script 15', type: 'story' },
  { id: 'throughline', date: '2026-10-17', title: 'App reel: THROUGHLINE', type: 'reel' },
  { id: 'throughliner', date: '2026-10-18', title: 'Story repost — THROUGHLINE', type: 'story' },
  { id: 'pelli', date: '2026-10-20', title: 'App reel: PELLI', type: 'reel' },
  { id: 'pellir', date: '2026-10-21', title: 'Story repost — PELLI', type: 'story' }
];

// A couple of ready pieces still sitting in the bank, unscheduled.
const BANK: ContentItem[] = [
  { id: 'bankVanajaCap', title: 'App reel: VANAJA (caption to write)', type: 'reel', date: null, status: 'planned', caption: '', owner: '', poster: '', notes: 'Needs a caption in the "comment X / one-line / follow" format.' },
  { id: 'bankSpareTestimonial', title: 'New testimonial video (unassigned)', type: 'testimonial', date: null, status: 'planned', caption: '', owner: '', poster: '', notes: 'Each testimonial: 24h after posting, reposted to the Rhai story.' }
];

export function seedCalendar(): ContentItem[] {
  const scheduled: ContentItem[] = RAW.map(r => ({
    id: r.id,
    title: r.title,
    type: r.type,
    date: r.date,
    status: r.date < TODAY ? 'posted' : 'planned',
    caption: r.caption ?? '',
    owner: '',
    poster: '',
    notes: ''
  }));
  return [...scheduled, ...BANK];
}

export async function loadContentCalendar(): Promise<ContentCalendar> {
  const snap = await adminDb().doc(CONTENT_CAL_DOC).get();
  const d = snap.data() as ContentCalendar | undefined;
  if (d && Array.isArray(d.items) && d.items.length) return d;
  // First load: seed and persist so edits stick from here.
  const seeded = { items: seedCalendar(), updatedAt: Date.now() };
  await adminDb().doc(CONTENT_CAL_DOC).set(seeded);
  return seeded;
}

export async function saveContentCalendar(items: ContentItem[]): Promise<void> {
  const clean = items.slice(0, 1000).map(i => ({
    id: String(i.id).slice(0, 60),
    title: String(i.title || '').slice(0, 300),
    type: (['post', 'reel', 'story', 'testimonial'].includes(i.type) ? i.type : 'post') as ContentType,
    date: i.date && /^\d{4}-\d{2}-\d{2}$/.test(i.date) ? i.date : null,
    status: (i.status === 'posted' ? 'posted' : 'planned') as ContentStatus,
    caption: String(i.caption || '').slice(0, 3000),
    owner: String(i.owner || '').slice(0, 60),
    poster: String(i.poster || '').slice(0, 60),
    notes: String(i.notes || '').slice(0, 1000)
  }));
  await adminDb().doc(CONTENT_CAL_DOC).set({ items: clean, updatedAt: Date.now() });
}
