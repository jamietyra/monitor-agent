(function() {
  // ─── DOM 요소 ─────────────────────────────────────
  var connectionDot = document.getElementById('connection-dot');
  var connectionStatus = document.getElementById('connection-status');

  var sessionStart = null;
  var elapsedTimer = null;

  // ─── 패널 리사이즈 ────────────────────────────────
  (function() {
    var handle = document.getElementById('resize-activity');
    var panel = document.querySelector('.activity-panel');
    var dragging = false;
    handle.addEventListener('mousedown', function(e) {
      dragging = true;
      handle.classList.add('active');
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      var main = document.querySelector('.main-content');
      var rect = main.getBoundingClientRect();
      var pct = ((e.clientY - rect.top) / rect.height) * 100;
      panel.style.height = Math.max(10, Math.min(70, pct)) + '%';
    });
    document.addEventListener('mouseup', function() {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  })();

  // ─── Stats ────────────────────────────────────────
  function updateStats(stats) {
    document.getElementById('stat-running').textContent = 'Running: ' + (stats.running || 0);
    document.getElementById('stat-done').textContent = 'Done: ' + (stats.completed || 0);
    var errorEl = document.getElementById('stat-error');
    var prevErrors = parseInt(errorEl.textContent.replace(/\D/g, '')) || 0;
    var newErrors = stats.errors || 0;
    errorEl.textContent = 'Errors: ' + newErrors;
    if (newErrors > prevErrors) {
      errorEl.classList.add('flash');
      setTimeout(function() { errorEl.classList.remove('flash'); }, 2000);
    }

    var total = (stats.completed || 0) + (stats.errors || 0) + (stats.running || 0);
    document.getElementById('event-count').textContent = 'Actions: ' + total.toLocaleString();

    if (stats.sessionStart && !sessionStart) {
      sessionStart = new Date(stats.sessionStart);
      if (!elapsedTimer) {
        elapsedTimer = setInterval(function() {
          var elapsed = Date.now() - sessionStart.getTime();
          document.getElementById('stat-time').textContent = 'Elapsed: ' + window.formatElapsed(elapsed);
        }, 1000);
      }
    }
  }

  // ─── SSE 연결 ─────────────────────────────────────
  function connect() {
    var es = new EventSource('/events');

    es.onopen = function() {
      connectionDot.className = 'connection-dot connected';
      connectionStatus.textContent = 'Connected';
    };

    es.onerror = function() {
      connectionDot.className = 'connection-dot disconnected';
      connectionStatus.textContent = 'Reconnecting...';
    };

    // 페이지네이션 상태
    var loadedStartIdx = 0;
    var hasMoreEvents = false;
    var loadMoreBtn = null;

    function insertLoadMoreBtn() {
      if (loadMoreBtn) loadMoreBtn.remove();
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'load-more-btn';
      loadMoreBtn.textContent = '▲ Load 100 more prompts';
      loadMoreBtn.onclick = function() {
        loadMoreBtn.textContent = 'Loading...';
        loadMoreBtn.disabled = true;
        fetch('/api/events?before=' + loadedStartIdx + '&prompts=100')
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.events && data.events.length > 0) {
              var scrollH = window.activityList.scrollHeight;
              var scrollT = window.activityList.scrollTop;
              // 역순으로 삽입 (오래된 것부터)
              var firstChild = window.activityList.firstChild;
              // loadMore 버튼 다음 요소가 첫 그룹
              var insertBefore = loadMoreBtn.nextSibling;
              for (var i = 0; i < data.events.length; i++) {
                window.addActivityItemBefore(data.events[i], insertBefore);
              }
              loadedStartIdx = data.startIdx;
              hasMoreEvents = data.hasMore;
              // 스크롤 위치 유지
              var newScrollH = window.activityList.scrollHeight;
              window.activityList.scrollTop = scrollT + (newScrollH - scrollH);
            }
            if (hasMoreEvents) {
              loadMoreBtn.textContent = '▲ Load 100 more prompts';
              loadMoreBtn.disabled = false;
            } else {
              loadMoreBtn.remove();
              loadMoreBtn = null;
            }
          })
          .catch(function() {
            loadMoreBtn.textContent = '▲ Load 100 more prompts';
            loadMoreBtn.disabled = false;
          });
      };
      window.activityList.insertBefore(loadMoreBtn, window.activityList.firstChild);
    }

    // 초기 데이터
    es.addEventListener('init', function(e) {
      var data = JSON.parse(e.data);

      if (data.recentEvents) {
        if (window.wilson) window.wilson.startBatch();
        for (var i = 0; i < data.recentEvents.length; i++) {
          window.addActivityItem(data.recentEvents[i]);
          if (window.wilson) window.wilson.onEvent(data.recentEvents[i]);
        }
        if (window.wilson) window.wilson.endBatch();
      }

      // 페이지네이션 상태 설정
      loadedStartIdx = data.startIdx;
      hasMoreEvents = data.hasMore;
      if (hasMoreEvents) insertLoadMoreBtn();

      if (data.stats) updateStats(data.stats);
      window.activityList.scrollTop = window.activityList.scrollHeight;
    });

    // 실시간 활동
    es.addEventListener('activity', function(e) {
      var ev = JSON.parse(e.data);
      window.addActivityItem(ev);
      if (window.wilson) window.wilson.onEvent(ev);
    });

    // 파일 콘텐츠
    es.addEventListener('file_content', function(e) {
      var fileData = JSON.parse(e.data);
      window.fileCache.set(fileData.filePath, fileData);
      window.displayCode(fileData);
    });

    // Diff
    es.addEventListener('file_diff', function(e) {
      var data = JSON.parse(e.data);
      window.displayDiff(data);
      if (window.wilson) window.wilson.onFileDiff(data);
    });

    // 스크린샷
    es.addEventListener('screenshot', function(e) {
      var data = JSON.parse(e.data);
      window.displayScreenshot(data);
    });

    // 통계
    es.addEventListener('stats', function(e) {
      var stats = JSON.parse(e.data);
      updateStats(stats);
    });

    return es;
  }

  connect();
})();
