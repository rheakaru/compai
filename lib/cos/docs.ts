import 'server-only';
import { randomUUID } from 'crypto';
import mammoth from 'mammoth';
import type Anthropic from '@anthropic-ai/sdk';
import { adminBucket, adminDb } from '@/lib/firebase/admin';
import { anthropic } from '@/lib/rhai/server';
import { modelFor } from '@/lib/rhai/models';
import { extractText } from '@/lib/rhai/extract';
import { COL_AGENTS, SUB_DOCS } from './store';
import type { CosDoc } from './types';

// Documents a participant hands their chief of staff (a chief-of-staff JD,
// strategy decks, org charts, company one-pagers). On upload we:
//   1. keep the original in Cloud Storage (cos/{uid}/docs/{id}/{name}),
//   2. extract the text (PDF via Claude, DOCX via mammoth, sheets as CSV),
//   3. write a 2–3 sentence summary that goes into agent.md, and
//   4. store the full text in cosAgents/{uid}/docs/{id}, split into ~1.5k-char
//      chunks so search_documents can return the matching passages.
// "Index" here is keyword scoring over those chunks — small corpora per
// person (≤ 12 docs), so no embedding store is needed.

export const MAX_DOCS = 12;
export const MAX_BYTES = 10 * 1024 * 1024;
const CHUNK = 1500;
const ALLOWED = /\.(pdf|docx|txt|md|markdown|csv|xlsx|xls|json)$/i;

export function acceptable(name: string): boolean {
  return ALLOWED.test(name);
}

interface StoredDoc {
  name: string;
  scope: CosDoc['scope'];
  text: string;
  chunks: string[];
  storagePath: string;
  at: number;
}

export async function ingestDocument(params: {
  uid: string;
  name: string;
  mime: string;
  buffer: Buffer;
  scope: CosDoc['scope'];
}): Promise<CosDoc> {
  const { uid, name, mime, buffer, scope } = params;
  const id = randomUUID().slice(0, 10);
  const safeName = name.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  const storagePath = `cos/${uid}/docs/${id}/${safeName}`;
  await adminBucket().file(storagePath).save(buffer, { contentType: mime || 'application/octet-stream', resumable: false });

  let text = '';
  try {
    if (/\.docx$/i.test(name)) {
      text = (await mammoth.extractRawText({ buffer })).value.slice(0, 40_000);
    } else {
      text = await extractText(buffer, name, mime);
    }
  } catch {
    text = '';
  }
  text = text.trim();

  const summary = text ? await summarize(name, text) : `Uploaded "${name}" — the text could not be read automatically.`;
  const chunks = chunkText(text);
  const stored: StoredDoc = { name: safeName, scope, text, chunks, storagePath, at: Date.now() };
  await adminDb().collection(COL_AGENTS).doc(uid).collection(SUB_DOCS).doc(id).set(stored);
  return { id, name: safeName, scope, summary, chars: text.length, size: buffer.length, at: stored.at };
}

export async function deleteDocument(uid: string, id: string): Promise<void> {
  const ref = adminDb().collection(COL_AGENTS).doc(uid).collection(SUB_DOCS).doc(id);
  const snap = await ref.get();
  const path = (snap.data() as StoredDoc | undefined)?.storagePath;
  if (path) await adminBucket().file(path).delete().catch(() => undefined);
  await ref.delete();
}

/** Keyword search across the person's documents; returns the best passages. */
export async function searchDocuments(uid: string, query: string, max = 4): Promise<string> {
  const snap = await adminDb().collection(COL_AGENTS).doc(uid).collection(SUB_DOCS).get();
  if (snap.empty) return 'They have not uploaded any documents.';
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9₹$%]+/)
    .filter(t => t.length > 2 && !STOP.has(t));
  const scored: { score: number; name: string; id: string; chunk: string }[] = [];
  for (const d of snap.docs) {
    const doc = d.data() as StoredDoc;
    (doc.chunks ?? []).forEach(chunk => {
      const lc = chunk.toLowerCase();
      let score = 0;
      for (const t of terms) {
        const hits = lc.split(t).length - 1;
        if (hits) score += 1 + Math.log(hits);
      }
      if (lc.includes(query.toLowerCase())) score += 3;
      if (score > 0) scored.push({ score, name: doc.name, id: d.id, chunk });
    });
  }
  if (!scored.length) {
    return `No passage matches "${query}". Documents available: ${snap.docs.map(d => `${(d.data() as StoredDoc).name} (id ${d.id})`).join(', ')}. Use read_document to open one.`;
  }
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, max)
    .map(s => `[${s.name} · id ${s.id}]\n${s.chunk}`)
    .join('\n\n---\n\n');
}

export async function readDocument(uid: string, id: string): Promise<string> {
  const snap = await adminDb().collection(COL_AGENTS).doc(uid).collection(SUB_DOCS).doc(id).get();
  if (!snap.exists) return 'No document with that id.';
  const d = snap.data() as StoredDoc;
  return `${d.name}\n\n${(d.text || '(no readable text)').slice(0, 20_000)}`;
}

function chunkText(text: string): string[] {
  if (!text) return [];
  const paras = text.split(/\n{2,}/);
  const out: string[] = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > CHUNK && cur) {
      out.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
    while (cur.length > CHUNK * 1.5) {
      out.push(cur.slice(0, CHUNK));
      cur = cur.slice(CHUNK);
    }
  }
  if (cur.trim()) out.push(cur);
  return out.slice(0, 80);
}

async function summarize(name: string, text: string): Promise<string> {
  try {
    const msg = await anthropic().messages.create({
      model: modelFor('digest'),
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `A person gave their new AI chief of staff this document ("${name}"). In 2–3 plain sentences say what it is and the specifics a chief of staff should remember from it (names, numbers, priorities, responsibilities). No preamble.\n\n${text.slice(0, 15_000)}`
        }
      ]
    });
    const out = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();
    return out.slice(0, 700) || `Uploaded "${name}".`;
  } catch {
    return `Uploaded "${name}".`;
  }
}

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'what', 'from', 'are', 'was', 'have', 'has', 'about', 'our', 'your', 'their', 'they', 'who', 'how', 'does', 'did']);
