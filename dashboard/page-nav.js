/* ─── Page Navigation (monitor-agent ↔ monitor-usage) ───
 * 양쪽 페이지에서 공유하는 타이틀 클릭 전환 + B 애니메이션 로직.
 *
 * 전략: Animated navigation (SPA 아님)
 *   1) 타이틀 클릭 → body에 .page-leaving 클래스 추가 (CSS가 슬라이드+페이드 재생)
 *   2) 0.4s 후 window.location.href = target 으로 실제 페이지 이동
 *   3) 도착 페이지는 로드 직후 body에 .page-entering 부여, 다음 frame에서 제거
 *      → CSS transition이 entrance 애니메이션을 재생
 *   4) popstate 핸들러로 뒤/앞 버튼도 동일 경로 사용
 *
 * 이 파일은 index.html / usage.html 양쪽에서 공유한다.
 * 각 페이지의 h1.page-nav-title 을 자동으로 찾아 클릭 핸들러를 붙인다.
 *
 * 설계 스펙: docs/specs/2026-04-13-monitor-usage-design.md §4b, §4c
 */

(function () {
  'use strict';

  // B 애니메이션 duration (ms). CSS의 .page-leaving transition과 동일해야 함.
  var LEAVE_MS = 400;

  // 중복 초기화 방지용 플래그
  if (window.__pageNavInitialized) return;
  window.__pageNavInitialized = true;

  // 현재 페이지가 어느 쪽인지 body[data-page]로 판정
  function currentPage() {
    var page = document.body && document.body.getAttribute('data-page');
    return page === 'usage' ? 'usage' : 'agent';
  }

  // 현재 페이지에서 반대 페이지 URL 반환
  function targetUrl() {
    return currentPage() === 'usage' ? '/' : '/usage';
  }

  /**
   * 타이틀을 클릭했을 때의 전환 시작 — leaving 애니메이션 재생 후 페이지 이동.
   * 전환 중엔 다시 트리거되지 않도록 가드.
   */
  function navigateWithAnimation(url) {
    if (document.body.classList.contains('page-leaving')) return;
    document.body.classList.add('page-leaving');

    // 타이틀에는 별도 훅(스타일용)을 추가 — pointer-events: none 등
    var title = document.getElementById('page-nav-title')
             || document.querySelector('.page-nav-title');
    if (title) title.classList.add('is-navigating');

    // history는 실제 네비게이션에 맡긴다 (SPA가 아니므로 pushState 별도 불필요)
    // 단, 애니메이션이 끝나야 시각적으로 자연스러움.
    window.setTimeout(function () {
      // 토큰 인증 모드 대비: 기존 query(token 등) 최대한 보존
      try {
        var here = new URL(window.location.href);
        var next = new URL(url, window.location.origin);
        // token 같은 파라미터를 현재 주소에서 물려줌
        here.searchParams.forEach(function (v, k) {
          if (!next.searchParams.has(k)) next.searchParams.set(k, v);
        });
        window.location.href = next.pathname + next.search;
      } catch (_) {
        window.location.href = url;
      }
    }, LEAVE_MS);
  }

  // 페이지 로드 시 entrance 애니메이션 트리거
  // - history navigation (뒤/앞)로 복귀 시 bfcache가 page-leaving 상태를 복구할 수 있으므로 해제도 같이
  function playEntrance() {
    // page-leaving 플래그가 남아있으면 해제 (bfcache 복원 대응)
    document.body.classList.remove('page-leaving');

    var title = document.getElementById('page-nav-title')
             || document.querySelector('.page-nav-title');
    if (title) title.classList.remove('is-navigating');

    document.body.classList.add('page-entering');
    // 두 frame 후 제거 → CSS transition이 "시작 상태 → 정상 상태"로 재생
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.remove('page-entering');
      });
    });
  }

  // 타이틀에 클릭 핸들러 부착
  function bindTitle() {
    var title = document.getElementById('page-nav-title')
             || document.querySelector('.page-nav-title');
    if (!title) return;

    // 인라인 onclick 제거 (혹시 남아있을 경우)
    title.onclick = null;
    title.removeAttribute('onclick');

    title.addEventListener('click', function (e) {
      e.preventDefault();
      navigateWithAnimation(targetUrl());
    });
  }

  // 뒤/앞 버튼: 브라우저가 실제 페이지를 재로드하므로 별도 처리 불필요.
  // 다만 bfcache로 인한 동일 DOM 복구 시 상태 정리가 필요.
  window.addEventListener('pageshow', function (e) {
    // bfcache 복원이든 일반 로드든 공통으로 entrance 재생
    playEntrance();
  });

  function init() {
    bindTitle();
    playEntrance();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 외부에서 프로그램적으로 전환하고 싶을 때
  window.pageNav = {
    navigate: navigateWithAnimation,
    target: targetUrl,
  };
})();
