// format.js — 공용 포맷 헬퍼. usage-*.js 간 중복 제거.
// window.wilsonFormat 네임스페이스로 노출.
// index.html / usage.html에서 usage-*.js 앞에 로드.

(function() {
  /** 1234 → "1.2K", 1234567 → "1.2M", 1234567890 → "1.2B" */
  function formatTokens(n) {
    if (!n || n <= 0) return '0';
    if (n < 1000) return String(Math.round(n));
    if (n < 1_000_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    if (n < 1_000_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }

  /** $X.XX 소수 둘째 자리. */
  function formatCost(usd) {
    if (!usd || usd <= 0) return '$0.00';
    return '$' + Number(usd).toFixed(2);
  }

  /** ms → "Xh Ym" 또는 "Ym", 0이면 "—" */
  function formatDuration(ms) {
    if (!ms || ms <= 0) return '—';
    var totalMin = Math.round(ms / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    if (h <= 0) return m + 'm';
    return h + 'h ' + m + 'm';
  }

  /** Date → 'YYYY-MM-DD' (로컬 기준) */
  function isoDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /** XSS 방지용 HTML 이스케이프 */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.wilsonFormat = {
    formatTokens: formatTokens,
    formatCost: formatCost,
    formatDuration: formatDuration,
    isoDate: isoDate,
    escapeHtml: escapeHtml,
  };
})();
