/* ─── Session Tag 공유 모듈 ─────────────────────────────
 * monitor-agent(Feeds)과 monitor-usage(Sessions·Top Projects)에서
 * 프로젝트 이름별로 동일한 색상 박스를 보장하기 위한 공유 레지스트리.
 *
 * 규칙:
 *   - 10색 팔레트 (아래 PALETTE)
 *   - 새 프로젝트가 나오면 다음 빈 슬롯(0~9)을 순서대로 배정
 *   - 11번째(이상) 프로젝트는 랜덤 슬롯 (충돌 허용)
 *   - 배정 결과는 localStorage에 영속화 → 양 페이지/세션 간 동일 색상
 *
 * 노출: window.sessionTag = { assign, render, palette }
 * 의존: 없음 (반드시 feed.js / usage-sessions.js 보다 먼저 로드)
 */
(function() {
  'use strict';

  // 10색 팔레트 — 시각적으로 구분되면서 다크 UI와 조화
  var PALETTE = [
    { bg: '#2a3a5c', fg: '#9cdcfe' }, // 파랑
    { bg: '#5c2a3a', fg: '#f48771' }, // 붉은 주황
    { bg: '#3a5c2a', fg: '#b5cea8' }, // 녹색
    { bg: '#5c4a2a', fg: '#d7ba7d' }, // 카키/황갈
    { bg: '#4a2a5c', fg: '#c586c0' }, // 보라
    { bg: '#1a3c3c', fg: '#4fc1ff' }, // 하늘
    { bg: '#3c3a1a', fg: '#dcdcaa' }, // 노랑
    { bg: '#1a3c2d', fg: '#4ec9b0' }, // 청록
    { bg: '#3c2a1a', fg: '#ce9178' }, // 주황
    { bg: '#2a1a3c', fg: '#b48ead' }  // 자주
  ];

  var STORAGE_KEY = 'wilson.projectColors.v1';
  var LEGACY_STORAGE_KEY = 'monitor-agent.projectColors.v1';

  function loadMap() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        var legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          localStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          raw = legacy;
        }
      }
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (_) { return {}; }
  }
  function saveMap(m) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(m)); } catch (_) { /* skip */ }
  }

  var map = loadMap();

  /** 다음 배정 슬롯 — 0~9 중 아직 누구도 안 쓴 것, 없으면 랜덤. */
  function nextSlot() {
    var used = {};
    Object.keys(map).forEach(function(k) {
      var v = map[k];
      if (typeof v === 'number' && v >= 0 && v < PALETTE.length) used[v] = true;
    });
    for (var i = 0; i < PALETTE.length; i++) {
      if (!used[i]) return i;
    }
    // 10색 모두 배정된 후엔 랜덤 (충돌 허용)
    return Math.floor(Math.random() * PALETTE.length);
  }

  /** name에 색상 pair 배정. 최초 호출 시 슬롯 확정, 이후 동일 결과. */
  function assign(name) {
    var key = String(name || 'default');
    if (typeof map[key] !== 'number') {
      map[key] = nextSlot();
      saveMap(map);
    }
    return PALETTE[map[key] % PALETTE.length];
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** <span class="session-tag">…</span> HTML 문자열 반환. */
  function render(name) {
    var n = name || 'IT';
    var c = assign(n);
    return '<span class="session-tag" style="background:' + c.bg + ';color:' + c.fg + '">' + escapeHtml(n) + '</span>';
  }

  /** 디버그/이관 용도 — 현재 배정 상태 스냅샷 반환 */
  function snapshot() { return Object.assign({}, map); }

  /** 모든 배정 초기화 (테스트용) */
  function reset() { map = {}; saveMap(map); }

  window.sessionTag = {
    assign: assign,
    render: render,
    snapshot: snapshot,
    reset: reset,
    palette: PALETTE
  };
})();
