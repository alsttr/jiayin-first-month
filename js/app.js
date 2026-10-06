/* Jiayin's First Month At Work — app logic (no build step, no dependencies) */
(function () {
  'use strict';

  var C = window.CONFIG, A = window.ART;
  var NS = 'http://www.w3.org/2000/svg';
  var W = A.w, H = A.h;
  var ASPECT = H / W;
  var MAXZ = 8;                 // max zoom
  var INK = '#3b3330';
  var BRUSH_PX = [8, 16, 30];   // brush diameters in screen pixels
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* ======================================================================
     TIME (everything is Singapore time, UTC+8)
     ====================================================================== */
  var params = new URLSearchParams(location.search);
  // Which version of the page this is:
  //   real    — her picture: locked-in days are saved online (when CONFIG.sync is set)
  //   test    — ?test  : everything unlocked, nothing saved online, separate sandbox on this device
  //   preview — ?preview=YYYY-MM-DDTHH:MM : pretend it's that Singapore time, separate sandbox, nothing saved online
  //   view    — ?view  : read-only look at her saved picture
  var MODE = params.has('test') ? 'test' : params.has('preview') ? 'preview' : params.has('view') ? 'view' : 'real';
  var PREVIEW = MODE === 'preview' ? parsePreview(params.get('preview')) : null;
  if (MODE === 'preview' && PREVIEW == null) PREVIEW = Date.now();   // unreadable date: sandbox at the real time
  var TEST_NOW = 0;   // set once the schedule is known (just after the last unlock)
  var t0 = Date.now();
  function now() {
    if (MODE === 'test') return TEST_NOW + (Date.now() - t0);
    return PREVIEW != null ? PREVIEW + (Date.now() - t0) : Date.now();
  }
  function parsePreview(s) {
    if (!s) return null;
    if (s === 'now') return Date.now();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?$/);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], (+(m[4] || 0)) - 8, +(m[5] || 0), +(m[6] || 0));
  }
  var SGT = 8 * 3600 * 1000;
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function sgt(ms) { var d = new Date(ms + SGT); return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes() }; }
  function fmtDate(ms) { var p = sgt(ms); return WD[p.wd] + ' ' + p.d + ' ' + MO[p.mo]; }
  function fmtTime(ms) { var p = sgt(ms); var h = ((p.h + 11) % 12) + 1; return h + (p.mi ? ':' + String(p.mi).padStart(2, '0') : '') + (p.h < 12 ? 'am' : 'pm'); }
  function dayKey(ms) { var p = sgt(ms); return p.y * 10000 + (p.mo + 1) * 100 + p.d; }
  function relDay(ms) {
    var a = dayKey(ms), today = dayKey(now()), tmr = dayKey(now() + 864e5);
    if (a === today) return 'Today';
    if (a === tmr) return 'Tomorrow';
    return fmtDate(ms);
  }
  function unlockAt(date) {
    var p = date.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2], (C.unlockHour == null ? 18 : C.unlockHour) - 8, C.unlockMinute || 0);
  }

  /* ======================================================================
     SCHEDULE + REGIONS
     ====================================================================== */
  var DAYS = C.days.map(function (d) { return { n: d.n, date: d.date, game: d.game, at: unlockAt(d.date) }; })
    .sort(function (a, b) { return a.n - b.n; });
  var DAY = {}; DAYS.forEach(function (d) { DAY[d.n] = d; });
  var TOTAL = DAYS.length;
  TEST_NOW = (DAYS.length ? DAYS[DAYS.length - 1].at : Date.now()) + 3600 * 1000;

  var REG = {};
  A.regions.forEach(function (r) {
    var n = Object.prototype.hasOwnProperty.call(C.regions, r.id) ? C.regions[r.id] : null;
    REG[r.id] = { id: r.id, d: r.d, bbox: r.bbox, pt: r.pt, area: r.area, n: n, el: null, label: null, p2d: null };
  });
  var DAY_REGIONS = {};
  Object.keys(REG).forEach(function (id) {
    var n = REG[id].n;
    if (n == null) return;
    (DAY_REGIONS[n] = DAY_REGIONS[n] || []).push(id);
  });

  /* ======================================================================
     STATE (saved on this device)
     ====================================================================== */
  var KEY = C.storageKey + (MODE === 'real' ? '' : ':' + MODE);
  var state = load();
  function blank() { return { v: 1, days: {}, draft: null, opened: {} }; }
  function valid(s) { return s && s.v === 1 && s.days && typeof s.days === 'object'; }
  function load() {
    var keys = [KEY, KEY + ':bak'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (raw) { var s = JSON.parse(raw); if (valid(s)) { s.opened = s.opened || {}; return s; } }
      } catch (e) { /* ignore */ }
    }
    return blank();
  }
  var saveTimer = 0;
  function readDisk() {
    try { var raw = localStorage.getItem(KEY); if (raw) { var s = JSON.parse(raw); if (valid(s)) return s; } } catch (e) { /* ignore */ }
    return null;
  }
  // Never lose a locked-in day: combine what's stored (maybe written by another tab) with what's in memory.
  // Days flagged srv are confirmed online; one missing from disk was removed online (by another tab's sync).
  function mergeWithDisk() {
    var disk = readDisk();
    if (!disk) return state;
    var out = { v: 1, days: {}, draft: state.draft, opened: {} };
    Object.keys(disk.days).forEach(function (k) { out.days[k] = disk.days[k]; });
    Object.keys(state.days).forEach(function (k) {
      var m = state.days[k];
      if (!out.days[k]) { if (!m.srv) out.days[k] = m; }
      else if (m.srv && !out.days[k].srv) out.days[k] = m;
    });
    [disk.opened, state.opened].forEach(function (o) { if (o) Object.keys(o).forEach(function (k) { out.opened[k] = 1; }); });
    if (out.draft && out.days[out.draft.day]) out.draft = null;
    return out;
  }
  var frozen = false;   // set when we're deliberately wiping/replacing data and about to reload
  function save(backup, force) {
    clearTimeout(saveTimer);
    if (frozen) return true;
    try {
      if (!force) state = mergeWithDisk();
      var s = JSON.stringify(state);
      localStorage.setItem(KEY, s);
      if (backup) localStorage.setItem(KEY + ':bak', s);
      return true;
    } catch (e) { return false; }
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { save(false); }, 350); }
  function pref(k, v) {
    try {
      if (v === undefined) return localStorage.getItem('jfm-pref:' + k);
      localStorage.setItem('jfm-pref:' + k, v);
    } catch (e) { return null; }
  }

  /* ======================================================================
     ONLINE SAVING (Supabase) — her locked-in days, shared by every browser
     ====================================================================== */
  var SYNC = (C.sync && C.sync.url && C.sync.key) ? C.sync : null;
  var SYNC_READ = !!SYNC && (MODE === 'real' || MODE === 'view');
  var SYNC_WRITE = !!SYNC && MODE === 'real';
  var TABLE = (SYNC && SYNC.table) || 'jfm_days';
  var syncBusy = false, pushing = false, lastSync = 0, lastSyncOk = 0, syncError = '', booted = false, remoteDirty = false;

  function sbFetch(path, opts, ms) {
    opts = opts || {};
    var headers = { apikey: SYNC.key };
    if (!/^sb_/.test(SYNC.key)) headers.Authorization = 'Bearer ' + SYNC.key;   // legacy JWT-style keys
    var extra = opts.headers || {};
    for (var h in extra) headers[h] = extra[h];
    opts.headers = headers;
    opts.cache = 'no-store';
    var ctl = window.AbortController ? new AbortController() : null, timer = 0;
    if (ctl) { opts.signal = ctl.signal; timer = setTimeout(function () { ctl.abort(); }, ms || 9000); }
    return fetch(SYNC.url.replace(/\/+$/, '') + '/rest/v1/' + path, opts)
      .then(function (r) { clearTimeout(timer); return r; }, function (e) { clearTimeout(timer); throw e; });
  }
  function parseStrokes(v) {
    try { var a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function fetchServerDays() {
    return sbFetch(TABLE + '?select=n,fills,strokes,at&order=n.asc').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (rows) {
      var out = {};
      (rows || []).forEach(function (row) {
        out[row.n] = { fills: row.fills || {}, strokes: parseStrokes(row.strokes), at: +row.at || 0, srv: 1 };
      });
      return out;
    });
  }
  function uploadDay(n, rec) {
    var body = { n: +n, fills: rec.fills || {}, strokes: JSON.stringify(rec.strokes || []), at: rec.at || Date.now() };
    return sbFetch(TABLE, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body) }, 15000)
      .then(function (r) {
        if (r.ok) return 'ok';
        if (r.status === 409) return 'exists';      // already locked from another device: the online copy wins
        throw new Error('HTTP ' + r.status);
      });
  }
  // The online copy is the source of truth. Keep local days that haven't been uploaded yet.
  function applyServer(server) {
    var disk = readDisk(), pool = {};
    [disk && disk.days, state.days].forEach(function (src) {
      if (src) Object.keys(src).forEach(function (k) { if (!pool[k] || (src[k] && !src[k].srv)) pool[k] = src[k]; });
    });
    var days = {};
    Object.keys(server).forEach(function (k) { days[k] = server[k]; });
    Object.keys(pool).forEach(function (k) { if (!days[k] && pool[k] && !pool[k].srv) days[k] = pool[k]; });
    var before = dayDigest(state.days);
    var draft = state.draft && !days[state.draft.day] ? state.draft : null;
    var opened = {};
    [disk && disk.opened, state.opened].forEach(function (o) { if (o) Object.keys(o).forEach(function (k) { opened[k] = 1; }); });
    var changed = before !== dayDigest(days) || (!!state.draft && !draft);
    state = { v: 1, days: days, draft: draft, opened: opened };
    save(false, true);
    return changed;
  }
  function dayDigest(days) {
    return Object.keys(days).sort(function (a, b) { return a - b; }).map(function (k) {
      var d = days[k];
      return k + ':' + JSON.stringify(Object.keys(d.fills || {}).sort().map(function (id) { return [id, String(d.fills[id]).toLowerCase()]; })) + ':' + JSON.stringify(d.strokes || []);
    }).join('|');
  }
  function syncNow() {
    if (!SYNC_READ || syncBusy) return Promise.resolve(false);
    syncBusy = true; lastSync = Date.now();
    return fetchServerDays().then(function (server) {
      syncBusy = false; lastSyncOk = Date.now(); syncError = '';
      var changed = applyServer(server);
      if (SYNC_WRITE) pushPending();
      if (changed && booted) { remoteDirty = true; flushRemote(); }
      return changed;
    }, function (e) {
      syncBusy = false; syncError = String(e && e.message || e);
      return false;
    });
  }
  function pushPending() {
    if (!SYNC_WRITE || pushing) return;
    var pend = Object.keys(state.days).filter(function (k) { return !state.days[k].srv; }).sort(function (a, b) { return a - b; });
    if (!pend.length) return;
    pushing = true;
    (function next(i) {
      if (i >= pend.length) { pushing = false; return; }
      var k = pend[i], rec = state.days[k];
      if (!rec || rec.srv) { next(i + 1); return; }
      uploadDay(k, rec).then(function (res) {
        if (res === 'ok') {
          if (state.days[k]) state.days[k].srv = 1;
          save(false);
          next(i + 1);
        } else { pushing = false; syncNow(); }
      }, function (e) { pushing = false; syncError = String(e && e.message || e); });   // offline: retried on the next sync
    })(0);
  }
  // re-draw after the online copy changed — but never in the middle of a brush stroke or an open sheet
  function flushRemote() {
    if (!remoteDirty || live || anyOverlay()) return;
    remoteDirty = false;
    var was = lastPhase, cur0 = currentDay();
    lastPhase = null;
    render();
    var cur1 = currentDay();
    if (phase() === 'colour' && (!cur0 || !cur1 || cur0.n !== cur1.n)) focusToday(true);
    else if (was === 'colour' && phase() !== 'colour') animateView(fullView(), 700);
  }
  function firstSync(maxMs) {
    if (!SYNC_READ) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false;
      function fin() { if (!done) { done = true; resolve(); } }
      setTimeout(fin, maxMs);
      syncNow().then(fin, fin);
    });
  }

  function record(n) {
    if (state.days[n]) return state.days[n];
    var pf = C.prefilled && C.prefilled[n];
    return pf ? { fills: pf, strokes: [], pre: true } : null;
  }
  function isDone(n) { return !!record(n); }
  function currentDay() { for (var i = 0; i < DAYS.length; i++) if (!isDone(DAYS[i].n)) return DAYS[i]; return null; }
  function phase() { var d = currentDay(); if (!d) return 'complete'; return now() >= d.at ? 'colour' : 'wait'; }
  function canColour() { return MODE !== 'view' && phase() === 'colour'; }
  function draftFor(n) {
    if (!state.draft || state.draft.day !== n) state.draft = { day: n, fills: {}, strokes: [], ops: [] };
    if (!state.draft.ops) state.draft.ops = [];
    return state.draft;
  }
  function mainColour(n) {
    var r = record(n); if (!r) return null;
    var ids = Object.keys(r.fills || {});
    var best = null, area = -1;
    ids.forEach(function (id) { var a = REG[id] ? REG[id].area : 0; if (a > area) { area = a; best = r.fills[id]; } });
    if (best) return best;
    if (r.strokes && r.strokes.length) return r.strokes[0].c;
    return '#ffffff';
  }

  /* ======================================================================
     DOM
     ====================================================================== */
  var svg = $('#art'), card = $('#card'), stage = $('#stage');
  var hitCtx = document.createElement('canvas').getContext('2d');
  var defs, gFill, gFx, gStroke, gHl, gInk, gNum, gPing;
  var dayGroups = {};

  function buildArt() {
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    defs = mk('defs', null, svg);
    gFill = mk('g', { class: 'fills' }, svg);
    gFx = mk('g', { class: 'fx' }, svg);
    gStroke = mk('g', { class: 'strokes' }, svg);
    gHl = mk('g', { class: 'hls' }, svg);
    gInk = mk('g', { class: 'ink', fill: 'none', stroke: INK, 'stroke-width': 3.1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    gNum = mk('g', { class: 'nums' }, svg);
    gPing = mk('g', { class: 'pings' }, svg);

    Object.keys(REG).forEach(function (id) {
      var r = REG[id];
      r.el = mk('path', { d: r.d, 'fill-rule': 'evenodd', fill: 'none', 'data-id': id }, gFill);
      var cp = mk('clipPath', { id: 'cr-' + id }, defs);
      mk('path', { d: r.d, 'clip-rule': 'evenodd' }, cp);
      try { r.p2d = new Path2D(r.d); } catch (e) { r.p2d = null; }
    });
    Object.keys(DAY_REGIONS).forEach(function (n) {
      var cp = mk('clipPath', { id: 'cd-' + n }, defs);
      DAY_REGIONS[n].forEach(function (id) { mk('path', { d: REG[id].d, 'clip-rule': 'evenodd' }, cp); });
    });
    A.lines.forEach(function (d) { mk('path', { d: d }, gInk); });
    A.circles.forEach(function (c) { mk('circle', { cx: c.cx, cy: c.cy, r: c.r }, gInk); });
    A.labels.forEach(function (l) {
      var r = REG[l.region]; if (!r || r.n == null) return;
      var t = mk('text', { x: l.x, y: l.y, dy: '.36em', 'font-size': (l.size * 1.32).toFixed(1), class: 'num' }, gNum);
      t.textContent = r.n;
      r.label = t;
    });
  }

  function dayGroup(n) {
    if (!dayGroups[n]) {
      dayGroups[n] = mk('g', { 'clip-path': DAY_REGIONS[n] ? 'url(#cd-' + n + ')' : null, 'data-day': n }, gStroke);
    }
    return dayGroups[n];
  }

  function strokeD(p) {
    var n = p.length / 2;
    if (n === 1) return 'M' + p[0] + ' ' + p[1] + 'h.01';
    if (n === 2) return 'M' + p[0] + ' ' + p[1] + 'L' + p[2] + ' ' + p[3];
    var d = 'M' + p[0] + ' ' + p[1];
    for (var i = 1; i < n - 1; i++) {
      var x = p[2 * i], y = p[2 * i + 1], nx = p[2 * i + 2], ny = p[2 * i + 3];
      d += 'Q' + x + ' ' + y + ' ' + r1((x + nx) / 2) + ' ' + r1((y + ny) / 2);
    }
    return d + 'L' + p[2 * n - 2] + ' ' + p[2 * n - 1];
  }
  function drawStroke(n, s) {
    return mk('path', { d: strokeD(s.p), class: 'bstroke', stroke: s.c, 'stroke-width': s.w, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, dayGroup(n));
  }

  // paint everything that has been locked in (+ today's draft)
  function paintAll() {
    Object.keys(REG).forEach(function (id) { REG[id].el.setAttribute('fill', 'none'); });
    Object.keys(dayGroups).forEach(function (n) { dayGroups[n].textContent = ''; });
    DAYS.forEach(function (d) {
      var rec = record(d.n);
      if (!rec) return;
      paintRecord(d.n, rec);
    });
    var cur = currentDay();
    if (cur && state.draft && state.draft.day === cur.n) paintRecord(cur.n, state.draft);
    refreshLabels();
  }
  function paintRecord(n, rec) {
    var f = rec.fills || {};
    Object.keys(f).forEach(function (id) { if (REG[id]) REG[id].el.setAttribute('fill', f[id]); });
    (rec.strokes || []).forEach(function (s) { drawStroke(n, s); });
  }
  function refreshLabels() {
    Object.keys(REG).forEach(function (id) {
      var r = REG[id]; if (!r.label) return;
      var filled = r.el.getAttribute('fill') !== 'none';
      r.label.classList.toggle('coloured', filled);
    });
  }

  /* ======================================================================
     VIEW (zoom + pan via the SVG viewBox)
     ====================================================================== */
  var view = { x: 0, y: 0, w: W };
  var viewAnim = 0;
  function vh(w) { return w * ASPECT; }
  function clampView(v) {
    var w = clamp(v.w, W / MAXZ, W);
    return { w: w, x: clamp(v.x, 0, W - w), y: clamp(v.y, 0, H - vh(w)) };
  }
  function applyView() {
    svg.setAttribute('viewBox', view.x.toFixed(2) + ' ' + view.y.toFixed(2) + ' ' + view.w.toFixed(2) + ' ' + vh(view.w).toFixed(2));
    var upp = unitsPerPx();
    $$('.ping', gPing).forEach(function (c) { c.setAttribute('r', (17 * upp).toFixed(2)); });
    var zoomed = view.w < W - 0.5;
    $('#zFit').hidden = !zoomed;
    $('#zIn').hidden = view.w <= W / MAXZ + 0.5;
  }
  function unitsPerPx() { var w = svg.clientWidth || card.clientWidth || 300; return view.w / w; }
  function toArt(cx, cy) {
    var m = svg.getScreenCTM();
    if (m) { var p = new DOMPoint(cx, cy).matrixTransform(m.inverse()); return { x: p.x, y: p.y }; }
    var r = svg.getBoundingClientRect();
    return { x: view.x + (cx - r.left) / r.width * view.w, y: view.y + (cy - r.top) / r.height * vh(view.w) };
  }
  function toScreen(x, y) {
    var m = svg.getScreenCTM();
    if (m) { var p = new DOMPoint(x, y).matrixTransform(m); return { x: p.x, y: p.y }; }
    var r = svg.getBoundingClientRect();
    return { x: r.left + (x - view.x) / view.w * r.width, y: r.top + (y - view.y) / vh(view.w) * r.height };
  }
  function stopViewAnim() { if (viewAnim) { cancelAnimationFrame(viewAnim); viewAnim = 0; } }
  function animateView(target, dur, done) {
    stopViewAnim();
    target = clampView(target);
    if (reduceMotion || !dur) { view = target; applyView(); if (done) done(); return; }
    var from = { x: view.x, y: view.y, w: view.w }, start = performance.now();
    var fcx = from.x + from.w / 2, fcy = from.y + vh(from.w) / 2, tcx = target.x + target.w / 2, tcy = target.y + vh(target.w) / 2;
    function step(t) {
      var k = Math.min(1, (t - start) / dur), e = easeInOut(k);
      var w = Math.exp(lerp(Math.log(from.w), Math.log(target.w), e));
      var cx = lerp(fcx, tcx, e), cy = lerp(fcy, tcy, e);
      view = { w: w, x: cx - w / 2, y: cy - vh(w) / 2 };
      applyView();
      if (k < 1) viewAnim = requestAnimationFrame(step); else { viewAnim = 0; view = target; applyView(); if (done) done(); }
    }
    viewAnim = requestAnimationFrame(step);
  }
  function fullView() { return { x: 0, y: 0, w: W }; }
  function focusView(ids) {
    if (!ids || !ids.length) return fullView();
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ids.forEach(function (id) { var b = REG[id].bbox; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); });
    var w = Math.max((x1 - x0) * 1.7, (y1 - y0) * 1.7 / ASPECT, W / 3.4);
    if (w > W * 0.8) return fullView();
    return clampView({ w: w, x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - vh(w) / 2 });
  }
  function zoomAt(cx, cy, f) {
    stopViewAnim();
    var a = toArt(cx, cy), r = svg.getBoundingClientRect();
    var w = clamp(view.w * f, W / MAXZ, W), upp = w / r.width;
    view = clampView({ w: w, x: a.x - (cx - r.left) * upp, y: a.y - (cy - r.top) * upp });
    applyView();
  }
  function zoomCentre(f) {
    var r = svg.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var a = toArt(cx, cy), w = clamp(view.w * f, W / MAXZ, W);
    animateView({ w: w, x: a.x - w / 2, y: a.y - vh(w) / 2 }, 380);
  }

  function layout() {
    var cs = getComputedStyle(stage);
    var pw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var ph = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (pw <= 0 || ph <= 0) return;
    var w = pw, h = w * ASPECT;
    if (h > ph) { h = ph; w = h / ASPECT; }
    w = Math.floor(w);
    card.style.width = w + 'px';
    card.style.height = Math.floor(w * ASPECT) + 'px';
    applyView();
    sizeFx();
  }

  /* ======================================================================
     HIGHLIGHTS (today's glowing spots)
     ====================================================================== */
  function todayIds() { var c = currentDay(); return c && DAY_REGIONS[c.n] ? DAY_REGIONS[c.n] : []; }
  function touchedByStrokes(id, strokes) {
    var r = REG[id]; if (!r.p2d) return false;
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i];
      hitCtx.lineWidth = s.w;
      for (var j = 0; j < s.p.length; j += 2) {
        if (hitCtx.isPointInPath(r.p2d, s.p[j], s.p[j + 1], 'evenodd')) return true;
      }
    }
    return false;
  }
  function updateHighlights() {
    gHl.textContent = ''; gPing.textContent = '';
    if (phase() !== 'colour' || MODE === 'view') return;
    var cur = currentDay(), d = draftFor(cur.n);
    todayIds().forEach(function (id) {
      var r = REG[id];
      var done = !!d.fills[id] || touchedByStrokes(id, d.strokes);
      mk('path', { d: r.d, 'fill-rule': 'evenodd', class: 'hl' + (done ? ' done' : '') }, gHl);
      if (!done) {
        mk('circle', { cx: r.pt[0], cy: r.pt[1], r: 10, class: 'ping' }, gPing);
        mk('circle', { cx: r.pt[0], cy: r.pt[1], r: 10, class: 'ping p2' }, gPing);
      }
    });
    applyView();
  }
  function blanksLeft() {
    var cur = currentDay(); if (!cur) return 0;
    var d = draftFor(cur.n), k = 0;
    todayIds().forEach(function (id) { if (!d.fills[id] && !touchedByStrokes(id, d.strokes)) k++; });
    return k;
  }

  /* ======================================================================
     TOOLS
     ====================================================================== */
  var tool = 'fill';
  var colour = pref('colour') || C.palette[0];
  var sizeIdx = +(pref('size') || 1);

  function buildPalette() {
    var pal = $('#palette');
    pal.textContent = '';
    C.palette.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'sw'; b.style.background = c; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'Colour ' + c); b.dataset.c = c;
      b.addEventListener('click', function () { setColour(c); squish(b); });
      pal.appendChild(b);
    });
    var cb = document.createElement('label');
    cb.className = 'sw custom'; cb.setAttribute('aria-label', 'Pick any colour'); cb.title = 'Any colour';
    var inp = document.createElement('input'); inp.type = 'color'; inp.value = isHex(colour) ? colour : '#ff8fab';
    inp.addEventListener('input', function () { setColour(inp.value, true); });
    inp.addEventListener('change', function () { setColour(inp.value, true); });
    cb.appendChild(inp);
    pal.appendChild(cb);
    setColour(colour, C.palette.indexOf(colour) < 0);
  }
  function isHex(c) { return /^#[0-9a-f]{6}$/i.test(c); }
  function setColour(c, custom) {
    colour = c; pref('colour', c);
    $$('.sw', $('#palette')).forEach(function (b) { b.classList.toggle('on', !custom && b.dataset.c === c); b.setAttribute('aria-checked', String(!custom && b.dataset.c === c)); });
    var cb = $('.sw.custom');
    if (cb) { cb.classList.toggle('on', !!custom); cb.style.boxShadow = custom ? '0 0 0 2.5px #fff, 0 0 0 5px ' + c : ''; }
  }
  function squish(el) {
    if (reduceMotion || !el.animate) return;
    el.animate([{ transform: 'scale(1.12)' }, { transform: 'scale(.82)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1.12)' }], { duration: 380, easing: 'ease-out' });
  }
  function setTool(t) {
    tool = t;
    $$('#toolSeg button').forEach(function (b) { var on = b.dataset.tool === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    var on = $('#toolSeg button.on'), pill = $('#toolPill');
    if (on) { pill.style.width = on.offsetWidth + 'px'; pill.style.transform = 'translateX(' + (on.offsetLeft - 4) + 'px)'; }
    $('#sizes').classList.toggle('off', t !== 'brush' || !canColour());
    updatePrompt();
  }
  function setSize(i) {
    sizeIdx = i; pref('size', String(i));
    $$('#sizes button').forEach(function (b) { b.classList.toggle('on', +b.dataset.size === i); });
  }

  // ---- fill ----
  function regionsAt(x, y) {
    var out = [];
    Object.keys(REG).forEach(function (id) { var r = REG[id]; if (r.p2d && hitCtx.isPointInPath(r.p2d, x, y, 'evenodd')) out.push(id); });
    out.sort(function (a, b) { return REG[a].area - REG[b].area; });
    return out;
  }
  function pickToday(x, y) {
    var ids = todayIds();
    var inside = regionsAt(x, y).filter(function (id) { return ids.indexOf(id) >= 0; });
    if (inside.length) return inside[0];
    hitCtx.lineWidth = 2 * 15 * unitsPerPx();       // ~15px finger tolerance
    var near = ids.filter(function (id) { return REG[id].p2d && hitCtx.isPointInStroke(REG[id].p2d, x, y); });
    near.sort(function (a, b) { return REG[a].area - REG[b].area; });
    return near[0] || null;
  }
  function doFill(id, x, y) {
    var cur = currentDay(), d = draftFor(cur.n);
    var prev = d.fills[id] || null;
    if (prev && prev.toLowerCase() === colour.toLowerCase()) { wobbleRegion(id); return; }
    d.fills[id] = colour;
    d.ops.push({ t: 'f', id: id, prev: prev });
    animateFill(id, colour, x, y);
    sparkle(x, y, colour);
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) { try { navigator.vibrate(12); } catch (e) { /* ignore */ } }
    afterEdit();
  }
  function animateFill(id, c, x, y) {
    var r = REG[id], b = r.bbox, token = r.token = (r.token || 0) + 1;
    var maxR = Math.max(Math.hypot(x - b[0], y - b[1]), Math.hypot(x - b[2], y - b[1]), Math.hypot(x - b[0], y - b[3]), Math.hypot(x - b[2], y - b[3])) + 6;
    if (reduceMotion) { r.el.setAttribute('fill', c); refreshLabels(); return; }
    var g = mk('g', { 'clip-path': 'url(#cr-' + id + ')' }, gFx);
    var circ = mk('circle', { cx: x, cy: y, r: 0, fill: c }, g);
    var dur = clamp(260 + maxR * 1.4, 420, 1000), start = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - start) / dur);
      circ.setAttribute('r', (easeOut(k) * maxR).toFixed(1));
      if (k < 1) requestAnimationFrame(step);
      else { if (r.token === token) r.el.setAttribute('fill', c); refreshLabels(); g.remove(); }
    })(start);
  }
  function wobbleRegion(id) {
    var r = REG[id];
    var hl = mk('path', { d: r.d, 'fill-rule': 'evenodd', fill: '#fff', opacity: 0 }, gFx);
    if (hl.animate) hl.animate([{ opacity: 0 }, { opacity: .55 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' }).onfinish = function () { hl.remove(); };
    else hl.remove();
  }

  // ---- brush ----
  var live = null, liveRaf = 0;
  function startStroke(a) {
    var cur = currentDay();
    var w = r1(BRUSH_PX[sizeIdx] * unitsPerPx());
    var s = { c: colour, w: Math.max(0.8, w), p: [r1(a.x), r1(a.y)] };
    var el = drawStroke(cur.n, s);
    live = { s: s, el: el, n: cur.n, t: performance.now() };
    return live;
  }
  function extendStroke(a) {
    if (!live) return;
    var p = live.s.p, lx = p[p.length - 2], ly = p[p.length - 1];
    var minD = Math.max(0.35, live.s.w * 0.12);
    if (Math.hypot(a.x - lx, a.y - ly) < minD) return;
    p.push(r1(a.x), r1(a.y));
    if (!liveRaf) liveRaf = requestAnimationFrame(function () { liveRaf = 0; if (live) live.el.setAttribute('d', strokeD(live.s.p)); });
  }
  function endStroke() {
    if (!live) return;
    live.el.setAttribute('d', strokeD(live.s.p));
    var d = draftFor(live.n);
    d.strokes.push(live.s);
    d.ops.push({ t: 's' });
    live = null;
    afterEdit();
  }
  function cancelStroke() { if (!live) return; live.el.remove(); live = null; }

  function undo() {
    var cur = currentDay(); if (!cur || phase() !== 'colour') return;
    var d = draftFor(cur.n), op = d.ops.pop();
    if (!op) return;
    if (op.t === 'f') {
      if (op.prev) d.fills[op.id] = op.prev; else delete d.fills[op.id];
      var reg = REG[op.id], el = reg.el, to = op.prev || 'none', tk = reg.token = (reg.token || 0) + 1;
      $$('g', gFx).forEach(function (g) { if (g.getAttribute('clip-path') === 'url(#cr-' + op.id + ')') g.remove(); });
      if (!reduceMotion && el.animate && to === 'none') {
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in' }).onfinish = function () { if (reg.token === tk) el.setAttribute('fill', to); refreshLabels(); };
      } else { el.setAttribute('fill', to); refreshLabels(); }
    } else if (op.t === 's') {
      d.strokes.pop();
      var g = dayGroup(cur.n), last = g.lastElementChild;
      if (last) {
        if (!reduceMotion && last.animate) last.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).onfinish = function () { last.remove(); };
        else last.remove();
      }
    }
    afterEdit();
  }
  function afterEdit() {
    saveSoon();
    updateHighlights();
    updateDone();
    updatePrompt();
  }
  function hasWork() {
    var cur = currentDay(); if (!cur) return false;
    var d = draftFor(cur.n);
    return Object.keys(d.fills).length > 0 || d.strokes.length > 0;
  }
  function updateDone() {
    var cur = currentDay();
    var noRegions = cur && !todayIds().length;
    var ok = hasWork() || noRegions;
    var btn = $('#doneBtn');
    btn.disabled = !ok;
    btn.classList.toggle('ready', ok && blanksLeft() === 0);
    var d = cur ? draftFor(cur.n) : null;
    $('#undoBtn').disabled = !(d && d.ops.length);
  }
  function updatePrompt() {
    var cur = currentDay(); if (!cur) return;
    $('#dayTag').textContent = 'Day ' + cur.n;
    var ids = todayIds(), total = ids.length, left = phase() === 'colour' ? blanksLeft() : total;
    var msg;
    if (!total) msg = 'Nothing to colour today — tap Done!';
    else if (!hasWork()) msg = tool === 'fill' ? 'Tap the glowing spot' + (total > 1 ? 's' : '') + ' to colour' : 'Paint inside the glowing spot' + (total > 1 ? 's' : '');
    else if (left > 0) msg = left + ' glowing spot' + (left > 1 ? 's' : '') + ' left ✨';
    else msg = 'Looking lovely! Tap Done when happy';
    var m = $('#promptMsg');
    if (m.textContent !== msg) {
      m.textContent = msg;
      if (!reduceMotion && m.animate) m.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
    }
  }

  /* ======================================================================
     GESTURES
     ====================================================================== */
  var ptrs = {}, nPtrs = 0, gest = null;
  function ptList() { return Object.keys(ptrs).map(function (k) { return ptrs[k]; }); }
  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (anyOverlay()) return;
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (!ptrs[e.pointerId]) nPtrs++;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    stopViewAnim();
    if (nPtrs === 1) {
      if (canColour() && tool === 'brush') {
        var a = toArt(e.clientX, e.clientY);
        startStroke(a);
        gest = { type: 'paint', id: e.pointerId };
      } else {
        gest = { type: 'press', id: e.pointerId, sx: e.clientX, sy: e.clientY, v0: { x: view.x, y: view.y, w: view.w } };
      }
    } else if (nPtrs === 2) {
      if (gest && gest.type === 'paint' && live) {
        var young = performance.now() - live.t < 220 || live.s.p.length < 12;
        if (young) cancelStroke(); else endStroke();
      }
      var l = ptList(), a2 = l[0], b2 = l[1];
      var m = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
      gest = { type: 'pinch', d0: Math.max(10, Math.hypot(a2.x - b2.x, a2.y - b2.y)), anchor: toArt(m.x, m.y), w0: view.w };
    }
    e.preventDefault();
  }
  function onMove(e) {
    if (!ptrs[e.pointerId]) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (!gest) return;
    if (gest.type === 'paint' && e.pointerId === gest.id) {
      var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
      if (!evs.length) evs = [e];
      for (var i = 0; i < evs.length; i++) extendStroke(toArt(evs[i].clientX, evs[i].clientY));
    } else if (gest.type === 'press' && e.pointerId === gest.id) {
      if (Math.hypot(e.clientX - gest.sx, e.clientY - gest.sy) > 8) gest.type = 'pan';
    }
    if (gest.type === 'pan' && e.pointerId === gest.id) {
      var r = svg.getBoundingClientRect(), upp = gest.v0.w / r.width;
      view = clampView({ w: gest.v0.w, x: gest.v0.x - (e.clientX - gest.sx) * upp, y: gest.v0.y - (e.clientY - gest.sy) * upp });
      applyView();
    } else if (gest.type === 'pinch' && nPtrs >= 2) {
      var l = ptList(), a = l[0], b = l[1];
      var d = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      var w = clamp(gest.w0 * gest.d0 / d, W / MAXZ, W);
      var rr = svg.getBoundingClientRect(), u = w / rr.width;
      view = clampView({ w: w, x: gest.anchor.x - (m.x - rr.left) * u, y: gest.anchor.y - (m.y - rr.top) * u });
      applyView();
    }
  }
  function onUp(e, cancelled) {
    if (!ptrs[e.pointerId]) return;
    delete ptrs[e.pointerId]; nPtrs = Math.max(0, nPtrs - 1);
    if (!gest) return;
    if (gest.type === 'paint' && e.pointerId === gest.id) {
      if (cancelled) cancelStroke(); else endStroke();
      gest = null;
    } else if (gest.type === 'press' && e.pointerId === gest.id) {
      gest = null;
      if (!cancelled) onTap(e.clientX, e.clientY);
    } else if (gest.type === 'pan' && e.pointerId === gest.id) {
      gest = null;
    } else if (gest.type === 'pinch') {
      if (nPtrs < 2) gest = nPtrs ? { type: 'idle' } : null;
    } else if (gest.type === 'idle' && nPtrs === 0) {
      gest = null;
    }
  }
  function onTap(cx, cy) {
    var a = toArt(cx, cy);
    if (a.x < 0 || a.y < 0 || a.x > W || a.y > H) return;
    if (canColour()) {
      var id = pickToday(a.x, a.y);
      if (id) { doFill(id, a.x, a.y); return; }
      var other = regionsAt(a.x, a.y)[0];
      nudgeToday(other);
      return;
    }
    var hit = regionsAt(a.x, a.y)[0];
    if (hit) infoToast(hit);
  }
  function nudgeToday(other) {
    var r = other && REG[other];
    if (r && r.n == null) toast('Clouds stay white ☁️');
    else if (r && isDone(r.n)) infoToast(other);
    else if (r && DAY[r.n] && DAY[r.n].at <= now()) toast('That one’s next in line ✨');
    else if (r) toast('That one’s for ' + relDay(DAY[r.n] ? DAY[r.n].at : now()).replace('Today', 'later today').replace('Tomorrow', 'tomorrow') + ' ✨');
    gPing.classList.remove('wiggle'); void gPing.getBoundingClientRect(); gPing.classList.add('wiggle');
    setTimeout(function () { gPing.classList.remove('wiggle'); }, 900);
    $$('.hl:not(.done)', gHl).forEach(function (h) {
      if (h.animate) h.animate([{ opacity: .2 }, { opacity: .85 }, { opacity: .2 }], { duration: 650, easing: 'ease-in-out' });
    });
  }
  function infoToast(id) {
    var r = REG[id];
    if (r.n == null) { toast('Clouds stay white ☁️'); return; }
    var d = DAY[r.n];
    if (!d) return;
    if (isDone(r.n)) {
      toast('Day ' + r.n + ' · ' + esc(fmtDate(d.at)) + ' · <a href="' + esc(d.game.url) + '" target="_blank" rel="noopener">' + esc(d.game.name) + ' ↗</a>', 3600, true);
    } else {
      toast('Spot ' + r.n + ' unlocks ' + esc(relDay(d.at)) + ', ' + fmtTime(d.at) + ' ✨', 2600, true);
    }
  }
  function onWheel(e) {
    e.preventDefault();
    if (anyOverlay()) return;
    var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(e.clientX, e.clientY, Math.exp(dy * (e.ctrlKey ? 0.012 : 0.0016)));
  }

  /* ======================================================================
     UI: header, panes, countdown, modals, sheets, toast
     ====================================================================== */
  var curPane = null;
  function showPane(name) {
    if (curPane === name) return;
    curPane = name;
    $$('.pane').forEach(function (p) { p.classList.toggle('on', p.dataset.pane === name); });
    card.classList.toggle('mode-view', name !== 'colour');
  }
  function renderBeads() {
    var el = $('#beads'); el.textContent = '';
    var ph = phase(), cur = currentDay(), done = 0;
    DAYS.forEach(function (d) {
      var b = document.createElement('i'); b.className = 'bead';
      if (isDone(d.n)) {
        done++; var c = mainColour(d.n);
        b.classList.add('done'); b.style.background = c;
        if (c && c.toLowerCase() === '#ffffff') b.classList.add('white');
      } else if (ph === 'colour' && cur && cur.n === d.n) b.classList.add('now');
      b.title = 'Day ' + d.n + ' · ' + fmtDate(d.at);
      el.appendChild(b);
    });
    var c = document.createElement('span'); c.className = 'count'; c.textContent = done + '/' + TOTAL;
    el.appendChild(c);
  }
  function latestDone() { var n = null; DAYS.forEach(function (d) { if (isDone(d.n)) n = d.n; }); return n; }
  function renderWait() {
    var cur = currentDay(); if (!cur) return;
    var ready = now() >= cur.at;   // only happens in view mode: the day is open but she hasn't coloured it yet
    $('#waitLabel').textContent = ready ? 'Day ' + cur.n + ' is ready for ' + C.name + ' ✨' : 'Next spot unlocks in';
    $('#countdown').hidden = ready;
    $('#waitWhen').textContent = (ready ? 'Unlocked ' : '') + relDay(cur.at) + ' · ' + fmtTime(cur.at);
    var n = latestDone(), chip = $('#gameChip');
    if (n && DAY[n]) {
      chip.hidden = false;
      chip.href = DAY[n].game.url;
      $('#chipLbl').textContent = (dayKey(DAY[n].at) === dayKey(now()) ? 'Today’s game:' : 'Latest game:');
      $('#chipName').textContent = DAY[n].game.name + ' ↗';
      chip.onclick = function () { markOpened(n); };
    } else chip.hidden = true;
    tickCountdown(true);
  }
  var lastSecs = -1;
  function setBox(id, v, force) {
    var box = $('#' + id), span = box.firstElementChild, s = String(v).padStart(2, '0');
    if (span.textContent === s && !force) return;
    span.textContent = s;
    if (!force && !reduceMotion) { span.classList.remove('tick'); void span.offsetWidth; span.classList.add('tick'); }
  }
  function tickCountdown(force) {
    var cur = currentDay();
    if (!cur) return;
    var ms = Math.max(0, cur.at - now()), secs = Math.ceil(ms / 1000);
    if (secs === lastSecs && !force) return;
    lastSecs = secs;
    var h = Math.floor(secs / 3600), m = Math.floor(secs % 3600 / 60), s = secs % 60;
    setBox('cdH', h, force); setBox('cdM', m, force); setBox('cdS', s, force);
  }

  function anyOverlay() { return !!$('.modal.on, .sheet.on'); }
  function openOverlay(el) {
    $('#scrim').classList.add('on');
    el.classList.add('on');
  }
  function closeOverlays() {
    $$('.modal.on, .sheet.on').forEach(function (m) { m.classList.remove('on'); });
    $('#scrim').classList.remove('on');
  }

  var toastTimer = 0;
  function toast(html, ms, isHtml) {
    var t = $('#toast');
    if (isHtml) t.innerHTML = html; else t.textContent = html;
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || 2400);
  }

  // ---- confirm ----
  function askConfirm() {
    var cur = currentDay(); if (!cur) return;
    var d = draftFor(cur.n);
    $('#cfTitle').textContent = 'Lock in Day ' + cur.n + '?';
    var cols = [];
    Object.keys(d.fills).forEach(function (k) { if (cols.indexOf(d.fills[k]) < 0) cols.push(d.fills[k]); });
    d.strokes.forEach(function (s) { if (cols.indexOf(s.c) < 0) cols.push(s.c); });
    var sw = $('#cfSwatches'); sw.textContent = '';
    cols.slice(0, 10).forEach(function (c) { var i = document.createElement('i'); i.style.background = c; sw.appendChild(i); });
    var left = blanksLeft(), warn = $('#cfWarn');
    warn.classList.toggle('on', left > 0 && todayIds().length > 0);
    warn.textContent = 'Psst — ' + left + ' glowing spot' + (left > 1 ? 's are' : ' is') + ' still blank.';
    openOverlay($('#confirm'));
    setTimeout(function () { $('#cfYes').focus({ preventScroll: true }); }, 50);
  }

  // ---- lock ----
  function lockIn() {
    var cur = currentDay(); if (!cur || phase() !== 'colour') { closeOverlays(); return; }
    var n = cur.n, d = draftFor(n);
    var rec = { fills: d.fills, strokes: d.strokes, at: Date.now() };
    if (MODE !== 'real') rec.sim = now();
    state.days[n] = rec;
    state.draft = null;
    var ok = save(true);
    lastPhase = phase();   // the reveal sheet takes over; render() runs when it closes
    pushPending();         // save it to the website (retried later if offline)
    if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { /* ignore */ } }
    closeOverlays();
    gHl.textContent = ''; gPing.textContent = '';
    $('#sizes').classList.add('off');
    shine(n);
    var cols = [];
    Object.keys(rec.fills).forEach(function (k) { cols.push(rec.fills[k]); });
    rec.strokes.forEach(function (s) { cols.push(s.c); });
    cols = cols.concat(['#ffd65c', '#ff7f6e', '#a8e3cf', '#cdbcf5', '#b3ddf6', '#ffffff']);
    var c = centreOf(DAY_REGIONS[n] || []);
    setTimeout(function () { burst(c.x, c.y, cols, 110, 1); }, 120);
    renderBeads();
    if (!ok) toast('Hmm, this browser won’t let me save. Is private browsing on?', 5000);
    setTimeout(function () { animateView(fullView(), 900); }, 380);
    setTimeout(function () { showReveal(n, true); }, 900);
  }
  function centreOf(ids) {
    if (!ids.length) { var r = card.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ids.forEach(function (id) { var b = REG[id].bbox; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); });
    var s = toScreen((x0 + x1) / 2, (y0 + y1) / 2);
    var cr = card.getBoundingClientRect();
    return { x: clamp(s.x, cr.left + 20, cr.right - 20), y: clamp(s.y, cr.top + 20, cr.bottom - 20) };
  }
  function shine(n) {
    (DAY_REGIONS[n] || []).forEach(function (id) {
      var p = mk('path', { d: REG[id].d, 'fill-rule': 'evenodd', fill: '#fff', opacity: 0 }, gFx);
      if (p.animate && !reduceMotion) p.animate([{ opacity: 0 }, { opacity: .7 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' }).onfinish = function () { p.remove(); };
      else p.remove();
    });
  }

  // ---- reveal ----
  var TILE_COLS = ['#6aaa64', '#e2b93b', '#ff7f6e'];
  function showReveal(n, fresh) {
    var d = DAY[n]; if (!d) return;
    var g = d.game;
    $('#rvDay').textContent = 'Day ' + n + ' · ' + fmtDate(d.at);
    var link = $('#rvLink'); link.textContent = g.name; link.href = g.url;
    $('#rvPlay').href = g.url;
    $('#rvBlurb').textContent = g.blurb || '';
    var art = $('#gameArt'); art.textContent = '';
    var letters = (g.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase() + '???').slice(0, 3).split('');
    var pos = [[6, 30, -12], [26, 8, 4], [46, 32, 14]];
    letters.forEach(function (ch, i) {
      var t = document.createElement('div'); t.className = 'tile'; t.textContent = ch;
      t.style.left = pos[i][0] + 'px'; t.style.top = pos[i][1] + 'px'; t.style.background = TILE_COLS[i];
      t.style.transform = 'rotate(' + pos[i][2] + 'deg)'; t.style.animationDelay = (i * 0.09) + 's';
      art.appendChild(t);
    });
    var rv = $('#reveal');
    rv.classList.remove('anim'); void rv.offsetWidth; if (!reduceMotion) rv.classList.add('anim');
    var go = function () { markOpened(n); };
    link.onclick = go; $('#rvPlay').onclick = go;
    openOverlay($('#revealSheet'));
    revealFor = n;
    if (fresh && !reduceMotion) {
      setTimeout(function () {
        var r = $('#revealSheet').getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + 40, ['#ffd65c', '#ff7f6e', '#a8e3cf', '#cdbcf5', '#b3ddf6'], 60, 0.8);
      }, 420);
    }
  }
  var revealFor = null;
  function closeReveal() {
    var n = revealFor; revealFor = null;
    closeOverlays();
    var before = phase();
    render();
    if (n === TOTAL && before === 'complete') setTimeout(finale, 450);
    else if (before === 'colour') {
      var cur = currentDay();
      toast('Day ' + cur.n + ' is waiting too ✨', 2600);
      setTimeout(function () { focusToday(true); }, 300);
    }
  }
  function markOpened(n) { state.opened[n] = 1; saveSoon(); updateShelfDot(); }
  function updateShelfDot() { var n = latestDone(); $('#shelfDot').classList.toggle('on', !!(n && !state.opened[n] && !record(n).pre)); }

  // ---- shelf ----
  function openShelf() {
    var ul = $('#shelfList'); ul.textContent = '';
    var ph = phase(), cur = currentDay();
    DAYS.forEach(function (d) {
      var li = document.createElement('li');
      var dot = document.createElement('span'); dot.className = 'num-dot'; dot.textContent = d.n;
      var meta = document.createElement('div'); meta.className = 'meta';
      var b = document.createElement('b'), s = document.createElement('span');
      if (isDone(d.n)) {
        var c = mainColour(d.n); dot.style.background = c; dot.style.color = contrastInk(c);
        b.textContent = d.game.name; s.textContent = 'Day ' + d.n + ' · ' + fmtDate(d.at);
        var a = document.createElement('a'); a.className = 'go'; a.href = d.game.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Play ↗';
        a.addEventListener('click', function () { markOpened(d.n); });
        meta.appendChild(b); meta.appendChild(s); li.appendChild(dot); li.appendChild(meta); li.appendChild(a);
      } else {
        li.className = 'future';
        var isNow = ph === 'colour' && cur && cur.n === d.n;
        b.textContent = isNow ? 'Colour today’s spot to unlock' : 'Mystery game';
        s.textContent = 'Day ' + d.n + ' · ' + (isNow ? 'ready now ✨' : (now() >= d.at ? 'next in line ✨' : fmtDate(d.at) + ', ' + fmtTime(d.at)));
        var lk = document.createElement('span'); lk.className = 'lock'; lk.textContent = isNow ? '🎨' : '🔒';
        meta.appendChild(b); meta.appendChild(s); li.appendChild(dot); li.appendChild(meta); li.appendChild(lk);
      }
      ul.appendChild(li);
    });
    openOverlay($('#shelfSheet'));
  }
  function contrastInk(hex) {
    if (!isHex(hex)) return INK;
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? INK : '#fff';
  }

  /* ======================================================================
     EFFECTS
     ====================================================================== */
  var fx = $('#fx'), fctx = fx.getContext('2d'), parts = [], fxRaf = 0;
  function sizeFx() { var d = Math.min(2, window.devicePixelRatio || 1); fx.width = Math.round(innerWidth * d); fx.height = Math.round(innerHeight * d); fctx.setTransform(d, 0, 0, d, 0, 0); }
  function burst(x, y, cols, n, power) {
    if (reduceMotion) return;
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.25;
      var s = (5 + Math.random() * 10) * power;
      parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, g: .3 + Math.random() * .15, r: Math.random() * 6.28, vr: (Math.random() - .5) * .35,
        w: 6 + Math.random() * 7, h: 4 + Math.random() * 5, c: cols[i % cols.length], life: 0, max: 80 + Math.random() * 70, round: Math.random() < .35 });
    }
    if (!fxRaf) fxRaf = requestAnimationFrame(fxStep);
  }
  function sparkle(x, y, c) {
    if (reduceMotion) return;
    var s = toScreen(x, y);
    for (var i = 0; i < 12; i++) {
      var a = Math.random() * 6.28, sp = 1.5 + Math.random() * 3.5;
      parts.push({ x: s.x, y: s.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: .05, r: 0, vr: 0, w: 4 + Math.random() * 4, h: 4, c: i % 3 ? c : '#ffffff', life: 0, max: 28 + Math.random() * 18, round: true, ring: i % 4 === 0 });
    }
    if (!fxRaf) fxRaf = requestAnimationFrame(fxStep);
  }
  function fxStep() {
    fctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(function (p) { return p.life < p.max && p.y < innerHeight + 60; });
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.life++; p.vx *= .985; p.vy = p.vy * .985 + p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      var alpha = Math.min(1, (p.max - p.life) / 22);
      fctx.save(); fctx.globalAlpha = alpha; fctx.translate(p.x, p.y); fctx.rotate(p.r);
      fctx.fillStyle = p.c; fctx.strokeStyle = 'rgba(59,51,48,.18)'; fctx.lineWidth = 1;
      if (p.round) { fctx.beginPath(); fctx.arc(0, 0, p.w / 2.3, 0, 6.2832); fctx.fill(); if (p.c.toLowerCase() === '#ffffff') fctx.stroke(); }
      else { var hh = p.h * Math.abs(Math.cos(p.life * .13 + p.r)); fctx.fillRect(-p.w / 2, -hh / 2, p.w, hh); }
      fctx.restore();
    }
    fxRaf = parts.length ? requestAnimationFrame(fxStep) : 0;
    if (!fxRaf) fctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  function intro() {
    if (reduceMotion || document.hidden) { card.classList.remove('intro'); return 0; }
    var els = $$('path, circle', gInk);
    var items = els.map(function (p) {
      var L = 0; try { L = p.getTotalLength(); } catch (e) { L = 0; }
      var bb; try { bb = p.getBBox(); } catch (e) { bb = { y: 0, height: 0 }; }
      return { p: p, L: L, y: bb.y + bb.height / 2 };
    });
    items.forEach(function (it) { if (it.L > 0) { it.p.style.strokeDasharray = it.L + ' ' + it.L; it.p.style.strokeDashoffset = it.L; } });
    gFill.style.opacity = '0'; gStroke.style.opacity = '0'; gNum.style.opacity = '0';
    void svg.getBoundingClientRect();
    requestAnimationFrame(function () {
      items.forEach(function (it) {
        if (!(it.L > 0)) return;
        var delay = 350 + it.y / H * 1100 + Math.random() * 180;
        var dur = 520 + Math.min(700, it.L * 1.2);
        it.p.style.transition = 'stroke-dashoffset ' + dur + 'ms cubic-bezier(.45,.05,.3,1) ' + delay + 'ms';
        it.p.style.strokeDashoffset = '0';
      });
      [gFill, gStroke].forEach(function (g) { g.style.transition = 'opacity 900ms ease 1500ms'; g.style.opacity = '1'; });
      gNum.style.transition = 'opacity 700ms ease 1900ms'; gNum.style.opacity = '1';
    });
    setTimeout(function () {
      items.forEach(function (it) { it.p.style.strokeDasharray = ''; it.p.style.strokeDashoffset = ''; it.p.style.transition = ''; });
      [gFill, gStroke, gNum].forEach(function (g) { g.style.transition = ''; g.style.opacity = ''; });
    }, 3400);
    return 2300;
  }

  /* ======================================================================
     MAIN RENDER
     ====================================================================== */
  function focusToday(animated) {
    var ids = todayIds();
    var v = focusView(ids);
    animateView(v, animated ? 950 : 0);
  }
  var lastPhase = null;
  function render() {
    var ph = phase();
    renderBeads();
    paintAll();
    updateHighlights();
    updateShelfDot();
    $('#zFocus').hidden = !canColour() || todayIds().length === 0;
    $('#sizes').classList.toggle('off', tool !== 'brush' || !canColour());
    if (ph === 'complete') showPane('complete');
    else if (ph === 'wait' || MODE === 'view') { showPane('wait'); renderWait(); }
    else { showPane('colour'); setTool(tool); updateDone(); updatePrompt(); }
    lastPhase = ph;
  }

  function finale() {
    var r = card.getBoundingClientRect();
    var cols = ['#ffd65c', '#ff7f6e', '#a8e3cf', '#cdbcf5', '#b3ddf6', '#ff8fab', '#7ccb72'];
    burst(r.left + r.width * .25, r.top + r.height * .4, cols, 90, 1.1);
    setTimeout(function () { burst(r.left + r.width * .75, r.top + r.height * .35, cols, 90, 1.1); }, 350);
    setTimeout(function () { burst(r.left + r.width * .5, r.top + r.height * .55, cols, 120, 1.3); }, 700);
    toast('You did it, ' + C.name + '! Happy first month 🎉', 4200);
  }

  // live unlock at 6pm while the page is open
  function heartbeat() {
    if (!booted) return;
    if (remoteDirty) flushRemote();
    var ph = phase();
    if (ph !== lastPhase) {
      var was = lastPhase;
      if (!anyOverlay() && !live) {
        render();
        if (was === 'wait' && ph === 'colour' && MODE !== 'view') {
          var cur = currentDay();
          toast('Day ' + cur.n + ' is here! ✨', 3000);
          var r = card.getBoundingClientRect();
          burst(r.left + r.width / 2, r.top + r.height * .3, ['#ffd65c', '#ff7f6e', '#a8e3cf', '#cdbcf5'], 70, .9);
          setTimeout(function () { focusToday(true); }, 500);
        }
      }
    } else if (ph === 'wait') tickCountdown(false);
  }

  /* ======================================================================
     SAVE PICTURE (PNG)
     ====================================================================== */
  function exportPNG() {
    var btn = $('#saveBtn'); btn.disabled = true;
    var scale = 2;
    var clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', NS);
    clone.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    clone.setAttribute('width', W * scale); clone.setAttribute('height', H * scale);
    ['.nums', '.hls', '.pings', '.fx'].forEach(function (s) { var e = clone.querySelector(s); if (e) e.remove(); });
    var bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', W); bg.setAttribute('height', H); bg.setAttribute('fill', '#fffdf7');
    clone.insertBefore(bg, clone.firstChild.nextSibling);
    var s = new XMLSerializer().serializeToString(clone);
    var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = W * scale; cv.height = H * scale;
      var cx = cv.getContext('2d');
      cx.fillStyle = '#fffdf7'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(function (blob) {
        btn.disabled = false;
        if (!blob) { toast('Couldn’t make the picture, sorry!'); return; }
        var name = 'jiayins-first-month.png';
        var file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: C.title }).catch(function () { /* cancelled */ });
        } else {
          var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
          document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
          toast('Saved! 🖼️');
        }
      }, 'image/png');
    };
    img.onerror = function () { btn.disabled = false; toast('Couldn’t make the picture, sorry!'); };
    img.src = url;
  }

  /* ======================================================================
     PREVIEW BADGE + ADMIN (for the person who made this)
     ====================================================================== */
  // A small badge on every page that isn't her real one (test / preview / view)
  function previewBadge() {
    if (MODE === 'real') return;
    document.body.classList.add('has-pv');
    var b = document.createElement('div'); b.className = 'pv ' + MODE;
    var lab = document.createElement('span'); b.appendChild(lab);
    function btn(text, fn) { var e = document.createElement('button'); e.textContent = text; e.onclick = fn; b.appendChild(e); return e; }
    if (MODE === 'view') {
      lab.textContent = '👀 View only · updates by itself';
    } else if (MODE === 'test') {
      lab.textContent = '🧪 Test · not saved';
      var sel = document.createElement('select'); sel.setAttribute('aria-label', 'Jump to a day');
      var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Jump to…'; sel.appendChild(o0);
      DAYS.forEach(function (d) {
        if (C.prefilled && C.prefilled[d.n]) return;
        var o = document.createElement('option'); o.value = String(d.n); o.textContent = 'Day ' + d.n; sel.appendChild(o);
      });
      var oe = document.createElement('option'); oe.value = 'end'; oe.textContent = 'All done'; sel.appendChild(oe);
      sel.onchange = function () { if (sel.value) testJump(sel.value); };
      b.appendChild(sel);
      btn('Reset', resetSandbox);
    } else {
      btn('Reset', resetSandbox);
      (function upd() { lab.textContent = 'Preview · ' + fmtDate(now()) + ', ' + fmtTime(now()); setTimeout(upd, 1000); })();
    }
    document.body.appendChild(b);
  }
  function resetSandbox() {
    frozen = true;
    try {
      localStorage.removeItem(KEY); localStorage.removeItem(KEY + ':bak');
      localStorage.removeItem('jfm-pref:welcomed:' + MODE);
    } catch (e) { /* ignore */ }
    location.reload();
  }
  // Test page: colour everything before day v with sample colours, so any day can be tried straight away
  var SAMPLE = {
    snow_left: '#FFFFFF', snow_right: '#FFFFFF', mountain: '#B49CF0', trunk_left: '#9C6B43', trunk_right: '#9C6B43',
    canopy_left: '#7CCB72', canopy_right: '#3E9E54', canopy_right_nook: '#3E9E54', canopy_right_strip: '#3E9E54',
    fruit_L1: '#F25C54', fruit_L2: '#FFB347', fruit_L3: '#F25C54', fruit_L4: '#F25C54',
    fruit_R1: '#FFB347', fruit_R2: '#F25C54', fruit_R3: '#F25C54', fruit_R4: '#FFB347',
    hill: '#B8EBC0', flower_leaf: '#3E9E54', flower_big_stem: '#3E9E54', flower_small_stem: '#3E9E54',
    tulip_head: '#FF8FAB', daisy_leaf_left: '#7CCB72', daisy_leaf_right: '#7CCB72', daisy_stem: '#3E9E54',
    flower_big_centre: '#FFE45C', flower_big_petals: '#FF8FAB', flower_small_petals: '#B49CF0', flower_small_centre: '#FFE45C',
    ground: '#C4D97A', ground_between_flowers: '#C4D97A', tulip_leaf_left: '#3E9E54', tulip_leaf_right: '#3E9E54',
    tulip_stem: '#3E9E54', daisy_centre: '#FFE45C', daisy_petals: '#E9B8F2', sky: '#A9DDF7', sky_between_trees: '#A9DDF7'
  };
  function testJump(v) {
    var days = {};
    DAYS.forEach(function (d) {
      if (C.prefilled && C.prefilled[d.n]) return;
      if (v === 'end' || d.n < +v) {
        var fills = {};
        (DAY_REGIONS[d.n] || []).forEach(function (id) { fills[id] = SAMPLE[id] || C.palette[id.length % C.palette.length]; });
        days[d.n] = { fills: fills, strokes: [], at: Date.now(), sim: 1 };
      }
    });
    state = { v: 1, days: days, draft: null, opened: {} };
    save(false, true);
    frozen = true;
    location.reload();
  }
  function cleanUrl() {
    var q = new URLSearchParams(location.search); q.delete('admin');
    var qs = q.toString();
    return location.pathname + (qs ? '?' + qs : '');
  }
  function adminPanel() {
    if (!params.has('admin')) return;
    var wrap = document.createElement('div'); wrap.className = 'admin';
    var box = document.createElement('div'); box.className = 'box'; wrap.appendChild(box);
    function p(t) { var e = document.createElement('p'); e.textContent = t; box.appendChild(e); return e; }
    function btn(t, fn, cls) { var e = document.createElement('button'); e.className = 'btn sm ' + (cls || 'ghost'); e.textContent = t; e.onclick = fn; box.appendChild(e); return e; }
    var h = document.createElement('h3'); h.textContent = 'Behind the scenes'; box.appendChild(h);
    var locked = Object.keys(state.days).map(Number).sort(function (a, b) { return a - b; });
    p('Page: ' + MODE + (MODE === 'real' ? ' (her picture)' : ' (sandbox — never saved online)'));
    p('On this device: ' + (locked.length ? 'days ' + locked.join(', ') : 'nothing locked yet') + '  ·  now: ' + phase());
    var online = p(SYNC ? 'Saved online: checking…' : 'Online saving is off (no Supabase settings in config.js).');
    if (SYNC) {
      fetchServerDays().then(function (srv) {
        var ks = Object.keys(srv).map(Number).sort(function (a, b) { return a - b; });
        online.textContent = 'Saved online: ' + (ks.length ? 'days ' + ks.join(', ') : 'nothing yet') + (SYNC_WRITE ? '' : '  (this page only reads)');
      }, function (e) { online.textContent = 'Saved online: couldn’t reach the database (' + (e && e.message || e) + ')'; });
    }
    var ta = document.createElement('textarea'); ta.placeholder = 'Backup code appears / paste one here'; box.appendChild(ta);
    btn('Copy backup code', function () {
      state = mergeWithDisk();
      ta.value = btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, days: state.days, opened: state.opened }))));
      ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function () { /* ignore */ });
    });
    btn('Restore from code', function () {
      try {
        var s = JSON.parse(decodeURIComponent(escape(atob(ta.value.trim()))));
        if (!valid(s)) throw new Error('bad');
        if (!confirm('Load this backup on this device? (Days already saved online keep their online colours.)')) return;
        Object.keys(s.days).forEach(function (k) { if (s.days[k]) delete s.days[k].srv; });   // re-upload anything missing online
        state = { v: 1, days: s.days, draft: null, opened: s.opened || {} }; save(true, true); frozen = true; location.href = cleanUrl();
      } catch (e) { alert('That code doesn’t look right.'); }
    });
    if (SYNC) {
      var ref = (SYNC.url.match(/^https?:\/\/([^.]+)\./) || [])[1];
      btn('Undo a locked day (opens Supabase)', function () {
        alert('Locked days are protected online, so undo them in Supabase:\nTable editor → ' + TABLE + ' → tick the day’s row (column n) → Delete.\nEvery phone/browser drops that day the next time it opens the site.');
        if (ref) window.open('https://supabase.com/dashboard/project/' + ref + '/editor', '_blank', 'noopener');
      });
    } else {
      btn('Undo last locked day', function () {
        var l = Object.keys(state.days).map(Number).sort(function (a, b) { return b - a; })[0];
        if (!l) { alert('Nothing locked yet.'); return; }
        if (!confirm('Unlock Day ' + l + ' so it can be coloured again?')) return;
        delete state.days[l]; state.draft = null; save(true, true); frozen = true; location.href = cleanUrl();
      });
    }
    btn(SYNC ? 'Clear this device’s copy' : 'Erase everything on this device', function () {
      if (!confirm(SYNC ? 'Clear this device’s copy? Days saved online come back when the page reloads.' : 'Erase all colouring on this device? This cannot be undone.')) return;
      frozen = true;
      try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + ':bak'); } catch (e) { /* ignore */ }
      location.href = cleanUrl();
    });
    btn('Close', function () { wrap.remove(); }, '');
    p('Try things without touching her picture: open the /test/ page (everything unlocked, nothing saved online).');
    document.body.appendChild(wrap);
  }
  function dismissTop() {
    if ($('#welcome').classList.contains('on')) $('#wGo').click();
    else if ($('#revealSheet').classList.contains('on')) closeReveal();
    else closeOverlays();
  }
  function maybeWelcome(wait) {
    if (params.has('admin') || MODE === 'view') return;
    var k = 'welcomed' + (MODE === 'real' ? '' : ':' + MODE);
    if (pref(k)) return;
    $('#wTitle').textContent = 'Hi ' + C.name + '! 🌷';
    setTimeout(function () {
      if (anyOverlay()) return;
      openOverlay($('#welcome'));
    }, (wait || 0) + 250);
    $('#wGo').addEventListener('click', function () {
      pref(k, '1');
      closeOverlays();
      var r = card.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height * .25, ['#ffd65c', '#ff7f6e', '#a8e3cf', '#cdbcf5', '#b3ddf6'], 50, .8);
    });
  }

  /* ======================================================================
     WIRING
     ====================================================================== */
  function wire() {
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', function (e) { onUp(e, false); });
    svg.addEventListener('pointercancel', function (e) { onUp(e, true); });
    svg.addEventListener('lostpointercapture', function (e) { if (ptrs[e.pointerId]) onUp(e, false); });
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    ['gesturestart', 'gesturechange'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false }); });

    $$('#toolSeg button').forEach(function (b) { b.addEventListener('click', function () { setTool(b.dataset.tool); pref('tool', b.dataset.tool); }); });
    $$('#sizes button').forEach(function (b) { b.addEventListener('click', function () { setSize(+b.dataset.size); }); });
    $('#undoBtn').addEventListener('click', undo);
    $('#doneBtn').addEventListener('click', askConfirm);
    $('#cfNo').addEventListener('click', closeOverlays);
    $('#cfYes').addEventListener('click', lockIn);
    $('#rvBack').addEventListener('click', closeReveal);
    $('#shelfBtn').addEventListener('click', openShelf);
    $('#shelfBtn2').addEventListener('click', openShelf);
    $('#shelfClose').addEventListener('click', closeOverlays);
    $('#saveBtn').addEventListener('click', exportPNG);
    $('#scrim').addEventListener('click', dismissTop);
    $('#zIn').addEventListener('click', function () { zoomCentre(1 / 1.7); });
    $('#zFit').addEventListener('click', function () { animateView(fullView(), 600); });
    $('#zFocus').addEventListener('click', function () { focusToday(true); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') dismissTop();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !anyOverlay()) { e.preventDefault(); undo(); }
    });
    // swipe the sheets down to close
    $$('.sheet').forEach(function (sh) {
      var sy = null;
      sh.addEventListener('touchstart', function (e) { sy = sh.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
      sh.addEventListener('touchend', function (e) {
        if (sy == null) return;
        if (e.changedTouches[0].clientY - sy > 90) { if (sh.id === 'revealSheet') closeReveal(); else closeOverlays(); }
        sy = null;
      });
    });
    if (window.ResizeObserver) new ResizeObserver(layout).observe(stage); else window.addEventListener('resize', layout);
    window.addEventListener('resize', sizeFx);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { save(false); return; }
      heartbeat();
      if (Date.now() - lastSync > 15000) syncNow();
    });
    window.addEventListener('online', function () { syncNow(); });
    if (SYNC_READ) setInterval(function () { if (!document.hidden) syncNow(); }, MODE === 'view' ? 20000 : 60000);
    window.addEventListener('storage', function (e) {
      if (!booted || e.key !== KEY || live || anyOverlay()) return;
      var before = JSON.stringify(state.days);
      state = mergeWithDisk();
      if (JSON.stringify(state.days) !== before) { lastPhase = null; render(); }
    });
    window.addEventListener('pagehide', function () { save(false); });
    setInterval(heartbeat, 500);
  }

  function init() {
    document.title = C.title;
    $('#nm2').textContent = C.name;
    buildArt();
    buildPalette();
    setSize(clamp(sizeIdx, 0, 2) | 0);
    tool = pref('tool') === 'brush' ? 'brush' : 'fill';
    wire();
    layout();
    var tBoot = Date.now();
    var wait = intro();
    previewBadge();
    adminPanel();
    // show her saved picture from the website first (up to 1.5s), then draw the page state
    firstSync(1500).then(function () {
      booted = true;
      render();
      setTool(tool);
      maybeWelcome(wait);
      if (phase() === 'colour' && MODE !== 'view') {
        setTimeout(function () { focusToday(true); }, Math.max(0, (wait ? wait - 200 : 0) - (Date.now() - tBoot)));
      }
      if (SYNC_WRITE) pushPending();
    });
    setTimeout(function () { card.classList.remove('intro'); }, 1600);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTool(tool); });
  }

  try { init(); } catch (err) {
    console.error(err);
    var t = document.getElementById('toast');
    if (t) { t.textContent = 'Something went wrong loading the picture — try refreshing.'; t.classList.add('on'); }
  }
})();
