/* ============================================================
   functions/index.js — Marketing Engine Cloud Functions

   ONE multiplexed HTTPS endpoint, switches on payload.action.
   Anthropic key shared with the Next.js backend via Secret Manager.
   ============================================================ */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const cheerio = require('cheerio');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const HEYGEN_API_KEY = defineSecret('HEYGEN_API_KEY');
const HIGGSFIELD_API_KEY = defineSecret('HIGGSFIELD_API_KEY');

if (!admin.apps.length) admin.initializeApp({
  databaseURL: 'https://compai-57d55-default-rtdb.asia-southeast1.firebasedatabase.app'
});
const db = admin.database();

const CLAUDE_MODEL = 'claude-sonnet-5';
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

// ===========================================================
// Utilities
// ===========================================================

function parseJsonLoose(text) {
  let t = (text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const firstObj = t.indexOf('{');
  const firstArr = t.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);
  if (start === -1) throw new Error('No JSON found in model output');
  const slice = t.slice(start);
  try { return JSON.parse(slice); } catch (e1) {
    const open = slice[0];
    const close = open === '{' ? '}' : ']';
    const last = slice.lastIndexOf(close);
    if (last > 0) { try { return JSON.parse(slice.slice(0, last + 1)); } catch (e2) {} }
    const salvaged = _salvageTruncatedJSON(slice);
    if (salvaged) { try { return JSON.parse(salvaged); } catch (e3) {} }
    throw e1;
  }
}
function _salvageTruncatedJSON(s) {
  const stack = []; let inString = false, escape = false;
  let lastSafePos = -1, lastSafeStack = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '{' || c === '[') { stack.push(c); continue; }
    if (c === '}' || c === ']') {
      stack.pop();
      if (c === '}' && stack.length > 0 && stack[stack.length - 1] === '[') {
        lastSafePos = i + 1; lastSafeStack = stack.slice();
      }
    }
  }
  if (lastSafePos < 0 || !lastSafeStack) return null;
  let out = s.slice(0, lastSafePos);
  for (let i = lastSafeStack.length - 1; i >= 0; i--) out += lastSafeStack[i] === '{' ? '}' : ']';
  return out;
}

async function callClaude(apiKey, opts) {
  if (!apiKey) throw new Error('Anthropic API key not configured.');
  const body = {
    model: opts.model || CLAUDE_MODEL,
    max_tokens: opts.max_tokens || 4000,
    system: opts.system,
    messages: opts.messages
  };
  const r = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error('Claude API ' + r.status + ': ' + detail.slice(0, 500));
  }
  const j = await r.json();
  const text = (j.content || []).map(b => b.text || '').join('').trim();
  return { text, raw: j };
}

async function verifyAuth(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try { return await admin.auth().verifyIdToken(m[1]); } catch (e) { return null; }
}

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'item-' + Math.random().toString(36).slice(2, 6);
}
function absolutize(base, href) {
  try { return new URL(href, base).toString(); } catch (e) { return ''; }
}

// Build the workspace_context object every AI prompt reads.
async function loadWorkspaceContext(wsid) {
  if (!wsid) return {};
  const snap = await db.ref('Workspaces/' + wsid).once('value');
  const v = snap.val() || {};
  const intake = v.intake || {};
  const personas = Object.values(v.personas || {}).map(p => ({
    name: p.name, age_range: p.age_range, occupation: p.occupation,
    motivations: p.motivations, pain_points: p.pain_points, voice_to_use: p.voice_to_use,
    where_they_hang_out: p.where_they_hang_out, sample_objection: p.sample_objection
  })).slice(0, 8);
  const channels = Object.values(v.channels || {}).map(c => ({
    platform: c.platform, handle_url: c.handle_url, what_we_post: c.what_we_post
  }));
  const buckets = Object.values(v.buckets || {}).map(b => ({
    name: b.name, function: b.function, frequency_count: b.frequency_count,
    frequency_per: b.frequency_per, description: b.description
  }));
  const entityCollections = Object.values(v.entityCollections || {}).map(c => ({
    slug: c.slug, display_name: c.display_name, description: c.description, suggested_schema: c.suggested_schema
  }));
  const entitySample = {};
  const allEnts = v.entities || {};
  Object.keys(allEnts).forEach(coll => {
    entitySample[coll] = Object.values(allEnts[coll] || {}).slice(0, 15).map(e => e.name);
  });
  const styleTemplates = Object.values(v.styleTemplates || {}).map(s => ({
    slug: s.slug, palette: s.palette, mood: s.mood, prompt_hint: s.prompt_hint
  }));
  return {
    workspaceId: wsid,
    company_name: (v.meta && v.meta.name) || '',
    writeup: intake.writeup || '',
    customer_types: intake.customer_types || '',
    funnel_focus: intake.funnel_focus || 'mixed',
    marketing_stack: intake.marketing_stack || '',
    personas, channels, buckets, entityCollections, entitySample, styleTemplates
  };
}

// ===========================================================
// AI actions
// ===========================================================

// Deep scrape with live progress written to RTDB so the client can watch
// "got the logo… got the colors…" in realtime.
async function scrapeWebsite(payload) {
  const url = (payload && payload.url || '').trim();
  const wsid = payload && payload.workspaceId;
  if (!url) throw new Error('url required');
  const target = /^https?:\/\//i.test(url) ? url : ('https://' + url);

  const progressRef = wsid ? db.ref('Workspaces/' + wsid + '/scrapeJob') : null;
  async function step(label, done, extra) {
    if (!progressRef) return;
    await progressRef.child('steps').push({ label, done: !!done, at: Date.now(), ...(extra || {}) });
  }
  if (progressRef) await progressRef.set({ status: 'running', started_at: Date.now(), url: target, steps: null });

  const out = {
    tagline: '', description: '', palette: [], fonts: [], logo_url: '',
    product_images: [], screenshots: [], company_name: '', raw_signals: { source_url: target }
  };

  await step('Fetching homepage…');
  let html = '';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(target, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; Chrome/120)' }, signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) html = await r.text();
  } catch (e) { out.raw_signals.fetch_error = e.message; }
  if (!html) {
    if (progressRef) await progressRef.update({ status: 'failed', error: out.raw_signals.fetch_error || 'No HTML' });
    return out;
  }
  await step('Homepage loaded', true);

  const $ = cheerio.load(html);
  out.company_name = ($('meta[property="og:site_name"]').attr('content') || $('title').first().text() || '').trim().slice(0, 80);
  out.tagline = ($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '').trim().slice(0, 240);
  const aboutH1 = $('h1').first().text().trim();
  const paras = []; $('p').each((_, el) => { if (paras.length >= 3) return; const t = $(el).text().trim(); if (t.length > 60) paras.push(t); });
  out.description = [aboutH1, paras.join(' ')].filter(Boolean).join('\n\n').slice(0, 1200);
  await step('Found name + tagline ✓ "' + (out.company_name || '?') + '"', true);

  // Logo
  const og = $('meta[property="og:image"]').attr('content');
  $('link[rel*="icon"]').each((_, el) => { const h = $(el).attr('href'); if (h && !out.logo_url) out.logo_url = absolutize(target, h); });
  $('img[src*="logo"], img[class*="logo"], img[alt*="logo" i]').each((_, el) => {
    const s = $(el).attr('src'); if (s && !out.logo_url) out.logo_url = absolutize(target, s);
  });
  if (!out.logo_url && og) out.logo_url = absolutize(target, og);
  await step(out.logo_url ? 'Got the logo ✓' : 'No obvious logo found — you can upload one', !!out.logo_url);

  // Colors — theme-color + inline CSS color frequency
  const theme = $('meta[name="theme-color"]').attr('content');
  if (theme && /^#?[0-9a-f]{3,8}$/i.test(theme)) out.palette.push(theme.startsWith('#') ? theme : '#' + theme);
  const cssText = $('style').map((_, el) => $(el).html()).get().join('\n');
  const hexes = (cssText.match(/#[0-9a-fA-F]{6}\b/g) || []);
  const freq = {};
  hexes.forEach(h => { const k = h.toLowerCase(); freq[k] = (freq[k] || 0) + 1; });
  Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([h]) => {
    if (!out.palette.includes(h) && h !== '#ffffff' && h !== '#000000') out.palette.push(h);
  });
  out.palette = out.palette.slice(0, 6);
  await step(out.palette.length ? ('Extracted brand colors ✓ ' + out.palette.slice(0, 4).join(' ')) : 'No colors found in CSS', out.palette.length > 0);

  // Fonts
  const fontSet = new Set();
  $('link[href*="fonts.googleapis"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/family=([^&:]+)/g) || [];
    m.forEach(x => fontSet.add(decodeURIComponent(x.replace('family=', '')).replace(/\+/g, ' ').split(':')[0]));
  });
  (cssText.match(/font-family:\s*['"]?([^'",;}]+)/g) || []).slice(0, 10).forEach(f => {
    const name = f.replace(/font-family:\s*['"]?/, '').trim();
    if (name && !/^(inherit|sans-serif|serif|monospace|system-ui|-apple-system)/i.test(name)) fontSet.add(name);
  });
  out.fonts = Array.from(fontSet).slice(0, 5);
  await step(out.fonts.length ? ('Found fonts ✓ ' + out.fonts.join(', ')) : 'No custom fonts detected', out.fonts.length > 0);

  // Product images
  if (og) out.screenshots.push(absolutize(target, og));
  $('img').each((_, el) => {
    const s = $(el).attr('src') || $(el).attr('data-src'); if (!s) return;
    const abs = absolutize(target, s);
    if (!abs || abs.match(/\.svg|sprite|icon|pixel|tracking/i)) return;
    const alt = ($(el).attr('alt') || '').toLowerCase();
    const isProduct = /product|shop|item|collection/.test((($(el).attr('class') || '') + ' ' + alt).toLowerCase()) || s.match(/product|cdn\.shop/i);
    if (isProduct && out.product_images.length < 8 && !out.product_images.includes(abs)) out.product_images.push(abs);
    else if (out.screenshots.length < 5 && !out.screenshots.includes(abs)) out.screenshots.push(abs);
  });
  await step('Collected ' + out.product_images.length + ' product images + ' + out.screenshots.length + ' screenshots ✓', true);

  // Try an /about or linked page for richer writeup
  try {
    const aboutLink = $('a[href*="about"]').first().attr('href');
    if (aboutLink) {
      await step('Reading the about page…');
      const aboutUrl = absolutize(target, aboutLink);
      const ctrl2 = new AbortController();
      const t2 = setTimeout(() => ctrl2.abort(), 8000);
      const r2 = await fetch(aboutUrl, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: ctrl2.signal });
      clearTimeout(t2);
      if (r2.ok) {
        const $2 = cheerio.load(await r2.text());
        const aboutParas = [];
        $2('p').each((_, el) => { if (aboutParas.length >= 4) return; const t = $2(el).text().trim(); if (t.length > 80) aboutParas.push(t); });
        if (aboutParas.length) {
          out.description = (out.description + '\n\n' + aboutParas.join(' ')).slice(0, 2000);
          await step('About page read ✓', true);
        }
      }
    }
  } catch (e) { /* about page is best-effort */ }

  if (progressRef) await progressRef.update({ status: 'done', finished_at: Date.now(), result_summary: { logo: !!out.logo_url, colors: out.palette.length, fonts: out.fonts.length, products: out.product_images.length } });
  return out;
}

// agentChat — the AI CMO. Conversational: parses voice/text ramble into structured
// data for the current step, asks follow-ups, makes proactive suggestions.
async function agentChat(apiKey, payload) {
  const ctx = payload?.workspace_context || {};
  const step = payload?.step || 'writeup'; // writeup | personas | channels | buckets
  const userInput = String(payload?.user_input || '').slice(0, 8000);
  const history = (payload?.history || []).slice(-10); // [{role:'agent'|'user', text}]

  const STEP_SHAPES = {
    writeup: '"structured": { "writeup": "one polished paragraph", "customer_types": "comma-separated rough customer types you inferred" }',
    personas: '"structured": { "personas": [{ "name","age_range","gender_skew","occupation","location_archetype","motivations":[],"pain_points":[],"where_they_hang_out":[],"voice_to_use","sample_objection" }] }',
    channels: '"structured": { "channels": [{ "slug","platform","handle_url","what_we_post","active":true }] }',
    buckets: '"structured": { "buckets": [{ "slug","name","function":"Educate|Inspire|Entertain|Persuade","description","frequency_count":1,"frequency_per":"week","why_this_helps" }] }'
  };

  const system = [
    'You are the AI CMO for this specific company. You have a sharp marketing brain: positioning, funnels, persona psychology, channel strategy.',
    'You are interviewing the founder to build their brand ontology. Your job each turn:',
    '1. PARSE whatever they said (it may be rambling voice transcription) into clean structured data for the current step.',
    '2. REFLECT it back briefly so they feel heard ("So what I\'m hearing is…").',
    '3. PUSH their thinking: if something is vague, generic, or missing, ask ONE pointed follow-up question. If they said something interesting, dig into it.',
    '4. SUGGEST proactively: if you see an angle they missed (an underserved persona, an obvious channel, a bucket that fits their story), propose it.',
    'Tone: warm, direct, smart. Like a CMO who is genuinely excited about their business. Never bureaucratic.',
    'You remember everything in the workspace context — reference specifics from their company, never generic filler.',
    'Return ONLY valid JSON: { "reply": "your conversational message (2-5 sentences, may include ONE question)", ' + STEP_SHAPES[step] + ', "suggestions": ["short actionable suggestion", ...], "confidence": "low|medium|high" }',
    'structured may be partial or empty if they haven\'t given enough yet. suggestions max 3.'
  ].join('\n');

  const convo = history.map(h => (h.role === 'agent' ? 'CMO: ' : 'FOUNDER: ') + h.text).join('\n');
  const prompt = [
    'COMPANY CONTEXT SO FAR:',
    JSON.stringify({
      name: ctx.company_name, writeup: ctx.writeup, customer_types: ctx.customer_types,
      personas: (ctx.personas || []).map(p => p.name), channels: (ctx.channels || []).map(c => c.platform),
      buckets: (ctx.buckets || []).map(b => b.name), funnel_focus: ctx.funnel_focus
    }, null, 2),
    '',
    'CURRENT STEP: ' + step,
    convo ? ('CONVERSATION SO FAR:\n' + convo) : '(conversation just started)',
    '',
    'FOUNDER JUST SAID (may be a voice transcript — messy is fine):',
    userInput || '(nothing yet — open the interview with one sharp, specific question for this step, referencing what you already know about the company)',
    '',
    'Respond as the AI CMO. Return ONLY the JSON.'
  ].join('\n');

  const r = await callClaude(apiKey, { max_tokens: 4000, system, messages: [{ role: 'user', content: prompt }] });
  return parseJsonLoose(r.text);
}

// generateEntitiesFromBuckets — runs silently after buckets are chosen.
// Creates collections + entities derived from the buckets, no user setup needed.
async function generateEntitiesFromBuckets(apiKey, payload) {
  const ctx = payload?.workspace_context || {};
  const wsid = payload?.workspaceId;
  const system = 'You are an AI CMO building a content library. Given a company and its content buckets, decide 2-4 entity collections the buckets will draw from, then fill each with 6-10 concrete entities. Return ONLY valid JSON.';
  const prompt = [
    'COMPANY:', ctx.writeup || '(none)', '',
    'BUCKETS:', JSON.stringify(ctx.buckets || [], null, 2).slice(0, 2000), '',
    'PERSONAS:', JSON.stringify((ctx.personas || []).map(p => p.name)), '',
    'Decide 2-4 collections that give these buckets concrete material (e.g. festivals, products, customer stories, how-to topics).',
    'For each collection: { "slug","display_name","icon":"emoji","description" , "entities": [{ "name","slug","data":{"description":"1-2 sentences"},"image_query" }] }',
    'Entities must be REAL and specific — actual names, not categories.',
    'Return ONLY: {"collections":[...]}'
  ].join('\n');
  const r = await callClaude(apiKey, { max_tokens: 8000, system, messages: [{ role: 'user', content: prompt }] });
  const parsed = parseJsonLoose(r.text);
  const collections = parsed.collections || [];
  // Persist server-side so the client doesn't have to do 40 writes
  if (wsid) {
    const updates = {};
    collections.forEach(c => {
      const cslug = slugify(c.slug || c.display_name);
      updates['Workspaces/' + wsid + '/entityCollections/' + cslug] = {
        slug: cslug, display_name: c.display_name, icon: c.icon || '✨', description: c.description || '',
        auto_generated: true, created_at: Date.now(), updated_at: Date.now()
      };
      (c.entities || []).forEach(e => {
        const eslug = slugify(e.name || e.slug);
        updates['Workspaces/' + wsid + '/entities/' + cslug + '/' + eslug] = {
          slug: eslug, name: e.name, data: e.data || {}, image_query: e.image_query || '',
          auto_generated: true, created_at: Date.now(), updated_at: Date.now()
        };
      });
    });
    await db.ref().update(updates);
  }
  return { collections };
}

// oneClickCreative — AI picks the right tool + settings for a slot and produces
// a ready-to-post package: media + caption + hashtags (+ voiceover for reels).
async function oneClickCreative(keys, payload) {
  const { aiKey, geminiKey, heygenKey } = keys;
  const ctx = payload?.workspace_context || {};
  const slot = payload?.slot || {};
  const brand = payload?.brand || {}; // { logo_url, palette, fonts, product_images }
  const isVideo = /reel|short|story|long-video/.test(slot.format || '');

  // 1. Draft the post (caption etc.)
  const post = await turnIntoPost(aiKey, { workspace_context: ctx, slot });

  // Claude HTML fallback — always available (Anthropic key), so a static creative
  // renders even when Gemini image gen is unavailable (bad key / no billing).
  async function claudeDesignFallback(note) {
    const design = await designPost(aiKey, {
      slot, post,
      style_template: (ctx.styleTemplates || [])[0] || {},
      palette: (brand.palette && brand.palette.length ? brand.palette : ['#0F172A', '#7C3AED', '#F5F3FF']),
      layout_skeleton: 'editorial_card_overlay',
      aspect: '1:1'
    });
    return { tool_used: 'claude', reasoning: note, media: { html_design: design } };
  }

  // 2. Decide + run the media tool
  let media = null, tool_used = '', reasoning = '';
  if (isVideo && heygenKey) {
    tool_used = 'heygen';
    reasoning = 'Format is ' + slot.format + ' — a talking-head reel with voiceover lands best, and HeyGen bakes captions + voice in one pass.';
    const scriptSys = 'You write 30-second direct-to-camera reel scripts. Spoken words only, ~70 words, hook in the first line, end with the CTA. No camera directions.';
    const scriptR = await callClaude(aiKey, {
      max_tokens: 600, system: scriptSys,
      messages: [{ role: 'user', content: 'BRAND: ' + (ctx.writeup || '') + '\nHOOK: ' + (slot.hook || '') + '\nCAPTION: ' + (post.caption || '') + '\nCTA: ' + (post.cta || '') + '\n\nWrite the verbatim script.' }]
    });
    const script = scriptR.text.trim();
    try {
      media = await runHeyGenVideo(heygenKey, { script, background_color: (brand.palette && brand.palette[2]) || '#F5F3FF' });
      media.script = script;
    } catch (e) {
      media = { error: e.message, script };
    }
  } else if (geminiKey) {
    tool_used = 'nanobanana';
    reasoning = 'Static ' + (slot.format || 'post') + ' — Nano Banana renders the brand palette + text-in-image in one shot.';
    const imgPrompt = [
      'Social media ' + (slot.format || 'post') + ' creative for ' + (ctx.company_name || 'the brand') + '.',
      'Headline text ON the image: "' + (post.hook || slot.hook || '') + '"',
      'Visual: ' + (post.visual_direction || slot.angle || ''),
      'Brand palette: ' + ((brand.palette || []).join(', ') || 'deep ink, warm accent'),
      (brand.fonts && brand.fonts.length ? 'Typography mood: ' + brand.fonts[0] : ''),
      'Style: premium, editorial, clean composition, generous negative space. No watermarks.'
    ].filter(Boolean).join('\n');
    try {
      media = await runGeminiImage(geminiKey, { prompt: imgPrompt });
      media.prompt = imgPrompt;
    } catch (e) {
      // Image gen failed (often free-tier quota) → render a Claude HTML slide instead.
      try {
        return { post, is_video: isVideo, ...(await claudeDesignFallback('Nano Banana was unavailable (' + (e.message || 'error').slice(0, 60) + '), so I designed it as an editorial slide instead.')) };
      } catch (e2) {
        media = { error: e.message, prompt: imgPrompt };
      }
    }
  } else {
    // No image key at all → Claude HTML slide.
    try {
      return { post, is_video: isVideo, ...(await claudeDesignFallback('Designed as an editorial slide.')) };
    } catch (e) {
      reasoning = 'No media key available — returning the post package only.';
    }
  }

  return { post, media, tool_used, reasoning, is_video: isVideo };
}

// beyondContent — point the same brain at a NON-content marketing task.
async function beyondContent(apiKey, payload) {
  const ctx = payload?.workspace_context || {};
  const exclude = payload?.exclude || [];
  const system = [
    'You are the AI CMO for this company. You have absorbed their full ontology: positioning, personas, channels, buckets, style.',
    'Now show the founder that this SAME context powers marketing work far beyond social content.',
    'Pick the ONE highest-leverage non-content application for THIS company (not generic) — e.g. cold email outreach system, WhatsApp re-engagement flow, partnership/collab targets, offline activation, referral program, marketplace expansion, influencer seeding strategy.',
    'Then design it concretely AND produce a real sample artifact they could use today.',
    'Return ONLY valid JSON.'
  ].join(' ');
  const prompt = [
    'FULL ONTOLOGY:',
    JSON.stringify({
      company: ctx.company_name, writeup: ctx.writeup, customer_types: ctx.customer_types,
      funnel_focus: ctx.funnel_focus, marketing_stack: ctx.marketing_stack,
      personas: ctx.personas, channels: ctx.channels, buckets: (ctx.buckets || []).map(b => b.name)
    }, null, 2).slice(0, 5000),
    '',
    exclude.length ? ('ALREADY SHOWN (pick something different): ' + exclude.join(', ')) : '',
    '',
    'Return EXACTLY:',
    '{',
    '  "application_title": "short name, e.g. Founder-led cold outreach to wedding planners",',
    '  "category": "outreach|partnerships|offline|retention|referral|other",',
    '  "why_this_company": "2-3 sentences tying it to THEIR ontology — name the persona/channel that makes this the right pick",',
    '  "expected_outcome": "1 line, concrete (e.g. 10 qualified calls/month)",',
    '  "system_design": [{ "step": "...", "detail": "...", "tool_hint": "..." }],   // 4-6 steps to set this up',
    '  "sample_artifact": { "title": "...", "type": "email_sequence|call_script|dm_template|partner_list|event_plan", "content": "the actual artifact, fully written, ready to use — if email sequence give 3 emails with subject lines" },',
    '  "how_the_ontology_helped": ["specific piece of their ontology → how it shaped this", ...]',
    '}'
  ].filter(Boolean).join('\n');
  const r = await callClaude(apiKey, { max_tokens: 6000, system, messages: [{ role: 'user', content: prompt }] });
  return parseJsonLoose(r.text);
}

async function draftPersonas(apiKey, payload) {
  const writeup = String(payload?.writeup || '').slice(0, 4000);
  const customerTypes = String(payload?.customer_types || '').slice(0, 2000);
  const count = Math.max(1, Math.min(8, Number(payload?.count) || 3));
  const system = 'You are a senior marketing strategist drafting buyer personas. Personas must be concrete, specific, real-sounding — no generic filler. Return ONLY valid JSON, no prose, no markdown.';
  const prompt = [
    'COMPANY WRITEUP:', writeup || '(none)', '',
    'CUSTOMER TYPES (rough notes):', customerTypes || '(none)', '',
    `Draft ${count} distinct buyer personas. Each persona has EXACTLY these keys:`,
    'name, age_range, gender_skew, occupation, location_archetype, motivations, pain_points, where_they_hang_out, voice_to_use, sample_objection.',
    'motivations / pain_points / where_they_hang_out are arrays of 2-4 short bullets. Everything else is a short string.',
    '', 'Return ONLY: {"personas":[...]}'
  ].join('\n');
  const r = await callClaude(apiKey, { max_tokens: 3000, system, messages: [{ role: 'user', content: prompt }] });
  const parsed = parseJsonLoose(r.text);
  return { personas: (parsed && parsed.personas) || [] };
}

async function brainstormBuckets(apiKey, payload) {
  const ctx = payload?.workspace_context || {};
  const existing = (payload?.existing_buckets || []).map(b => b.name).join(', ');
  const count = Math.max(3, Math.min(10, Number(payload?.count) || 6));
  const system = 'You are an AI CMO proposing reusable content buckets for a brand. A bucket is a recurring rhythm. Return ONLY valid JSON: {"suggestions":[...]}.';
  const prompt = [
    'COMPANY:', ctx.writeup || '(none)', '',
    'PERSONAS:', JSON.stringify(ctx.personas || [], null, 2).slice(0, 2000), '',
    'CHANNELS:', JSON.stringify(ctx.channels || [], null, 2).slice(0, 1200), '',
    existing ? `EXISTING BUCKETS (don't duplicate): ${existing}` : '',
    '', `Propose ${count} content buckets covering Educate / Inspire / Entertain / Persuade.`,
    'Each bucket has EXACTLY these keys:',
    'slug, name, purpose, function (one of: Educate|Inspire|Entertain|Persuade),',
    'description, frequency_count (number), frequency_per (day|week|month),',
    'suggested_channels (array of channel platforms), suggested_entity_collections (array of slugs),',
    'why_this_helps (1-2 sentences explaining strategic value).',
    '', 'Return ONLY: {"suggestions":[...]}'
  ].join('\n');
  const r = await callClaude(apiKey, { max_tokens: 4000, system, messages: [{ role: 'user', content: prompt }] });
  return parseJsonLoose(r.text);
}

async function brainstormCollections(apiKey, payload) {
  const ctx = payload?.workspace_context || {};
  const count = Math.max(3, Math.min(8, Number(payload?.count) || 5));
  const system = 'You are an AI CMO. Propose entity COLLECTIONS the brand will repeatedly draw content from. Return ONLY valid JSON: {"suggestions":[...]}.';
  const prompt = [
    'COMPANY:', ctx.writeup || '(none)', '',
    'PERSONAS:', JSON.stringify(ctx.personas || [], null, 2).slice(0, 1500), '',
    'BUCKETS:', JSON.stringify(ctx.buckets || [], null, 2).slice(0, 1500), '',
    '', `Propose ${count} entity collections. Examples (DO NOT copy verbatim, adapt to this brand):`,
    '- For a flower brand: gods, festivals, flowers, recipes',
    '- For SaaS: features, use_cases, integrations, customer_stories',
    '- For food: ingredients, dishes, chefs, occasions',
    '', 'Each collection has EXACTLY:',
    'slug, display_name, icon (single emoji), description (1 sentence),',
    'example_entities (array of 5-8 real-sounding example names),',
    'suggested_schema (array of {name, type: text|long_text|url|number|date, hint}).',
    '', 'Return ONLY: {"suggestions":[...]}'
  ].join('\n');
  const r = await callClaude(apiKey, { max_tokens: 3500, system, messages: [{ role: 'user', content: prompt }] });
  return parseJsonLoose(r.text);
}

async function brainstormEntities(apiKey, payload) {
  const ctx = payload?.workspace_context || {};
  const collSlug = payload?.collection_slug || '';
  const collSchema = payload?.collection_schema || [];
  const collDisplayName = payload?.collection_display_name || collSlug;
  const existing = (payload?.existing_entities || []).map(e => e.name).join(', ');
  const count = Math.max(3, Math.min(20, Number(payload?.count) || 10));
  const schemaKeys = (collSchema || []).map(f => `${f.name} (${f.type || 'text'})`).join(', ');
  const system = 'You generate specific, concrete entities for a brand\'s content library. Each entity is a real thing, not a category. Return ONLY valid JSON: {"suggestions":[...]}.';
  const prompt = [
    'COMPANY:', ctx.writeup || '(none)', '',
    'COLLECTION:', collDisplayName, schemaKeys ? `Schema fields: ${schemaKeys}` : '',
    existing ? `EXISTING (don't duplicate): ${existing}` : '',
    '', `Propose ${count} specific entities. Each entity has EXACTLY:`,
    'name (string), slug (kebab-case), data (object with the schema fields filled), image_query (a short phrase a designer could search for visuals).',
    'Be CONCRETE — real names, real facts, no placeholders.',
    '', 'Return ONLY: {"suggestions":[...]}'
  ].join('\n');
  const r = await callClaude(apiKey, { max_tokens: 4000, system, messages: [{ role: 'user', content: prompt }] });
  return parseJsonLoose(r.text);
}

async function extractStyleTemplate(apiKey, payload) {
  const imageUrl = payload?.image_url;
  if (!imageUrl) throw new Error('image_url required');
  const system = 'You are a creative director extracting a reusable style template from a single design image. Return ONLY valid JSON.';
  const content = [
    { type: 'image', source: { type: 'url', url: imageUrl } },
    { type: 'text', text: [
      'Extract a style template usable to brief future designs:',
      '- palette: array of 3-6 hex codes (most prominent first)',
      '- typography: 1 sentence on font character (serif/sans, weight, mood)',
      '- composition: 1 sentence on layout rule (centered? offset? grid?)',
      '- mood: array of 4-6 mood adjectives',
      '- prompt_hint: 2-3 sentence prompt to brief an image generator in this style',
      '',
      'Return ONLY: {"palette":[...], "typography":"...", "composition":"...", "mood":[...], "prompt_hint":"..."}'
    ].join('\n') }
  ];
  const r = await callClaude(apiKey, { max_tokens: 1500, system, messages: [{ role: 'user', content }] });
  return parseJsonLoose(r.text);
}

async function generateCalendar(apiKey, payload) {
  const ctx = payload?.workspace_context || {};
  const wsid = payload?.workspaceId;
  const persist = !!payload?.persist && !!wsid; // write result to RTDB server-side
  const year = Number(payload?.year) || new Date().getUTCFullYear();
  const month = Number(payload?.month) || (new Date().getUTCMonth() + 1);
  const monthKey = year + '-' + String(month).padStart(2, '0');
  const jobRef = wsid ? db.ref('Workspaces/' + wsid + '/calendarJob') : null;
  const postsPerDay = Math.max(0.5, Math.min(3, Number(payload?.posts_per_day) || 1));
  const countCap = Math.max(10, Math.min(60, Number(payload?.count_cap) || 30));
  const monthStr = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const daysInMonth = new Date(year, month, 0).getDate();

  // Mark the job running so any page can show progress — and so it survives the
  // client navigating away (this function finishes regardless of the browser).
  if (jobRef) {
    await jobRef.set({ status: 'running', month_key: monthKey, month_label: monthStr + ' ' + year, started_at: Date.now(), is_regenerate: !!payload?.feedback });
  }
  const system = [
    'You are an AI CMO planning a brand\'s content month.',
    'You produce calendar slots with narrative continuity (arcs, not random posts),',
    'bucket distribution proportional to frequency, persona coverage across the month,',
    'and REAL dates (no placeholders) for the requested month.',
    'Return ONLY valid JSON.'
  ].join(' ');
  const channelList = (ctx.channels || []).map(c => `${c.platform} (${c.what_we_post})`).join('\n');
  const personaList = (ctx.personas || []).map(p => `- ${p.name}: ${(p.voice_to_use || '').slice(0, 80)}`).join('\n');
  const bucketList = (ctx.buckets || []).map(b => `- [${b.function}] ${b.name} — ${b.frequency_count}/${b.frequency_per} — ${(b.description || '').slice(0, 100)}`).join('\n');
  const entityList = Object.entries(ctx.entitySample || {}).map(([coll, names]) => `${coll}: ${names.join(', ')}`).join('\n');
  const prompt = [
    `MONTH: ${monthStr} ${year} (${daysInMonth} days, from ${year}-${String(month).padStart(2,'0')}-01)`,
    `TARGET: ~${postsPerDay} posts/day across all channels. CAP AT ${countCap} slots total.`,
    '',
    'COMPANY:', ctx.writeup || '(none)', '',
    'PERSONAS:', personaList || '(none)', '',
    'CHANNELS:', channelList || '(none)', '',
    'BUCKETS:', bucketList || '(none)', '',
    'ENTITY POOL:', entityList || '(none)', '',
    `FUNNEL FOCUS: ${ctx.funnel_focus || 'mixed'}`,
    '',
    'Plan slots with narrative ARCS — a 3-5 day storyline that builds up, pays off, then reflects.',
    'Distribute buckets proportionally. Cover all personas at least twice across the month.',
    payload?.feedback ? ('\nTHE FOUNDER REVIEWED THE PREVIOUS CALENDAR AND SAID:\n"' + String(payload.feedback).slice(0, 1500) + '"\nTake this seriously — it overrides defaults. Previous strategy was: ' + String(payload.previous_strategy || '').slice(0, 500)) : '',
    '',
    'Each slot has EXACTLY these keys:',
    'date (YYYY-MM-DD), platform (string), channel_slug, bucket_slug, bucket_function, entity_collection, entity_slug, persona_slug,',
    'format (reel|carousel|story|post|short|long-video|blog-post|thread|newsletter),',
    'language (default "en"), hook (1 line), angle (2-3 sentences),',
    'arc_title (if part of an arc, else ""), arc_beat (1, 2, 3... or 0), arc_role (build-up|payoff|reflection|standalone),',
    'reason (why this slot, 1 sentence).',
    '',
    'Wrap as: {"strategy_summary":"...", "mix_check":{"educate_pct":0,"inspire_pct":0,"entertain_pct":0,"persuade_pct":0}, "slots":[...]}',
    '', 'Return ONLY the JSON.'
  ].join('\n');
  let parsed;
  try {
    const r = await callClaude(apiKey, { max_tokens: 20000, system, messages: [{ role: 'user', content: prompt }] });
    parsed = parseJsonLoose(r.text);
  } catch (e) {
    if (jobRef) await jobRef.update({ status: 'failed', error: (e && e.message) || String(e), finished_at: Date.now() });
    throw e;
  }

  if (persist) {
    // Assign slot ids + write the month, so the result lands even if the client
    // already navigated away. Mirrors what the client used to do.
    const slots = {};
    (parsed.slots || []).forEach((s, i) => {
      const id = 'slot-' + String(i).padStart(3, '0') + '-' + Math.random().toString(36).slice(2, 5);
      s.id = id; slots[id] = s;
    });
    await db.ref('Workspaces/' + wsid + '/calendar/' + monthKey).set({
      slots, strategy_summary: parsed.strategy_summary || '', mix_check: parsed.mix_check || null, generated_at: Date.now()
    });
    if (jobRef) await jobRef.update({ status: 'done', slot_count: Object.keys(slots).length, finished_at: Date.now() });
  }
  return parsed;
}

async function turnIntoPost(apiKey, payload) {
  const ctx = payload?.workspace_context || {};
  const slot = payload?.slot || {};
  const system = 'You write social posts. Produce production-ready copy that matches the persona\'s voice and the bucket\'s function. Return ONLY valid JSON.';
  const prompt = [
    'SLOT:', JSON.stringify(slot, null, 2).slice(0, 2000), '',
    'BRAND VOICE:', ctx.writeup || '(none)', '',
    'PERSONA (target):', JSON.stringify((ctx.personas || []).find(p => slugify(p.name) === slot.persona_slug) || {}, null, 2).slice(0, 1200), '',
    `Format: ${slot.format || 'post'}. Platform: ${slot.platform || ''}.`,
    '',
    'Produce EXACTLY:',
    'title, hook (1 line),',
    'script (array of beats — strings — for reel/carousel/short; empty array if not applicable),',
    'caption (2-4 sentences for social, longer for blog/newsletter),',
    'hashtags (array of 3-8 strings without the # symbol),',
    'cta (1 line),',
    'music_cue (1 line, only for reel/short else ""),',
    'visual_direction (1 sentence describing what the visual should show),',
    'alt_text (1 sentence for accessibility),',
    'production_notes (1-2 sentences with anything special).',
    '', 'Return ONLY a single JSON object.'
  ].join('\n');
  const r = await callClaude(apiKey, { max_tokens: 3000, system, messages: [{ role: 'user', content: prompt }] });
  return parseJsonLoose(r.text);
}

async function designPost(apiKey, payload) {
  const slot = payload?.slot || {};
  const post = payload?.post || {};
  const styleTemplate = payload?.style_template || {};
  const palette = payload?.palette || styleTemplate.palette || ['#0F172A', '#7C3AED', '#F5F3FF'];
  const aspect = payload?.aspect || '1:1';
  const layout = payload?.layout_skeleton || 'poster_centered';

  // SAFE_ZONE_CSS — text bleed structurally impossible
  const SAFE_ZONE_CSS = `
.slide { position:relative; width:100%; height:100%; container-type:size; overflow:hidden; }
.slide-safe { position:absolute; inset:8%; display:flex; flex-direction:column; }
.align-center { align-items:center; text-align:center; }
.align-left { align-items:flex-start; text-align:left; }
.align-right { align-items:flex-end; text-align:right; }
.justify-top { justify-content:flex-start; }
.justify-middle { justify-content:center; }
.justify-bottom { justify-content:flex-end; }
.t-hero { font-size:11cqw; line-height:1.05; font-weight:800; letter-spacing:-0.03em; }
.t-title { font-size:7cqw; line-height:1.1; font-weight:700; letter-spacing:-0.02em; }
.t-sub { font-size:4.2cqw; line-height:1.3; font-weight:500; }
.t-body { font-size:3cqw; line-height:1.45; }
.t-tiny { font-size:2.2cqw; line-height:1.4; }
.t-caps { letter-spacing:0.18em; text-transform:uppercase; }
`;
  // MOTION_CSS — 13 named keyframes + utilities
  const MOTION_CSS = `
@keyframes m-fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
@keyframes m-fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes m-scaleIn { from { opacity:0; transform:scale(.85); } to { opacity:1; transform:none; } }
@keyframes m-slideLeft { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:none; } }
@keyframes m-slideRight { from { opacity:0; transform:translateX(-40px); } to { opacity:1; transform:none; } }
@keyframes m-kenBurns { from { transform:scale(1.1); } to { transform:scale(1.0); } }
@keyframes m-pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.04); } }
@keyframes m-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
@keyframes m-shimmer { from { background-position:-200% 0; } to { background-position:200% 0; } }
@keyframes m-blink { 0%,49% { opacity:1; } 50%,100% { opacity:.3; } }
@keyframes m-rotateIn { from { opacity:0; transform:rotate(-12deg) scale(.9); } to { opacity:1; transform:none; } }
@keyframes m-typewriter { from { width:0; } to { width:100%; } }
@keyframes m-bg { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
.motion-fade-up { animation:m-fadeUp .6s both; }
.motion-fade-in { animation:m-fadeIn .6s both; }
.motion-scale-in { animation:m-scaleIn .55s both cubic-bezier(.2,.8,.2,1); }
.motion-slide-left { animation:m-slideLeft .5s both; }
.motion-slide-right { animation:m-slideRight .5s both; }
.motion-ken-burns { animation:m-kenBurns 8s both ease-out; }
.motion-pulse { animation:m-pulse 2.4s both infinite; }
.motion-float { animation:m-float 3.5s both ease-in-out infinite; }
.motion-d1{animation-delay:.10s}.motion-d2{animation-delay:.25s}.motion-d3{animation-delay:.40s}
.motion-d4{animation-delay:.55s}.motion-d5{animation-delay:.70s}.motion-d6{animation-delay:.90s}
`;

  const system = [
    'You are a senior designer producing HTML+CSS slides for a social post.',
    'You MUST use the provided .slide, .slide-safe, .align-*, .justify-*, .t-* classes from SAFE_ZONE_CSS.',
    'You MUST use the provided .motion-* classes for animations. Do NOT redefine these classes.',
    'You design with the provided palette and style mood. Output crisp, editorial typography — no clip art, no emojis as decoration.',
    'Return ONLY valid JSON.'
  ].join(' ');

  const prompt = [
    'POST CONTENT:', JSON.stringify({ hook: post.hook, title: post.title, caption: post.caption, cta: post.cta, visual_direction: post.visual_direction }, null, 2).slice(0, 1500), '',
    'PALETTE:', palette.join(', '),
    'STYLE MOOD:', (styleTemplate.mood || []).join(', ') || 'editorial, modern, calm',
    'STYLE COMPOSITION:', styleTemplate.composition || 'centered, generous whitespace',
    'LAYOUT SKELETON:', layout,
    'ASPECT RATIO:', aspect,
    '',
    'Produce 1-3 slides (carousel ok for "carousel" format, else 1 slide).',
    'Each slide is a self-contained block of HTML using the provided classes.',
    'Use background colors / gradients from the palette. Text in palette[0] or white as appropriate.',
    'Add motion classes for entrance + small ambient motion. Use stagger delays d1..d6.',
    '',
    'Return EXACTLY:',
    '{',
    '  "design_summary": "1 sentence on the design intent",',
    '  "aspect_ratio": "' + aspect + '",',
    '  "head_html": "additional <style> for THIS design only — fonts, custom colors, etc. DO NOT redefine .slide/.t-*/.motion-* classes.",',
    '  "slides": [ { "body_html": "<div class=\\"slide\\" style=\\"background:...\\"><div class=\\"slide-safe align-center justify-middle\\">...</div></div>", "duration_sec": 4 } ],',
    '  "fonts_used": ["Inter"],',
    '  "style_template_slug": "' + (styleTemplate.slug || '') + '"',
    '}'
  ].join('\n');

  const r = await callClaude(apiKey, { max_tokens: 6000, system, messages: [{ role: 'user', content: prompt }] });
  const design = parseJsonLoose(r.text);
  // Auto-prepend the safe-zone + motion CSS layers
  design.head_html = '<style>' + SAFE_ZONE_CSS + MOTION_CSS + '</style>' + (design.head_html || '');
  return design;
}

// craftToolPrompts — same content, six tool-tailored briefs.
// The frontend shows each as a card with copy + "Open tool" link.
async function craftToolPrompts(apiKey, payload) {
  const ctx = payload?.workspace_context || {};
  const slot = payload?.slot || {};
  const post = payload?.post || {};
  const personaName = slot.persona_slug || '';
  const persona = (ctx.personas || []).find(p => slugify(p.name) === personaName) || (ctx.personas || [])[0] || {};
  const styleTemplate = (ctx.styleTemplates || [])[0] || {};
  const palette = (payload?.palette || styleTemplate.palette || ['#0F172A', '#7C3AED', '#F5F3FF']);

  const system = [
    'You are a senior creative director who knows the strengths of every major AI tool.',
    'Given the SAME piece of brand content, you write a prompt or script tailored to each tool\'s sweet spot.',
    'You DO NOT call the tools — you produce the brief a human can paste into each tool to get a polished output.',
    'Video scripts are real shot-by-shot scripts with timing, voice-over copy, and audio direction.',
    'Each prompt must be production-ready: concrete subject, specific style cues, no filler.',
    'Return ONLY valid JSON, no prose, no markdown.'
  ].join(' ');

  const prompt = [
    'BRAND:', ctx.writeup || '(none)', '',
    'PERSONA TO TALK TO:', persona.name ? (persona.name + ' — voice: ' + (persona.voice_to_use || '')) : '(general audience)', '',
    'CONTENT SLOT:', JSON.stringify({
      date: slot.date, platform: slot.platform, format: slot.format,
      hook: slot.hook, angle: slot.angle, bucket: slot.bucket_slug, function: slot.bucket_function,
      arc_title: slot.arc_title, arc_role: slot.arc_role
    }, null, 2), '',
    post && post.caption ? ('FULL POST DRAFTED:\n' + JSON.stringify({
      title: post.title, hook: post.hook, caption: post.caption, cta: post.cta,
      visual_direction: post.visual_direction, script: post.script
    }, null, 2)) : '',
    '',
    'PALETTE: ' + palette.join(', '),
    'STYLE MOOD: ' + ((styleTemplate.mood || []).join(', ') || 'editorial, modern, calm'),
    '',
    'Produce ONE brief per tool. Each tool gets the SAME underlying content but the brief reshapes it for that tool\'s strengths:',
    '',
    '- nanobanana (Google Gemini 2.5 Flash Image): Best at stylized images with text-in-image and character consistency. Output a single dense scene-description prompt + a one-line negative prompt + suggested aspect (1:1 / 4:5 / 9:16 / 16:9).',
    '',
    '- claude (Anthropic Claude — for image/poster design via HTML): Best at editorial typographic posters. Output a design brief: subject, layout intent (where text sits), mood, palette use, motion suggestion.',
    '',
    '- chatgpt (text generation): Best at caption variations + hashtag packs + repurposing across platforms. Output a copy brief that asks for: hook caption (long + short), 3 caption variations in different tones, 8 hashtags, 1-line SMS adaptation.',
    '',
    '- veo (Google Veo 3 — text-to-video with audio, 8-sec clips): Best at cinematic short clips with synced audio. Output a real shot script as an array of beats: each beat has {time: "0:00-0:03", shot: "camera + subject + action", vo: "voice-over words", audio: "sfx / music cue"}. Plus a music_cue line and suggested_aspect.',
    '',
    '- higgsfield (Higgsfield AI — adds cinematic camera moves to a still): Best at motion presets (Bullet Time, Dolly Zoom, Crane Up, Whip Pan, etc.). Output {starting_image_prompt, motion_preset, duration_seconds, why_this_motion}.',
    '',
    '- heygen (AI avatar talking head): Best at direct-to-camera explainers. Output {avatar_brief (look + outfit + setting), voice_tone, script (verbatim, ~60-80 words for 30 sec), background, suggested_b_roll_keywords}.',
    '',
    'Each tool gets a `headline` (one-line summary of what THIS tool will produce for this slot) and a `best_for` (one-line reminder of when to reach for this tool).',
    '',
    'Return EXACTLY this shape:',
    '{',
    '  "tools": {',
    '    "nanobanana": { "headline": "...", "best_for": "...", "prompt": "...", "negative_prompt": "...", "suggested_aspect": "1:1" },',
    '    "claude": { "headline": "...", "best_for": "...", "design_brief": "..." },',
    '    "chatgpt": { "headline": "...", "best_for": "...", "prompt": "..." },',
    '    "veo": { "headline": "...", "best_for": "...", "script": [{"time":"0:00-0:03","shot":"...","vo":"...","audio":"..."}], "music_cue": "...", "suggested_aspect": "9:16" },',
    '    "higgsfield": { "headline": "...", "best_for": "...", "starting_image_prompt": "...", "motion_preset": "...", "duration_seconds": 5, "why_this_motion": "..." },',
    '    "heygen": { "headline": "...", "best_for": "...", "avatar_brief": "...", "voice_tone": "...", "script": "...", "background": "...", "suggested_b_roll_keywords": ["...","..."] }',
    '  }',
    '}'
  ].filter(Boolean).join('\n');

  const r = await callClaude(apiKey, { max_tokens: 8000, system, messages: [{ role: 'user', content: prompt }] });
  return parseJsonLoose(r.text);
}

// ============================================================
// Live tool runners — actually call the third-party APIs
// ============================================================

async function runOpenAIText(apiKey, payload) {
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured.');
  const prompt = (payload && payload.prompt) || '';
  if (!prompt.trim()) throw new Error('prompt required');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: 'You are a senior social copywriter. Follow the brief exactly. Output ready-to-paste copy.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('OpenAI ' + r.status + ': ' + t.slice(0, 400));
  }
  const j = await r.json();
  const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  return { text };
}

async function runGeminiImage(apiKey, payload) {
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');
  const prompt = (payload && payload.prompt) || '';
  if (!prompt.trim()) throw new Error('prompt required');
  const model = 'gemini-2.5-flash-image';
  // Gemini API keys — both AIza-prefixed and AQ.-prefixed — authenticate via the
  // x-goog-api-key header (NOT Authorization: Bearer, which these keys reject).
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] }
    })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('Gemini ' + r.status + ': ' + t.slice(0, 400));
  }
  const j = await r.json();
  // Find the inline image part
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  const img = parts.find(p => p.inlineData || p.inline_data);
  if (!img) {
    // Some models return base64 under a different shape; surface raw for debugging.
    throw new Error('Gemini returned no image. Raw: ' + JSON.stringify(j).slice(0, 400));
  }
  const inline = img.inlineData || img.inline_data;
  return { image_b64: inline.data, mime: inline.mimeType || inline.mime_type || 'image/png' };
}

async function runHeyGenVideo(apiKey, payload) {
  if (!apiKey) throw new Error('HEYGEN_API_KEY not configured.');
  const script = (payload && payload.script) || '';
  const avatar_id = (payload && payload.avatar_id) || 'Daisy-inskirt-20220818'; // common stock avatar
  const voice_id = (payload && payload.voice_id) || '2d5b0e6cf36f460aa7fc47e3eee4ba54';
  const background_color = (payload && payload.background_color) || '#F5F3FF';
  if (!script.trim()) throw new Error('script required');
  // 1. Kick off
  const start = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      caption: true, // burned-in captions for reel-style output
      video_inputs: [{
        character: { type: 'avatar', avatar_id: avatar_id, avatar_style: 'normal' },
        voice: { type: 'text', input_text: script.slice(0, 1500), voice_id: voice_id },
        background: { type: 'color', value: background_color }
      }],
      dimension: { width: 720, height: 1280 }
    })
  });
  if (!start.ok) {
    const t = await start.text().catch(() => '');
    throw new Error('HeyGen start ' + start.status + ': ' + t.slice(0, 400));
  }
  const startJson = await start.json();
  const video_id = startJson.data && startJson.data.video_id;
  if (!video_id) throw new Error('HeyGen did not return a video_id: ' + JSON.stringify(startJson).slice(0, 300));
  // 2. Poll up to ~5 min (function timeout is 9 min). HeyGen typically finishes in 30-90 sec.
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const s = await fetch('https://api.heygen.com/v1/video_status.get?video_id=' + encodeURIComponent(video_id), {
      headers: { 'x-api-key': apiKey }
    });
    if (!s.ok) continue;
    const sj = await s.json();
    const status = sj.data && sj.data.status;
    if (status === 'completed') {
      return { video_id: video_id, video_url: sj.data.video_url, thumbnail_url: sj.data.thumbnail_url, duration: sj.data.duration };
    }
    if (status === 'failed') {
      throw new Error('HeyGen failed: ' + (sj.data && sj.data.error && sj.data.error.message || 'unknown'));
    }
  }
  // Timed out — return video_id so the client can resume polling later
  return { video_id: video_id, status: 'still_processing' };
}

async function exportWorkspace(payload) {
  const wsid = payload?.workspaceId || '';
  if (!wsid) throw new Error('workspaceId required');
  const snap = await db.ref('Workspaces/' + wsid).once('value');
  const v = snap.val() || {};
  const meta = v.meta || {};

  const ontology = {
    meta: { name: meta.name, slug: meta.slug, created_at: meta.created_at },
    intake: v.intake || {},
    personas: Object.values(v.personas || {}),
    channels: Object.values(v.channels || {}),
    buckets: Object.values(v.buckets || {}),
    entityCollections: Object.values(v.entityCollections || {}),
    entities: v.entities || {},
    styleTemplates: Object.values(v.styleTemplates || {})
  };
  const calendar = [];
  Object.entries(v.calendar || {}).forEach(([month, slots]) => {
    Object.values(slots || {}).forEach(s => calendar.push(Object.assign({ month }, s)));
  });
  calendar.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const creatives = Object.values(v.creatives || {});
  const applications = Object.values(v.applications || {}).map(a => a.result).filter(Boolean);

  // Markdown AI-agent brief — the most valuable take-home
  const brief = [
    `# ${meta.name || 'Brand'} — Marketing Brief`,
    '',
    `_Exported ${new Date().toISOString()} from the Marketing Engine workshop._`,
    '',
    '## What this brand does',
    ontology.intake.writeup || '_(not provided)_',
    '',
    '## Who they sell to',
    ontology.intake.customer_types || '_(not provided)_',
    '',
    `**Funnel focus this period:** ${ontology.intake.funnel_focus || 'mixed'}`,
    `**Marketing stack:** ${ontology.intake.marketing_stack || '_(not provided)_'}`,
    '',
    '## Personas',
    ontology.personas.length === 0 ? '_(none yet)_' : ontology.personas.map(p => [
      `### ${p.name} (${p.age_range || ''}, ${p.occupation || ''})`,
      `**Voice:** ${p.voice_to_use || ''}`,
      `**Motivations:** ${(Array.isArray(p.motivations) ? p.motivations : [p.motivations]).join(' · ')}`,
      `**Pain points:** ${(Array.isArray(p.pain_points) ? p.pain_points : [p.pain_points]).join(' · ')}`,
      `**Where they hang out:** ${(Array.isArray(p.where_they_hang_out) ? p.where_they_hang_out : [p.where_they_hang_out]).join(' · ')}`,
      `**Sample objection:** ${p.sample_objection || ''}`
    ].join('\n')).join('\n\n'),
    '',
    '## Channels',
    ontology.channels.length === 0 ? '_(none yet)_' :
      ontology.channels.map(c => `- **${c.platform}** — ${c.handle_url || ''} — ${c.what_we_post || ''}`).join('\n'),
    '',
    '## Content buckets',
    ontology.buckets.length === 0 ? '_(none yet)_' :
      ontology.buckets.map(b => `- **${b.name}** _(${b.function})_, ${b.frequency_count}/${b.frequency_per} — ${b.description || ''}`).join('\n'),
    '',
    '## Entity collections',
    ontology.entityCollections.length === 0 ? '_(none yet)_' :
      ontology.entityCollections.map(c => {
        const ents = Object.values((ontology.entities[c.slug] || {})).map(e => e.name);
        return `- **${c.display_name}** ${c.icon || ''} (${ents.length}): ${ents.slice(0, 10).join(', ')}${ents.length > 10 ? ', …' : ''}`;
      }).join('\n'),
    '',
    '## Style direction',
    ontology.styleTemplates.length === 0 ? '_(none yet)_' :
      ontology.styleTemplates.map(s => `- Palette: ${(s.palette || []).join(', ')} — Mood: ${(s.mood || []).join(', ')}`).join('\n'),
    '',
    '## How to use this with an AI agent',
    'Paste this whole document into a Claude / ChatGPT prompt and ask:',
    '- "Draft three Instagram captions for [persona] about [entity], using the bucket [bucket name]."',
    '- "Outline a five-day arc on [topic] mixing buckets X and Y."',
    '- "Rewrite this caption in the voice of [persona]."',
    '',
    '— Generated by the Marketing Engine.'
  ].join('\n');

  return {
    schema_version: 1,
    generated_at: Date.now(),
    workspace: { id: wsid, name: meta.name, slug: meta.slug },
    ontology,
    calendar,
    creatives,
    applications,
    brief_markdown: brief
  };
}

// ===========================================================
// Endpoint
// ===========================================================

exports.marketingAI = onRequest(
  { region: 'us-central1', timeoutSeconds: 540, memory: '1GiB', cors: true,
    secrets: [ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, HEYGEN_API_KEY, HIGGSFIELD_API_KEY] },
  async (req, res) => {
    if (req.method === 'OPTIONS') { res.set('Access-Control-Allow-Origin', '*'); res.status(204).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    const { action, payload } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action required' });

    let aiKey = null, openaiKey = null, geminiKey = null, heygenKey = null, higgsKey = null;
    try { aiKey = ANTHROPIC_API_KEY.value(); } catch (e) {}
    try { openaiKey = OPENAI_API_KEY.value(); } catch (e) {}
    try { geminiKey = GEMINI_API_KEY.value(); } catch (e) {}
    try { heygenKey = HEYGEN_API_KEY.value(); } catch (e) {}
    try { higgsKey = HIGGSFIELD_API_KEY.value(); } catch (e) {}

    // For actions that need full workspace context, autoload it if caller passed workspaceId
    if (payload && payload.workspaceId && !payload.workspace_context) {
      try { payload.workspace_context = await loadWorkspaceContext(payload.workspaceId); }
      catch (e) { console.warn('context load failed:', e.message); }
    }

    try {
      switch (action) {
        case 'scrapeWebsite':        return res.json(await scrapeWebsite(payload));
        case 'draftPersonas':        return res.json(await draftPersonas(aiKey, payload));
        case 'brainstormBuckets':    return res.json(await brainstormBuckets(aiKey, payload));
        case 'brainstormCollections':return res.json(await brainstormCollections(aiKey, payload));
        case 'brainstormEntities':   return res.json(await brainstormEntities(aiKey, payload));
        case 'extractStyleTemplate': return res.json(await extractStyleTemplate(aiKey, payload));
        case 'generateCalendar':     return res.json(await generateCalendar(aiKey, payload));
        case 'turnIntoPost':         return res.json(await turnIntoPost(aiKey, payload));
        case 'designPost':           return res.json(await designPost(aiKey, payload));
        case 'craftToolPrompts':     return res.json(await craftToolPrompts(aiKey, payload));
        case 'exportWorkspace':      return res.json(await exportWorkspace(payload));
        case 'runOpenAIText':        return res.json(await runOpenAIText(openaiKey, payload));
        case 'runGeminiImage':       return res.json(await runGeminiImage(geminiKey, payload));
        case 'runHeyGenVideo':       return res.json(await runHeyGenVideo(heygenKey, payload));
        case 'agentChat':            return res.json(await agentChat(aiKey, payload));
        case 'generateEntitiesFromBuckets': return res.json(await generateEntitiesFromBuckets(aiKey, payload));
        case 'oneClickCreative':     return res.json(await oneClickCreative({ aiKey, geminiKey, heygenKey }, payload));
        case 'beyondContent':        return res.json(await beyondContent(aiKey, payload));
        case 'generateHeroImage':    return res.json(await runGeminiImage(geminiKey, payload)); // alias
        default: return res.status(400).json({ error: 'Unknown action ' + action });
      }
    } catch (e) {
      console.error(action + ' error:', e);
      return res.status(500).json({ error: (e && e.message) || String(e) });
    }
  }
);

// Rhai scheduled triggers (Fireflies sync, WhatsApp briefings).
Object.assign(exports, require('./rhai-cron'));
