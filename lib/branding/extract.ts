import 'server-only';

export interface Branding {
  logoUrl: string | null;
  logoDarkUrl: string | null;
  accentColor: string | null; // CSS color (hex/rgb)
  name: string | null;
  description: string | null;
  extractedAt: number;
}

const TIMEOUT_MS = 5000;
const COLOR_RE = /^#([0-9a-f]{3,8})$|^rgb/i;

export async function extractBranding(rawUrl: string): Promise<Branding> {
  const url = normalize(rawUrl);
  const base = new URL(url);

  const html = await fetchText(url);
  if (!html) {
    return empty();
  }

  const logoUrl = pickLogo(html, base);
  const accentColor = pickThemeColor(html);
  const name = pickName(html, base);
  const description = pickDescription(html);

  // Try manifest.json as a secondary source for theme color + name.
  let manifestColor: string | null = null;
  let manifestName: string | null = null;
  const manifestHref = match(html, /<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/i);
  if (manifestHref) {
    const manifestUrl = resolveUrl(manifestHref, base);
    const manifestJson = await fetchText(manifestUrl).catch(() => '');
    if (manifestJson) {
      try {
        const m = JSON.parse(manifestJson) as { theme_color?: string; name?: string; short_name?: string };
        if (typeof m.theme_color === 'string' && COLOR_RE.test(m.theme_color)) {
          manifestColor = m.theme_color;
        }
        if (typeof m.name === 'string') manifestName = m.name;
        else if (typeof m.short_name === 'string') manifestName = m.short_name;
      } catch {
        // ignore malformed manifest
      }
    }
  }

  return {
    logoUrl,
    logoDarkUrl: null,
    accentColor: accentColor ?? manifestColor,
    name: name ?? manifestName,
    description,
    extractedAt: Date.now()
  };
}

function empty(): Branding {
  return {
    logoUrl: null,
    logoDarkUrl: null,
    accentColor: null,
    name: null,
    description: null,
    extractedAt: Date.now()
  };
}

async function fetchText(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // Modern UA so sites don't serve a noscript shell.
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
        accept: 'text/html,application/xhtml+xml,application/xml,application/json'
      }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function pickLogo(html: string, base: URL): string | null {
  // Priority: og:image > apple-touch-icon > link[rel=icon] > /favicon.ico
  const og = match(
    html,
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i
  );
  if (og) return resolveUrl(og, base);

  const apple = match(
    html,
    /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i
  );
  if (apple) return resolveUrl(apple, base);

  const icon = match(
    html,
    /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i
  );
  if (icon) return resolveUrl(icon, base);

  return resolveUrl('/favicon.ico', base);
}

function pickThemeColor(html: string): string | null {
  const direct = match(html, /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (direct && COLOR_RE.test(direct) && !isExtreme(direct)) return direct;

  const ms = match(
    html,
    /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i
  );
  if (ms && COLOR_RE.test(ms) && !isExtreme(ms)) return ms;

  return null;
}

function isExtreme(color: string): boolean {
  // Reject near-white or near-black accent colors — they make accents invisible.
  const c = color.trim().toLowerCase();
  if (c === '#fff' || c === '#ffffff' || c === '#000' || c === '#000000') return true;
  const rgb = parseColor(c);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 235 || brightness < 25;
}

function parseColor(c: string): [number, number, number] | null {
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
  }
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  return null;
}

function pickName(html: string, base: URL): string | null {
  const ogSite = match(
    html,
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogSite) return ogSite.trim();
  const ogTitle = match(
    html,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogTitle) return ogTitle.trim().split(/[|–-]\s*/)[0]?.trim() ?? null;
  const title = match(html, /<title[^>]*>([^<]+)<\/title>/i);
  if (title) return title.trim().split(/[|–-]\s*/)[0]?.trim() ?? null;
  return base.hostname.replace(/^www\./, '');
}

function pickDescription(html: string): string | null {
  const og = match(
    html,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
  );
  if (og) return og.trim();
  const desc = match(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  return desc ? desc.trim() : null;
}

function match(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  return m ? decodeEntities(m[1]) : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function resolveUrl(href: string, base: URL): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function normalize(raw: string): string {
  return raw.startsWith('http') ? raw : `https://${raw}`;
}
