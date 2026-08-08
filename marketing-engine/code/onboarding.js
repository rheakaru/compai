/* ============================================================
   onboarding.js — AI-CMO-guided ontology builder.
   7 steps. The agent scrapes, interviews (voice or text),
   parses rambling answers into structure, pushes thinking,
   and quietly builds a content library in the background.
   ============================================================ */

(function () {
  var Onboarding = {};
  var state = {
    intake: {}, personas: {}, channels: {}, buckets: {},
    entityCollections: {}, entities: {},
    current: 1,
    chat: {}        // per-step conversation history: { stepKey: [{role,text}] }
  };

  var STEPS = [
    { n: 1, key: 'brand',    title: 'Your website → brand playbook', time: '~2 min', render: renderStep1 },
    { n: 2, key: 'writeup',  title: 'Tell your CMO about the company', time: '~3 min', render: renderStep2 },
    { n: 3, key: 'personas', title: 'Who you sell to',                time: '~4 min', render: renderStep3 },
    { n: 4, key: 'channels', title: 'Where you show up',              time: '~2 min', render: renderStep4 },
    { n: 5, key: 'buckets',  title: 'Content buckets',                time: '~3 min', render: renderStep5 },
    { n: 6, key: 'funnel',   title: 'Funnel + stack',                 time: '~1 min', render: renderStep6 },
    { n: 7, key: 'done',     title: 'Review & generate',              time: '~1 min', render: renderStep7 }
  ];

  Onboarding.init = function () {
    MKT.ensureAccess().then(function () {
      MKT.renderChrome('onboarding');
      Promise.all([
        MKT.getIntake(),
        MKT.listDocs('personas'),
        MKT.listDocs('channels'),
        MKT.listDocs('buckets'),
        MKT.listDocs('entityCollections')
      ]).then(function (out) {
        state.intake = out[0] || {};
        (out[1] || []).forEach(p => state.personas[p.slug] = p);
        (out[2] || []).forEach(c => state.channels[c.slug] = c);
        (out[3] || []).forEach(b => state.buckets[b.slug] = b);
        (out[4] || []).forEach(c => state.entityCollections[c.slug] = c);
        state.current = Number(state.intake.current_step) || pickResumeStep();
        if (state.current > 7) state.current = 7;
        renderAll();
      });
    });
  };

  function pickResumeStep() {
    if (!state.intake.brand && !state.intake.website) return 1;
    if (!state.intake.writeup) return 2;
    if (Object.keys(state.personas).length === 0) return 3;
    if (Object.keys(state.channels).length === 0) return 4;
    if (Object.keys(state.buckets).length === 0) return 5;
    if (!state.intake.funnel_focus) return 6;
    return 7;
  }

  function stepIsDone(n) {
    switch (n) {
      case 1: return !!(state.intake.brand || state.intake.website);
      case 2: return !!(state.intake.writeup && state.intake.writeup.length > 20);
      case 3: return Object.keys(state.personas).length >= 1;
      case 4: return Object.values(state.channels).some(c => c.active);
      case 5: return Object.keys(state.buckets).length >= 1;
      case 6: return !!state.intake.funnel_focus;
      case 7: return !!state.intake.completed_at;
    }
    return false;
  }

  function setCurrent(n) {
    state.current = n;
    MKT.saveIntake({ current_step: n });
    renderAll();
    setTimeout(function () {
      var target = document.querySelectorAll('.ob-step')[n - 1];
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    }, 30);
  }
  function nextStep() { if (state.current < 7) setCurrent(state.current + 1); }
  function prevStep() { if (state.current > 1) setCurrent(state.current - 1); }
  function backBtnHtml() { return state.current > 1 ? '<button class="mkt-btn mkt-btn-ghost" id="b-back">← Back</button>' : ''; }
  function wireBackBtn(host) { var b = host.querySelector('#b-back'); if (b) b.onclick = prevStep; }

  function renderAll() {
    var root = document.getElementById('root');
    root.innerHTML = '<div class="ob-wrap"><div class="ob-steps" id="ob-steps"></div><aside class="ob-rail" id="ob-rail"></aside></div>';
    var stepsEl = document.getElementById('ob-steps');
    var head = document.createElement('div');
    head.innerHTML = ''
      + '<div class="mkt-pagehead" style="margin-bottom:18px;">'
      + '  <div><h1 class="mkt-pagehead-title">Meet your AI CMO</h1>'
      + '    <p class="mkt-pagehead-desc">It learns your company as you go — scraping, listening, asking, suggesting. Everything stays editable.</p>'
      + '  </div>'
      + '  <div class="mkt-pagehead-actions"><span class="mkt-time-hint">⏱ ~15 minutes</span></div>'
      + '</div>';
    stepsEl.appendChild(head);

    STEPS.forEach(function (s) {
      var done = stepIsDone(s.n);
      var active = s.n === state.current;
      var future = !done && !active && s.n > state.current;
      var card = document.createElement('div');
      card.className = 'ob-step' + (done ? ' done' : '') + (active ? ' active' : '') + (future ? ' future' : '');
      card.innerHTML = ''
        + '<div class="ob-step-head">'
        +   '<div class="ob-step-num">' + (done ? '✓' : s.n) + '</div>'
        +   '<div class="ob-step-title">' + s.title + '</div>'
        +   '<div class="ob-step-meta">' + s.time + '</div>'
        +   '<div class="ob-step-edit">✏ Edit</div>'
        +   '<div class="ob-step-caret">▾</div>'
        + '</div>'
        + '<div class="ob-step-summary" id="sum-' + s.n + '"></div>'
        + '<div class="ob-step-body" id="body-' + s.n + '"></div>';
      stepsEl.appendChild(card);
      card.querySelector('.ob-step-head').onclick = function () { if (!future) setCurrent(s.n); };
      if (active) s.render(card.querySelector('.ob-step-body'));
      if (done) renderSummary(s.n, card.querySelector('.ob-step-summary'));
    });

    var rail = document.getElementById('ob-rail');
    var doneCount = 0; for (var i = 1; i <= 7; i++) if (stepIsDone(i)) doneCount++;
    rail.innerHTML = '<div class="ob-rail-title">Progress · ' + doneCount + '/7</div>';
    STEPS.forEach(function (s) {
      var el = document.createElement('div');
      el.className = 'ob-rail-step' + (stepIsDone(s.n) ? ' done' : '') + (s.n === state.current ? ' active' : '');
      el.innerHTML = '<span class="dot"></span><span>' + s.n + '. ' + s.title + '</span>';
      el.onclick = function () { setCurrent(s.n); };
      rail.appendChild(el);
    });
  }

  function renderSummary(n, el) {
    if (!el) return;
    var b = state.intake.brand || {};
    switch (n) {
      case 1: el.textContent = state.intake.website ? (state.intake.website + ' · ' + (b.palette || []).length + ' colors · ' + ((b.product_images || []).length) + ' assets') : 'Manual setup'; break;
      case 2: el.textContent = trim(state.intake.writeup, 140); break;
      case 3: el.textContent = Object.keys(state.personas).length + ' personas · ' + Object.values(state.personas).map(p => p.name).slice(0, 4).join(', '); break;
      case 4: el.textContent = Object.values(state.channels).filter(c => c.active).map(c => c.platform).join(', '); break;
      case 5: el.textContent = Object.values(state.buckets).map(b => b.name).join(' · '); break;
      case 6: el.textContent = 'Funnel: ' + (state.intake.funnel_focus || '—'); break;
      case 7: el.textContent = state.intake.completed_at ? 'Completed' : ''; break;
    }
  }
  function trim(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // ============================================================
  // Voice input (Web Speech API). Falls back to typing if absent.
  // ============================================================
  function attachVoice(btn, textarea) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { btn.style.display = 'none'; return; }
    var rec = null, active = false;
    btn.onclick = function () {
      if (active) { try { rec.stop(); } catch (e) {} return; }
      rec = new SR();
      rec.continuous = true; rec.interimResults = true; rec.lang = 'en-IN';
      var base = textarea.value ? (textarea.value.trim() + ' ') : '';
      rec.onresult = function (ev) {
        var finalT = '', interim = '';
        for (var i = 0; i < ev.results.length; i++) {
          var r = ev.results[i];
          if (r.isFinal) finalT += r[0].transcript;
          else interim += r[0].transcript;
        }
        textarea.value = base + finalT + interim;
        textarea.scrollTop = textarea.scrollHeight;
      };
      rec.onend = function () { active = false; btn.classList.remove('rec'); btn.innerHTML = '🎙 Speak'; };
      rec.onerror = function () { active = false; btn.classList.remove('rec'); btn.innerHTML = '🎙 Speak'; };
      try { rec.start(); active = true; btn.classList.add('rec'); btn.innerHTML = '⏹ Stop'; } catch (e) {}
    };
  }

  // ============================================================
  // CMO interview panel — shared by steps 2, 3, 5.
  // opts: { stepKey, opener, placeholder, onStructured(structured) }
  // ============================================================
  function renderCmoPanel(host, opts) {
    var hist = state.chat[opts.stepKey] = state.chat[opts.stepKey] || [];
    var panel = document.createElement('div');
    panel.className = 'cmo-panel';
    panel.innerHTML = ''
      + '<div class="cmo-thread" id="thread"></div>'
      + '<div class="cmo-input-row">'
      + '  <textarea class="mkt-textarea cmo-ta" id="cmo-ta" rows="3" placeholder="' + MKT.escape(opts.placeholder || 'Talk or type — messy is fine, your CMO will structure it.') + '"></textarea>'
      + '  <div class="cmo-input-btns">'
      + '    <button class="mkt-btn mkt-btn-soft" id="cmo-voice">🎙 Speak</button>'
      + '    <button class="mkt-btn mkt-btn-primary" id="cmo-send">Send</button>'
      + '  </div>'
      + '</div>';
    host.appendChild(panel);
    var thread = panel.querySelector('#thread');
    var ta = panel.querySelector('#cmo-ta');
    attachVoice(panel.querySelector('#cmo-voice'), ta);

    function bubble(role, text, suggestions) {
      var b = document.createElement('div');
      b.className = 'cmo-bubble ' + role;
      b.innerHTML = (role === 'agent' ? '<div class="cmo-avatar">🧠</div>' : '')
        + '<div class="cmo-bubble-text">' + MKT.escape(text)
        + ((suggestions && suggestions.length)
            ? '<div class="cmo-suggestions">' + suggestions.map(s => '<span class="cmo-sug">💡 ' + MKT.escape(s) + '</span>').join('') + '</div>'
            : '')
        + '</div>';
      thread.appendChild(b);
      thread.scrollTop = thread.scrollHeight;
    }

    // Replay history, or show the opener
    if (hist.length) hist.forEach(h => bubble(h.role, h.text, h.suggestions));
    else { bubble('agent', opts.opener); hist.push({ role: 'agent', text: opts.opener }); }

    function send() {
      var text = ta.value.trim();
      if (!text) return;
      ta.value = '';
      bubble('user', text);
      hist.push({ role: 'user', text: text });
      var typing = document.createElement('div');
      typing.className = 'cmo-bubble agent';
      typing.innerHTML = '<div class="cmo-avatar">🧠</div><div class="cmo-bubble-text"><span class="mkt-spinner"></span> thinking…</div>';
      thread.appendChild(typing); thread.scrollTop = thread.scrollHeight;
      MKT.callAI('agentChat', {
        workspaceId: MKT.workspaceId,
        step: opts.stepKey,
        user_input: text,
        history: hist.slice(0, -1).map(h => ({ role: h.role, text: h.text }))
      }).then(function (r) {
        typing.remove();
        bubble('agent', r.reply || '…', r.suggestions);
        hist.push({ role: 'agent', text: r.reply || '', suggestions: r.suggestions });
        if (r.structured && opts.onStructured) opts.onStructured(r.structured);
      }).catch(function (e) {
        typing.remove();
        // Put the message back so retry is one click, and drop it from history
        // so a resend doesn't double it up.
        hist.pop();
        ta.value = text;
        console.error('agentChat failed:', e);
        bubble('agent', 'I hit a technical error and couldn\'t process that (' + (e.message || e) + '). Your message is back in the box — hit send to retry. If this keeps happening, please let the Rhai team know.');
        MKT.toast('CMO error: ' + (e.message || e), 'error', 4000);
      });
    }
    panel.querySelector('#cmo-send').onclick = send;
    ta.addEventListener('keydown', function (ev) {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') send();
    });
    return { bubble: bubble };
  }

  // ============================================================
  // STEP 1 · Website → Brand Playbook
  // ============================================================
  function renderStep1(host) {
    var brand = state.intake.brand || null;
    host.innerHTML = ''
      + '<p class="mkt-hint" style="margin:0 0 12px;">Drop your website. Your CMO reads it live — logo, colors, fonts, product shots — and builds your brand playbook. Everything it finds is editable.</p>'
      + '<div class="mkt-row" style="gap:8px;">'
      + '  <input class="mkt-input" id="url" style="flex:1;" placeholder="https://yourcompany.com" value="' + MKT.escape(state.intake.website && state.intake.website !== '__skipped__' ? state.intake.website : '') + '" />'
      + '  <button class="mkt-btn mkt-btn-primary" id="b-scrape">Read my site</button>'
      + '  <button class="mkt-btn mkt-btn-ghost" id="b-manual">No website — set up manually</button>'
      + '</div>'
      + '<div class="scrape-feed" id="feed" style="display:none;"></div>'
      + '<div id="playbook"></div>'
      + '<div class="ob-step-actions" style="margin-top:18px;">' + backBtnHtml() + '<button class="mkt-btn mkt-btn-primary" id="b-next">Continue</button></div>';
    wireBackBtn(host);

    if (brand) renderPlaybook(host.querySelector('#playbook'), brand);

    host.querySelector('#b-manual').onclick = function () {
      var empty = { logo_url: '', palette: ['#7C3AED'], fonts: [], product_images: [], tagline: '', description: '' };
      state.intake.brand = empty;
      MKT.saveIntake({ website: '__skipped__', brand: empty });
      renderPlaybook(host.querySelector('#playbook'), empty);
    };

    host.querySelector('#b-scrape').onclick = function () {
      var url = host.querySelector('#url').value.trim();
      if (!url) { MKT.toast('Type your website URL first', 'warn'); return; }
      var feed = host.querySelector('#feed');
      feed.style.display = 'block';
      feed.innerHTML = '<div class="scrape-line"><span class="mkt-spinner"></span> Your CMO is opening ' + MKT.escape(url) + '…</div>';

      // Listen to live progress
      var jobRef = firebase.database().ref(MKT.basePath() + '/scrapeJob/steps');
      var seen = {};
      jobRef.on('child_added', function (snap) {
        var s = snap.val(); if (!s || seen[snap.key]) return; seen[snap.key] = 1;
        var line = document.createElement('div');
        line.className = 'scrape-line' + (s.done ? ' done' : '');
        line.innerHTML = (s.done ? '✓ ' : '· ') + MKT.escape(s.label);
        feed.appendChild(line);
        feed.scrollTop = feed.scrollHeight;
      });

      MKT.callAI('scrapeWebsite', { url: url, workspaceId: MKT.workspaceId }).then(function (r) {
        jobRef.off();
        var brandData = {
          logo_url: r.logo_url || '',
          palette: r.palette || [],
          fonts: r.fonts || [],
          product_images: r.product_images || [],
          screenshots: r.screenshots || [],
          tagline: r.tagline || '',
          description: r.description || ''
        };
        state.intake.brand = brandData;
        state.intake.website = url;
        state.intake.writeup_seed = [r.tagline, r.description].filter(Boolean).join('\n\n');
        MKT.saveIntake({ website: url, brand: brandData, writeup_seed: state.intake.writeup_seed });
        var doneLine = document.createElement('div');
        doneLine.className = 'scrape-line done';
        doneLine.innerHTML = '✓ <strong>Playbook drafted — review it below.</strong>';
        feed.appendChild(doneLine);
        renderPlaybook(host.querySelector('#playbook'), brandData);
      }).catch(function (e) {
        jobRef.off();
        feed.innerHTML += '<div class="scrape-line" style="color:var(--danger);">✗ ' + MKT.escape(e.message || String(e)) + ' — you can set up manually instead.</div>';
      });
    };

    host.querySelector('#b-next').onclick = function () {
      if (!state.intake.brand && !state.intake.website) { MKT.toast('Read your site or choose manual setup', 'warn'); return; }
      nextStep();
    };
  }

  function saveBrand() {
    MKT.saveIntake({ brand: state.intake.brand });
  }

  function renderPlaybook(hostEl, b) {
    hostEl.innerHTML = ''
      + '<div class="playbook">'
      + '  <h3 class="pb-title">Brand playbook <span class="mkt-tiny mkt-muted">— click anything to edit</span></h3>'
      + '  <div class="pb-grid">'
      + '    <div class="pb-card"><h4>Logo</h4><div class="pb-logo" id="pb-logo">' + (b.logo_url ? '<img src="' + MKT.escape(b.logo_url) + '" />' : '<span class="mkt-muted">none yet</span>') + '</div>'
      + '      <label class="mkt-btn mkt-btn-ghost mkt-btn-sm"><input type="file" id="pb-logo-up" accept="image/*" style="display:none;" />⬆ Upload logo</label></div>'
      + '    <div class="pb-card"><h4>Colors</h4><div class="pb-swatches" id="pb-swatches"></div>'
      + '      <div class="mkt-row" style="gap:6px;margin-top:8px;"><input class="mkt-input" id="pb-newcolor" placeholder="#hex" style="width:90px;padding:6px 8px;font-size:12px;" /><button class="mkt-btn mkt-btn-ghost mkt-btn-sm" id="pb-addcolor">+ Add</button></div></div>'
      + '    <div class="pb-card"><h4>Fonts</h4><div class="pb-fonts" id="pb-fonts"></div>'
      + '      <div class="mkt-row" style="gap:6px;margin-top:8px;"><input class="mkt-input" id="pb-newfont" placeholder="Font name" style="flex:1;padding:6px 8px;font-size:12px;" /><button class="mkt-btn mkt-btn-ghost mkt-btn-sm" id="pb-addfont">+ Add</button></div></div>'
      + '  </div>'
      + '  <div class="pb-card" style="margin-top:12px;"><h4>Product photos & assets</h4>'
      + '    <div class="pb-assets" id="pb-assets"></div>'
      + '    <label class="mkt-btn mkt-btn-ghost mkt-btn-sm" style="margin-top:8px;"><input type="file" id="pb-asset-up" accept="image/*" multiple style="display:none;" />⬆ Upload assets</label>'
      + '  </div>'
      + '  <div class="pb-card" style="margin-top:12px;"><h4>Tagline</h4>'
      + '    <input class="mkt-input" id="pb-tagline" value="' + MKT.escape(b.tagline || '') + '" placeholder="Your one-liner" />'
      + '  </div>'
      + '</div>';

    function renderSwatches() {
      var sw = hostEl.querySelector('#pb-swatches');
      sw.innerHTML = (b.palette || []).map(function (c, i) {
        return '<span class="pb-swatch" data-i="' + i + '" style="background:' + MKT.escape(c) + '" title="' + MKT.escape(c) + ' — click to remove">×</span>';
      }).join('') || '<span class="mkt-tiny mkt-muted">none yet</span>';
      sw.querySelectorAll('.pb-swatch').forEach(function (el) {
        el.onclick = function () {
          if (!confirm('Remove ' + b.palette[Number(el.getAttribute('data-i'))] + '?')) return;
          b.palette.splice(Number(el.getAttribute('data-i')), 1);
          saveBrand(); renderSwatches();
        };
      });
    }
    function renderFonts() {
      var f = hostEl.querySelector('#pb-fonts');
      f.innerHTML = (b.fonts || []).map(function (name, i) {
        return '<span class="mkt-chip brand pb-font" data-i="' + i + '">' + MKT.escape(name) + ' ×</span>';
      }).join(' ') || '<span class="mkt-tiny mkt-muted">none yet</span>';
      f.querySelectorAll('.pb-font').forEach(function (el) {
        el.style.cursor = 'pointer';
        el.onclick = function () { b.fonts.splice(Number(el.getAttribute('data-i')), 1); saveBrand(); renderFonts(); };
      });
    }
    function renderAssets() {
      var a = hostEl.querySelector('#pb-assets');
      var all = (b.product_images || []);
      a.innerHTML = all.map(function (u, i) {
        return '<div class="pb-asset" data-i="' + i + '"><img src="' + MKT.escape(u) + '" /><span class="pb-asset-x">×</span></div>';
      }).join('') || '<span class="mkt-tiny mkt-muted">none yet — upload product shots, packaging, past creatives</span>';
      a.querySelectorAll('.pb-asset .pb-asset-x').forEach(function (x) {
        x.onclick = function () {
          var i = Number(x.parentElement.getAttribute('data-i'));
          b.product_images.splice(i, 1); saveBrand(); renderAssets();
        };
      });
    }
    renderSwatches(); renderFonts(); renderAssets();

    hostEl.querySelector('#pb-addcolor').onclick = function () {
      var v = hostEl.querySelector('#pb-newcolor').value.trim();
      if (!/^#[0-9a-fA-F]{3,8}$/.test(v)) { MKT.toast('Use #hex format', 'warn'); return; }
      b.palette = b.palette || []; b.palette.push(v);
      hostEl.querySelector('#pb-newcolor').value = '';
      saveBrand(); renderSwatches();
    };
    hostEl.querySelector('#pb-addfont').onclick = function () {
      var v = hostEl.querySelector('#pb-newfont').value.trim();
      if (!v) return;
      b.fonts = b.fonts || []; b.fonts.push(v);
      hostEl.querySelector('#pb-newfont').value = '';
      saveBrand(); renderFonts();
    };
    hostEl.querySelector('#pb-tagline').onblur = function () {
      b.tagline = hostEl.querySelector('#pb-tagline').value.trim(); saveBrand();
    };
    hostEl.querySelector('#pb-logo-up').onchange = function (ev) {
      var file = ev.target.files[0]; if (!file) return;
      MKT.toast('Uploading logo…');
      MKT.uploadAssetFile(file).then(function (up) {
        b.logo_url = up.download_url; saveBrand();
        hostEl.querySelector('#pb-logo').innerHTML = '<img src="' + MKT.escape(up.download_url) + '" />';
        MKT.toast('Logo updated', 'ok');
      }).catch(function (e) { MKT.toast(e.message, 'error'); });
    };
    hostEl.querySelector('#pb-asset-up').onchange = function (ev) {
      var files = Array.from(ev.target.files || []); if (!files.length) return;
      ev.target.value = '';
      var a = hostEl.querySelector('#pb-assets');
      // If the grid is showing the "none yet" hint, clear it so placeholders show.
      if (!(b.product_images || []).length) a.innerHTML = '';
      b.product_images = b.product_images || [];
      files.forEach(function (file) {
        var localUrl = URL.createObjectURL(file);
        var tile = document.createElement('div');
        tile.className = 'pb-asset pending';
        tile.innerHTML = '<img src="' + localUrl + '" /><span class="pb-asset-spinner"><span class="mkt-spinner"></span></span>';
        a.appendChild(tile);
        MKT.uploadAssetFile(file).then(function (up) {
          b.product_images.push(up.download_url);
          saveBrand(); renderAssets();
          URL.revokeObjectURL(localUrl);
        }).catch(function (e) {
          tile.classList.add('failed');
          tile.querySelector('.pb-asset-spinner').innerHTML = '<span style="color:var(--danger);font-size:11px;">failed</span>';
          MKT.toast(e.message, 'error');
        });
      });
    };
  }

  // ============================================================
  // STEP 2 · The company — CMO interview
  // ============================================================
  function renderStep2(host) {
    host.innerHTML = '<p class="mkt-hint" style="margin:0 0 12px;">Talk to your CMO like you\'d talk to a smart new hire. Ramble — it structures everything.</p>'
      + '<div id="cmo-host"></div>'
      + '<div class="ob-applied" id="applied"></div>'
      + '<div class="ob-step-actions" style="margin-top:18px;">' + backBtnHtml() + '<button class="mkt-btn mkt-btn-primary" id="b-next">Continue</button></div>';
    wireBackBtn(host);

    var seed = state.intake.writeup_seed;
    var opener = seed
      ? 'I read your website — here\'s my first take: "' + trim(seed, 200) + '". Now tell me in your own words: what do you sell, who actually pays for it, and what makes people pick you over the obvious alternative?'
      : 'Tell me about the company — what do you sell, who actually pays for it, and what makes people pick you over the obvious alternative? Talk freely, I\'ll structure it.';

    function renderApplied() {
      var el = host.querySelector('#applied');
      if (!state.intake.writeup) { el.innerHTML = ''; return; }
      el.innerHTML = '<h4 class="ob-applied-title">📋 Your CMO\'s structured version <span class="mkt-tiny mkt-muted">(editable)</span></h4>'
        + '<textarea class="mkt-textarea" id="w-final" rows="4">' + MKT.escape(state.intake.writeup) + '</textarea>';
      el.querySelector('#w-final').onblur = function () {
        state.intake.writeup = el.querySelector('#w-final').value.trim();
        MKT.saveIntake({ writeup: state.intake.writeup });
      };
    }
    renderApplied();

    renderCmoPanel(host.querySelector('#cmo-host'), {
      stepKey: 'writeup',
      opener: opener,
      placeholder: 'e.g. "So we basically sell fresh flowers for daily puja, mostly to families in Bangalore who…"',
      onStructured: function (s) {
        if (s.writeup) {
          state.intake.writeup = s.writeup;
          var patch = { writeup: s.writeup };
          if (s.customer_types) { state.intake.customer_types = s.customer_types; patch.customer_types = s.customer_types; }
          MKT.saveIntake(patch);
          renderApplied();
        }
      }
    });

    host.querySelector('#b-next').onclick = function () {
      if (!state.intake.writeup || state.intake.writeup.length < 20) { MKT.toast('Give your CMO at least one good answer first', 'warn'); return; }
      nextStep();
    };
  }

  // ============================================================
  // STEP 3 · Personas — CMO interview + editable cards
  // ============================================================
  function renderStep3(host) {
    host.innerHTML = '<p class="mkt-hint" style="margin:0 0 12px;">Describe your customers out loud — types, moments they buy, what they worry about. Your CMO turns it into formal personas (and will suggest ones you missed).</p>'
      + '<div id="cmo-host"></div>'
      + '<div class="ob-persona-grid" id="pg" style="margin-top:16px;"></div>'
      + '<div class="ob-step-actions" style="margin-top:18px;">' + backBtnHtml()
      + '<button class="mkt-btn mkt-btn-ghost" id="b-blank">+ Add persona manually</button>'
      + '<button class="mkt-btn mkt-btn-primary" id="b-next">Continue</button></div>';
    wireBackBtn(host);
    var pg = host.querySelector('#pg');
    renderPersonas(pg);

    renderCmoPanel(host.querySelector('#cmo-host'), {
      stepKey: 'personas',
      opener: 'Based on what you\'ve told me' + (state.intake.customer_types ? (' — and the customer types I noted (' + trim(state.intake.customer_types, 80) + ')') : '') + ' — walk me through who actually buys. Who\'s the easiest sale? Who\'s the most valuable? Who should be buying but isn\'t yet?',
      placeholder: 'e.g. "There\'s this one type — usually the mom in the house, 45+, she orders weekly and never churns…"',
      onStructured: function (s) {
        (s.personas || []).forEach(function (p) {
          var slug = MKT.slugify(p.name) + '-' + Math.random().toString(36).slice(2, 4);
          // Merge with an existing persona of the same name instead of duplicating
          var existing = Object.values(state.personas).find(x => x.name === p.name);
          if (existing) slug = existing.slug;
          var doc = Object.assign({}, existing || {}, p, { slug: slug });
          state.personas[slug] = doc;
          MKT.saveDoc('personas', slug, doc);
        });
        renderPersonas(pg);
      }
    });

    host.querySelector('#b-blank').onclick = function () {
      var slug = 'persona-' + Math.random().toString(36).slice(2, 6);
      var doc = { slug: slug, name: 'New persona', age_range: '', occupation: '', motivations: [], pain_points: [], voice_to_use: '', where_they_hang_out: [], sample_objection: '' };
      state.personas[slug] = doc;
      MKT.saveDoc('personas', slug, doc).then(function () { renderPersonas(pg); });
    };
    host.querySelector('#b-next').onclick = function () {
      if (Object.keys(state.personas).length === 0) { MKT.toast('Describe at least one customer to your CMO', 'warn'); return; }
      nextStep();
    };
  }

  function renderPersonas(pg) {
    pg.innerHTML = '';
    Object.values(state.personas).forEach(function (p) {
      var card = document.createElement('div'); card.className = 'ob-persona-card';
      card.innerHTML = ''
        + '<button class="pcard-x" title="Remove">×</button>'
        + '<input class="pcard-name" data-k="name" placeholder="Name" value="' + MKT.escape(p.name) + '" />'
        + '<div class="pcard-meta"><input data-k="age_range" placeholder="Age range" value="' + MKT.escape(p.age_range) + '" /><input data-k="occupation" placeholder="Occupation" value="' + MKT.escape(p.occupation) + '" /></div>'
        + '<textarea data-k="motivations" placeholder="Motivations (one per line)" rows="2">' + MKT.escape(arrToLines(p.motivations)) + '</textarea>'
        + '<textarea data-k="pain_points" placeholder="Pain points (one per line)" rows="2">' + MKT.escape(arrToLines(p.pain_points)) + '</textarea>'
        + '<textarea data-k="voice_to_use" placeholder="Voice to use" rows="1">' + MKT.escape(p.voice_to_use) + '</textarea>'
        + '<textarea data-k="sample_objection" placeholder="Sample objection" rows="1">' + MKT.escape(p.sample_objection) + '</textarea>';
      card.querySelector('.pcard-x').onclick = function () {
        if (!confirm('Remove this persona?')) return;
        delete state.personas[p.slug];
        MKT.deleteDoc('personas', p.slug).then(function () { renderPersonas(pg); });
      };
      card.querySelectorAll('[data-k]').forEach(function (inp) {
        inp.onblur = function () {
          var k = inp.getAttribute('data-k');
          var v = inp.value;
          if (['motivations', 'pain_points', 'where_they_hang_out'].indexOf(k) >= 0) v = v.split('\n').map(s => s.trim()).filter(Boolean);
          p[k] = v;
          MKT.saveDoc('personas', p.slug, p);
        };
      });
      pg.appendChild(card);
    });
  }
  function arrToLines(v) { if (Array.isArray(v)) return v.join('\n'); return String(v || ''); }

  // ============================================================
  // STEP 4 · Channels — toggle grid + CMO recommendation
  // ============================================================
  var CHANNEL_OPTIONS = [
    { slug: 'instagram', label: 'Instagram', icon: '📷' }, { slug: 'youtube', label: 'YouTube', icon: '▶️' },
    { slug: 'linkedin', label: 'LinkedIn', icon: '💼' }, { slug: 'facebook', label: 'Facebook', icon: '📘' },
    { slug: 'x', label: 'X (Twitter)', icon: '𝕏' }, { slug: 'pinterest', label: 'Pinterest', icon: '📌' },
    { slug: 'whatsapp', label: 'WhatsApp', icon: '💬' }, { slug: 'tiktok', label: 'TikTok', icon: '🎵' },
    { slug: 'threads', label: 'Threads', icon: '🧵' }, { slug: 'reddit', label: 'Reddit', icon: '🤖' },
    { slug: 'substack', label: 'Substack', icon: '📨' }, { slug: 'blog', label: 'Blog', icon: '✍️' }
  ];
  function renderStep4(host) {
    host.innerHTML = ''
      + '<p class="mkt-hint" style="margin:0 0 10px;">Toggle where you\'re active — or ask your CMO where you <em>should</em> be.</p>'
      + '<div class="mkt-row" style="margin:0 0 12px;"><button class="mkt-btn mkt-btn-soft" id="b-ask">🧠 Where should we focus?</button><span class="ob-saving" id="cmo-say" style="flex:1;"></span></div>'
      + '<div class="ob-channel-grid" id="cg"></div>'
      + '<div class="ob-step-actions" style="margin-top:18px;">' + backBtnHtml() + '<button class="mkt-btn mkt-btn-primary" id="b-next">Continue</button></div>';
    wireBackBtn(host);
    var cg = host.querySelector('#cg');

    function renderGrid() {
      cg.innerHTML = '';
      CHANNEL_OPTIONS.forEach(function (opt) {
        var existing = state.channels[opt.slug] || {};
        var card = document.createElement('div'); card.className = 'ob-channel-card' + (existing.active ? ' on' : '');
        card.innerHTML = ''
          + '<div class="ch-top"><span>' + opt.icon + '</span><span>' + opt.label + '</span>' + (existing.cmo_pick ? '<span class="mkt-chip brand" style="margin-left:auto;">CMO pick</span>' : '') + '</div>'
          + '<div class="ch-detail">'
          + '  <input data-k="handle_url" placeholder="Account link (URL)" value="' + MKT.escape(existing.handle_url || '') + '" />'
          + '  <textarea data-k="what_we_post" rows="2" placeholder="What kind of stuff you post here">' + MKT.escape(existing.what_we_post || '') + '</textarea>'
          + '</div>';
        card.querySelector('.ch-top').onclick = function () {
          card.classList.toggle('on');
          var doc = Object.assign({}, state.channels[opt.slug] || {}, { slug: opt.slug, platform: opt.label, active: card.classList.contains('on') });
          state.channels[opt.slug] = doc;
          MKT.saveDoc('channels', opt.slug, doc);
        };
        card.querySelectorAll('[data-k]').forEach(function (inp) {
          inp.onblur = function () {
            var doc = state.channels[opt.slug] || { slug: opt.slug, platform: opt.label, active: true };
            doc[inp.getAttribute('data-k')] = inp.value;
            state.channels[opt.slug] = doc;
            MKT.saveDoc('channels', opt.slug, doc);
          };
        });
        cg.appendChild(card);
      });
    }
    renderGrid();

    host.querySelector('#b-ask').onclick = function () {
      var say = host.querySelector('#cmo-say');
      say.innerHTML = '<span class="mkt-spinner"></span> Your CMO is thinking…';
      MKT.callAI('agentChat', {
        workspaceId: MKT.workspaceId, step: 'channels',
        user_input: 'Given everything you know about us, which channels should we be active on and what should we post on each? Mark your top picks.',
        history: []
      }).then(function (r) {
        say.textContent = r.reply || '';
        (r.structured && r.structured.channels || []).forEach(function (c) {
          var slug = MKT.slugify(c.slug || c.platform);
          var match = CHANNEL_OPTIONS.find(o => o.slug === slug) || CHANNEL_OPTIONS.find(o => o.label.toLowerCase() === String(c.platform || '').toLowerCase());
          if (!match) return;
          var doc = Object.assign({}, state.channels[match.slug] || {}, {
            slug: match.slug, platform: match.label, active: true,
            what_we_post: c.what_we_post || (state.channels[match.slug] || {}).what_we_post || '',
            cmo_pick: true
          });
          state.channels[match.slug] = doc;
          MKT.saveDoc('channels', match.slug, doc);
        });
        renderGrid();
      }).catch(function (e) { say.textContent = 'Failed: ' + e.message; });
    };

    host.querySelector('#b-next').onclick = function () {
      if (!Object.values(state.channels).some(c => c.active)) { MKT.toast('Toggle at least one channel', 'warn'); return; }
      nextStep();
    };
  }

  // ============================================================
  // STEP 5 · Buckets — CMO interview + cards
  // ============================================================
  function renderStep5(host) {
    host.innerHTML = '<p class="mkt-hint" style="margin:0 0 12px;">Buckets are repeatable content rhythms — "Customer love Fridays", "Founder honesty posts". Tell your CMO what content you enjoy making (or could sustain), and it\'ll design the mix.</p>'
      + '<div id="cmo-host"></div>'
      + '<div class="ob-bucket-grid" id="bg" style="margin-top:16px;"></div>'
      + '<div class="ob-saving" id="mix-status" style="margin-top:10px;"></div>'
      + '<div class="ob-step-actions" style="margin-top:18px;">' + backBtnHtml()
      + '<button class="mkt-btn mkt-btn-soft" id="b-suggest">✨ Just propose a full mix</button>'
      + '<button class="mkt-btn mkt-btn-ghost" id="b-manual">+ Add my own bucket</button>'
      + '<button class="mkt-btn mkt-btn-primary" id="b-next">Continue</button></div>';
    wireBackBtn(host);
    var bg = host.querySelector('#bg');

    function renderBuckets() {
      bg.innerHTML = '';
      Object.values(state.buckets).forEach(function (b) {
        var card = document.createElement('div'); card.className = 'ob-bucket-card accepted';
        card.innerHTML = '<div class="bt">' + MKT.escape(b.name) + '</div>'
          + '<div class="bd">' + MKT.escape(b.description || '') + '</div>'
          + '<div class="bmeta"><span class="mkt-chip brand">' + MKT.escape(b.function || '') + '</span><span>· ' + (b.frequency_count || 1) + '/' + (b.frequency_per || 'week') + '</span><span class="mkt-spacer"></span><button class="mkt-icon-btn" title="Remove">×</button></div>';
        card.querySelector('.mkt-icon-btn').onclick = function (ev) {
          ev.stopPropagation();
          if (!confirm('Remove this bucket?')) return;
          delete state.buckets[b.slug];
          MKT.deleteDoc('buckets', b.slug).then(renderBuckets);
        };
        bg.appendChild(card);
      });
    }
    renderBuckets();

    function applyBuckets(arr) {
      (arr || []).forEach(function (b) {
        var slug = MKT.slugify(b.slug || b.name);
        var doc = Object.assign({}, state.buckets[slug] || {}, b, { slug: slug });
        state.buckets[slug] = doc;
        MKT.saveDoc('buckets', slug, doc);
      });
      renderBuckets();
    }

    renderCmoPanel(host.querySelector('#cmo-host'), {
      stepKey: 'buckets',
      opener: 'Last big one. What kind of content do you actually enjoy making — and what could you sustain weekly without burning out? Behind-the-scenes? Teaching? Customer stories? Tell me, and I\'ll design buckets around your reality, not a fantasy calendar.',
      placeholder: 'e.g. "I like talking to camera, and we get amazing customer photos on WhatsApp every week…"',
      onStructured: function (s) { applyBuckets(s.buckets); }
    });

    host.querySelector('#b-suggest').onclick = function () {
      var btn = host.querySelector('#b-suggest');
      var status = host.querySelector('#mix-status');
      btn.disabled = true; btn.innerHTML = '<span class="mkt-spinner" style="vertical-align:middle;"></span> Designing your mix…';
      status.innerHTML = '<span class="mkt-spinner" style="vertical-align:middle;"></span> Your CMO is reading your personas + channels and designing a sustainable weekly mix — about 20 seconds…';
      MKT.callAI('brainstormBuckets', { workspaceId: MKT.workspaceId, existing_buckets: Object.values(state.buckets), count: 6 }).then(function (r) {
        applyBuckets(r.suggestions);
        status.textContent = '✓ ' + (r.suggestions || []).length + ' buckets proposed — remove any that don\'t fit, or ask your CMO to adjust.';
        status.className = 'ob-saving ok';
      }).catch(function (e) {
        status.textContent = 'Failed: ' + e.message;
      }).finally(function () {
        btn.disabled = false; btn.innerHTML = '✨ Just propose a full mix';
      });
    };

    host.querySelector('#b-manual').onclick = function () {
      var slug = 'bucket-' + Math.random().toString(36).slice(2, 6);
      var draft = { slug: slug, name: '', function: 'Educate', description: '', frequency_count: 1, frequency_per: 'week' };
      var form = MKT.renderForm(draft, [
        { key: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Customer love Fridays', required: true },
        { key: 'function', label: 'Function', type: 'select', options: ['Educate', 'Inspire', 'Entertain', 'Persuade'] },
        { key: 'description', label: 'What goes in this bucket', type: 'textarea', placeholder: 'e.g. Real customer testimonials, photos and quotes from WhatsApp — social proof.' },
        { key: 'frequency_count', label: 'How often (count)', type: 'number', placeholder: '1' },
        { key: 'frequency_per', label: 'How often (per)', type: 'select', options: ['day', 'week', 'month'] }
      ]);
      MKT.openDrawer({
        title: 'New bucket',
        body: form.element,
        actions: [
          { label: 'Cancel', kind: 'ghost', onClick: function () {} },
          { label: 'Add bucket', kind: 'primary', onClick: function () {
            var v = form.read();
            if (!v.name || v.name.trim().length < 2) { MKT.toast('Name is required', 'warn'); return false; }
            v.frequency_count = Number(v.frequency_count) || 1;
            applyBuckets([Object.assign(draft, v)]);
            MKT.toast('Bucket added', 'ok');
          } }
        ]
      });
    };

    host.querySelector('#b-next').onclick = function () {
      if (Object.keys(state.buckets).length === 0) { MKT.toast('Add at least one bucket', 'warn'); return; }
      // Quietly start building the content library — no user step needed.
      if (!state.intake.entities_started) {
        state.intake.entities_started = true;
        MKT.saveIntake({ entities_started: true });
        MKT.callAI('generateEntitiesFromBuckets', { workspaceId: MKT.workspaceId }).then(function () {
          MKT.saveIntake({ entities_ready: true });
          state.intake.entities_ready = true;
        }).catch(function (e) {
          console.error('generateEntitiesFromBuckets failed:', e);
          MKT.toast('Entity generation failed: ' + (e.message || e) + ' — it will retry from the review step', 'error', 4000);
        });
      }
      nextStep();
    };
  }

  // ============================================================
  // STEP 6 · Funnel + stack
  // ============================================================
  function renderStep6(host) {
    var funnels = [
      { v: 'awareness', l: 'Awareness' }, { v: 'consideration', l: 'Consideration' },
      { v: 'conversion', l: 'Conversion' }, { v: 'retention', l: 'Retention' }, { v: 'mixed', l: 'Mixed' }
    ];
    var cur = state.intake.funnel_focus || 'mixed';
    host.innerHTML = ''
      + '<div class="mkt-field"><label class="mkt-label">Funnel focus this session</label>'
      + '<div class="mkt-row" style="gap:6px;flex-wrap:wrap;">' + funnels.map(f => '<button class="mkt-btn ' + (f.v === cur ? 'mkt-btn-primary' : 'mkt-btn-ghost') + ' mkt-btn-sm" data-f="' + f.v + '">' + f.l + '</button>').join('') + '</div></div>'
      + '<div class="mkt-field"><label class="mkt-label">Current marketing stack</label>'
      + '<textarea class="mkt-textarea" id="ms" rows="2" placeholder="e.g. Mailchimp, Canva, an agency for ads, in-house for social">' + MKT.escape(state.intake.marketing_stack || '') + '</textarea></div>'
      + '<div class="ob-step-actions" style="margin-top:18px;">' + backBtnHtml() + '<button class="mkt-btn mkt-btn-primary" id="b-next">Save & continue</button></div>';
    wireBackBtn(host);
    host.querySelectorAll('[data-f]').forEach(function (b) {
      b.onclick = function () {
        cur = b.getAttribute('data-f');
        host.querySelectorAll('[data-f]').forEach(function (bb) {
          bb.className = 'mkt-btn ' + (bb.getAttribute('data-f') === cur ? 'mkt-btn-primary' : 'mkt-btn-ghost') + ' mkt-btn-sm';
        });
      };
    });
    host.querySelector('#b-next').onclick = function () {
      MKT.saveIntake({ funnel_focus: cur, marketing_stack: host.querySelector('#ms').value.trim() }).then(function () {
        state.intake.funnel_focus = cur;
        nextStep();
      });
    };
  }

  // ============================================================
  // STEP 7 · Review
  // ============================================================
  function renderStep7(host) {
    host.innerHTML = '<div id="rv"></div>'
      + '<div class="ob-step-actions" style="margin-top:24px;gap:10px;">' + backBtnHtml()
      + '  <button class="mkt-btn mkt-btn-ghost" id="b-edit">Open ontology editor</button>'
      + '  <button class="mkt-btn mkt-btn-primary mkt-btn-lg" id="b-gen">Generate my month →</button>'
      + '</div>';
    wireBackBtn(host);

    function paint() {
      Promise.all([MKT.listDocs('entityCollections')]).then(function (out) {
        var colls = out[0] || [];
        var entPromises = colls.map(c => MKT.listEntities(c.slug));
        Promise.all(entPromises).then(function (entLists) {
          var entCount = entLists.reduce((n, l) => n + l.length, 0);
          var libReady = colls.length > 0;
          host.querySelector('#rv').innerHTML = ''
            + '<p class="mkt-hint" style="margin:0 0 12px;">Your CMO\'s picture of the company:</p>'
            + '<div class="ob-review-grid">'
            + '  <div class="ob-review-tile"><div class="tnum">' + Object.keys(state.personas).length + '</div><div class="tlab">personas</div></div>'
            + '  <div class="ob-review-tile"><div class="tnum">' + Object.values(state.channels).filter(c => c.active).length + '</div><div class="tlab">channels</div></div>'
            + '  <div class="ob-review-tile"><div class="tnum">' + Object.keys(state.buckets).length + '</div><div class="tlab">buckets</div></div>'
            + '  <div class="ob-review-tile"><div class="tnum">' + ((state.intake.brand && (state.intake.brand.palette || []).length) || 0) + '</div><div class="tlab">brand colors</div></div>'
            + '  <div class="ob-review-tile">'
            +     (libReady
                    ? '<div class="tnum">' + entCount + '</div><div class="tlab">content library items <span title="auto-built from your buckets">🧠</span></div>'
                    : '<div class="tnum"><span class="mkt-spinner"></span></div><div class="tlab">content library building…</div>')
            + '  </div>'
            + '</div>'
            + (libReady
                ? '<p class="mkt-hint" style="margin-top:10px;">Your CMO built a content library from your buckets — ' + colls.map(c => (c.icon || '') + ' ' + MKT.escape(c.display_name)).join(' · ') + '. Edit it any time on the Ontology page.</p>'
                : '<p class="mkt-hint" style="margin-top:10px;">The content library is being drafted in the background — it\'ll be ready by the time your calendar generates.</p>');
          if (!libReady) setTimeout(paint, 4000);
        });
      });
    }
    paint();

    host.querySelector('#b-edit').onclick = function () {
      MKT.saveMeta({ workshop_stage: 'ontology' });
      MKT.saveIntake({ completed_at: Date.now() });
      window.location.href = '/ontology';
    };
    host.querySelector('#b-gen').onclick = function () {
      MKT.saveMeta({ workshop_stage: 'calendar' });
      MKT.saveIntake({ completed_at: Date.now() });
      window.location.href = '/calendar?autogen=1';
    };
  }

  window.Onboarding = Onboarding;
})();
