/**
 * tooltip.js — 공용 hover 툴팁 (feed, Tool Timeline 등 재사용)
 *
 * 사용법:
 *   <element data-tooltip="전체 내용">...</element>
 *   window.hoverTooltip.bind(rootEl, delayMs)
 *
 * - 네이티브 title 대신 커스텀 DOM → 긴 텍스트·개행·스크롤 완전 지원
 * - 툴팁 내부 hover 유지 (휠 스크롤 가능)
 * - 트리거 외부/툴팁 외부 이탈 시 120ms grace 후 숨김
 */
(function () {
  'use strict';

  var DEFAULT_DELAY_MS = 1500;
  var HIDE_GRACE_MS = 120;

  var tooltipEl = null;
  var tooltipTimer = null;
  var hideTimer = null;
  var tooltipCurrent = null;

  function ensureEl() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.getElementById('feed-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'feed-tooltip';
      tooltipEl.className = 'feed-tooltip';
      tooltipEl.setAttribute('aria-hidden', 'true');
    }
    if (document.body && !tooltipEl.parentNode) document.body.appendChild(tooltipEl);
    tooltipEl.addEventListener('mouseenter', cancelHide);
    tooltipEl.addEventListener('mouseleave', hideTooltipNow);
    return tooltipEl;
  }

  function positionTooltip(target) {
    var el = ensureEl();
    var rect = target.getBoundingClientRect();
    el.style.left = '0px';
    el.style.top = '0px';
    var tipRect = el.getBoundingClientRect();
    var margin = 8;
    var x = rect.left;
    var y = rect.bottom + margin;
    if (y + tipRect.height > window.innerHeight - margin) {
      y = Math.max(margin, rect.top - tipRect.height - margin);
    }
    if (x + tipRect.width > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - tipRect.width - margin);
    }
    if (x < margin) x = margin;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  function showTooltipNow(target) {
    var text = target.getAttribute('data-tooltip');
    if (!text) return;
    var el = ensureEl();
    el.textContent = text;
    el.classList.add('visible');
    positionTooltip(target);
  }

  function hideTooltipNow() {
    if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    tooltipCurrent = null;
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(hideTooltipNow, HIDE_GRACE_MS);
  }

  function scheduleShow(target, delay) {
    delay = delay != null ? delay : DEFAULT_DELAY_MS;
    if (tooltipCurrent === target) { cancelHide(); return; }
    if (tooltipTimer) clearTimeout(tooltipTimer);
    cancelHide();
    tooltipCurrent = target;
    tooltipTimer = setTimeout(function () {
      tooltipTimer = null;
      if (tooltipCurrent === target) showTooltipNow(target);
    }, delay);
  }

  function bindTooltip(rootEl, delay) {
    if (!rootEl) return;
    ensureEl();
    rootEl.addEventListener('mouseover', function (e) {
      var el = e.target.closest('[data-tooltip]');
      if (el && rootEl.contains(el)) scheduleShow(el, delay);
    });
    rootEl.addEventListener('mouseout', function (e) {
      var el = e.target.closest('[data-tooltip]');
      if (!el) return;
      var to = e.relatedTarget;
      if (to && (el.contains(to) || (tooltipEl && tooltipEl.contains(to)))) return;
      scheduleHide();
    });
    rootEl.addEventListener('scroll', hideTooltipNow, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureEl);
  } else {
    ensureEl();
  }
  window.addEventListener('scroll', hideTooltipNow, { passive: true });

  window.hoverTooltip = {
    bind: bindTooltip,
    hide: hideTooltipNow,
  };
})();
