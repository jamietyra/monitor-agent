(function() {
  var activityList = document.getElementById('activity-list');
  var sessionFiltersEl = document.getElementById('session-filters');
  var knownSessions = new Set();
  var activeSessionFilter = null; // null = 전체

  function addSessionFilterBtn(project) {
    var name = project || 'IT';
    if (knownSessions.has(name)) return;
    knownSessions.add(name);

    var btn = document.createElement('button');
    btn.className = 'session-filter-btn active';
    btn.textContent = name;
    var color = getSessionColor(name);
    btn.style.color = color.fg;
    btn.style.background = color.bg;
    btn.dataset.session = name;

    btn.onclick = function() {
      if (activeSessionFilter === name) {
        // 이미 선택된 필터 해제 → 전체 보기
        activeSessionFilter = null;
        sessionFiltersEl.querySelectorAll('.session-filter-btn').forEach(function(b) { b.classList.add('active'); });
      } else {
        // 이 세션만 필터
        activeSessionFilter = name;
        sessionFiltersEl.querySelectorAll('.session-filter-btn').forEach(function(b) {
          b.classList.toggle('active', b.dataset.session === name);
        });
      }
      applyFilters();
    };

    sessionFiltersEl.appendChild(btn);
  }

  // Toggle all expand/collapse
  var allExpanded = false;
  var toggleAllBtn = document.getElementById('toggle-all');
  toggleAllBtn.onclick = function() {
    allExpanded = !allExpanded;
    toggleAllBtn.textContent = allExpanded ? '▼ All' : '▶ All';
    var groups = activityList.querySelectorAll('.prompt-group');
    for (var i = 0; i < groups.length; i++) {
      var toggle = groups[i].querySelector('.prompt-toggle');
      var tools = groups[i].querySelector('.prompt-tools');
      if (allExpanded) {
        if (toggle) toggle.classList.remove('collapsed');
        if (tools) tools.classList.remove('collapsed');
      } else {
        if (toggle) toggle.classList.add('collapsed');
        if (tools) tools.classList.add('collapsed');
      }
    }
  };

  var searchInput = document.getElementById('activity-search');
  searchInput.addEventListener('input', applyFilters);

  function applyFilters() {
    var q = searchInput.value.toLowerCase().trim();
    var groups = activityList.querySelectorAll('.prompt-group');
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var show = true;
      // 세션 필터
      if (activeSessionFilter && group.dataset.session !== activeSessionFilter) {
        show = false;
      }
      // 검색어 필터
      if (show && q) {
        var text = group.textContent.toLowerCase();
        if (!text.includes(q)) show = false;
      }
      group.style.display = show ? '' : 'none';
    }
  }

  function formatTime(isoStr) {
    var d = new Date(isoStr);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  function formatDuration(seconds) {
    if (seconds < 1) return Math.round(seconds * 1000) + 'ms';
    if (seconds < 60) return seconds.toFixed(1) + 's';
    var m = Math.floor(seconds / 60);
    var s = Math.round(seconds % 60);
    return m + 'm ' + s + 's';
  }

  function formatElapsed(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var h = Math.floor(m / 60);
    if (h > 0) return h + 'h ' + (m % 60) + 'm';
    return m + 'm ' + (s % 60) + 's';
  }

  var sessionColorCache = {};
  var SESSION_COLORS = [
    { bg: '#1a3a5c', fg: '#569cd6' },
    { bg: '#3c1a1a', fg: '#f44747' },
    { bg: '#2d1a3c', fg: '#c586c0' },
    { bg: '#1a3c2d', fg: '#4ec9b0' },
    { bg: '#3c3a1a', fg: '#dcdcaa' },
    { bg: '#1a3c3c', fg: '#4fc1ff' },
    { bg: '#3c2a1a', fg: '#ce9178' },
    { bg: '#2a1a3c', fg: '#b48ead' },
  ];

  function getSessionColor(project) {
    if (!project) project = 'default';
    if (sessionColorCache[project]) return sessionColorCache[project];
    var hash = 0;
    for (var i = 0; i < project.length; i++) hash = ((hash << 5) - hash + project.charCodeAt(i)) | 0;
    var color = SESSION_COLORS[Math.abs(hash) % SESSION_COLORS.length];
    sessionColorCache[project] = color;
    return color;
  }

  function makeSessionTag(project) {
    var name = project || 'IT';
    var color = getSessionColor(name);
    return '<span class="session-tag" style="background:' + color.bg + ';color:' + color.fg + '">' + escapeHtml(name) + '</span>';
  }

  var currentGroup = null;
  var currentToolsContainer = null;
  var currentToolCount = 0;
  var currentSession = null;

  function collapseCurrentGroup() {
    if (!currentGroup) return;
    var toggle = currentGroup.querySelector('.prompt-toggle');
    var tools = currentGroup.querySelector('.prompt-tools');
    if (toggle) toggle.classList.add('collapsed');
    if (tools) tools.classList.add('collapsed');
  }

  function createGroup(timeStr, text, promptId, project) {
    // 이전 그룹 접기
    collapseCurrentGroup();

    var sessionName = project || 'IT';
    addSessionFilterBtn(sessionName);

    var group = document.createElement('div');
    group.className = 'prompt-group';
    group.dataset.session = sessionName;
    if (promptId) group.dataset.promptId = promptId;

    var header = document.createElement('div');
    header.className = 'prompt-header';

    header.innerHTML = [
      '<span class="prompt-toggle">▼</span>',
      makeSessionTag(project),
      '<span class="prompt-time">' + timeStr + '</span>',
      '<span class="prompt-text">' + escapeHtml(text) + '</span>',
      '<span class="prompt-count">0</span>',
    ].join('');

    var tools = document.createElement('div');
    tools.className = 'prompt-tools';

    header.onclick = function() {
      var toggle = this.querySelector('.prompt-toggle');
      toggle.classList.toggle('collapsed');
      tools.classList.toggle('collapsed');
    };

    group.appendChild(header);
    group.appendChild(tools);
    activityList.appendChild(group);

    currentGroup = group;
    currentToolsContainer = tools;
    currentToolCount = 0;
  }

  function ensurePromptGroup(ev) {
    if (ev.type === 'prompt') {
      var timeStr = ev.time ? formatTime(ev.time) : '';
      var previewText = ev.text.replace(/\n/g, ' ').slice(0, 160) || '(prompt)';
      createGroup(timeStr, previewText, ev.promptId, ev.project);
      autoScroll();
      return;
    }

    if (!currentGroup) {
      createGroup('', '(previous)', null, ev.project);
    }
  }

  function updateGroupCount() {
    if (!currentGroup) return;
    var countEl = currentGroup.querySelector('.prompt-count');
    if (countEl) countEl.textContent = currentToolCount;
  }

  function autoScroll() {
    var isNearBottom = activityList.scrollHeight - activityList.scrollTop - activityList.clientHeight < 80;
    if (isNearBottom) activityList.scrollTop = activityList.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function addActivityItem(ev) {
    // prompt 이벤트 처리
    if (ev.type === 'prompt') {
      ensurePromptGroup(ev);
      return;
    }

    // assistant 텍스트 → 현재 그룹에 추가
    if (ev.type === 'assistant_text') {
      ensurePromptGroup(ev);
      var item = document.createElement('div');
      item.className = 'assistant-text-item';
      var preview = ev.text.replace(/\n/g, ' ').slice(0, 150);
      item.innerHTML = '<span class="assistant-icon">\u25CF</span><span class="assistant-text">' + escapeHtml(preview) + '</span>';
      currentToolsContainer.appendChild(item);
      autoScroll();
      return;
    }

    // tool_done/tool_error → 기존 줄 업데이트
    if ((ev.type === 'tool_done' || ev.type === 'tool_error') && ev.id) {
      var existing = document.querySelector('.activity-item[data-tool-id="' + ev.id + '"]');
      if (existing) {
        var iconEl = existing.querySelector('.activity-icon');
        if (ev.type === 'tool_done') {
          iconEl.textContent = '\u2713';
          iconEl.className = 'activity-icon icon-done';
        } else {
          iconEl.textContent = '\u2717';
          iconEl.className = 'activity-icon icon-error';
          existing.classList.add('error-item');
        }
        var endTime = ev.time ? formatTime(ev.time) : '';
        var duration = ev.duration != null ? formatDuration(ev.duration) : '';
        var endTimeEl = existing.querySelector('.activity-end-time');
        if (endTimeEl) endTimeEl.textContent = endTime;
        var durationEl = existing.querySelector('.activity-duration');
        if (durationEl) durationEl.textContent = duration;

        if (ev.filePath && !existing.dataset.filePath) {
          existing.dataset.filePath = ev.filePath;
          existing.style.cursor = 'pointer';
          existing.onclick = function() {
            window.displayCode._clickedEl = this;
            window.requestFileContent(ev.filePath);
          };
        }
        return;
      }
    }

    // tool_start → 그룹 안에 새 줄 생성
    if (ev.type !== 'tool_start') return;

    ensurePromptGroup(ev);

    var item = document.createElement('div');
    item.className = 'activity-item';
    if (ev.id) item.dataset.toolId = ev.id;

    if (ev.diff) item._diffData = { filePath: ev.filePath, fileName: ev.target, diff: ev.diff, time: ev.time };

    if (ev.filePath) {
      item.dataset.filePath = ev.filePath;
      item.style.cursor = 'pointer';
      item.onclick = function() {
        window.displayCode._clickedEl = this;
        if (this._diffData) {
          window.pendingHighlight = this._diffData;
          window.displayDiff(this._diffData);
        } else {
          window.pendingHighlight = null;
        }
        window.fileCache.delete(ev.filePath); // 최신 파일 내용 로드
        window.requestFileContent(ev.filePath);
      };
    }

    var timeStr = ev.time ? formatTime(ev.time) : '';
    var target = ev.target || '';

    item.innerHTML = [
      '<span class="activity-time">' + timeStr + '</span>',
      '<span class="activity-icon icon-start">\u25b6</span>',
      '<span class="activity-name">' + escapeHtml(ev.name) + '</span>',
      '<span class="activity-target">' + escapeHtml(target) + '</span>',
      '<span class="activity-end-time"></span>',
      '<span class="activity-duration"></span>',
    ].join('');

    currentToolsContainer.appendChild(item);
    currentToolCount++;
    updateGroupCount();
    autoScroll();
  }

  // 이전 이벤트를 특정 위치 앞에 삽입 (Load more용)
  var prevGroup = null;
  var prevToolsContainer = null;
  var prevToolCount = 0;

  function addActivityItemBefore(ev, beforeEl) {
    if (ev.type === 'prompt') {
      var sessionName = ev.project || 'IT';
      addSessionFilterBtn(sessionName);
      var group = document.createElement('div');
      group.className = 'prompt-group';
      group.dataset.session = sessionName;
      if (ev.promptId) group.dataset.promptId = ev.promptId;
      var header = document.createElement('div');
      header.className = 'prompt-header';
      var timeStr = ev.time ? formatTime(ev.time) : '';
      var previewText = ev.text.replace(/\n/g, ' ').slice(0, 160) || '(prompt)';
      header.innerHTML = [
        '<span class="prompt-toggle collapsed">▼</span>',
        makeSessionTag(ev.project),
        '<span class="prompt-time">' + timeStr + '</span>',
        '<span class="prompt-text">' + escapeHtml(previewText) + '</span>',
        '<span class="prompt-count">0</span>',
      ].join('');
      var tools = document.createElement('div');
      tools.className = 'prompt-tools collapsed';
      header.onclick = function() {
        var toggle = this.querySelector('.prompt-toggle');
        toggle.classList.toggle('collapsed');
        tools.classList.toggle('collapsed');
      };
      group.appendChild(header);
      group.appendChild(tools);
      activityList.insertBefore(group, beforeEl);
      prevGroup = group;
      prevToolsContainer = tools;
      prevToolCount = 0;
      return;
    }

    if (ev.type === 'assistant_text') {
      if (!prevToolsContainer) return;
      var aItem = document.createElement('div');
      aItem.className = 'assistant-text-item';
      var preview = ev.text.replace(/\n/g, ' ').slice(0, 150);
      aItem.innerHTML = '<span class="assistant-icon">\u25CF</span><span class="assistant-text">' + escapeHtml(preview) + '</span>';
      prevToolsContainer.appendChild(aItem);
      return;
    }

    if ((ev.type === 'tool_done' || ev.type === 'tool_error') && ev.id) {
      var existing = document.querySelector('.activity-item[data-tool-id="' + ev.id + '"]');
      if (existing) {
        var iconEl = existing.querySelector('.activity-icon');
        if (ev.type === 'tool_done') { iconEl.textContent = '\u2713'; iconEl.className = 'activity-icon icon-done'; }
        else { iconEl.textContent = '\u2717'; iconEl.className = 'activity-icon icon-error'; existing.classList.add('error-item'); }
        var endTime = ev.time ? formatTime(ev.time) : '';
        var duration = ev.duration != null ? formatDuration(ev.duration) : '';
        var etEl = existing.querySelector('.activity-end-time');
        if (etEl) etEl.textContent = endTime;
        var dEl = existing.querySelector('.activity-duration');
        if (dEl) dEl.textContent = duration;
        return;
      }
    }

    if (ev.type !== 'tool_start') return;
    if (!prevGroup) {
      addActivityItemBefore({ type: 'prompt', text: '(previous)', project: ev.project, time: ev.time }, beforeEl);
    }
    var item = document.createElement('div');
    item.className = 'activity-item';
    if (ev.id) item.dataset.toolId = ev.id;
    if (ev.diff) item._diffData = { filePath: ev.filePath, fileName: ev.target, diff: ev.diff, time: ev.time };
    if (ev.filePath) {
      item.dataset.filePath = ev.filePath;
      item.style.cursor = 'pointer';
      item.onclick = function() {
        window.displayCode._clickedEl = this;
        if (this._diffData) { window.pendingHighlight = this._diffData; window.displayDiff(this._diffData); }
        else { window.pendingHighlight = null; }
        window.fileCache.delete(ev.filePath);
        window.requestFileContent(ev.filePath);
      };
    }
    var timeStr = ev.time ? formatTime(ev.time) : '';
    var target = ev.target || '';
    item.innerHTML = [
      '<span class="activity-time">' + timeStr + '</span>',
      '<span class="activity-icon icon-start">\u25b6</span>',
      '<span class="activity-name">' + escapeHtml(ev.name) + '</span>',
      '<span class="activity-target">' + escapeHtml(target) + '</span>',
      '<span class="activity-end-time"></span>',
      '<span class="activity-duration"></span>',
    ].join('');
    prevToolsContainer.appendChild(item);
    prevToolCount++;
    var countEl = prevGroup.querySelector('.prompt-count');
    if (countEl) countEl.textContent = prevToolCount;
  }

  window.addActivityItem = addActivityItem;
  window.addActivityItemBefore = addActivityItemBefore;
  window.escapeHtml = escapeHtml;
  window.formatTime = formatTime;
  window.formatDuration = formatDuration;
  window.formatElapsed = formatElapsed;
  window.activityList = activityList;
})();
