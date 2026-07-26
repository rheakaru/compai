/* ============================================================
   ontology.js — 6-tab editor over the workspace data.
   Tabs: Personas / Channels / Buckets / Entities / Style / Settings
   ============================================================ */

(function () {
  var Ont = {};
  var state = { tab: 'personas', personas: {}, channels: {}, buckets: {}, entityCollections: {}, entities: {}, styleTemplates: {}, intake: {}, currentColl: null };

  var TABS = [
    { k: 'personas',  label: 'Personas' },
    { k: 'channels',  label: 'Channels' },
    { k: 'buckets',   label: 'Buckets' },
    { k: 'entities',  label: 'Entities' },
    { k: 'style',     label: 'Style' },
    { k: 'settings',  label: 'Settings' }
  ];

  Ont.init = function () {
    MKT.ensureAccess().then(function () {
      MKT.renderChrome('ontology');
      Promise.all([
        MKT.getIntake(),
        MKT.listDocs('personas'),
        MKT.listDocs('channels'),
        MKT.listDocs('buckets'),
        MKT.listDocs('entityCollections'),
        MKT.listDocs('styleTemplates')
      ]).then(function (out) {
        state.intake = out[0] || {};
        (out[1] || []).forEach(p => state.personas[p.slug] = p);
        (out[2] || []).forEach(c => state.channels[c.slug] = c);
        (out[3] || []).forEach(b => state.buckets[b.slug] = b);
        (out[4] || []).forEach(c => state.entityCollections[c.slug] = c);
        (out[5] || []).forEach(s => state.styleTemplates[s.slug] = s);
        var first = Object.keys(state.entityCollections)[0];
        state.currentColl = first || null;
        if (state.currentColl) loadEntities(state.currentColl).then(renderShell);
        else renderShell();
      });
    });
  };

  function loadEntities(coll) {
    return MKT.listEntities(coll).then(function (ents) {
      var bag = {};
      ents.forEach(e => bag[e.slug] = e);
      state.entities[coll] = bag;
    });
  }

  function renderShell() {
    var root = document.getElementById('root');
    root.innerHTML = ''
      + '<div class="mkt-content-wrap">'
      + '  <div class="mkt-pagehead">'
      + '    <div><h1 class="mkt-pagehead-title">Ontology</h1>'
      + '      <p class="mkt-pagehead-desc">Edit anything from your onboarding. Changes are live across the engine.</p>'
      + '    </div>'
      + '    <div class="mkt-pagehead-actions"><a href="/calendar" class="mkt-btn mkt-btn-soft">Calendar →</a></div>'
      + '  </div>'
      + '  <div class="mkt-tabs">' + TABS.map(t => '<button class="tab' + (t.k === state.tab ? ' active' : '') + '" data-t="' + t.k + '">' + t.label + '</button>').join('') + '</div>'
      + '  <div id="tab-body"></div>'
      + '</div>';
    root.querySelectorAll('[data-t]').forEach(function (b) {
      b.onclick = function () { state.tab = b.getAttribute('data-t'); renderShell(); };
    });
    renderTab();
  }

  function renderTab() {
    var host = document.getElementById('tab-body');
    if (state.tab === 'personas') renderPersonasTab(host);
    if (state.tab === 'channels') renderChannelsTab(host);
    if (state.tab === 'buckets') renderBucketsTab(host);
    if (state.tab === 'entities') renderEntitiesTab(host);
    if (state.tab === 'style') renderStyleTab(host);
    if (state.tab === 'settings') renderSettingsTab(host);
  }

  // ---- Personas ----
  function renderPersonasTab(host) {
    host.innerHTML = '<div class="mkt-row" style="justify-content:flex-end;gap:8px;margin-bottom:12px;">'
      + '<button class="mkt-btn mkt-btn-soft" id="b-draft">✨ Draft more</button>'
      + '<button class="mkt-btn mkt-btn-ghost" id="b-blank">+ Blank persona</button></div>'
      + '<div id="pg"></div>';
    var pg = host.querySelector('#pg');
    function r() {
      var items = Object.values(state.personas).map(function (p) {
        return {
          name: p.name, slug: p.slug, emoji: '👤',
          description: (Array.isArray(p.motivations) ? p.motivations.join(' · ') : p.motivations) || p.occupation || '',
          meta: [{ label: p.age_range || '—', kind: '' }, { label: p.voice_to_use ? 'voice ✓' : 'no voice', kind: p.voice_to_use ? 'ok' : '' }]
        };
      });
      MKT.renderGrid(pg, items, {
        emptyIcon: '👤', emptyTitle: 'No personas yet', emptyDesc: 'Draft a few or add manually.',
        onClick: function (it) { editPersona(state.personas[it.slug]); }
      });
    }
    r();
    host.querySelector('#b-blank').onclick = function () {
      var slug = 'persona-' + Math.random().toString(36).slice(2, 6);
      var doc = { slug: slug, name: 'New persona', age_range: '', occupation: '', motivations: [], pain_points: [], voice_to_use: '', where_they_hang_out: [], sample_objection: '' };
      state.personas[slug] = doc;
      MKT.saveDoc('personas', slug, doc).then(function () { editPersona(doc); });
    };
    host.querySelector('#b-draft').onclick = function () {
      MKT.toast('Drafting…');
      MKT.callAI('draftPersonas', { writeup: state.intake.writeup || '', customer_types: state.intake.customer_types || '', count: 3 }).then(function (out) {
        (out.personas || []).forEach(function (p) {
          var slug = MKT.slugify(p.name) + '-' + Math.random().toString(36).slice(2, 5);
          var doc = Object.assign({ slug: slug }, p);
          state.personas[slug] = doc;
          MKT.saveDoc('personas', slug, doc);
        });
        r();
      }).catch(function (e) { MKT.toast(e.message, 'error'); });
    };
  }

  function editPersona(p) {
    var fields = [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'age_range', label: 'Age range', type: 'text' },
      { key: 'occupation', label: 'Occupation', type: 'text' },
      { key: 'gender_skew', label: 'Gender skew', type: 'text' },
      { key: 'location_archetype', label: 'Location archetype', type: 'text' },
      { key: 'motivations', label: 'Motivations (one per line)', type: 'textarea' },
      { key: 'pain_points', label: 'Pain points (one per line)', type: 'textarea' },
      { key: 'where_they_hang_out', label: 'Where they hang out (one per line)', type: 'textarea' },
      { key: 'voice_to_use', label: 'Voice to use', type: 'textarea' },
      { key: 'sample_objection', label: 'Sample objection', type: 'textarea' }
    ];
    var seed = Object.assign({}, p);
    ['motivations', 'pain_points', 'where_they_hang_out'].forEach(function (k) {
      if (Array.isArray(seed[k])) seed[k] = seed[k].join('\n');
    });
    var form = MKT.renderForm(seed, fields);
    MKT.openDrawer({
      title: 'Edit persona',
      body: form.element,
      actions: [
        { label: 'Delete', kind: 'danger', onClick: function () {
          if (!confirm('Delete persona?')) return false;
          delete state.personas[p.slug];
          return MKT.deleteDoc('personas', p.slug).then(function () { renderTab(); });
        } },
        { label: 'Save', kind: 'primary', onClick: function () {
          var v = form.read();
          ['motivations', 'pain_points', 'where_they_hang_out'].forEach(function (k) {
            v[k] = String(v[k] || '').split('\n').map(s => s.trim()).filter(Boolean);
          });
          var merged = Object.assign({}, p, v);
          state.personas[p.slug] = merged;
          return MKT.saveDoc('personas', p.slug, merged).then(function () { renderTab(); MKT.toast('Saved', 'ok'); });
        } }
      ]
    });
  }

  // ---- Channels ----
  var CHANNEL_OPTIONS = [
    'instagram', 'youtube', 'linkedin', 'facebook', 'x', 'pinterest', 'whatsapp', 'tiktok', 'threads', 'reddit', 'substack', 'blog'
  ];
  function renderChannelsTab(host) {
    host.innerHTML = '<div class="ob-channel-grid" id="cg"></div>';
    var cg = host.querySelector('#cg');
    CHANNEL_OPTIONS.forEach(function (slug) {
      var existing = state.channels[slug] || {};
      var on = existing.active;
      var card = document.createElement('div'); card.className = 'ob-channel-card' + (on ? ' on' : '');
      card.innerHTML = ''
        + '<div class="ch-top"><span style="text-transform:capitalize;font-weight:700;">' + slug + '</span></div>'
        + '<div class="ch-detail">'
        + '  <input data-k="handle_url" placeholder="Account link (URL)" value="' + MKT.escape(existing.handle_url || '') + '" />'
        + '  <textarea data-k="what_we_post" rows="2" placeholder="What kind of stuff you post here">' + MKT.escape(existing.what_we_post || '') + '</textarea>'
        + '</div>';
      card.querySelector('.ch-top').onclick = function () {
        card.classList.toggle('on');
        var nowOn = card.classList.contains('on');
        var doc = Object.assign({}, existing, { slug: slug, platform: slug, active: nowOn });
        state.channels[slug] = doc;
        MKT.saveDoc('channels', slug, doc);
      };
      card.querySelectorAll('[data-k]').forEach(function (inp) {
        inp.onblur = function () {
          var doc = state.channels[slug] || { slug: slug, platform: slug, active: true };
          doc[inp.getAttribute('data-k')] = inp.value;
          state.channels[slug] = doc;
          MKT.saveDoc('channels', slug, doc);
        };
      });
      cg.appendChild(card);
    });
  }

  // ---- Buckets ----
  function renderBucketsTab(host) {
    host.innerHTML = '<div class="mkt-row" style="justify-content:flex-end;gap:8px;margin-bottom:12px;">'
      + '<button class="mkt-btn mkt-btn-soft" id="b-suggest">✨ Suggest more</button>'
      + '<button class="mkt-btn mkt-btn-ghost" id="b-blank">+ Blank</button></div>'
      + '<div id="bg"></div>';
    var bg = host.querySelector('#bg');
    function r() {
      var items = Object.values(state.buckets).map(function (b) {
        return {
          name: b.name, slug: b.slug, emoji: emojiForFn(b.function),
          description: b.description || b.purpose || '',
          meta: [{ label: b.function || '—', kind: 'brand' }, { label: (b.frequency_count || 1) + '/' + (b.frequency_per || 'week'), kind: '' }]
        };
      });
      MKT.renderGrid(bg, items, {
        emptyIcon: '🪣', emptyTitle: 'No buckets yet',
        onClick: function (it) { editBucket(state.buckets[it.slug]); }
      });
    }
    r();
    host.querySelector('#b-blank').onclick = function () {
      var slug = 'bucket-' + Math.random().toString(36).slice(2, 6);
      var doc = { slug: slug, name: 'New bucket', function: 'Educate', description: '', frequency_count: 1, frequency_per: 'week' };
      state.buckets[slug] = doc;
      MKT.saveDoc('buckets', slug, doc).then(function () { editBucket(doc); });
    };
    host.querySelector('#b-suggest').onclick = function () {
      MKT.toast('Brainstorming…');
      MKT.callAI('brainstormBuckets', { workspaceId: MKT.workspaceId, existing_buckets: Object.values(state.buckets), count: 6 }).then(function (out) {
        (out.suggestions || []).forEach(function (s) {
          var slug = MKT.slugify(s.name);
          var doc = Object.assign({}, s, { slug: slug });
          state.buckets[slug] = doc;
          MKT.saveDoc('buckets', slug, doc);
        });
        r();
      }).catch(function (e) { MKT.toast(e.message, 'error'); });
    };
  }
  function emojiForFn(fn) {
    return { Educate: '📚', Inspire: '✨', Entertain: '🎭', Persuade: '🎯' }[fn] || '🪣';
  }
  function editBucket(b) {
    var fields = [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'function', label: 'Function', type: 'select', options: ['Educate', 'Inspire', 'Entertain', 'Persuade'] },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'frequency_count', label: 'Frequency count', type: 'number' },
      { key: 'frequency_per', label: 'Frequency per', type: 'select', options: ['day', 'week', 'month'] },
      { key: 'why_this_helps', label: 'Why this helps', type: 'textarea' }
    ];
    var form = MKT.renderForm(b, fields);
    MKT.openDrawer({
      title: 'Edit bucket', body: form.element,
      actions: [
        { label: 'Delete', kind: 'danger', onClick: function () {
          if (!confirm('Delete bucket?')) return false;
          delete state.buckets[b.slug];
          return MKT.deleteDoc('buckets', b.slug).then(function () { renderTab(); });
        } },
        { label: 'Save', kind: 'primary', onClick: function () {
          var merged = Object.assign({}, b, form.read());
          state.buckets[b.slug] = merged;
          return MKT.saveDoc('buckets', b.slug, merged).then(function () { renderTab(); MKT.toast('Saved', 'ok'); });
        } }
      ]
    });
  }

  // ---- Entities ----
  function renderEntitiesTab(host) {
    host.innerHTML = ''
      + '<div class="mkt-row" style="gap:8px;margin-bottom:14px;align-items:center;">'
      + '  <select class="mkt-select" id="coll-pick" style="max-width:300px;"></select>'
      + '  <button class="mkt-btn mkt-btn-soft" id="b-gen">✨ Generate 10 entities</button>'
      + '  <button class="mkt-btn mkt-btn-ghost" id="b-blank">+ Blank entity</button>'
      + '  <button class="mkt-btn mkt-btn-soft" id="b-new-coll" style="margin-left:auto;">✨ Suggest collections</button>'
      + '</div>'
      + '<div id="eg"></div>';
    var pick = host.querySelector('#coll-pick');
    var colls = Object.values(state.entityCollections);
    pick.innerHTML = colls.length ? colls.map(c => '<option value="' + MKT.escape(c.slug) + '"' + (c.slug === state.currentColl ? ' selected' : '') + '>' + MKT.escape(c.icon || '') + ' ' + MKT.escape(c.display_name || c.slug) + '</option>').join('') : '<option>(no collections)</option>';
    pick.onchange = function () {
      state.currentColl = pick.value;
      loadEntities(state.currentColl).then(renderTab);
    };
    var eg = host.querySelector('#eg');
    function r() {
      if (!state.currentColl) { eg.innerHTML = '<div class="mkt-empty"><div class="mkt-empty-icon">📦</div><h3 class="mkt-empty-title">No collections yet</h3><p class="mkt-empty-desc">Hit "Suggest collections" to start.</p></div>'; return; }
      var bag = state.entities[state.currentColl] || {};
      var items = Object.values(bag).map(function (e) {
        return {
          name: e.name, slug: e.slug, emoji: '✨',
          description: (e.data && (e.data.description || e.data.tagline)) || e.description || '',
          meta: [{ label: e.image_query ? '🔍 ' + e.image_query.slice(0, 20) : '—', kind: '' }]
        };
      });
      MKT.renderGrid(eg, items, {
        emptyIcon: '✨', emptyTitle: 'No entities yet',
        onClick: function (it) { editEntity(state.currentColl, bag[it.slug]); }
      });
    }
    r();
    host.querySelector('#b-blank').onclick = function () {
      if (!state.currentColl) return;
      var slug = 'entity-' + Math.random().toString(36).slice(2, 6);
      var doc = { slug: slug, name: 'New entity', data: {}, image_query: '' };
      state.entities[state.currentColl][slug] = doc;
      MKT.saveEntity(state.currentColl, slug, doc).then(function () { editEntity(state.currentColl, doc); });
    };
    host.querySelector('#b-gen').onclick = function () {
      if (!state.currentColl) return;
      var coll = state.entityCollections[state.currentColl];
      MKT.toast('Generating…');
      MKT.callAI('brainstormEntities', {
        workspaceId: MKT.workspaceId,
        collection_slug: coll.slug,
        collection_display_name: coll.display_name,
        collection_schema: coll.suggested_schema || [],
        existing_entities: Object.values(state.entities[coll.slug] || {}),
        count: 10
      }).then(function (out) {
        var writes = [];
        (out.suggestions || []).forEach(function (e) {
          var slug = MKT.slugify(e.name || e.slug);
          var doc = Object.assign({}, e, { slug: slug });
          state.entities[coll.slug][slug] = doc;
          writes.push(MKT.saveEntity(coll.slug, slug, doc));
        });
        Promise.all(writes).then(renderTab);
      }).catch(function (e) { MKT.toast(e.message, 'error'); });
    };
    host.querySelector('#b-new-coll').onclick = function () {
      MKT.toast('Brainstorming…');
      MKT.callAI('brainstormCollections', { workspaceId: MKT.workspaceId, count: 5 }).then(function (out) {
        (out.suggestions || []).forEach(function (s) {
          var slug = MKT.slugify(s.slug || s.display_name);
          var doc = Object.assign({}, s, { slug: slug });
          state.entityCollections[slug] = doc;
          state.entities[slug] = {};
          MKT.saveDoc('entityCollections', slug, doc);
        });
        state.currentColl = state.currentColl || Object.keys(state.entityCollections)[0];
        renderTab();
      }).catch(function (e) { MKT.toast(e.message, 'error'); });
    };
  }
  function editEntity(coll, e) {
    var dataKeys = Object.keys(e.data || {});
    var fields = [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'image_query', label: 'Image search query', type: 'text', hint: 'A phrase a designer could search for visuals.' }
    ];
    dataKeys.forEach(function (k) { fields.push({ key: 'data_' + k, label: k, type: 'textarea' }); });
    var seed = Object.assign({ name: e.name, image_query: e.image_query }, {});
    dataKeys.forEach(function (k) { seed['data_' + k] = e.data[k]; });
    var form = MKT.renderForm(seed, fields);
    MKT.openDrawer({
      title: 'Edit entity', body: form.element,
      actions: [
        { label: 'Delete', kind: 'danger', onClick: function () {
          if (!confirm('Delete?')) return false;
          delete state.entities[coll][e.slug];
          return MKT.deleteEntity(coll, e.slug).then(function () { renderTab(); });
        } },
        { label: 'Save', kind: 'primary', onClick: function () {
          var v = form.read();
          var newE = Object.assign({}, e, { name: v.name, image_query: v.image_query, data: Object.assign({}, e.data) });
          dataKeys.forEach(function (k) { newE.data[k] = v['data_' + k]; });
          state.entities[coll][e.slug] = newE;
          return MKT.saveEntity(coll, e.slug, newE).then(function () { renderTab(); MKT.toast('Saved', 'ok'); });
        } }
      ]
    });
  }

  // ---- Style ----
  function renderStyleTab(host) {
    host.innerHTML = ''
      + '<div class="mkt-row" style="justify-content:space-between;gap:8px;margin-bottom:12px;align-items:center;">'
      + '  <span class="mkt-tiny mkt-muted">Upload designs you love — your CMO reads each one for palette, mood, and a reusable style hint.</span>'
      + '  <label class="mkt-btn mkt-btn-soft"><input type="file" id="up" accept="image/*" multiple style="display:none" />⬆ Upload references</label>'
      + '</div>'
      + '<div class="ob-style-grid" id="pending"></div>'
      + '<div class="ob-style-grid" id="sg"></div>';
    var sg = host.querySelector('#sg');
    var pending = host.querySelector('#pending');
    function r() {
      sg.innerHTML = '';
      var arr = Object.values(state.styleTemplates);
      if (!arr.length && !pending.children.length) {
        sg.innerHTML = '<div class="mkt-empty"><div class="mkt-empty-icon">🎨</div><h3 class="mkt-empty-title">No style references yet</h3><p class="mkt-empty-desc">Upload designs you love — we extract the palette + mood.</p></div>';
        return;
      }
      arr.forEach(function (s) {
        var card = document.createElement('div'); card.className = 'ob-style-card';
        card.innerHTML = '<div class="preview">' + (s.image_url ? '<img src="' + MKT.escape(s.image_url) + '" />' : '✨') + '</div>'
          + '<div class="palette">' + (s.palette || []).slice(0, 6).map(p => '<span class="swatch" style="background:' + MKT.escape(p) + '" title="' + MKT.escape(p) + '"></span>').join('') + '</div>'
          + '<div class="mood">' + MKT.escape((s.mood || []).join(' · ')) + '</div>'
          + '<button class="mkt-btn mkt-btn-ghost mkt-btn-sm" style="margin-top:6px;width:100%;justify-content:center;" data-rem="' + MKT.escape(s.slug) + '">Remove</button>';
        card.querySelector('[data-rem]').onclick = function () {
          delete state.styleTemplates[s.slug];
          MKT.deleteDoc('styleTemplates', s.slug).then(r);
        };
        sg.appendChild(card);
      });
    }
    r();

    host.querySelector('#up').onchange = function (ev) {
      var files = Array.from(ev.target.files || []); if (!files.length) return;
      ev.target.value = ''; // allow re-selecting the same files later
      files.forEach(function (file) { uploadOneReference(file, pending, r); });
    };
  }

  // Upload + extract one style reference, with a live placeholder card that
  // shows a local preview, an upload progress bar, then an "extracting" state.
  function uploadOneReference(file, pendingHost, onDone) {
    var card = document.createElement('div');
    card.className = 'ob-style-card pending';
    var localUrl = URL.createObjectURL(file);
    card.innerHTML = ''
      + '<div class="preview"><img src="' + localUrl + '" /></div>'
      + '<div class="pending-bar"><span class="pending-fill" style="width:8%"></span></div>'
      + '<div class="pending-label">Uploading…</div>';
    pendingHost.appendChild(card);
    var fill = card.querySelector('.pending-fill');
    var label = card.querySelector('.pending-label');

    MKT.uploadAssetFile(file, {
      onProgress: function (pct) { fill.style.width = Math.max(8, Math.round(pct * 0.6)) + '%'; }
    }).then(function (up) {
      fill.style.width = '70%';
      label.innerHTML = '<span class="mkt-spinner" style="width:12px;height:12px;vertical-align:middle;"></span> Reading the style…';
      return MKT.callAI('extractStyleTemplate', { image_url: up.download_url }).then(function (out) {
        fill.style.width = '100%';
        var slug = 'style-' + Math.random().toString(36).slice(2, 6);
        var doc = Object.assign({ slug: slug, image_url: up.download_url, asset_id: up.assetId }, out);
        state.styleTemplates[slug] = doc;
        return MKT.saveDoc('styleTemplates', slug, doc);
      });
    }).then(function () {
      URL.revokeObjectURL(localUrl);
      card.remove();
      onDone();
    }).catch(function (e) {
      label.textContent = 'Failed: ' + (e.message || e);
      card.classList.add('failed');
      var bar = card.querySelector('.pending-bar'); if (bar) bar.style.display = 'none';
    });
  }

  // ---- Settings ----
  function renderSettingsTab(host) {
    var ws = MKT.workspace();
    host.innerHTML = ''
      + '<div class="mkt-card" style="max-width:540px;">'
      + '  <h3 class="mkt-card-title">Workspace</h3>'
      + '  <div class="mkt-field"><label class="mkt-label">Name</label><input class="mkt-input" id="ws-name" value="' + MKT.escape(ws.meta.name || '') + '" /></div>'
      + '  <div class="mkt-field"><label class="mkt-label">Writeup</label><textarea class="mkt-textarea" id="ws-writeup" rows="5">' + MKT.escape(state.intake.writeup || '') + '</textarea></div>'
      + '  <div class="mkt-field"><label class="mkt-label">Funnel focus</label><select class="mkt-select" id="ws-funnel">'
      +     ['awareness', 'consideration', 'conversion', 'retention', 'mixed'].map(f => '<option' + (f === state.intake.funnel_focus ? ' selected' : '') + '>' + f + '</option>').join('')
      +   '</select></div>'
      + '  <div class="mkt-field"><label class="mkt-label">Marketing stack</label><textarea class="mkt-textarea" id="ws-stack" rows="2">' + MKT.escape(state.intake.marketing_stack || '') + '</textarea></div>'
      + '  <div class="mkt-row" style="gap:8px;justify-content:flex-end;">'
      + '    <button class="mkt-btn mkt-btn-primary" id="b-save">Save</button>'
      + '  </div>'
      + '</div>';
    host.querySelector('#b-save').onclick = function () {
      Promise.all([
        MKT.saveMeta({ name: host.querySelector('#ws-name').value.trim() }),
        MKT.saveIntake({
          writeup: host.querySelector('#ws-writeup').value.trim(),
          funnel_focus: host.querySelector('#ws-funnel').value,
          marketing_stack: host.querySelector('#ws-stack').value.trim()
        })
      ]).then(function () { MKT.toast('Saved', 'ok'); });
    };
  }

  window.Ont = Ont;
})();
