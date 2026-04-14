/**
 * tool-timeline.js v4 — Wilson 패널 하단 가로 Tool Timeline
 *
 * v4 변경: CSS keyframe 대신 requestAnimationFrame 으로 `left` 직접 계산.
 * calc(px ↔ %) 혼합 보간 이슈 제거, 진단 배지(ID='timeline-count') 추가.
 *
 * 노출 API: window.toolTimeline = { onEvent(ev), clear(), _debug() }
 */
(function () {
  'use strict';

  var WINDOW_MS = 600000; // 10분
  var LANES = 6;
  var STORAGE_KEY = 'toolTimeline.state.v1';

  var track = null;
  var clearBtn = null;
  var countEl = null;
  var ready = false;
  var rafHandle = 0;

  // 상태
  var icons = [];                                       // [{ el, ts, id, status, lane }]
  var idToIcon = new Map();                             // ev.id → record
  var activeSessions = new Map();                       // sid → lastEventMs
  var laneAssignment = new Array(LANES).fill(null);
  var laneLastInsert = new Array(LANES).fill(0);

  // ── SVG 아이콘 세트 (24×24 stroke) ────────────────────
  var ICONS = {
    Read:     '<path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6"/>',
    Write:    '<path d="M3 21v-4l11-11 4 4-11 11z"/><path d="M14 6l4 4"/>',
    Edit:     '<path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18 2l4 4-10 10H8v-4z"/>',
    Bash:     '<path d="M4 17l6-6-6-6"/><path d="M12 19h8"/>',
    Task:     '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    Glob:     '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    Web:      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    _default: '<circle cx="12" cy="12" r="5"/>'
  };

  function normalizeName(name) {
    if (!name) return '_default';
    var lower = String(name).toLowerCase();
    if (lower.indexOf('read') >= 0) return 'Read';
    if (lower.indexOf('write') >= 0) return 'Write';
    if (lower.indexOf('edit') >= 0) return 'Edit';
    if (lower.indexOf('bash') >= 0 || lower.indexOf('shell') >= 0) return 'Bash';
    if (lower.indexOf('task') >= 0 || lower === 'agent') return 'Task';
    if (lower.indexOf('glob') >= 0 || lower.indexOf('grep') >= 0 || lower.indexOf('search') >= 0) return 'Glob';
    if (lower.indexOf('fetch') >= 0 || lower.indexOf('web') >= 0 || lower.indexOf('http') >= 0 || lower.indexOf('url') >= 0) return 'Web';
    return '_default';
  }

  function svgFor(name) {
    var key = normalizeName(name);
    var inner = ICONS[key] || ICONS._default;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  // ── 로그 스케일: 0→0%, 30s→5%, 1m→10%, 2m→20%, 5m→50%, 10m→100% ──
  function elapsedToPercent(elapsedMs) {
    var s = elapsedMs / 1000;
    if (s <= 30)  return s / 30 * 5;
    if (s <= 60)  return 5  + (s - 30)  / 30  * 5;
    if (s <= 120) return 10 + (s - 60)  / 60  * 10;
    if (s <= 300) return 20 + (s - 120) / 180 * 30;
    if (s <= 600) return 50 + (s - 300) / 300 * 50;
    return 100;
  }

  // ── 세션/레인 분배 ─────────────────────────────────────
  function allocateLanes() {
    var sessions = [];
    activeSessions.forEach(function (_, sid) { sessions.push(sid); });
    var n = sessions.length;
    var lanes = new Array(LANES).fill(null);
    if (n === 0) { laneAssignment = lanes; return; }
    if (n >= 7)  { laneAssignment = lanes.fill('_shared'); return; }
    var per = Math.floor(LANES / n);
    var extra = LANES - per * n;
    var idx = 0;
    for (var s = 0; s < n; s++) {
      for (var k = 0; k < per; k++) lanes[idx++] = sessions[s];
    }
    for (var k2 = 0; k2 < extra; k2++) lanes[idx++] = '_shared';
    laneAssignment = lanes;
  }

  function updateActiveSessions(sid, nowMs) {
    activeSessions.set(sid, nowMs);
    var cutoff = nowMs - WINDOW_MS;
    activeSessions.forEach(function (last, s) {
      if (last < cutoff) activeSessions.delete(s);
    });
    allocateLanes();
  }

  function pickLane(sid) {
    var candidates = [];
    for (var i = 0; i < LANES; i++) {
      if (laneAssignment[i] === sid || laneAssignment[i] === '_shared') candidates.push(i);
    }
    if (candidates.length === 0) {
      for (var j = 0; j < LANES; j++) {
        if (laneAssignment[j] === null) candidates.push(j);
      }
    }
    if (candidates.length === 0) candidates = [0, 1, 2, 3, 4, 5];
    var pick = candidates[0];
    var oldest = laneLastInsert[pick];
    for (var c = 1; c < candidates.length; c++) {
      var idx2 = candidates[c];
      if (laneLastInsert[idx2] < oldest) { pick = idx2; oldest = laneLastInsert[idx2]; }
    }
    return pick;
  }

  // ── 아이콘 DOM ─────────────────────────────────────────
  function makeIconEl(ev, lane) {
    var el = document.createElement('div');
    el.className = 'timeline-icon';
    el.dataset.tool = normalizeName(ev.name);
    el.dataset.status = 'running';

    // lane 중앙
    var laneFrac = (lane + 0.5) / LANES;
    el.style.top = 'calc(' + (laneFrac * 100) + '% - 11px)';
    el.style.left = '0px';
    el.style.opacity = '1';

    // 세션 색 border
    if (window.sessionTag && typeof window.sessionTag.assign === 'function') {
      var pal = window.sessionTag.assign(ev.project || '_shared');
      if (pal && pal.bg) el.style.borderColor = pal.bg;
    }

    el.innerHTML = svgFor(ev.name);

    var target = ev.target ? String(ev.target) : '';
    if (target.length > 60) target = target.slice(0, 57) + '…';
    el.title = (ev.name || '?') + (target ? ' · ' + target : '') + (ev.project ? '  [' + ev.project + ']' : '');

    return el;
  }

  function updateCount() {
    if (!countEl) return;
    var running = 0;
    for (var i = 0; i < icons.length; i++) if (icons[i].status === 'running') running++;
    countEl.textContent = running + '/' + icons.length;
  }

  // ── rAF 루프: 모든 아이콘 위치/opacity 매 프레임 갱신 ──
  function tick() {
    rafHandle = requestAnimationFrame(tick);
    if (!ready || icons.length === 0) return;
    var now = Date.now();
    var alive = [];
    for (var i = 0; i < icons.length; i++) {
      var it = icons[i];
      var elapsed = now - it.ts;
      if (elapsed >= WINDOW_MS) {
        if (it.el.parentNode) it.el.parentNode.removeChild(it.el);
        continue;
      }
      var pct = elapsedToPercent(elapsed);
      // 양쪽 5% 마진 (아이콘이 끝 clipping 없이 완전히 보임)
      var visualPct = 5 + pct * 0.90; // 0%→5%, 100%→95%
      it.el.style.left = 'calc(' + visualPct.toFixed(3) + '% - 11px)';
      // fade-in 0-400ms + fade-out 끝 5%
      var op;
      if (elapsed < 400) op = Math.max(0, elapsed / 400);
      else if (pct > 95) op = Math.max(0, (100 - pct) / 5);
      else op = 1;
      var opStr = op.toFixed(2);
      if (it.el.style.opacity !== opStr) it.el.style.opacity = opStr;
      alive.push(it);
    }
    if (alive.length !== icons.length) {
      icons = alive;
      updateCount();
    }
  }

  // ── 이벤트 처리 ────────────────────────────────────────
  function onEvent(ev) {
    if (!ev) return;
    // 진단 로그 (DevTools Console 에서 확인 가능)
    try { console.debug('[toolTimeline]', ev.type, ev.name, ev.id); } catch (e) {}
    if (!ready) { console.warn('[toolTimeline] not ready, dropped event'); return; }

    var type = ev.type;
    if (type === 'tool_start') {
      var sid = ev.project || '_shared';
      var now = Date.now();
      updateActiveSessions(sid, now);
      var lane = pickLane(sid);
      laneLastInsert[lane] = now;
      var el = makeIconEl(ev, lane);
      track.appendChild(el);
      var record = {
        el: el, ts: now, id: ev.id, status: 'running', lane: lane,
        name: ev.name, target: ev.target, project: ev.project
      };
      icons.push(record);
      if (ev.id) idToIcon.set(ev.id, record);
      updateCount();
    } else if (type === 'tool_done' || type === 'tool_error') {
      var existing = ev.id ? idToIcon.get(ev.id) : null;
      if (existing) {
        existing.status = (type === 'tool_error') ? 'error' : 'done';
        existing.el.dataset.status = existing.status;
        idToIcon.delete(ev.id);
        updateCount();
      }
    }
  }

  function clear() {
    while (track && track.firstChild) track.removeChild(track.firstChild);
    icons = [];
    idToIcon.clear();
    activeSessions.clear();
    laneAssignment = new Array(LANES).fill(null);
    laneLastInsert = new Array(LANES).fill(0);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
    updateCount();
  }

  // ── sessionStorage persistence (페이지 네비 간 유지) ──
  function saveState() {
    try {
      var now = Date.now();
      var data = icons
        .filter(function (it) { return now - it.ts < WINDOW_MS; })
        .map(function (it) {
          return {
            ts: it.ts, id: it.id, status: it.status, lane: it.lane,
            name: it.name, target: it.target, project: it.project
          };
        });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* quota or private mode */ }
  }

  function restoreState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return 0;
      var data = JSON.parse(raw);
      var now = Date.now();
      var restored = 0;
      data.forEach(function (rec) {
        if (now - rec.ts >= WINDOW_MS) return; // stale
        var sid = rec.project || '_shared';
        updateActiveSessions(sid, rec.ts);
        var lane = (rec.lane != null && rec.lane >= 0 && rec.lane < LANES) ? rec.lane : pickLane(sid);
        var el = makeIconEl({ name: rec.name, target: rec.target, project: rec.project, id: rec.id }, lane);
        // 복원된 아이콘은 항상 done 처리 (페이지 리로드로 tool_done 놓쳤을 수 있음)
        el.dataset.status = 'done';
        track.appendChild(el);
        icons.push({
          el: el, ts: rec.ts, id: rec.id, status: 'done', lane: lane,
          name: rec.name, target: rec.target, project: rec.project
        });
        restored++;
      });
      if (restored > 0) console.info('[toolTimeline] restored ' + restored + ' icons from sessionStorage');
      return restored;
    } catch (e) {
      console.warn('[toolTimeline] restoreState failed', e);
      return 0;
    }
  }

  function init() {
    track = document.getElementById('timeline-track');
    clearBtn = document.getElementById('timeline-clear');
    countEl = document.getElementById('timeline-count');
    if (!track) { console.warn('[toolTimeline] #timeline-track not found'); return; }
    if (clearBtn) clearBtn.addEventListener('click', clear);
    ready = true;
    restoreState();
    updateCount();
    rafHandle = requestAnimationFrame(tick);
    // 페이지 떠날 때 저장 — pagehide 가 iOS/Safari 포함 가장 범용
    window.addEventListener('pagehide', saveState);
    window.addEventListener('beforeunload', saveState);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') saveState();
    });
    console.info('[toolTimeline] v5 initialized (sessionStorage persistence enabled)');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.toolTimeline = {
    onEvent: onEvent,
    clear: clear,
    _debug: function () {
      return { ready: ready, icons: icons.length, running: icons.filter(function(i){return i.status==='running';}).length, track: !!track };
    }
  };
})();
