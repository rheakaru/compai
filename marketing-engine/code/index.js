/* ============================================================
   index.js — workspace picker.
   - Sign in → list workspaces the user is a member of
   - "+ New workspace" → name + jump to onboarding
   - Click a row → activate + jump to onboarding (or last stage)
   ============================================================ */

(function () {
  var Index = {};

  Index.init = function () {
    MKT.ensureAccess({ bypassPicker: true }).then(function (ctx) {
      render(ctx.user);
    });
  };

  function render(user) {
    document.body.innerHTML = '<main id="root"></main>';
    var root = document.getElementById('root');
    root.innerHTML = ''
      + '<header class="mkt-topbar">'
      +   '<div class="mkt-topbar-left">'
      +     '<a class="mkt-logo" href="/"><span class="mkt-logo-dot"></span> Rhai</a>'
      +   '</div>'
      +   '<div class="mkt-topbar-right" style="display:flex; gap:10px; align-items:center;">'
      +     '<span class="mkt-tiny mkt-muted">' + MKT.escape(user.email || '') + '</span>'
      +     '<button class="mkt-btn mkt-btn-ghost mkt-btn-sm" id="btn-signout">Sign out</button>'
      +   '</div>'
      + '</header>'
      + '<div class="mkt-content-wrap">'
      +   '<div class="mkt-pagehead">'
      +     '<div>'
      +       '<h1 class="mkt-pagehead-title">Your workspaces</h1>'
      +       '<p class="mkt-pagehead-desc">A workspace is one company\'s session. Pick one to continue — or create a new one.</p>'
      +     '</div>'
      +     '<div class="mkt-pagehead-actions">'
      +       '<button class="mkt-btn mkt-btn-primary" id="btn-new">+ New workspace</button>'
      +     '</div>'
      +   '</div>'
      +   '<div id="ws-list"><div class="mkt-spinner"></div></div>'
      + '</div>';

    document.getElementById('btn-signout').onclick = function () {
      firebase.auth().signOut().then(function () { window.location.reload(); });
    };
    document.getElementById('btn-new').onclick = openNewDialog;

    loadList();
  }

  function loadList() {
    var listEl = document.getElementById('ws-list');
    MKT.listMyWorkspaces().then(function (workspaces) {
      if (!workspaces.length) {
        listEl.innerHTML = ''
          + '<div class="mkt-empty">'
          +   '<div class="mkt-empty-icon">🚀</div>'
          +   '<h3 class="mkt-empty-title">No workspaces yet</h3>'
          +   '<p class="mkt-empty-desc">Spin one up — takes about 30 seconds.</p>'
          +   '<button class="mkt-btn mkt-btn-primary mkt-btn-lg" id="btn-new-empty">Create your first workspace</button>'
          + '</div>';
        document.getElementById('btn-new-empty').onclick = openNewDialog;
        return;
      }
      var html = '<div class="mkt-grid">';
      workspaces.forEach(function (ws) {
        var stage = (ws.meta && ws.meta.workshop_stage) || 'onboarding';
        var lastTouched = ws.meta && ws.meta.last_active
          ? new Date(ws.meta.last_active).toLocaleString() : '—';
        html += '<div class="mkt-grid-card" data-wsid="' + MKT.escape(ws.id) + '">'
          + '<div class="mkt-grid-card-hero" style="background:linear-gradient(135deg, var(--brand-soft), var(--brand-tint)); color:var(--brand-deep); font-weight:700; font-size:36px; letter-spacing:-0.04em;">'
          +   MKT.escape((ws.meta.name || '?').slice(0, 1).toUpperCase())
          + '</div>'
          + '<div class="mkt-grid-card-body">'
          +   '<h4 class="mkt-grid-card-name">' + MKT.escape(ws.meta.name || ws.id) + '</h4>'
          +   '<p class="mkt-grid-card-desc">Last touched: ' + MKT.escape(lastTouched) + '</p>'
          +   '<div class="mkt-grid-card-meta">'
          +     '<span class="mkt-chip brand">' + MKT.escape(stage) + '</span>'
          +   '</div>'
          + '</div></div>';
      });
      html += '</div>';
      listEl.innerHTML = html;
      listEl.querySelectorAll('.mkt-grid-card').forEach(function (card) {
        card.onclick = function () { activate(card.getAttribute('data-wsid')); };
      });
    }).catch(function (e) {
      listEl.innerHTML = '<p class="mkt-hint" style="color:var(--danger);">' + MKT.escape(e.message || String(e)) + '</p>';
    });
  }

  function openNewDialog() {
    var form = MKT.renderForm({}, [
      { key: 'name', label: 'Company name', type: 'text', placeholder: 'e.g. Hoovu Fresh', required: true,
        hint: 'This is just the workspace name — you can rename it later.' }
    ]);
    MKT.openDrawer({
      title: 'New workspace',
      body: form.element,
      actions: [
        { label: 'Cancel', kind: 'ghost', onClick: function () {} },
        { label: 'Create', kind: 'primary', onClick: function () {
          var v = form.read();
          if (!v.name) { MKT.toast('Name is required', 'error'); return false; }
          return MKT.createWorkspace(v.name).then(function (ws) {
            MKT.toast('Workspace created', 'ok');
            window.location.href = '/onboarding';
          }).catch(function (e) { MKT.toast(e.message || 'Failed', 'error'); return false; });
        } }
      ]
    });
  }

  function activate(wsid) {
    MKT.activateWorkspace(wsid).then(function (ws) {
      var stage = (ws.meta && ws.meta.workshop_stage) || 'onboarding';
      var route = stage === 'complete' ? '/export' : ('/' + stage);
      window.location.href = route;
    }).catch(function (e) {
      MKT.toast(e.message || 'Failed to open', 'error');
    });
  }

  window.Index = Index;
})();
