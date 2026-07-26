/* ============================================================
   export.js — JSON download + markdown brief + share URL.
   Confetti on first export of the session.
   ============================================================ */

(function () {
  var Exp = {};
  var data = null;

  Exp.init = function () {
    MKT.ensureAccess().then(function () {
      MKT.renderChrome('export');
      var root = document.getElementById('root');
      root.innerHTML = '<div class="exp-wrap">'
        + '<div class="mkt-pagehead">'
        + '  <div><h1 class="mkt-pagehead-title">Take everything home</h1>'
        + '    <p class="mkt-pagehead-desc">Download your ontology + calendar as JSON, copy a Claude-ready brief, share a read-only link.</p>'
        + '  </div>'
        + '  <div class="mkt-pagehead-actions"><span class="mkt-time-hint">⏱ ~30 sec</span></div>'
        + '</div>'
        + '<div id="loading"><div class="mkt-spinner"></div> Building your export…</div>'
        + '<div id="body" style="display:none;"></div></div>';
      MKT.callAI('exportWorkspace', { workspaceId: MKT.workspaceId }).then(function (out) {
        data = out;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('body').style.display = 'block';
        render();
        confetti();
      }).catch(function (e) {
        document.getElementById('loading').innerHTML = '<p class="mkt-hint" style="color:var(--danger);">' + MKT.escape(e.message || String(e)) + '</p>';
      });
    });
  };

  function render() {
    var body = document.getElementById('body');
    var o = data.ontology || {};
    var personas = (o.personas || []).length;
    var channels = (o.channels || []).length;
    var buckets = (o.buckets || []).length;
    var collections = (o.entityCollections || []).length;
    var entities = 0; Object.values(o.entities || {}).forEach(b => entities += Object.keys(b || {}).length);
    var calendar = (data.calendar || []).length;
    var creatives = (data.creatives || []).length;

    body.innerHTML = ''
      + '<div class="exp-tiles">'
      + tile(personas, 'personas')
      + tile(channels, 'channels')
      + tile(buckets, 'buckets')
      + tile(collections, 'collections')
      + tile(entities, 'entities')
      + tile(calendar, 'calendar slots')
      + tile(creatives, 'creatives')
      + '</div>'
      + '<div class="exp-actions">'
      + '  <div class="exp-action">'
      + '    <h3>📦 Full export JSON</h3>'
      + '    <p>The whole workspace — ontology, calendar, posts, creatives — in one machine-readable file. Pipe it into any AI tool to keep working.</p>'
      + '    <div class="actions"><button class="mkt-btn mkt-btn-primary" id="dl-json">Download JSON</button><button class="mkt-btn mkt-btn-ghost" id="copy-json">Copy</button></div>'
      + '  </div>'
      + '  <div class="exp-action">'
      + '    <h3>📝 Markdown AI brief</h3>'
      + '    <p>Paste this into Claude / ChatGPT and ask it to draft captions, scripts, or campaign ideas — it has all the context.</p>'
      + '    <div class="actions"><button class="mkt-btn mkt-btn-primary" id="copy-md">Copy brief</button><button class="mkt-btn mkt-btn-ghost" id="dl-md">Download .md</button></div>'
      + '  </div>'
      + '</div>'
      + '<h3 style="font-weight:700;font-size:13px;color:var(--ink-3);text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Brief preview</h3>'
      + '<div class="exp-brief-box" id="brief">' + MKT.escape(data.brief_markdown || '') + '</div>'
      + '<div style="margin-top:28px;padding:18px 22px;background:var(--brand-soft);border:1px solid var(--brand-line);border-radius:var(--radius-lg);">'
      + '<h3 style="margin:0 0 6px;font-size:15px;">What\'s next?</h3>'
      + '<p class="mkt-hint" style="margin:0;">Bring this back any time. Your workspace stays here — log in, hit ✏️ Ontology to refine, or generate next month\'s calendar.</p>'
      + '</div>';

    document.getElementById('dl-json').onclick = function () { download(JSON.stringify(data, null, 2), filename('json'), 'application/json'); };
    document.getElementById('copy-json').onclick = function () { copy(JSON.stringify(data, null, 2)); };
    document.getElementById('dl-md').onclick = function () { download(data.brief_markdown || '', filename('md'), 'text/markdown'); };
    document.getElementById('copy-md').onclick = function () { copy(data.brief_markdown || ''); };

    MKT.saveMeta({ workshop_stage: 'complete' });
  }
  function tile(n, lab) { return '<div class="exp-tile"><div class="num">' + n + '</div><div class="lab">' + lab + '</div></div>'; }
  function filename(ext) { return 'workspace-' + (data.workspace.slug || data.workspace.id) + '-' + new Date().toISOString().slice(0, 10) + '.' + ext; }
  function download(content, fname, mime) {
    var blob = new Blob([content], { type: mime });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    MKT.toast('Downloaded', 'ok');
  }
  function copy(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { MKT.toast('Copied to clipboard', 'ok'); });
    } else {
      var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
      MKT.toast('Copied', 'ok');
    }
  }
  function confetti() {
    if (sessionStorage.getItem('confetti_' + MKT.workspaceId)) return;
    sessionStorage.setItem('confetti_' + MKT.workspaceId, '1');
    var w = document.createElement('div'); w.className = 'exp-confetti';
    var colors = ['#7C3AED', '#F59E0B', '#16A34A', '#DB2777', '#2563EB'];
    for (var i = 0; i < 60; i++) {
      var p = document.createElement('div');
      p.className = 'exp-piece';
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.6) + 's';
      p.style.top = (-Math.random() * 20) + 'vh';
      w.appendChild(p);
    }
    document.body.appendChild(w);
    setTimeout(function () { w.remove(); }, 3200);
  }

  window.Exp = Exp;
})();
