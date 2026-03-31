(function() {
  // ─── DOM 요소 ─────────────────────────────────────
  var codeFilename = document.getElementById('code-filename');
  var codeInfo = document.getElementById('code-info');
  var codeContent = document.getElementById('code-content');
  var browserViewer = document.getElementById('browser-viewer');
  var browserContent = document.getElementById('browser-content');
  var screenshotTime = document.getElementById('screenshot-time');
  var diffPanel = document.getElementById('diff-panel');
  var diffFilename = document.getElementById('diff-filename');
  var diffTime = document.getElementById('diff-time');
  var diffContent = document.getElementById('diff-content');

  // ─── Code Viewer ──────────────────────────────────
  var pendingHighlight = null;

  function displayCode(fileData) {
    codeFilename.textContent = fileData.fileName;
    var info = fileData.totalLines + ' lines';
    if (fileData.truncated) info += ' (showing first 1500)';
    codeInfo.textContent = info;

    var pre = document.createElement('pre');
    var code = document.createElement('code');
    code.className = 'language-' + (fileData.language || 'plaintext');
    code.textContent = fileData.content;
    pre.appendChild(code);

    codeContent.innerHTML = '';
    codeContent.appendChild(pre);

    // 구문 하이라이트 후 Edit diff 하이라이트 적용
    var savedHighlight = pendingHighlight;
    pendingHighlight = null;

    if (fileData.totalLines <= 1000 && typeof Prism !== 'undefined') {
      requestAnimationFrame(function() {
        Prism.highlightElement(code);
        if (savedHighlight) highlightChangedLines(code, savedHighlight);
      });
    } else if (savedHighlight) {
      highlightChangedLines(code, savedHighlight);
    }

    // 클릭된 항목만 강조 (clickedElement가 있을 때만)
    document.querySelectorAll('.activity-item.active').forEach(function(el) { el.classList.remove('active'); });
    if (displayCode._clickedEl) {
      displayCode._clickedEl.classList.add('active');
      displayCode._clickedEl = null;
    }
  }

  function highlightChangedLines(codeEl, diffData) {
    var newStr = diffData.diff.newString;
    if (!newStr) return;

    var content = codeEl.textContent;
    var lines = content.split('\n');
    var newLines = newStr.split('\n');

    // 파일에서 new_string이 시작되는 줄 찾기
    var firstNewLine = newLines[0].trim();
    if (!firstNewLine) return;

    var startLine = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].includes(firstNewLine)) {
        // 연속된 줄이 매칭되는지 검증
        var match = true;
        for (var j = 1; j < Math.min(newLines.length, 3); j++) {
          if (i + j < lines.length && newLines[j].trim() && !lines[i + j].includes(newLines[j].trim())) {
            match = false;
            break;
          }
        }
        if (match) { startLine = i; break; }
      }
    }

    if (startLine === -1) return;

    var endLine = startLine + newLines.length;

    // HTML을 줄 단위로 분할해서 하이라이트 적용
    var html = codeEl.innerHTML;
    var htmlLines = html.split('\n');
    for (var i = startLine; i < Math.min(endLine, htmlLines.length); i++) {
      htmlLines[i] = '<span class="code-line-highlight">' + htmlLines[i] + '</span>';
    }
    codeEl.innerHTML = htmlLines.join('\n');

    // 하이라이트된 줄로 스크롤 (상단 1/3 지점)
    requestAnimationFrame(function() {
      var highlighted = codeContent.querySelector('.code-line-highlight');
      if (highlighted) {
        var containerRect = codeContent.getBoundingClientRect();
        var targetRect = highlighted.getBoundingClientRect();
        var offset = targetRect.top - containerRect.top + codeContent.scrollTop;
        var scrollTo = offset - containerRect.height / 3;
        codeContent.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' });
      }
    });
  }

  // ─── 파일 캐시 + 요청 ─────────────────────────────
  var fileCache = new Map();

  function requestFileContent(filePath) {
    // 캐시에 있으면 즉시 표시
    var cached = fileCache.get(filePath);
    if (cached) { displayCode(cached); return; }

    // 없으면 서버에 요청
    fetch('/api/file?path=' + encodeURIComponent(filePath))
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data && data.content) {
          fileCache.set(filePath, data);
          displayCode(data);
        }
      })
      .catch(function() {});
  }

  // ─── Diff Viewer ──────────────────────────────────
  function displayDiff(data) {
    diffPanel.classList.add('visible');
    diffFilename.textContent = 'Edit: ' + (data.fileName || '');
    diffTime.textContent = data.time ? window.formatTime(data.time) : '';

    var lines = [];
    // 삭제된 줄
    if (data.diff.oldString) {
      data.diff.oldString.split('\n').forEach(function(line) {
        lines.push('<div class="diff-line-old">- ' + window.escapeHtml(line) + '</div>');
      });
    }
    // 구분선
    lines.push('<hr class="diff-separator">');
    // 추가된 줄
    if (data.diff.newString) {
      data.diff.newString.split('\n').forEach(function(line) {
        lines.push('<div class="diff-line-new">+ ' + window.escapeHtml(line) + '</div>');
      });
    }

    diffContent.innerHTML = lines.join('');
  }

  // ─── Browser Viewer ───────────────────────────────
  function displayScreenshot(data) {
    browserViewer.classList.add('visible');
    screenshotTime.textContent = data.time ? window.formatTime(data.time) : '';
    browserContent.innerHTML = '<img src="/screenshots/' + encodeURIComponent(data.fileName) + '?t=' + Date.now() + '" alt="Browser screenshot">';
  }

  // ─── window 노출 ──────────────────────────────────
  window.displayCode = displayCode;
  window.displayDiff = displayDiff;
  window.displayScreenshot = displayScreenshot;
  window.requestFileContent = requestFileContent;
  window.fileCache = fileCache;

  // pendingHighlight를 feed.js에서 설정할 수 있도록 노출
  Object.defineProperty(window, 'pendingHighlight', {
    get: function() { return pendingHighlight; },
    set: function(v) { pendingHighlight = v; }
  });
})();
