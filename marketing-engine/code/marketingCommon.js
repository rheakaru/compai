/* ============================================================
   marketingCommon.js — the MKT global.

   Provides workspace context, RTDB CRUD helpers, file uploads,
   page chrome, drawer, toast, and form/grid renderers used by
   every marketing-engine page.

   Loaded AFTER firebase v8 SDKs and loginScript.js.
   ============================================================ */

(function () {
  var MKT = {};
  var _ws = null;       // resolved workspace object {id, meta}
  var _user = null;     // firebase user

  // ---- Constants ----
  MKT.AI_ENDPOINT = 'https://us-central1-compai-57d55.cloudfunctions.net/marketingAI';
  MKT.SCHEMA_VERSION = 1;

  // ---- Utils ----
  MKT.nowTs = function () { return Date.now(); };
  MKT.encEmail = function (e) {
    return String(e || '').toLowerCase().replace(/@/g, '_AT_').replace(/\./g, '_DOT_');
  };
  MKT.decEmail = function (s) {
    return String(s || '').replace(/_AT_/g, '@').replace(/_DOT_/g, '.');
  };
  MKT.slugify = function (s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'item-' + Math.random().toString(36).slice(2, 7);
  };
  MKT.uid = function () {
    return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  };
  MKT.escape = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // ---- Workspace context ----
  MKT.user = function () { return _user; };
  MKT.workspace = function () { return _ws; };
  Object.defineProperty(MKT, 'workspaceId', { get: function () { return _ws && _ws.id; } });
  Object.defineProperty(MKT, 'BUSINESS_ID', { get: function () { return _ws && _ws.id; } }); // deprecated alias

  MKT.basePath = function () {
    if (!_ws) throw new Error('No active workspace.');
    return 'Workspaces/' + _ws.id;
  };

  // ---- RTDB CRUD ----
  function ref(path) { return firebase.database().ref(path); }

  MKT.getDoc = function (coll, slug) {
    return ref(MKT.basePath() + '/' + coll + '/' + slug).once('value').then(function (s) {
      var v = s.val(); return v ? v : null;
    });
  };
  MKT.listDocs = function (coll) {
    return ref(MKT.basePath() + '/' + coll).once('value').then(function (s) {
      var v = s.val() || {};
      return Object.keys(v).map(function (k) {
        var d = v[k] || {}; d.slug = d.slug || k; return d;
      });
    });
  };
  MKT.saveDoc = function (coll, slug, data) {
    slug = slug || MKT.slugify(data.name || data.slug || MKT.uid());
    data.slug = slug;
    data.updated_at = MKT.nowTs();
    if (!data.created_at) data.created_at = data.updated_at;
    return ref(MKT.basePath() + '/' + coll + '/' + slug).update(data).then(function () { return slug; });
  };
  MKT.deleteDoc = function (coll, slug) {
    return ref(MKT.basePath() + '/' + coll + '/' + slug).remove();
  };

  // entities are nested by collection
  MKT.getEntity = function (collSlug, slug) {
    return ref(MKT.basePath() + '/entities/' + collSlug + '/' + slug).once('value').then(function (s) {
      return s.val() || null;
    });
  };
  MKT.listEntities = function (collSlug) {
    return ref(MKT.basePath() + '/entities/' + collSlug).once('value').then(function (s) {
      var v = s.val() || {};
      return Object.keys(v).map(function (k) {
        var d = v[k] || {}; d.slug = d.slug || k; return d;
      });
    });
  };
  MKT.saveEntity = function (collSlug, slug, data) {
    slug = slug || MKT.slugify(data.name || data.slug || MKT.uid());
    data.slug = slug;
    data.updated_at = MKT.nowTs();
    if (!data.created_at) data.created_at = data.updated_at;
    return ref(MKT.basePath() + '/entities/' + collSlug + '/' + slug).update(data).then(function () { return slug; });
  };
  MKT.deleteEntity = function (collSlug, slug) {
    return ref(MKT.basePath() + '/entities/' + collSlug + '/' + slug).remove();
  };

  // intake (the onboarding flat map)
  MKT.getIntake = function () {
    return ref(MKT.basePath() + '/intake').once('value').then(function (s) { return s.val() || {}; });
  };
  MKT.saveIntake = function (patch) {
    var p = Object.assign({ updated_at: MKT.nowTs() }, patch || {});
    return ref(MKT.basePath() + '/intake').update(p);
  };
  MKT.saveMeta = function (patch) {
    var p = Object.assign({ last_active: MKT.nowTs() }, patch || {});
    return ref(MKT.basePath() + '/meta').update(p);
  };

  // ---- File uploads ----
  // opts.onProgress(pct 0-100) fires during the upload if provided.
  MKT.uploadAssetFile = function (file, opts) {
    opts = opts || {};
    if (!file) return Promise.reject(new Error('No file'));
    var assetId = opts.assetId || MKT.uid();
    var path = 'marketing/' + MKT.workspaceId + '/assets/' + assetId + '/' + file.name;
    var sref = firebase.storage().ref(path);
    var task = sref.put(file);
    return new Promise(function (resolve, reject) {
      task.on('state_changed',
        function (snap) {
          if (opts.onProgress && snap.totalBytes) {
            opts.onProgress((snap.bytesTransferred / snap.totalBytes) * 100);
          }
        },
        reject,
        function () {
          task.snapshot.ref.getDownloadURL().then(function (url) {
            resolve({ assetId: assetId, path: path, download_url: url, mime: file.type, size: file.size, name: file.name });
          }).catch(reject);
        }
      );
    });
  };
  MKT.createAssetFromUpload = function (uploaded, extra) {
    var data = Object.assign({
      asset_id: uploaded.assetId,
      name: uploaded.name,
      mime: uploaded.mime,
      size: uploaded.size,
      download_url: uploaded.download_url,
      storage_path: uploaded.path,
      ai_generated: false,
      created_at: MKT.nowTs()
    }, extra || {});
    return ref(MKT.basePath() + '/assets/' + uploaded.assetId).set(data).then(function () { return data; });
  };

  // ---- Cloud Function call ----
  MKT.callAI = function (action, payload) {
    return _user.getIdToken().then(function (token) {
      return fetch(MKT.AI_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: action, payload: payload || {} })
      }).then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok) throw new Error(body && body.error || ('Action ' + action + ' failed (' + r.status + ')'));
          return body;
        });
      });
    });
  };

  // ---- Toast ----
  function ensureToastWrap() {
    var w = document.querySelector('.mkt-toast-wrap');
    if (!w) { w = document.createElement('div'); w.className = 'mkt-toast-wrap'; document.body.appendChild(w); }
    return w;
  }
  MKT.toast = function (msg, kind, ms) {
    var w = ensureToastWrap();
    var t = document.createElement('div');
    t.className = 'mkt-toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    w.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .2s'; t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 220); }, ms || 2200);
  };

  // ---- Drawer ----
  function ensureDrawer() {
    if (document.querySelector('.mkt-drawer')) return;
    var b = document.createElement('div'); b.className = 'mkt-drawer-backdrop'; b.onclick = MKT.closeDrawer;
    var d = document.createElement('aside'); d.className = 'mkt-drawer';
    d.innerHTML = '<div class="mkt-drawer-head"><h3 class="mkt-drawer-title">Edit</h3>'
      + '<button class="mkt-icon-btn" id="mkt-drawer-close" aria-label="Close">×</button></div>'
      + '<div class="mkt-drawer-body"></div>'
      + '<div class="mkt-drawer-foot"></div>';
    document.body.appendChild(b); document.body.appendChild(d);
    d.querySelector('#mkt-drawer-close').onclick = MKT.closeDrawer;
  }
  MKT.openDrawer = function (opts) {
    ensureDrawer();
    var b = document.querySelector('.mkt-drawer-backdrop');
    var d = document.querySelector('.mkt-drawer');
    d.querySelector('.mkt-drawer-title').textContent = opts.title || 'Edit';
    var body = d.querySelector('.mkt-drawer-body');
    body.innerHTML = '';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body instanceof HTMLElement) body.appendChild(opts.body);
    var foot = d.querySelector('.mkt-drawer-foot');
    foot.innerHTML = '';
    (opts.actions || []).forEach(function (a) {
      var btn = document.createElement('button');
      btn.className = 'mkt-btn ' + (a.kind === 'primary' ? 'mkt-btn-primary' :
        a.kind === 'danger' ? 'mkt-btn-danger' : 'mkt-btn-ghost');
      btn.textContent = a.label;
      btn.onclick = function () {
        Promise.resolve(a.onClick && a.onClick()).then(function (close) {
          if (close !== false) MKT.closeDrawer();
        }).catch(function (err) {
          console.error('drawer action error:', err);
          MKT.toast((err && err.message) || 'Something went wrong', 'error');
        });
      };
      foot.appendChild(btn);
    });
    b.classList.add('open'); d.classList.add('open');
  };
  MKT.closeDrawer = function () {
    var b = document.querySelector('.mkt-drawer-backdrop');
    var d = document.querySelector('.mkt-drawer');
    if (b) b.classList.remove('open');
    if (d) d.classList.remove('open');
  };

  // ---- Form renderer ----
  // fields: [{key, label, type: 'text'|'textarea'|'select'|'number'|'url', options?, hint?, placeholder?, required?}]
  MKT.renderForm = function (data, fields) {
    var root = document.createElement('div');
    data = data || {};
    fields.forEach(function (f) {
      var wrap = document.createElement('div'); wrap.className = 'mkt-field';
      var label = document.createElement('label'); label.className = 'mkt-label';
      label.textContent = f.label + (f.required ? ' *' : '');
      wrap.appendChild(label);
      var input;
      if (f.type === 'textarea') {
        input = document.createElement('textarea'); input.className = 'mkt-textarea';
        if (f.rows) input.rows = f.rows;
      } else if (f.type === 'select') {
        input = document.createElement('select'); input.className = 'mkt-select';
        (f.options || []).forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = (typeof o === 'string') ? o : o.value;
          opt.textContent = (typeof o === 'string') ? o : (o.label || o.value);
          input.appendChild(opt);
        });
      } else {
        input = document.createElement('input'); input.className = 'mkt-input';
        input.type = f.type === 'number' ? 'number' : (f.type === 'url' ? 'url' : 'text');
      }
      input.id = 'fld-' + f.key;
      input.placeholder = f.placeholder || '';
      input.value = data[f.key] == null ? '' : data[f.key];
      wrap.appendChild(input);
      if (f.hint) {
        var h = document.createElement('p'); h.className = 'mkt-hint'; h.textContent = f.hint;
        wrap.appendChild(h);
      }
      root.appendChild(wrap);
    });
    // returns { element, read() }
    return {
      element: root,
      read: function () {
        var out = {};
        fields.forEach(function (f) {
          var el = root.querySelector('#fld-' + f.key);
          if (!el) return;
          var v = el.value;
          if (f.type === 'number') v = v === '' ? null : Number(v);
          out[f.key] = v;
        });
        return out;
      }
    };
  };

  // ---- Grid renderer ----
  // items: [{name, slug, description, image_url, meta: [{label, kind?}]}]
  // opts: {onClick(item), selectable, onSelectChange(selectedSlugs)}
  MKT.renderGrid = function (root, items, opts) {
    opts = opts || {};
    root.innerHTML = '';
    if (!items || items.length === 0) {
      var e = document.createElement('div'); e.className = 'mkt-empty';
      e.innerHTML = '<div class="mkt-empty-icon">' + (opts.emptyIcon || '✨') + '</div>'
        + '<h3 class="mkt-empty-title">' + MKT.escape(opts.emptyTitle || 'Nothing here yet') + '</h3>'
        + '<p class="mkt-empty-desc">' + MKT.escape(opts.emptyDesc || 'Add one to get started.') + '</p>';
      root.appendChild(e);
      return;
    }
    var grid = document.createElement('div'); grid.className = 'mkt-grid';
    var selected = new Set();
    items.forEach(function (it) {
      var card = document.createElement('div'); card.className = 'mkt-grid-card';
      var hero = '<div class="mkt-grid-card-hero">'
        + (it.image_url ? '<img src="' + MKT.escape(it.image_url) + '" alt="" />' : (it.emoji || '✨'))
        + '</div>';
      var metaHtml = (it.meta || []).map(function (m, i) {
        if (typeof m === 'string') return (i === 0 ? '' : '<span class="dot"></span>') + MKT.escape(m);
        return (i === 0 ? '' : '<span class="dot"></span>') + '<span class="mkt-chip ' + (m.kind || '') + '">' + MKT.escape(m.label) + '</span>';
      }).join('');
      card.innerHTML = hero
        + '<div class="mkt-grid-card-body">'
        +   '<h4 class="mkt-grid-card-name">' + MKT.escape(it.name || it.slug || '—') + '</h4>'
        +   (it.description ? '<p class="mkt-grid-card-desc">' + MKT.escape(it.description) + '</p>' : '')
        +   (metaHtml ? '<div class="mkt-grid-card-meta">' + metaHtml + '</div>' : '')
        + '</div>'
        + (opts.selectable ? '<div class="mkt-grid-card-select">✓</div>' : '');
      card.onclick = function (ev) {
        if (opts.selectable && (ev.metaKey || ev.ctrlKey || ev.target.classList.contains('mkt-grid-card-select'))) {
          if (selected.has(it.slug)) { selected.delete(it.slug); card.classList.remove('selected'); }
          else { selected.add(it.slug); card.classList.add('selected'); }
          if (opts.onSelectChange) opts.onSelectChange(Array.from(selected));
          return;
        }
        if (opts.onClick) opts.onClick(it);
      };
      grid.appendChild(card);
    });
    root.appendChild(grid);
  };

  // ---- Bulkbar ----
  MKT.renderBulkBar = function (count, actions) {
    var bar = document.querySelector('.mkt-bulkbar');
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'mkt-bulkbar';
      bar.innerHTML = '<span class="mkt-bulkbar-count"></span>'
        + '<div class="mkt-bulkbar-actions" style="display:flex;gap:6px;"></div>'
        + '<button class="mkt-bulkbar-close" aria-label="Close">×</button>';
      document.body.appendChild(bar);
    }
    var countEl = bar.querySelector('.mkt-bulkbar-count');
    var actEl = bar.querySelector('.mkt-bulkbar-actions');
    var closeEl = bar.querySelector('.mkt-bulkbar-close');
    if (!count) { bar.classList.remove('open'); return; }
    countEl.textContent = count + ' selected';
    actEl.innerHTML = '';
    (actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'mkt-btn mkt-btn-sm' + (a.kind === 'danger' ? ' mkt-btn-danger' : '');
      b.textContent = a.label;
      b.onclick = a.onClick;
      actEl.appendChild(b);
    });
    closeEl.onclick = function () { bar.classList.remove('open'); if (actions && actions._onClose) actions._onClose(); };
    bar.classList.add('open');
  };

  // ---- Page chrome ----
  // tabs is workshop journey, current = key.
  // NOTE: the 'design' tab (image/video generation) is intentionally hidden —
  // this is the shareable intake/giveaway build. The design page + its code
  // are kept on disk (nothing deleted); just not surfaced in the nav.
  var TABS = [
    { key: 'onboarding', label: 'Onboarding', href: '/onboarding' },
    { key: 'ontology',   label: 'Ontology',   href: '/ontology'   },
    { key: 'calendar',   label: 'Calendar',   href: '/calendar'   },
    { key: 'apply',      label: 'Beyond content', href: '/apply'  },
    { key: 'export',     label: 'Get your file', href: '/export'  }
  ];

  MKT.renderChrome = function (currentKey) {
    var bar = document.createElement('header');
    bar.className = 'mkt-topbar';
    bar.innerHTML = ''
      + '<div class="mkt-topbar-left">'
      +   '<a class="mkt-logo" href="/"><span class="mkt-logo-dot"></span> Rhai</a>'
      + '</div>'
      + '<nav class="mkt-topbar-tabs">'
      +   TABS.map(function (t) {
        return '<a class="mkt-topbar-tab' + (t.key === currentKey ? ' active' : '') + '" href="' + t.href + '">' + t.label + '</a>';
      }).join('')
      + '</nav>'
      + '<div class="mkt-topbar-right">'
      +   '<div class="mkt-workspace-switcher" id="mkt-ws-switcher">'
      +     '<div class="ws-avatar">' + MKT.escape((_ws && _ws.meta && _ws.meta.name || '?').slice(0, 1).toUpperCase()) + '</div>'
      +     '<span>' + MKT.escape(_ws && _ws.meta && _ws.meta.name || 'No workspace') + '</span>'
      +     '<span style="color:var(--ink-4);">▾</span>'
      +   '</div>'
      + '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
    var sw = document.getElementById('mkt-ws-switcher');
    if (sw) sw.onclick = function () { window.location.href = '/'; };

    // progress strip below
    var strip = document.createElement('div'); strip.className = 'mkt-progress-strip';
    var stage = (_ws && _ws.meta && _ws.meta.workshop_stage) || 'onboarding';
    var order = ['onboarding', 'ontology', 'calendar', 'design', 'apply', 'export', 'complete'];
    var stageIdx = order.indexOf(stage);
    var html = [];
    TABS.forEach(function (t, i) {
      var done = i < stageIdx;
      var active = t.key === currentKey;
      html.push('<span class="step ' + (done ? 'done' : active ? 'active' : '') + '">'
        + (done ? '✓ ' : active ? '● ' : '○ ') + t.label + '</span>');
      if (i < TABS.length - 1) html.push('<span class="sep">·</span>');
    });
    strip.innerHTML = html.join('');
    document.body.insertBefore(strip, bar.nextSibling);

    // Global background-job indicator — shows a floating pill on ANY page while
    // the calendar is generating, so navigating away doesn't hide progress.
    if (currentKey !== 'calendar') MKT.watchCalendarJob();
  };

  // Floating "generating calendar" pill, driven by the RTDB job marker.
  MKT.watchCalendarJob = function () {
    if (!_ws) return;
    var ref = ref0('Workspaces/' + _ws.id + '/calendarJob');
    var startedAt = 0, ticker = null;
    function ensurePill() {
      var p = document.getElementById('mkt-jobpill');
      if (!p) {
        p = document.createElement('a');
        p.id = 'mkt-jobpill'; p.className = 'mkt-jobpill'; p.href = '/calendar';
        document.body.appendChild(p);
      }
      return p;
    }
    ref.on('value', function (snap) {
      var job = snap.val();
      var pill = document.getElementById('mkt-jobpill');
      // Ignore stale jobs (>5 min) — they likely died mid-flight.
      if (job && job.status === 'running' && Date.now() - (job.started_at || 0) > 300000) job = null;
      if (job && job.status === 'running') {
        startedAt = job.started_at || Date.now();
        var p = ensurePill();
        if (!ticker) ticker = setInterval(function () {
          var el = document.getElementById('mkt-jobpill');
          if (!el) return;
          var s = Math.floor((Date.now() - startedAt) / 1000);
          el.innerHTML = '<span class="mkt-spinner" style="width:13px;height:13px;"></span> Generating ' + (job.month_label || 'calendar') + '… ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' →';
        }, 500);
      } else if (job && job.status === 'done') {
        if (ticker) { clearInterval(ticker); ticker = null; }
        var pd = ensurePill();
        pd.classList.add('done');
        pd.innerHTML = '✓ ' + (job.month_label || 'Calendar') + ' ready — ' + (job.slot_count || '') + ' slots →';
        setTimeout(function () { var el = document.getElementById('mkt-jobpill'); if (el) el.remove(); }, 8000);
      } else {
        if (ticker) { clearInterval(ticker); ticker = null; }
        if (pill) pill.remove();
      }
    });
  };
  function ref0(p) { return firebase.database().ref(p); }

  // ---- Workspace resolution ----
  var LS_KEY = '_active_ws';

  // Reads the per-user member index (WorkspaceMembers/{encEmail}) rather than
  // the whole Workspaces tree — security rules only allow reading workspaces
  // you're a member of, so a root read would be denied (and would leak other
  // prospects' data if it weren't).
  MKT.listMyWorkspaces = function () {
    var encEmail = MKT.encEmail(_user.email);
    return ref('WorkspaceMembers/' + encEmail).once('value').then(function (snap) {
      var idx = snap.val() || {};
      var ids = Object.keys(idx).filter(function (wsid) { return idx[wsid] === true; });
      return Promise.all(ids.map(function (wsid) {
        return ref('Workspaces/' + wsid + '/meta').once('value')
          .then(function (s) { return s.val() ? { id: wsid, meta: s.val() } : null; })
          .catch(function () { return null; }); // stale index entry / no access
      }));
    }).then(function (list) {
      var out = list.filter(Boolean);
      out.sort(function (a, b) { return (b.meta.last_active || 0) - (a.meta.last_active || 0); });
      return out;
    });
  };

  MKT.createWorkspace = function (name) {
    var wsid = MKT.slugify(name) + '-' + Math.random().toString(36).slice(2, 6);
    var encEmail = MKT.encEmail(_user.email);
    var meta = {
      name: name, slug: wsid,
      created_at: MKT.nowTs(), last_active: MKT.nowTs(),
      created_by: _user.uid,
      workshop_stage: 'onboarding'
    };
    var data = { meta: meta, members: {} };
    data.members[encEmail] = true;
    return ref('Workspaces/' + wsid).set(data).then(function () {
      // Index entry so listMyWorkspaces can find this workspace without a
      // root read (rules deny root reads on Workspaces).
      return ref('WorkspaceMembers/' + encEmail + '/' + wsid).set(true);
    }).then(function () {
      try { localStorage.setItem(LS_KEY, wsid); } catch (e) {}
      return { id: wsid, meta: meta };
    });
  };

  MKT.activateWorkspace = function (wsid) {
    try { localStorage.setItem(LS_KEY, wsid); } catch (e) {}
    return ref('Workspaces/' + wsid + '/meta').once('value').then(function (s) {
      var meta = s.val();
      if (!meta) throw new Error('Workspace not found.');
      _ws = { id: wsid, meta: meta };
      ref('Workspaces/' + wsid + '/meta/last_active').set(MKT.nowTs());
      return _ws;
    });
  };

  // ensureAccess: resolve last-active workspace OR send user back to the picker.
  // Pass {bypassPicker: true} on the picker page itself.
  MKT.ensureAccess = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      window.checkSignedInGeneral(function (user) {
        _user = user;
        if (opts.bypassPicker) return resolve({ user: user });
        var wsid = null;
        try { wsid = localStorage.getItem(LS_KEY); } catch (e) {}
        if (!wsid) { window.location.href = '/'; return; }
        MKT.activateWorkspace(wsid).then(function (ws) {
          resolve({ user: user, workspace: ws });
        }).catch(function () {
          try { localStorage.removeItem(LS_KEY); } catch (e) {}
          window.location.href = '/';
        });
      });
    });
  };

  window.MKT = MKT;
})();
