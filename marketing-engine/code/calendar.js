/* ============================================================
   calendar.js — month grid + generate + slot drawer.
   URL ?autogen=1 → auto-trigger generation on first load.
   ============================================================ */

(function () {
  var Cal = {};
  var state = { year: 0, month: 0, slots: {}, strategy: '', mix: null, posts: {} };

  Cal.init = function () {
    MKT.ensureAccess().then(function () {
      MKT.renderChrome('calendar');
      var now = new Date();
      state.year = now.getUTCFullYear();
      state.month = now.getUTCMonth() + 1;
      renderShell();
      // Is a generation already in flight (kicked off, then navigated away)?
      firebase.database().ref(MKT.basePath() + '/calendarJob').once('value').then(function (js) {
        var job = js.val();
        return loadMonth().then(function () {
          if (job && job.status === 'running' && job.month_key === monthKey()) {
            showProgress(job.is_regenerate);
            watchJob();
          } else if (location.search.indexOf('autogen=1') >= 0 && Object.keys(state.slots).length === 0) {
            generate('');
          } else {
            renderGrid();
            watchJob(); // arm the watcher in case a job starts/finishes while here
          }
        });
      });
    });
  };

  function monthKey() { return state.year + '-' + String(state.month).padStart(2, '0'); }

  function loadMonth() {
    return firebase.database().ref(MKT.basePath() + '/calendar/' + monthKey()).once('value').then(function (s) {
      var v = s.val() || {};
      state.slots = v.slots || {};
      state.strategy = v.strategy_summary || '';
      state.mix = v.mix_check || null;
      state.posts = {};
    });
  }

  function renderShell() {
    var root = document.getElementById('root');
    root.innerHTML = '<div class="cal-wrap">'
      + '<div class="mkt-pagehead">'
      + '  <div><h1 class="mkt-pagehead-title" id="mlabel"></h1>'
      + '    <p class="mkt-pagehead-desc">One month of slots. Click any slot to edit or turn it into a full post.</p>'
      + '  </div>'
      + '  <div class="mkt-pagehead-actions">'
      + '    <button class="mkt-btn mkt-btn-primary" id="gen">✨ Generate this month</button>'
      + '    <button class="mkt-btn mkt-btn-soft" id="regen" style="display:none;">↻ Regenerate with feedback</button>'
      + '    <button class="mkt-btn mkt-btn-soft" id="next-step" style="margin-left:8px;">Get your file →</button>'
      + '  </div>'
      + '</div>'
      + '<div id="strategy"></div>'
      + '<div class="cal-progress" id="progress" style="margin-bottom:18px;"></div>'
      + '<div id="grid"></div></div>';
    document.getElementById('gen').onclick = function () { generate(''); };
    document.getElementById('regen').onclick = openFeedbackDrawer;
    document.getElementById('next-step').onclick = function () {
      MKT.saveMeta({ workshop_stage: 'export' });
      window.location.href = '/export';
    };
    refreshLabel();
  }

  function refreshLabel() {
    var d = new Date(Date.UTC(state.year, state.month - 1, 1));
    document.getElementById('mlabel').textContent = d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  // Workshop constraint: one month per session — no month navigation.
  function openFeedbackDrawer() {
    var body = document.createElement('div');
    body.innerHTML = ''
      + '<p class="mkt-hint" style="margin:0 0 12px;">Tell your CMO what felt off — too much of one bucket, wrong tone, missed an important date, want more reels — anything. It regenerates the month with your notes baked in.</p>'
      + '<textarea class="mkt-textarea" id="fb" rows="5" placeholder="e.g. Too many educational posts in week 1, and we want every Friday to be a customer story. Also add buildup to our launch on the 24th."></textarea>';
    MKT.openDrawer({
      title: 'Regenerate with your notes',
      body: body,
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: function () {} },
        { label: '↻ Regenerate', kind: 'primary', onClick: function () {
          var fb = body.querySelector('#fb').value.trim();
          if (!fb) { MKT.toast('Give your CMO at least one note', 'warn'); return false; }
          generate(fb);
        } }
      ]
    });
  }

  function renderGrid() {
    var strat = document.getElementById('strategy');
    if (state.strategy || state.mix) {
      var mixHtml = '';
      if (state.mix) {
        mixHtml = '<div class="cal-mix">'
          + ['educate', 'inspire', 'entertain', 'persuade'].map(k => '<span class="chip">' + k + ' ' + (state.mix[k + '_pct'] || 0) + '%</span>').join('')
          + '</div>';
      }
      strat.innerHTML = '<div class="cal-strategy">' + MKT.escape(state.strategy || '') + mixHtml + '</div>';
    } else {
      strat.innerHTML = '';
    }

    var grid = document.getElementById('grid');
    var first = new Date(Date.UTC(state.year, state.month - 1, 1));
    var firstWeekday = first.getUTCDay(); // 0 = Sunday
    var daysInMonth = new Date(state.year, state.month, 0).getDate();
    var slotsByDate = {};
    Object.values(state.slots).forEach(function (s) {
      var d = s.date || '';
      if (!slotsByDate[d]) slotsByDate[d] = [];
      slotsByDate[d].push(s);
    });
    var slotCount = Object.keys(state.slots).length;
    document.getElementById('progress').innerHTML = slotCount === 0
      ? '<span class="mkt-muted">No slots yet — hit ✨ Generate this month.</span>'
      : '<span><strong>' + slotCount + ' slots</strong> · ' + Object.keys(slotsByDate).length + ' days have content · not feeling it? hit ↻ Regenerate with feedback</span>';
    var regenBtn = document.getElementById('regen');
    if (regenBtn) regenBtn.style.display = slotCount > 0 ? '' : 'none';

    var todayKey = '';
    var now = new Date();
    if (now.getUTCFullYear() === state.year && (now.getUTCMonth() + 1) === state.month) {
      todayKey = state.year + '-' + String(state.month).padStart(2, '0') + '-' + String(now.getUTCDate()).padStart(2, '0');
    }

    var html = '<div class="cal-grid">';
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => { html += '<div class="cal-dow">' + d + '</div>'; });
    for (var i = 0; i < firstWeekday; i++) html += '<div class="cal-day other-month"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var key = state.year + '-' + String(state.month).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var ss = slotsByDate[key] || [];
      var inner = '<div class="cal-day-num">' + d + '</div>'
        + ss.map(function (s) {
          return '<div class="cal-slot f-' + MKT.escape(s.bucket_function || 'Educate') + '" data-id="' + MKT.escape(s.id || '') + '">'
            + '<span class="slot-platform">' + MKT.escape(s.platform || '') + ' · ' + MKT.escape(s.format || '') + '</span>'
            + '<span class="slot-hook">' + MKT.escape(s.hook || s.angle || '') + '</span></div>';
        }).join('');
      html += '<div class="cal-day' + (key === todayKey ? ' today' : '') + '">' + inner + '</div>';
    }
    var trailing = (firstWeekday + daysInMonth) % 7;
    if (trailing) for (var i = trailing; i < 7; i++) html += '<div class="cal-day other-month"></div>';
    html += '</div>';
    grid.innerHTML = html;
    grid.querySelectorAll('.cal-slot').forEach(function (el) {
      el.onclick = function () { openSlot(el.getAttribute('data-id')); };
    });
  }

  // Rotating status messages so the progress bar feels alive (Claude can't
  // stream true %, so we narrate the stages over the expected ~90s).
  var STAGE_MSGS = [
    'Reading your ontology — personas, buckets, channels…',
    'Sketching narrative arcs across the month…',
    'Distributing buckets so the mix stays balanced…',
    'Covering every persona at least twice…',
    'Placing posts on real dates…',
    'Writing hooks and angles for each slot…',
    'Almost there — tightening the story…'
  ];
  var progressTimer = null;

  function showProgress(isRegen) {
    var grid = document.getElementById('grid');
    var prog = document.getElementById('progress');
    if (prog) prog.innerHTML = '';
    var gen = document.getElementById('gen'); if (gen) { gen.disabled = true; gen.textContent = '✨ Generating…'; }
    var regen = document.getElementById('regen'); if (regen) regen.disabled = true;
    var start = Date.now();
    grid.innerHTML = ''
      + '<div class="cal-genbar">'
      + '  <div class="cal-genbar-top"><span class="mkt-spinner"></span>'
      + '    <strong id="cal-gen-msg">' + (isRegen ? 'Regenerating with your notes…' : 'Your CMO is planning the month…') + '</strong>'
      + '    <span class="cal-gen-time" id="cal-gen-time">0:00</span></div>'
      + '  <div class="cal-genbar-track"><span class="cal-genbar-fill" id="cal-gen-fill"></span></div>'
      + '  <div class="cal-gen-note">This keeps running even if you switch pages — come back any time.</div>'
      + '</div>';
    var fill = document.getElementById('cal-gen-fill');
    var msg = document.getElementById('cal-gen-msg');
    var timeEl = document.getElementById('cal-gen-time');
    clearInterval(progressTimer);
    progressTimer = setInterval(function () {
      var elapsed = (Date.now() - start) / 1000;
      // Asymptotic fill toward ~95% over ~90s so it never "completes" before the data lands.
      var pct = Math.min(95, 100 * (1 - Math.exp(-elapsed / 38)));
      if (fill) fill.style.width = pct.toFixed(1) + '%';
      if (timeEl) timeEl.textContent = Math.floor(elapsed / 60) + ':' + String(Math.floor(elapsed % 60)).padStart(2, '0');
      if (msg) msg.textContent = STAGE_MSGS[Math.min(STAGE_MSGS.length - 1, Math.floor(elapsed / 13))];
    }, 500);
  }

  function stopProgress() { clearInterval(progressTimer); progressTimer = null; }

  // Watch the server-side job marker. Fires when the function finishes writing —
  // works even if generation was kicked off, then the user navigated away and back.
  var jobWatcher = null;
  function watchJob() {
    if (jobWatcher) return;
    var ref = firebase.database().ref(MKT.basePath() + '/calendarJob');
    jobWatcher = ref;
    ref.on('value', function (snap) {
      var job = snap.val();
      if (!job) return;
      // Stale guard: a job running >5 min almost certainly died — clear it.
      if (job.status === 'running' && Date.now() - (job.started_at || 0) > 300000) {
        stopProgress();
        var g = document.getElementById('gen'); if (g) { g.disabled = false; g.textContent = '✨ Generate this month'; }
        ref.set(null); renderGrid();
        MKT.toast('That took too long — try generating again', 'warn', 4000);
        return;
      }
      if (job.status === 'running' && job.month_key === monthKey()) {
        if (!progressTimer) showProgress(job.is_regenerate);
      } else if (job.status === 'done' && job.month_key === monthKey()) {
        stopProgress();
        var gen = document.getElementById('gen'); if (gen) { gen.disabled = false; gen.textContent = '✨ Generate this month'; }
        loadMonth().then(renderGrid);
        // Clear the marker so we don't re-render on every revisit.
        ref.set(null);
        MKT.toast('Calendar ready ✓', 'ok');
      } else if (job.status === 'failed') {
        stopProgress();
        var gen2 = document.getElementById('gen'); if (gen2) { gen2.disabled = false; gen2.textContent = '✨ Generate this month'; }
        MKT.toast(job.error || 'Generation failed', 'error', 4000);
        renderGrid();
        ref.set(null);
      }
    });
  }

  function generate(feedback) {
    showProgress(!!feedback);
    watchJob();
    // The function persists the result + flips the job marker server-side, so we
    // don't depend on this promise resolving — but we still catch hard failures.
    MKT.callAI('generateCalendar', {
      workspaceId: MKT.workspaceId,
      persist: true,
      year: state.year, month: state.month,
      posts_per_day: 1.5, count_cap: 45,
      feedback: feedback || '',
      previous_strategy: state.strategy || ''
    }).catch(function (e) {
      // Network blip / navigation can reject the fetch even though the function
      // keeps running. Only surface a real error if the job marker also failed.
      firebase.database().ref(MKT.basePath() + '/calendarJob').once('value').then(function (s) {
        var job = s.val();
        if (!job || job.status === 'failed') {
          stopProgress();
          var gen = document.getElementById('gen'); if (gen) { gen.disabled = false; gen.textContent = '✨ Generate this month'; }
          MKT.toast((e && e.message) || 'Generation failed', 'error', 4000);
        }
      });
    });
  }

  function openSlot(id) {
    var slot = state.slots[id]; if (!slot) return;
    var body = document.createElement('div'); body.className = 'slot-detail';
    body.innerHTML = renderSlotBody(slot);
    MKT.openDrawer({
      title: slot.platform + ' · ' + slot.date,
      body: body,
      actions: [
        { label: 'Close', kind: 'ghost', onClick: function () {} },
        { label: 'Save edits', kind: 'soft', onClick: function () { return saveSlotEdits(id, body); } },
        { label: '✨ Turn into full post', kind: 'primary', onClick: function () { return turnIntoPost(id, body); } }
      ]
    });
  }

  function renderSlotBody(slot) {
    var post = state.posts[slot.id];
    return ''
      + '<div class="mkt-field"><label class="mkt-label">Hook</label><textarea class="mkt-textarea" id="f-hook" rows="2">' + MKT.escape(slot.hook || '') + '</textarea></div>'
      + '<div class="mkt-field"><label class="mkt-label">Angle</label><textarea class="mkt-textarea" id="f-angle" rows="3">' + MKT.escape(slot.angle || '') + '</textarea></div>'
      + '<div class="mkt-row" style="gap:10px;">'
      + '  <div class="mkt-field" style="flex:1;"><label class="mkt-label">Format</label><input class="mkt-input" id="f-format" value="' + MKT.escape(slot.format || '') + '" /></div>'
      + '  <div class="mkt-field" style="flex:1;"><label class="mkt-label">Platform</label><input class="mkt-input" id="f-platform" value="' + MKT.escape(slot.platform || '') + '" /></div>'
      + '</div>'
      + '<div class="mkt-row" style="gap:10px;">'
      + '  <div class="mkt-field" style="flex:1;"><label class="mkt-label">Bucket</label><input class="mkt-input" id="f-bucket" value="' + MKT.escape(slot.bucket_slug || '') + '" /></div>'
      + '  <div class="mkt-field" style="flex:1;"><label class="mkt-label">Persona</label><input class="mkt-input" id="f-persona" value="' + MKT.escape(slot.persona_slug || '') + '" /></div>'
      + '</div>'
      + '<h4>Why this slot</h4><p class="mkt-tiny mkt-muted">' + MKT.escape(slot.reason || '') + '</p>'
      + (slot.arc_title ? ('<h4>Arc</h4><p class="mkt-tiny">' + MKT.escape(slot.arc_title) + ' · beat ' + (slot.arc_beat || '?') + ' (' + (slot.arc_role || '?') + ')</p>') : '')
      + (post ? renderPostBox(post) : '<div id="post-host"></div>');
  }

  function renderPostBox(p) {
    return '<h4>Full post</h4><div class="post-box">'
      + '<strong>' + MKT.escape(p.title || '') + '</strong>'
      + '<pre style="margin-top:6px;">' + MKT.escape(p.caption || '') + '</pre>'
      + (p.hashtags && p.hashtags.length ? '<p class="hashtags" style="margin-top:8px;">' + p.hashtags.map(h => '#' + MKT.escape(h)).join(' ') + '</p>' : '')
      + (p.cta ? '<p style="margin-top:8px;"><strong>CTA:</strong> ' + MKT.escape(p.cta) + '</p>' : '')
      + (p.script && p.script.length ? '<p style="margin-top:8px;"><strong>Script:</strong></p><ol style="margin:4px 0 0 18px;font-size:13px;line-height:1.5;">' + p.script.map(b => '<li>' + MKT.escape(b) + '</li>').join('') + '</ol>' : '')
      + (p.visual_direction ? '<p style="margin-top:8px;"><strong>Visual:</strong> ' + MKT.escape(p.visual_direction) + '</p>' : '')
      + '</div>';
  }

  function saveSlotEdits(id, body) {
    var slot = state.slots[id]; if (!slot) return Promise.resolve();
    slot.hook = body.querySelector('#f-hook').value;
    slot.angle = body.querySelector('#f-angle').value;
    slot.format = body.querySelector('#f-format').value;
    slot.platform = body.querySelector('#f-platform').value;
    slot.bucket_slug = body.querySelector('#f-bucket').value;
    slot.persona_slug = body.querySelector('#f-persona').value;
    return firebase.database().ref(MKT.basePath() + '/calendar/' + monthKey() + '/slots/' + id).update(slot).then(function () {
      MKT.toast('Saved', 'ok');
      renderGrid();
    });
  }

  function turnIntoPost(id, body) {
    var slot = state.slots[id]; if (!slot) return Promise.resolve();
    var host = body.querySelector('#post-host');
    if (host) host.innerHTML = '<div class="mkt-tiny" style="margin-top:14px;color:var(--ink-3);">Drafting full post… <span class="mkt-spinner" style="vertical-align:middle;"></span></div>';
    return MKT.callAI('turnIntoPost', { workspaceId: MKT.workspaceId, slot: slot }).then(function (post) {
      state.posts[id] = post;
      return firebase.database().ref(MKT.basePath() + '/calendar/' + monthKey() + '/posts/' + id).set(post).then(function () {
        if (host) host.outerHTML = renderPostBox(post);
        MKT.toast('Post drafted ✓', 'ok');
        return false; // keep drawer open so they can read it
      });
    }).catch(function (e) {
      MKT.toast(e.message || 'Failed', 'error', 4000);
      return false;
    });
  }

  window.Cal = Cal;
})();
