// config.js — 대시보드 전역 설정 (매직넘버 집약)
// IIFE로 window.wilsonConfig 노출. format.js 바로 뒤에 로드.
(function () {
  'use strict';

  window.wilsonConfig = {
    // feed.js — 최종 메시지 후 N ms 무활동 시 그룹 자동 접힘
    IDLE_CLOSE_MS: 10000,

    // tooltip.js — hover 후 툴팁 표시까지 기본 지연
    TOOLTIP_DEFAULT_DELAY_MS: 1500,
    // tooltip.js — 이탈 후 숨김까지 grace 기간 (툴팁 내부 재진입 허용)
    TOOLTIP_HIDE_GRACE_MS: 120,

    // viewer.js — 파일 LRU 캐시 최대 항목 수
    FILE_CACHE_MAX: 50,

    // wilson.js — 툴팁/팁 메시지 표시 시간
    TIP_DISPLAY_MS: 15000,
    // wilson.js — 액션 애니메이션 잔상 유지 시간
    ACTION_LINGER_MS: 15000,
    // wilson.js — 최근 파일 목록 최대 보관 수
    MAX_RECENT_FILES: 100,
  };
})();
