// Prism syntax highlighting Web Worker.
// Main thread에서 큰 파일 하이라이팅 시 UI blocking 방지.

importScripts(
  '/vendor/prism/prism.min.js',
  '/vendor/prism/prism-javascript.min.js',
  '/vendor/prism/prism-typescript.min.js',
  '/vendor/prism/prism-jsx.min.js',
  '/vendor/prism/prism-tsx.min.js',
  '/vendor/prism/prism-python.min.js',
  '/vendor/prism/prism-csharp.min.js',
  '/vendor/prism/prism-json.min.js',
  '/vendor/prism/prism-css.min.js',
  '/vendor/prism/prism-bash.min.js',
  '/vendor/prism/prism-yaml.min.js',
  '/vendor/prism/prism-markdown.min.js',
  '/vendor/prism/prism-sql.min.js',
  '/vendor/prism/prism-go.min.js',
  '/vendor/prism/prism-rust.min.js',
  '/vendor/prism/prism-powershell.min.js'
);

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

self.onmessage = function(e) {
  var id = e.data.id;
  var code = e.data.code;
  var language = e.data.language;

  if (!self.Prism || !self.Prism.languages[language]) {
    self.postMessage({ id: id, html: escapeHtml(code), fallback: true });
    return;
  }

  try {
    var html = self.Prism.highlight(code, self.Prism.languages[language], language);
    self.postMessage({ id: id, html: html });
  } catch (err) {
    self.postMessage({ id: id, html: escapeHtml(code), err: err.message });
  }
};
