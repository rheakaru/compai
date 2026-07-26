/* ============================================================
   design.js — multi-tool comparison studio.
   Same calendar slot → six tool-specific briefs side by side.
   Claude tile keeps an actual HTML preview rendered inline.
   ============================================================ */

(function () {
  var Des = {};
  var state = {
    slotsByMonth: {}, postsByMonth: {},
    selectedSlotId: null,
    prompts: null,        // { tools: {...} }
    claudeDesign: null,   // designPost output for the Claude tile preview
    liveOutputs: {},      // { toolKey: { text?, image_b64?, mime?, video_url?, thumbnail_url? } }
    liveLoading: {},      // { toolKey: true/false }
    creatives: {},
    loading: false,
    oneClick: null,       // oneClickCreative output
    oneClickLoading: false,
    brand: {}             // intake.brand — palette/logo/fonts/product shots
  };
  var CAP = 3; // workshop limit: 3 designed pieces per session

  // The six tools, in display order. Logos use brand-color CSS classes.
  // `live` = we have an API key and can render output inline.
  var TOOLS = [
    { key: 'nanobanana', name: 'Nano Banana',  letter: '🍌', best: 'Stylized images with text-in-image · character consistency',
      open: 'https://gemini.google.com/', open_label: 'Open Gemini ↗', live: true, live_label: '▶ Generate image' },
    { key: 'claude',     name: 'Claude',       letter: 'C',  best: 'Editorial HTML posters · typographic design',
      open: 'https://claude.ai/', open_label: 'Open Claude ↗', live: true, live_label: '▶ Render slide' },
    { key: 'chatgpt',    name: 'ChatGPT',      letter: 'G',  best: 'Caption variations · hashtag packs · repurposing',
      open: 'https://chatgpt.com/', open_label: 'Open ChatGPT ↗', live: true, live_label: '▶ Run live' },
    { key: 'veo',        name: 'Veo 3',        letter: 'V',  best: '8-sec cinematic video with synced audio',
      open: 'https://gemini.google.com/', open_label: 'Open Veo (in Gemini) ↗', live: false },
    { key: 'higgsfield', name: 'Higgsfield',   letter: 'H',  best: 'Cinematic camera moves on a still image',
      open: 'https://higgsfield.ai/', open_label: 'Open Higgsfield ↗', live: false },
    { key: 'heygen',     name: 'HeyGen',       letter: 'ʜ',  best: 'AI avatar talking head · direct-to-camera explainers',
      open: 'https://app.heygen.com/', open_label: 'Open HeyGen ↗', live: true, live_label: '▶ Generate video (~60s)' }
  ];

  Des.init = function () {
    MKT.ensureAccess().then(function () {
      MKT.renderChrome('design');
      Promise.all([
        firebase.database().ref(MKT.basePath() + '/calendar').once('value'),
        firebase.database().ref(MKT.basePath() + '/creatives').once('value'),
        MKT.getIntake()
      ]).then(function (out) {
        var months = out[0].val() || {};
        Object.keys(months).forEach(function (mk) {
          state.slotsByMonth[mk] = months[mk].slots || {};
          state.postsByMonth[mk] = months[mk].posts || {};
        });
        state.creatives = out[1].val() || {};
        state.brand = (out[2] || {}).brand || {};
        render();
      });
    });
  };

  function render() {
    var root = document.getElementById('root');
    var creativeCount = Object.keys(state.creatives).length;
    var full = creativeCount >= CAP;
    root.innerHTML = '<div class="des-wrap">'
      + '<div class="mkt-pagehead">'
      + '  <div><h1 class="mkt-pagehead-title">Studio</h1>'
      + '    <p class="mkt-pagehead-desc">One click for a post-ready creative in your brand language — or compare how six different AI tools handle the same brief.</p>'
      + '  </div>'
      + '  <div class="mkt-pagehead-actions">'
      + '    <span class="des-counter' + (full ? ' full' : '') + '">' + creativeCount + ' of ' + CAP + ' crafted</span>'
      + '    <a href="/apply" class="mkt-btn mkt-btn-soft">Apply →</a>'
      + '  </div>'
      + '</div>'
      + '<div class="des-grid">'
      + '  <aside class="des-side" id="side"></aside>'
      + '  <div class="des-stage" id="stage"></div>'
      + '</div></div>';
    renderSide();
    renderStage();
  }

  function renderSide() {
    var side = document.getElementById('side');
    var slots = collectSlots();
    side.innerHTML = '<h3>Pick a calendar slot</h3>'
      + (slots.length === 0
        ? '<p class="mkt-tiny mkt-muted">No calendar yet — generate one first.</p>'
        : '<div class="des-slot-list">' + slots.map(s => {
          var sel = s.id === state.selectedSlotId;
          var hasPost = !!(state.postsByMonth[s.month] && state.postsByMonth[s.month][s.id]);
          var made = slotHasCreative(s.id);
          return '<div class="des-slot' + (sel ? ' sel' : '') + (made ? ' made' : '') + '" data-id="' + MKT.escape(s.id) + '">'
            + '<div class="d">' + MKT.escape(s.date) + ' · ' + MKT.escape(s.platform || '') + ' · ' + MKT.escape(s.format || '') + (made ? ' · <span style="color:var(--brand-deep);font-weight:600;">✦ creative made</span>' : (hasPost ? ' · <span style="color:var(--ok);">post drafted</span>' : '')) + '</div>'
            + '<div class="h">' + MKT.escape(s.hook || s.angle || '') + '</div></div>';
        }).join('') + '</div>');
    side.querySelectorAll('[data-id]').forEach(el => el.onclick = function () {
      var sid = el.getAttribute('data-id');
      state.selectedSlotId = sid;
      state.prompts = null; state.claudeDesign = null;
      // If this post already has a creative, surface it again instead of a blank slate.
      var existing = state.creatives[creativeIdForSlot(sid)];
      state.oneClick = existing ? { post: existing.post, media: existing.media || {}, tool_used: existing.tool, reasoning: existing.reasoning, is_video: false } : null;
      render();
    });
  }

  function collectSlots() {
    var all = [];
    Object.entries(state.slotsByMonth).forEach(function (entry) {
      var mk = entry[0], slots = entry[1];
      Object.entries(slots).forEach(function (e) {
        var s = Object.assign({}, e[1]); s.id = e[0]; s.month = mk; all.push(s);
      });
    });
    all.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return all;
  }
  function findSlot(id) {
    for (var mk in state.slotsByMonth) if (state.slotsByMonth[mk][id]) return Object.assign({ id: id, month: mk }, state.slotsByMonth[mk][id]);
    return null;
  }
  function findPost(slot) { return (state.postsByMonth[slot.month] || {})[slot.id] || null; }

  function renderStage() {
    var stage = document.getElementById('stage');
    if (!state.selectedSlotId) {
      stage.innerHTML = '<div class="des-stage-empty"><div class="icon">🎬</div>'
        + '<h3 class="ttl">Pick a slot to start</h3>'
        + '<p class="desc">Choose any slot from your calendar. We\'ll craft a tool-specific prompt for each of the six tools — image generators, video models, and chat — so you can see how the same idea looks in each.</p></div>';
      return;
    }
    var slot = findSlot(state.selectedSlotId);
    var post = findPost(slot);
    var ready = !!state.prompts;
    var loading = state.loading;
    var html = ''
      + '<div class="des-slot-preview">'
      + '  <div class="meta">' + MKT.escape(slot.date) + ' · ' + MKT.escape(slot.platform || '') + ' · ' + MKT.escape(slot.format || '') + (slot.bucket_function ? ' · ' + MKT.escape(slot.bucket_function) : '') + '</div>'
      + '  <h2 class="hook">' + MKT.escape(slot.hook || '') + '</h2>'
      + '  <p class="angle">' + MKT.escape(slot.angle || '') + '</p>'
      + '  <div class="actions">'
      + '    <button class="mkt-btn mkt-btn-primary mkt-btn-lg" id="b-oneclick" ' + (state.oneClickLoading || Object.keys(state.creatives).length >= CAP ? 'disabled' : '') + '>'
      +       (state.oneClickLoading ? '⚡ Making it… (image ~10s, reel ~90s)' : '⚡ Make it post-ready')
      + '    </button>'
      + '    <button class="mkt-btn mkt-btn-ghost" id="b-craft" ' + (loading ? 'disabled' : '') + '>'
      +       (loading ? '✨ Crafting… (~45 sec)' : (ready ? '↻ Re-compare all 6 tools' : '🔬 Compare all 6 tools'))
      + '    </button>'
      + '    <span class="pcounter">' + Object.keys(state.creatives).length + ' / ' + CAP + ' saved this session</span>'
      + '  </div>'
      + '</div>';
    if (state.oneClick || state.oneClickLoading) html += renderOneClick();
    if (ready) html += renderToolGrid(slot, post);
    stage.innerHTML = html;
    var craft = document.getElementById('b-craft');
    if (craft) craft.onclick = function () { craftAll(slot, post); };
    var oc = document.getElementById('b-oneclick');
    if (oc) oc.onclick = function () { runOneClick(slot, post); };
    // Wire copy buttons (after innerHTML)
    document.querySelectorAll('[data-copy]').forEach(function (b) {
      b.onclick = function () { copy(b.getAttribute('data-copy')); };
    });
    document.querySelectorAll('[data-save]').forEach(function (b) {
      b.onclick = function () { saveCreative(b.getAttribute('data-save')); };
    });
    document.querySelectorAll('[data-live]').forEach(function (b) {
      b.onclick = function () { runLive(b.getAttribute('data-live')); };
    });
    // Render Claude iframe if we have a design
    if (state.claudeDesign) renderClaudeIframe();
  }

  function runLive(toolKey) {
    var slot = findSlot(state.selectedSlotId);
    var post = findPost(slot);
    var tools = (state.prompts && state.prompts.tools) || {};
    var d = tools[toolKey] || {};
    state.liveLoading[toolKey] = true;
    state.liveOutputs[toolKey] = null;
    renderStage();
    var p;
    if (toolKey === 'chatgpt') {
      p = MKT.callAI('runOpenAIText', { prompt: d.prompt || '' });
    } else if (toolKey === 'nanobanana') {
      p = MKT.callAI('runGeminiImage', { prompt: d.prompt || '' });
    } else if (toolKey === 'heygen') {
      p = MKT.callAI('runHeyGenVideo', { script: d.script || '', background_color: '#F5F3FF' });
    } else if (toolKey === 'claude') {
      return renderClaudeHTML(slot, post);
    } else {
      return;
    }
    p.then(function (out) {
      state.liveOutputs[toolKey] = out;
    }).catch(function (e) {
      state.liveOutputs[toolKey] = { error: (e && e.message) || String(e) };
    }).finally(function () {
      state.liveLoading[toolKey] = false;
      renderStage();
    });
  }

  // ---- One-click post-ready ----
  function renderOneClick() {
    if (state.oneClickLoading) {
      return '<div class="des-oneclick"><div class="mkt-row" style="gap:10px;"><span class="mkt-spinner"></span>'
        + '<span>Your CMO is producing this one — picking the tool, applying your brand, writing the caption…</span></div></div>';
    }
    var oc = state.oneClick;
    if (!oc) return '';
    var p = oc.post || {};
    var mediaHtml = '';
    if (oc.media && oc.media.html_design) {
      var d = oc.media.html_design;
      var slide = (d.slides || [])[0] || {};
      var doc = '<!doctype html><html><head><meta charset=\"utf-8\">'
        + '<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:wght@400;600;700&display=swap\" rel=\"stylesheet\">'
        + '<style>html,body{margin:0;padding:0;font-family:Inter,system-ui,sans-serif;height:100%;width:100%;}</style>'
        + (d.head_html || '') + '</head><body>' + (slide.body_html || '') + '</body></html>';
      mediaHtml = '<iframe srcdoc="' + MKT.escape(doc) + '" width="100%" style="aspect-ratio:1;border:0;border-radius:10px;background:#fff;"></iframe>';
    } else if (oc.media && oc.media.image_b64) {
      mediaHtml = '<img src="data:' + (oc.media.mime || 'image/png') + ';base64,' + oc.media.image_b64 + '" style="width:100%;border-radius:10px;display:block;" />';
    } else if (oc.media && oc.media.video_url) {
      mediaHtml = '<video controls src="' + MKT.escape(oc.media.video_url) + '" poster="' + MKT.escape(oc.media.thumbnail_url || '') + '" style="width:100%;border-radius:10px;display:block;background:#000;"></video>';
    } else if (oc.media && oc.media.status === 'still_processing') {
      mediaHtml = '<div style="padding:14px;background:#FEF3C7;border-radius:8px;font-size:13px;color:#92400E;">Video still rendering — check back in a minute. ID: <code>' + MKT.escape(oc.media.video_id) + '</code></div>';
    } else if (oc.media && oc.media.error) {
      mediaHtml = '<div style="padding:14px;background:#FEE2E2;border-radius:8px;font-size:13px;color:#991B1B;">Media failed: ' + MKT.escape(oc.media.error) + '</div>';
    }
    return '<div class="des-oneclick">'
      + '<div class="des-oneclick-head"><span class="mkt-chip brand">⚡ Post-ready</span>'
      + '<span class="mkt-tiny mkt-muted">' + MKT.escape(oc.reasoning || '') + '</span></div>'
      + '<div class="des-oneclick-grid">'
      + '  <div>' + mediaHtml + '</div>'
      + '  <div class="des-oneclick-copy">'
      + '    <h4 style="margin:0 0 4px;font-size:14px;">' + MKT.escape(p.title || p.hook || '') + '</h4>'
      + '    <p style="margin:0 0 8px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;">' + MKT.escape(p.caption || '') + '</p>'
      + ((p.hashtags || []).length ? '<p style="margin:0 0 8px;font-size:12.5px;color:var(--brand-deep);">' + (p.hashtags || []).map(h => '#' + MKT.escape(h)).join(' ') + '</p>' : '')
      + (p.cta ? '<p style="margin:0;font-size:12.5px;"><strong>CTA:</strong> ' + MKT.escape(p.cta) + '</p>' : '')
      + (oc.media && oc.media.script ? '<p style="margin:8px 0 0;font-size:12px;color:var(--ink-3);"><strong>VO script:</strong> ' + MKT.escape(oc.media.script) + '</p>' : '')
      + '    <div class="mkt-row" style="gap:8px;margin-top:12px;align-items:center;">'
      + '      <span class="mkt-chip ok">✓ Saved to this post</span>'
      + '      <button class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-copy="' + MKT.escape((p.caption || '') + '\n\n' + (p.hashtags || []).map(h => '#' + h).join(' ')) + '">Copy caption</button>'
      + '    </div>'
      + '  </div>'
      + '</div></div>';
  }

  // One creative per post — id is derived from the slot, so re-generating the
  // same post overwrites instead of piling up (and doesn't burn the cap).
  function creativeIdForSlot(slotId) { return 'creative-' + slotId; }
  function slotHasCreative(slotId) { return !!state.creatives[creativeIdForSlot(slotId)]; }

  function runOneClick(slot, post) {
    // Cap counts distinct posts that have a creative. Re-rolling an existing one is free.
    if (!slotHasCreative(slot.id) && Object.keys(state.creatives).length >= CAP) {
      MKT.toast('Session limit reached — ' + CAP + ' posts per workshop. Re-roll an existing one instead.', 'warn', 4000);
      return;
    }
    state.oneClickLoading = true; state.oneClick = null;
    renderStage();
    MKT.callAI('oneClickCreative', {
      workspaceId: MKT.workspaceId,
      slot: slot,
      brand: state.brand
    }).then(function (out) {
      state.oneClick = out;
      // Auto-persist immediately — no Save click needed.
      persistOneClick(slot, out);
    }).catch(function (e) {
      MKT.toast(e.message || 'Failed', 'error', 4000);
    }).finally(function () {
      state.oneClickLoading = false;
      renderStage();
    });
  }

  function persistOneClick(slot, oc) {
    var media = oc.media || {};
    var cid = creativeIdForSlot(slot.id);
    var rec = {
      id: cid, slot_id: slot.id, slot_date: slot.date, slot_hook: slot.hook,
      tool: oc.tool_used || 'oneclick', one_click: true,
      post: oc.post || null,
      media: { video_url: media.video_url || null, thumbnail_url: media.thumbnail_url || null, script: media.script || null, prompt: media.prompt || null, html_design: media.html_design || null },
      reasoning: oc.reasoning || '', created_at: Date.now()
    };
    state.creatives[cid] = rec;
    firebase.database().ref(MKT.basePath() + '/creatives/' + cid).set(rec);
  }

  function renderToolGrid(slot, post) {
    var tools = (state.prompts && state.prompts.tools) || {};
    var html = '<div class="des-tool-grid">';
    TOOLS.forEach(function (t) {
      var d = tools[t.key] || {};
      var live = state.liveOutputs[t.key];
      var loading = state.liveLoading[t.key];
      html += '<div class="des-tool">'
        + '  <div class="des-tool-head">'
        + '    <div class="des-tool-logo t-' + t.key + '">' + t.letter + '</div>'
        + '    <div style="min-width:0;flex:1;">'
        + '      <div class="des-tool-name">' + MKT.escape(t.name) + '</div>'
        + '      <div class="des-tool-best">' + MKT.escape(d.best_for || t.best) + '</div>'
        + '    </div>'
        + '    <a class="des-tool-open" href="' + MKT.escape(t.open) + '" target="_blank" rel="noopener">' + t.open_label + '</a>'
        + '  </div>'
        + '  <div class="des-tool-body">'
        + (d.headline ? '<div class="des-tool-headline">' + MKT.escape(d.headline) + '</div>' : '')
        + renderToolBody(t.key, d, slot, post)
        + renderLiveOutput(t.key, live, loading)
        + '  </div>'
        + '  <div class="des-tool-actions">'
        + (t.live ? '<button class="mkt-btn mkt-btn-primary mkt-btn-sm" data-live="' + MKT.escape(t.key) + '" ' + (loading ? 'disabled' : '') + '>' + (loading ? '⏳ Running…' : t.live_label) + '</button>' : '')
        + '    <button class="mkt-btn mkt-btn-soft mkt-btn-sm" data-copy="' + MKT.escape(toolToCopyText(t.key, d, slot)) + '">Copy prompt</button>'
        + '    <button class="mkt-btn mkt-btn-ghost mkt-btn-sm" data-save="' + MKT.escape(t.key) + '">★ Save</button>'
        + '  </div>'
        + '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderLiveOutput(key, out, loading) {
    if (loading) return '<div style="padding:14px;background:var(--brand-soft);border-radius:8px;display:flex;align-items:center;gap:10px;"><span class="mkt-spinner"></span><span class="mkt-tiny" style="color:var(--brand-deep);">Running ' + key + '…</span></div>';
    if (!out) return '';
    if (out.text) {
      return '<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px 14px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;color:var(--ink);">' + MKT.escape(out.text) + '</div>';
    }
    if (out.image_b64) {
      var src = 'data:' + (out.mime || 'image/png') + ';base64,' + out.image_b64;
      return '<div style="border-radius:8px;overflow:hidden;border:1px solid var(--line);"><img src="' + src + '" style="width:100%;display:block;" alt="Generated" /></div>';
    }
    if (out.video_url) {
      return '<div style="border-radius:8px;overflow:hidden;border:1px solid var(--line);background:#000;"><video controls src="' + MKT.escape(out.video_url) + '" poster="' + MKT.escape(out.thumbnail_url || '') + '" style="width:100%;display:block;"></video></div>';
    }
    if (out.status === 'still_processing') {
      return '<div style="padding:12px;background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;font-size:13px;color:#92400E;">Still processing — HeyGen is slow today. Video ID: <code>' + MKT.escape(out.video_id) + '</code></div>';
    }
    if (out.error) {
      return '<div style="padding:12px;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:8px;font-size:13px;color:#991B1B;">' + MKT.escape(out.error) + '</div>';
    }
    return '';
  }

  function renderToolBody(key, d, slot, post) {
    if (key === 'nanobanana') {
      return '<div class="des-prompt-box">'
        + (d.suggested_aspect ? '<span class="lbl">Aspect</span>' + MKT.escape(d.suggested_aspect) + '\n\n' : '')
        + '<span class="lbl">Prompt</span>' + MKT.escape(d.prompt || '')
        + (d.negative_prompt ? '\n\n<span class="lbl">Negative</span>' + MKT.escape(d.negative_prompt) : '')
        + '</div>';
    }
    if (key === 'claude') {
      return '<div class="des-prompt-box">'
        + '<span class="lbl">Design brief</span>' + MKT.escape(d.design_brief || '')
        + '</div>'
        + (state.claudeDesign
          ? '<div class="des-iframe-wrap" id="claude-iframe-wrap"><iframe id="claude-iframe" width="320" height="320"></iframe></div>'
          : '');
    }
    if (key === 'chatgpt') {
      return '<div class="des-prompt-box">' + MKT.escape(d.prompt || '') + '</div>';
    }
    if (key === 'veo') {
      var rows = (d.script || []).map(function (s) {
        return '<div class="des-shot-row">'
          + '<div class="des-shot-time">' + MKT.escape(s.time || '') + '</div>'
          + '<div class="des-shot-detail">'
          + '  <div class="shot">' + MKT.escape(s.shot || '') + '</div>'
          + (s.vo ? '<div class="vo">VO: "' + MKT.escape(s.vo) + '"</div>' : '')
          + (s.audio ? '<div class="audio">Audio: ' + MKT.escape(s.audio) + '</div>' : '')
          + '</div></div>';
      }).join('');
      return '<div class="des-prompt-box script">' + (rows || '<em>(no shots)</em>')
        + (d.music_cue ? '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--line);"><strong>Music cue:</strong> ' + MKT.escape(d.music_cue) + '</div>' : '')
        + (d.suggested_aspect ? '<div style="margin-top:4px;color:var(--ink-3);font-size:11.5px;">Aspect: ' + MKT.escape(d.suggested_aspect) + '</div>' : '')
        + '</div>';
    }
    if (key === 'higgsfield') {
      return '<div class="des-prompt-box">'
        + '<span class="lbl">Starting image</span>' + MKT.escape(d.starting_image_prompt || '') + '\n\n'
        + '<span class="lbl">Motion preset</span>' + MKT.escape(d.motion_preset || '') + ' · ' + (d.duration_seconds || 5) + 's\n\n'
        + (d.why_this_motion ? '<span class="lbl">Why this motion</span>' + MKT.escape(d.why_this_motion) : '')
        + '</div>';
    }
    if (key === 'heygen') {
      var bRoll = (d.suggested_b_roll_keywords || []).join(', ');
      return '<div class="des-prompt-box script">'
        + '<span class="lbl">Avatar</span>' + MKT.escape(d.avatar_brief || '') + '\n\n'
        + '<span class="lbl">Voice tone</span>' + MKT.escape(d.voice_tone || '') + '\n\n'
        + '<span class="lbl">Script (verbatim)</span>' + MKT.escape(d.script || '') + '\n\n'
        + (d.background ? '<span class="lbl">Background</span>' + MKT.escape(d.background) + '\n\n' : '')
        + (bRoll ? '<span class="lbl">B-roll keywords</span>' + MKT.escape(bRoll) : '')
        + '</div>';
    }
    return '';
  }

  function toolToCopyText(key, d, slot) {
    if (key === 'veo') {
      var sc = (d.script || []).map(s => (s.time || '') + ' — ' + (s.shot || '') + (s.vo ? '\n  VO: "' + s.vo + '"' : '') + (s.audio ? '\n  Audio: ' + s.audio : '')).join('\n\n');
      return sc + (d.music_cue ? '\n\nMusic: ' + d.music_cue : '');
    }
    if (key === 'heygen') {
      return 'Avatar: ' + (d.avatar_brief || '') + '\nVoice: ' + (d.voice_tone || '') + '\nScript:\n' + (d.script || '') + (d.background ? '\nBackground: ' + d.background : '');
    }
    if (key === 'higgsfield') {
      return 'Starting image: ' + (d.starting_image_prompt || '') + '\nMotion: ' + (d.motion_preset || '') + ' (' + (d.duration_seconds || 5) + 's)';
    }
    if (key === 'nanobanana') {
      return (d.prompt || '') + (d.negative_prompt ? '\n\nNegative: ' + d.negative_prompt : '') + (d.suggested_aspect ? '\nAspect: ' + d.suggested_aspect : '');
    }
    if (key === 'claude') return d.design_brief || '';
    return d.prompt || '';
  }

  function craftAll(slot, post) {
    state.loading = true; renderStage();
    MKT.callAI('craftToolPrompts', {
      workspaceId: MKT.workspaceId,
      slot: slot,
      post: post || null
    }).then(function (out) {
      state.prompts = out;
      state.loading = false;
      renderStage();
    }).catch(function (e) {
      state.loading = false;
      MKT.toast(e.message || 'Failed', 'error', 4000);
      renderStage();
    });
  }

  function renderClaudeHTML(slot, post) {
    var styleTpl = {};
    state.liveLoading.claude = true;
    renderStage();
    var brief = state.prompts && state.prompts.tools && state.prompts.tools.claude && state.prompts.tools.claude.design_brief;
    var fakePost = post || { hook: slot.hook, title: slot.hook, caption: slot.angle, cta: '', visual_direction: brief || '' };
    MKT.callAI('designPost', {
      slot: slot, post: fakePost, style_template: styleTpl,
      palette: ['#0F172A', '#7C3AED', '#F5F3FF'],
      layout_skeleton: 'editorial_card_overlay', aspect: '1:1'
    }).then(function (design) {
      state.claudeDesign = design;
    }).catch(function (e) {
      state.liveOutputs.claude = { error: e.message || String(e) };
    }).finally(function () {
      state.liveLoading.claude = false;
      renderStage();
    });
  }

  function renderClaudeIframe() {
    var f = document.getElementById('claude-iframe'); if (!f) return;
    var slide = (state.claudeDesign.slides || [])[0] || {};
    var html = '<!doctype html><html><head><meta charset="utf-8">'
      + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:wght@400;600;700&display=swap" rel="stylesheet">'
      + '<style>html,body{margin:0;padding:0;font-family:Inter,system-ui,sans-serif;height:100%;width:100%;}</style>'
      + (state.claudeDesign.head_html || '') + '</head><body>' + (slide.body_html || '') + '</body></html>';
    f.srcdoc = html;
  }

  function copy(text) {
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(function () { MKT.toast('Copied to clipboard', 'ok'); }); }
    else {
      var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
      MKT.toast('Copied', 'ok');
    }
  }

  function saveCreative(toolKey) {
    if (Object.keys(state.creatives).length >= CAP) {
      MKT.toast('Session limit reached — 3 per workshop', 'warn'); return;
    }
    var slot = findSlot(state.selectedSlotId);
    var tools = (state.prompts && state.prompts.tools) || {};
    var d = tools[toolKey] || {};
    var cid = 'creative-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
    var rec = {
      id: cid, slot_id: slot.id, slot_date: slot.date, slot_hook: slot.hook,
      tool: toolKey, brief: d, claude_design: toolKey === 'claude' ? state.claudeDesign : null,
      created_at: Date.now()
    };
    state.creatives[cid] = rec;
    firebase.database().ref(MKT.basePath() + '/creatives/' + cid).set(rec).then(function () {
      MKT.toast('Saved to creatives', 'ok');
      render();
    });
  }

  window.Des = Des;
})();
