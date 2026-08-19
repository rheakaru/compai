import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireOperator } from '@/lib/rhai/server';
import { sendWhatsAppText } from '@/lib/rhai/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Daily session-reminder sweep (scheduled ~08:00 IST). For every confirmed
// upcoming session it nudges Rhea on WhatsApp at:
//   T-5 → data connection / additional discovery check
//   T-3 → send the 3-days-before reminder to participants (+ Claude/GitHub setup)
//   T-1 → day-before reminder + confirm screens/table/laptops with the host,
//         and flag the car if it still isn't booked
// At T-1 an in-person session also posts a car call-out into the team group
// (WHATSAPP_TEAM_GROUP_ID) with the pickup time, so whoever books it sees it a
// full day ahead rather than on the morning.
// Each nudge also lands in rhaiTodos (WhatsApp free-form messages only
// deliver inside Meta's 24h window, so the todo is the reliable copy).

const OFFSETS: Array<{ days: number; key: string; lines: (s: SessionDoc) => string[] }> = [
  {
    days: 5,
    key: 't5',
    lines: s => [
      `${s.client} session in 5 days (${s.date}).`,
      '→ Data connection / additional discovery needed? Sort it now.',
      '→ Slides started?'
    ]
  },
  {
    days: 3,
    key: 't3',
    lines: s => [
      `${s.client} session in 3 days (${s.date}).`,
      '→ Send the participants their reminder: laptops + chargers, paid Claude subscription, Claude desktop app, GitHub connected.',
      s.car?.status !== 'booked' ? '→ Car not booked yet.' : ''
    ]
  },
  {
    days: 1,
    key: 't1',
    lines: s => [
      `${s.client} session TOMORROW (${s.date}${s.startTime ? `, ${s.startTime}` : ''}).`,
      '→ Send the day-before reminder to participants.',
      '→ Confirm with the host: screen to present on (not a projector), table to sit around.',
      s.venue ? `→ Venue: ${s.venue}` : '→ No venue on the session — get the address!',
      s.car?.status !== 'booked' ? '→ CAR STILL NOT BOOKED.' : '→ Car booked.',
      '→ Pack tonight: adapters, cables + the packing list.'
    ]
  }
];

/**
 * Pickup time = one hour before the session starts, so the car is at the door
 * with room for Bangalore traffic. Falls back to a nudge without a time when
 * the session has no start time on it yet.
 */
function carCallout(s: SessionDoc): string {
  const lines = [`🚗 Car needed TOMORROW (${s.date}) — ${s.client} session.`];
  if (s.startTime && /^\d{1,2}:\d{2}$/.test(s.startTime)) {
    const [h, m] = s.startTime.split(':').map(Number);
    const total = h * 60 + m - 60;
    if (total >= 0) {
      const pad = (n: number) => String(n).padStart(2, '0');
      lines.push(`Pickup ${pad(Math.floor(total / 60))}:${pad(total % 60)} (session starts ${s.startTime}).`);
    } else {
      lines.push(`Session starts ${s.startTime} — pickup the night before or very early.`);
    }
  } else {
    lines.push('No start time on the session yet — need one to fix the pickup.');
  }
  if (s.venue) lines.push(`Venue: ${s.venue}`);
  lines.push(s.car?.status === 'booked' ? 'Marked booked — just confirming.' : 'Not booked yet.');
  return lines.join('\n');
}

interface SessionDoc {
  client: string;
  date: string;
  startTime?: string;
  venue?: string;
  status: string;
  car?: { status?: string };
}

async function authorize(req: NextRequest): Promise<Response | null> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('x-cron-secret') === secret) return null;
  const { error } = await requireOperator(req);
  return error ?? null;
}

export async function POST(req: NextRequest) {
  const err = await authorize(req);
  if (err) return err;

  const db = adminDb();
  const todayIST = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const to = (process.env.WHATSAPP_ALLOWED_NUMBERS ?? '').split(',')[0]?.trim();

  const snap = await db
    .collection('rhaiSessions')
    .where('date', '>=', todayIST)
    .orderBy('date', 'asc')
    .limit(50)
    .get();

  const sent: string[] = [];
  for (const doc of snap.docs) {
    const s = doc.data() as SessionDoc;
    if (s.status !== 'confirmed') continue;
    const daysOut = Math.round(
      (new Date(`${s.date}T00:00:00Z`).getTime() - new Date(`${todayIST}T00:00:00Z`).getTime()) / 86_400_000
    );
    const offset = OFFSETS.find(o => o.days === daysOut);
    if (!offset) continue;

    // Dedupe: one reminder per session per offset, ever.
    try {
      await db.collection('rhaiSessionReminders').doc(`${doc.id}-${offset.key}`).create({ at: Date.now() });
    } catch {
      continue; // already sent
    }

    const text = offset.lines(s).filter(Boolean).join('\n');
    const now = Date.now();
    await db.collection('rhaiTodos').add({
      text: text.slice(0, 500),
      done: false,
      createdAt: now,
      updatedAt: now
    });
    if (to) {
      try {
        await sendWhatsAppText(to, text);
      } catch {
        /* the todo is the reliable copy */
      }
    }
    sent.push(`${s.client} ${offset.key}`);

    // Day before an in-person session: tell the team group we need a car and
    // when. Sent once per session (the reminder dedupe above already gates it).
    const teamGroup = process.env.WHATSAPP_TEAM_GROUP_ID?.trim();
    if (offset.days === 1 && teamGroup && s.venue !== 'online') {
      try {
        await sendWhatsAppText(teamGroup, carCallout(s), true);
        sent.push(`${s.client} car-callout`);
      } catch {
        /* Rhea still got the 1:1 nudge above */
      }
    }
  }

  return Response.json({ sent });
}
