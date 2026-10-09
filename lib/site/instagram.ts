import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

// The @heyrhai Instagram feed, mirrored onto the site. Posts are pulled with
// the Instagram API (Instagram Login) using a long-lived token Rhea connects
// once from /instagram, cached in Firestore, and rendered as real HTML —
// captions included — so the answers she posts there are readable by people
// and by answer engines, not locked inside an iframe widget.
//
// Everything here fails soft: no token, an expired token, or an API error
// returns the last cached posts (or none) and the site renders without the
// section. The homepage must never break because Instagram did.

const DOC = 'rhaiSettings/instagram';
const API = 'https://graph.instagram.com';
const CACHE_MS = 30 * 60 * 1000; // media URLs are signed and expire — keep fresh
const TOKEN_REFRESH_MS = 20 * 24 * 60 * 60 * 1000; // long-lived tokens last 60 days
const MAX_POSTS = 24;

export interface InstagramPost {
  id: string;
  caption: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  imageUrl: string | null;
  permalink: string;
  timestamp: string;
}

interface StoredState {
  token?: string;
  tokenRefreshedAt?: number;
  username?: string;
  posts?: InstagramPost[];
  fetchedAt?: number;
  lastError?: string;
}

async function load(): Promise<StoredState> {
  const snap = await adminDb().doc(DOC).get();
  return (snap.data() as StoredState | undefined) ?? {};
}

async function fetchPosts(token: string): Promise<InstagramPost[]> {
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  const res = await fetch(`${API}/me/media?fields=${fields}&limit=${MAX_POSTS}&access_token=${encodeURIComponent(token)}`, {
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`instagram ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as {
    data?: {
      id: string;
      caption?: string;
      media_type: InstagramPost['mediaType'];
      media_url?: string;
      thumbnail_url?: string;
      permalink: string;
      timestamp: string;
    }[];
  };
  return (body.data ?? []).map(m => ({
    id: m.id,
    caption: m.caption ?? '',
    mediaType: m.media_type,
    // Videos expose a still as thumbnail_url; images and albums as media_url.
    imageUrl: (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url) ?? m.thumbnail_url ?? null,
    permalink: m.permalink,
    timestamp: m.timestamp
  }));
}

async function refreshToken(token: string): Promise<string | null> {
  const res = await fetch(
    `${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return null;
  return ((await res.json()) as { access_token?: string }).access_token ?? null;
}

/** Latest posts for the public site. Never throws. */
export async function getInstagramPosts(limit = MAX_POSTS): Promise<InstagramPost[]> {
  try {
    const state = await load();
    const token = state.token || process.env.INSTAGRAM_TOKEN;
    const cached = state.posts ?? [];
    if (!token) return [];
    if (state.fetchedAt && Date.now() - state.fetchedAt < CACHE_MS) return cached.slice(0, limit);

    try {
      const posts = await fetchPosts(token);
      const patch: StoredState = { posts, fetchedAt: Date.now(), lastError: '' };
      // Roll the 60-day token forward well before it lapses.
      if (state.token && Date.now() - (state.tokenRefreshedAt ?? 0) > TOKEN_REFRESH_MS) {
        const next = await refreshToken(state.token);
        if (next) {
          patch.token = next;
          patch.tokenRefreshedAt = Date.now();
        }
      }
      await adminDb().doc(DOC).set(patch, { merge: true });
      return posts.slice(0, limit);
    } catch (e) {
      // Back off for a cache window so a dead token doesn't hit the API on
      // every page view; keep serving what we have.
      await adminDb()
        .doc(DOC)
        .set({ fetchedAt: Date.now(), lastError: e instanceof Error ? e.message : 'fetch failed' }, { merge: true });
      return cached.slice(0, limit);
    }
  } catch {
    return [];
  }
}

export async function instagramStatus() {
  const s = await load();
  return {
    connected: Boolean(s.token || process.env.INSTAGRAM_TOKEN),
    username: s.username ?? null,
    postCount: s.posts?.length ?? 0,
    fetchedAt: s.fetchedAt ?? null,
    lastError: s.lastError || null
  };
}

/** Validate a token against the API, then store it and pull the first batch. */
export async function connectInstagram(token: string): Promise<{ username: string; postCount: number }> {
  const res = await fetch(`${API}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`, {
    cache: 'no-store'
  });
  if (!res.ok) throw new Error('Instagram rejected that token. Generate a fresh one and paste the whole thing.');
  const me = (await res.json()) as { username?: string };
  const posts = await fetchPosts(token);
  await adminDb()
    .doc(DOC)
    .set(
      { token, tokenRefreshedAt: Date.now(), username: me.username ?? '', posts, fetchedAt: Date.now(), lastError: '' },
      { merge: true }
    );
  return { username: me.username ?? '', postCount: posts.length };
}

export async function disconnectInstagram(): Promise<void> {
  await adminDb().doc(DOC).set({ token: '', posts: [], fetchedAt: 0, lastError: '' }, { merge: true });
}

/** First line of a caption as a title, the rest as the body. */
export function splitCaption(caption: string): { title: string; body: string } {
  const text = caption.trim();
  const i = text.indexOf('\n');
  if (i === -1) return { title: text, body: '' };
  return { title: text.slice(0, i).trim(), body: text.slice(i + 1).trim() };
}
