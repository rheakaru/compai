/* ============================================================
   apply.js — "what else can this brain do?"
   Points the workspace ontology at a NON-content marketing task
   the AI CMO picks for this specific company.
   ============================================================ */

(function () {
  var Apply = {};
  var state = { result: null, loading: false, shown: [] };

  Apply.init = function () {
    MKT.ensureAccess().then(function () {
      MKT.renderChrome('apply');
      // Restore the last application if one was generated before
      firebase.database().ref(MKT.basePath() + '/applications').limitToLast(1).once('value').then(function (s) {
        var v = s.val();
        if (v) {
          var last = Object.values(v)[0];
          state.result = last.result;
          state.shown = last.shown || [last.result && last.result.application_title].filter(Boolean);
        }
        render();
      });
    });
  };

  function render() {
    var root = document.getElementById('root');
    root.innerHTML = '<div class="ap-wrap">'
      + '<div class="mkt-pagehead">'
      + '  <div><h1 class="mkt-pagehead-title">Beyond content</h1>'
      + '    <p class="mkt-pagehead-desc">The ontology you just built isn\'t a social-media thing — it\'s a brain. Point it at any marketing problem.</p>'
      + '  </div>'
      + '  <div class="mkt-pagehead-actions"><a href="/export" class="mkt-btn mkt-btn-soft">Export →</a></div>'
      + '</div>'
      + '<div class="ap-intro">'
      + '  <h2>🧠 Same context, different job</h2>'
      + '  <p>Everything your CMO learned — your personas, your voice, your channels, your funnel — works for cold outreach, partnerships, offline activations, retention flows. Ask it to pick the highest-leverage one for <em>your</em> company and design the system.</p>'
      + '  <button class="mkt-btn mkt-btn-primary mkt-btn-lg" id="b-go" ' + (state.loading ? 'disabled' : '') + '>'
      +     (state.loading ? '🧠 Thinking… (~30 sec)' : (state.result ? '↻ Show me a different application' : '✨ What else can this brain do?'))
      + '  </button>'
      + '</div>'
      + '<div id="result"></div></div>';
    document.getElementById('b-go').onclick = generate;
    if (state.loading) {
      document.getElementById('result').innerHTML = '<div class="mkt-card" style="display:flex;gap:10px;align-items:center;"><span class="mkt-spinner"></span> Your CMO is scanning your ontology for the highest-leverage play…</div>';
    } else if (state.result) {
      renderResult(document.getElementById('result'), state.result);
    }
  }

  function generate() {
    state.loading = true;
    render();
    MKT.callAI('beyondContent', {
      workspaceId: MKT.workspaceId,
      exclude: state.shown
    }).then(function (r) {
      state.result = r;
      if (r.application_title) state.shown.push(r.application_title);
      // Persist so it survives reloads + lands in the export
      var id = 'app-' + Date.now();
      firebase.database().ref(MKT.basePath() + '/applications/' + id).set({
        id: id, result: r, shown: state.shown, created_at: Date.now()
      });
      MKT.saveMeta({ workshop_stage: 'apply' });
    }).catch(function (e) {
      MKT.toast(e.message || 'Failed', 'error', 4000);
    }).finally(function () {
      state.loading = false;
      render();
    });
  }

  function renderResult(host, r) {
    var steps = (r.system_design || []).map(function (s, i) {
      return '<div class="ap-step">'
        + '<div class="ap-step-num">' + (i + 1) + '</div>'
        + '<div><div class="ap-step-title">' + MKT.escape(s.step || '') + '</div>'
        + '<div class="ap-step-detail">' + MKT.escape(s.detail || '') + '</div>'
        + (s.tool_hint ? '<div class="ap-step-tool">🔧 ' + MKT.escape(s.tool_hint) + '</div>' : '')
        + '</div></div>';
    }).join('');
    var links = (r.how_the_ontology_helped || []).map(function (l) {
      return '<div class="ap-link"><span class="arrow">→</span><span>' + MKT.escape(l) + '</span></div>';
    }).join('');
    var artifact = r.sample_artifact || {};

    host.innerHTML = '<div class="ap-result">'
      + '<div class="ap-hero">'
      + '  <div class="cat">' + MKT.escape(r.category || 'application') + '</div>'
      + '  <h2>' + MKT.escape(r.application_title || '') + '</h2>'
      + '  <p class="why">' + MKT.escape(r.why_this_company || '') + '</p>'
      + (r.expected_outcome ? '<span class="outcome">🎯 ' + MKT.escape(r.expected_outcome) + '</span>' : '')
      + '</div>'
      + '<div class="ap-card"><h3>The system — set this up this week</h3><div class="ap-steps">' + steps + '</div></div>'
      + '<div class="ap-card">'
      + '  <div class="mkt-row-between" style="margin-bottom:12px;">'
      + '    <h3 style="margin:0;">Sample artifact · ' + MKT.escape(artifact.title || '') + '</h3>'
      + '    <button class="mkt-btn mkt-btn-soft mkt-btn-sm" id="b-copy-art">Copy</button>'
      + '  </div>'
      + '  <div class="ap-artifact">' + MKT.escape(artifact.content || '') + '</div>'
      + '</div>'
      + (links ? '<div class="ap-card"><h3>How your ontology shaped this</h3><div class="ap-ontology-links">' + links + '</div></div>' : '')
      + '</div>';
    var cb = host.querySelector('#b-copy-art');
    if (cb) cb.onclick = function () {
      var text = artifact.content || '';
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { MKT.toast('Copied', 'ok'); });
    };
  }

  window.Apply = Apply;
})();
