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

  function formatSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(2) + 'MB';
  }

  function formatAge(mtimeMs) {
    if (!mtimeMs) return '';
    var diff = Date.now() - mtimeMs;
    if (diff < 0) return 'just now';
    var s = Math.floor(diff / 1000);
    if (s < 60) return s + 's ago';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24);
    return d + 'd ago';
  }

  function clearDiff() {
    diffFilename.textContent = 'Diff';
    diffTime.textContent = '';
    diffContent.innerHTML = '<span style="color: var(--text-dim)">Click an Edit item to see changes</span>';
  }

  function displayCode(fileData) {
    codeFilename.textContent = fileData.fileName;
    var parts = [fileData.totalLines + ' lines'];
    if (fileData.truncated) parts[0] += ' (showing first 1500)';
    if (fileData.size != null) parts.push(formatSize(fileData.size));
    if (fileData.mtimeMs) parts.push('modified ' + formatAge(fileData.mtimeMs));
    codeInfo.textContent = parts.join(' · ');

    var pre = document.createElement('pre');
    var code = document.createElement('code');
    code.className = 'language-' + (fileData.language || 'plaintext');
    code.textContent = fileData.content;
    pre.appendChild(code);

    codeContent.innerHTML = '';
    codeContent.appendChild(pre);

    if (!pendingHighlight) clearDiff();

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
    var oldLines = data.diff.oldString ? data.diff.oldString.split('\n').length : 0;
    var newLines = data.diff.newString ? data.diff.newString.split('\n').length : 0;
    var fname = window.escapeHtml('Edit: ' + (data.fileName || ''));
    var badge = ' <span style="color:var(--text-dim);font-weight:400">'
      + '<span style="color:#6ee7b7">+' + newLines + '</span> / '
      + '<span style="color:#fca5a5">-' + oldLines + '</span></span>';
    diffFilename.innerHTML = fname + badge;
    diffTime.textContent = data.time ? window.formatTime(data.time) : '';

    var lang = data.language || 'plaintext';
    var lines = [];
    // 삭제된 줄
    if (data.diff.oldString) {
      data.diff.oldString.split('\n').forEach(function(line) {
        lines.push('<div class="diff-line-old"><span class="diff-prefix">- </span><code class="language-' + lang + '">' + window.escapeHtml(line) + '</code></div>');
      });
    }
    // 구분선
    lines.push('<hr class="diff-separator">');
    // 추가된 줄
    if (data.diff.newString) {
      data.diff.newString.split('\n').forEach(function(line) {
        lines.push('<div class="diff-line-new"><span class="diff-prefix">+ </span><code class="language-' + lang + '">' + window.escapeHtml(line) + '</code></div>');
      });
    }

    diffContent.innerHTML = lines.join('');

    var totalDiffLines = (data.diff.oldString ? data.diff.oldString.split('\n').length : 0)
      + (data.diff.newString ? data.diff.newString.split('\n').length : 0);
    if (typeof Prism !== 'undefined' && lang !== 'plaintext' && totalDiffLines <= 1000) {
      requestAnimationFrame(function() {
        diffContent.querySelectorAll('code[class^="language-"]').forEach(function(el) {
          Prism.highlightElement(el);
        });
      });
    }
  }

  // ─── Browser Viewer ───────────────────────────────
  function displayScreenshot(data) {
    browserViewer.classList.add('visible');
    screenshotTime.textContent = data.time ? window.formatTime(data.time) : '';
    browserContent.innerHTML = '<img src="/screenshots/' + encodeURIComponent(data.fileName) + '?t=' + Date.now() + '" alt="Browser screenshot">';
  }

  // ─── Tool Output Viewer ────────────────────────────
  function displayOutput(data) {
    var title = data.name || 'Output';
    if (data.target) title += ': ' + data.target.split(/[/\\]/).pop();
    codeFilename.textContent = title;
    var lines = (data.output || '').split('\n');
    codeInfo.textContent = lines.length + ' lines';

    var pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-word';
    var code = document.createElement('code');
    code.className = 'language-plaintext';
    code.textContent = data.output || '(no output)';
    pre.appendChild(code);

    codeContent.innerHTML = '';
    codeContent.appendChild(pre);

    pendingHighlight = null;
    clearDiff();
  }

  // ─── window 노출 ──────────────────────────────────
  window.displayCode = displayCode;
  window.displayDiff = displayDiff;
  window.displayScreenshot = displayScreenshot;
  window.displayOutput = displayOutput;
  window.requestFileContent = requestFileContent;
  window.fileCache = fileCache;

  // pendingHighlight를 feed.js에서 설정할 수 있도록 노출
  Object.defineProperty(window, 'pendingHighlight', {
    get: function() { return pendingHighlight; },
    set: function(v) { pendingHighlight = v; }
  });
})();
