#!/usr/bin/env node
/**
 * monitor-agent Server
 * Claude Code 실시간 활동 대시보드 — http://localhost:3456
 *
 * 사용법: node dashboard-server.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3456;
const MAX_FILE_LINES = 1500;
const DEBOUNCE_MS = 100;
const HEARTBEAT_MS = 30000;

// ─── 세션 발견 ───────────────────────────────────────────

function cwdToProjectDir(cwd) {
  const dashed = cwd.replace(/\\/g, '-').replace(':', '-');
  return dashed.charAt(0).toLowerCase() + dashed.slice(1);
}

// 프로젝트 디렉토리명에서 짧은 이름 추출
// 마지막 2개 경로 세그먼트를 사용 (예: Jamie-IT → IT, IT-aika → aika)
function extractProjectName(dirName, baseName) {
  if (!baseName) {
    // baseName 없으면 마지막 세그먼트 반환
    const parts = dirName.split('-').filter(Boolean);
    return parts[parts.length - 1] || dirName.slice(0, 10);
  }
  // baseName 이후 부분 추출
  const lower = dirName.toLowerCase();
  const baseL = baseName.toLowerCase();
  if (lower === baseL) return dirName.split('-').filter(Boolean).pop() || 'root';
  if (lower.startsWith(baseL + '-')) {
    const after = dirName.slice(baseName.length + 1);
    return after || 'root';
  }
  return dirName.split('-').filter(Boolean).pop() || dirName.slice(0, 10);
}

function discoverAllTranscripts() {
  const claudeDir = path.join(os.homedir(), '.claude');
  const projectsDir = path.join(claudeDir, 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  // 현재 작업 디렉토리 기반으로 관련 프로젝트 탐지
  const workDir = process.argv[2] || process.cwd();
  const baseDirName = cwdToProjectDir(workDir);
  const results = [];

  const dirs = fs.readdirSync(projectsDir);
  for (const dir of dirs) {
    // 현재 폴더 및 하위 프로젝트만 매칭
    if (!dir.toLowerCase().startsWith(baseDirName.toLowerCase())) continue;

    const projectDir = path.join(projectsDir, dir);
    if (!fs.statSync(projectDir).isDirectory()) continue;

    const jsonlFiles = fs.readdirSync(projectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        full: path.join(projectDir, f),
        mtime: fs.statSync(path.join(projectDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (jsonlFiles.length > 0) {
      results.push({
        project: extractProjectName(dir, baseDirName),
        transcriptPath: jsonlFiles[0].full,
        dirName: dir,
      });
    }
  }

  return results;
}

// 단일 transcript 발견 (하위 호환)
function discoverTranscript(cwd) {
  const claudeDir = path.join(os.homedir(), '.claude');
  const projectDirName = cwdToProjectDir(cwd);
  const candidates = [
    projectDirName,
    projectDirName.charAt(0).toLowerCase() + projectDirName.slice(1),
    projectDirName.charAt(0).toUpperCase() + projectDirName.slice(1),
  ];
  for (const candidate of candidates) {
    const projectDir = path.join(claudeDir, 'projects', candidate);
    if (!fs.existsSync(projectDir)) continue;
    const jsonlFiles = fs.readdirSync(projectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({ full: path.join(projectDir, f), mtime: fs.statSync(path.join(projectDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (jsonlFiles.length > 0) return jsonlFiles[0].full;
  }
  return null;
}

// ─── JSONL 파싱 ─────────────────────────────────────────

function extractTarget(toolName, input) {
  if (!input) return undefined;
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'NotebookEdit': {
      const fp = input.file_path || input.path || input.notebook_path;
      if (fp) {
        // 상위 2단계 + 파일명 표시 (예: .claude/scripts/dashboard.html)
        const parts = fp.replace(/\\/g, '/').split('/');
        return parts.slice(-3).join('/');
      }
      return undefined;
    }
    case 'Glob':
    case 'Grep':
      return input.pattern;
    case 'Bash': {
      const cmd = input.command;
      if (!cmd) return undefined;
      return cmd.length > 100 ? cmd.slice(0, 100) + '...' : cmd;
    }
    case 'Agent':
    case 'Task': {
      const desc = input.description || input.prompt;
      const subType = input.subagent_type;
      if (subType && desc) return `${subType}: ${desc.slice(0, 35)}...`;
      if (subType) return subType;
      if (desc) return desc.slice(0, 50);
      return undefined;
    }
    case 'WebSearch':
      return input.query;
    case 'WebFetch':
      return input.url;
    case 'Skill':
      return input.skill;
    default:
      return undefined;
  }
}

function processEntry(entry, state) {
  const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date();
  const events = [];

  if (!state.sessionStart && entry.timestamp) {
    state.sessionStart = timestamp;
  }

  const content = entry.message?.content;
  if (!content || !Array.isArray(content)) return events;

  for (const block of content) {
    if (block.type === 'tool_use' && block.id && block.name) {
      const target = extractTarget(block.name, block.input);
      const isPlaywright = block.name.startsWith('mcp__plugin_playwright');
      const isAgent = block.name === 'Task' || block.name === 'Agent';
      const skip = ['TodoWrite', 'TaskCreate', 'TaskUpdate'].includes(block.name);

      if (!skip) {
        state.pendingTools.set(block.id, {
          name: block.name,
          target,
          startTime: timestamp,
          isAgent,
          isPlaywright,
          input: block.input,
        });

        const displayName = isPlaywright
          ? 'Playwright:' + block.name.split('__').pop()
          : isAgent ? 'Agent' : block.name;

        events.push({
          type: 'tool_start',
          name: displayName,
          target,
          time: timestamp.toISOString(),
          id: block.id,
          isPlaywright,
          filePath: (block.name === 'Read' || block.name === 'Edit' || block.name === 'Write')
            ? (block.input?.file_path || block.input?.path) : null,
        });
      }
    }

    if (block.type === 'tool_result' && block.tool_use_id) {
      const pending = state.pendingTools.get(block.tool_use_id);
      if (pending) {
        const duration = (timestamp - pending.startTime) / 1000;
        const isError = block.is_error === true;

        if (isError) state.errorCount++;
        else state.completedCount++;

        const displayName = pending.isPlaywright
          ? 'Playwright:' + pending.name.split('__').pop()
          : pending.isAgent ? 'Agent' : pending.name;

        const pendingFilePath = (pending.name === 'Read' || pending.name === 'Edit' || pending.name === 'Write')
          ? (pending.input?.file_path || pending.input?.path) : null;

        events.push({
          type: isError ? 'tool_error' : 'tool_done',
          name: displayName,
          target: pending.target,
          time: timestamp.toISOString(),
          duration,
          id: block.tool_use_id,
          isPlaywright: pending.isPlaywright,
          filePath: pendingFilePath,
        });

        // Playwright 스크린샷 감지
        if (pending.isPlaywright && pending.name.includes('screenshot')) {
          events.push({ type: 'screenshot_taken', time: timestamp.toISOString() });
        }

        state.pendingTools.delete(block.tool_use_id);
      }
    }
  }

  return events;
}

// ─── 파일 콘텐츠 읽기 ───────────────────────────────────

function readFileContent(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);

    // 바이너리/이미지 파일 제외 (5MB 초과도 제외)
    if (stat.size > 5 * 1024 * 1024) return { truncated: true, reason: 'too_large', size: stat.size };

    const ext = path.extname(filePath).toLowerCase();
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.mp3', '.mp4', '.zip', '.exe', '.dll', '.so', '.wasm'];
    if (binaryExts.includes(ext)) return { truncated: true, reason: 'binary', ext };

    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n');
    const truncated = lines.length > MAX_FILE_LINES;
    const content = truncated ? lines.slice(0, MAX_FILE_LINES).join('\n') : raw;

    // 확장자 → Prism 언어 매핑
    const langMap = {
      '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
      '.ts': 'typescript', '.tsx': 'tsx', '.jsx': 'jsx',
      '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
      '.java': 'java', '.kt': 'kotlin', '.swift': 'swift',
      '.cs': 'csharp', '.cpp': 'cpp', '.c': 'c', '.h': 'c',
      '.html': 'html', '.css': 'css', '.scss': 'scss',
      '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
      '.md': 'markdown', '.xml': 'xml', '.sql': 'sql',
      '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
      '.bat': 'batch', '.cmd': 'batch', '.ps1': 'powershell',
      '.toml': 'toml', '.ini': 'ini', '.cfg': 'ini',
      '.vue': 'html', '.svelte': 'html',
    };

    return {
      content,
      language: langMap[ext] || 'plaintext',
      totalLines: lines.length,
      truncated,
      fileName: path.basename(filePath),
      filePath,
    };
  } catch {
    return null;
  }
}

// ─── SSE 관리 ───────────────────────────────────────────

const clients = new Set();
let eventId = 0;

function broadcast(eventType, data) {
  eventId++;
  const payload = `id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

// ─── Transcript 감시 ────────────────────────────────────

function watchTranscript(transcriptPath, state, projectName) {
  let byteOffset = 0;
  let lineBuf = '';
  let debounceTimer = null;

  function readNewLines() {
    let stat;
    try { stat = fs.statSync(transcriptPath); } catch { return []; }
    if (stat.size <= byteOffset) return [];

    const buf = Buffer.alloc(stat.size - byteOffset);
    const fd = fs.openSync(transcriptPath, 'r');
    fs.readSync(fd, buf, 0, buf.length, byteOffset);
    fs.closeSync(fd);
    byteOffset = stat.size;

    const chunk = lineBuf + buf.toString('utf8');
    const lines = chunk.split('\n');
    lineBuf = lines.pop() || '';

    const allEvents = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        const events = processEntry(entry, state);
        // 프로젝트 태그 추가
        for (const ev of events) { ev.project = projectName; }
        allEvents.push(...events);
      } catch { /* skip */ }
    }
    return allEvents;
  }

  // 초기 로드 — 최근 이벤트
  const initialEvents = readNewLines();
  const recentEvents = initialEvents.slice(-30);

  // 새 이벤트 처리 + 브로드캐스트
  function processAndBroadcast() {
    const newEvents = readNewLines();
    if (newEvents.length === 0) return;

    for (const ev of newEvents) {
      broadcast('activity', ev);

      if (ev.type === 'tool_start' && ev.filePath) {
        const fileData = readFileContent(ev.filePath);
        if (fileData && fileData.content) {
          broadcast('file_content', fileData);
        }
      }

      if (ev.type === 'screenshot_taken') {
        checkForNewScreenshot();
      }
    }

    broadcast('stats', {
      running: state.pendingTools.size,
      completed: state.completedCount,
      errors: state.errorCount,
      sessionStart: state.sessionStart?.toISOString(),
    });
  }

  setInterval(processAndBroadcast, 1000);

  let watcher;
  try {
    watcher = fs.watch(transcriptPath, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processAndBroadcast, DEBOUNCE_MS);
    });
  } catch { /* 폴링이 백업 */ }

  return { recentEvents, watcher };
}

// ─── 스크린샷 감지 ──────────────────────────────────────

const screenshotsDir = path.join(__dirname, 'screenshots');

function checkForNewScreenshot() {
  try {
    if (!fs.existsSync(screenshotsDir)) return;
    const files = fs.readdirSync(screenshotsDir)
      .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(screenshotsDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > 0) {
      broadcast('screenshot', { fileName: files[0].name, time: new Date().toISOString() });
    }
  } catch { /* ignore */ }
}

// ─── HTTP 서버 ──────────────────────────────────────────

const state = {
  pendingTools: new Map(),
  completedCount: 0,
  errorCount: 0,
  sessionStart: null,
};

// 모든 IT 하위 프로젝트 transcript 감시
const allTranscripts = discoverAllTranscripts();
let allRecentEvents = [];

if (allTranscripts.length === 0) {
  console.error('Claude Code transcript를 찾을 수 없습니다.');
  console.error('Claude Code를 먼저 실행한 후 다시 시도해주세요.');
  process.exit(1);
}

for (const t of allTranscripts) {
  const { recentEvents } = watchTranscript(t.transcriptPath, state, t.project);
  allRecentEvents.push(...recentEvents);
}

// 시간순 정렬 후 최근 50개만
allRecentEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
allRecentEvents = allRecentEvents.slice(-50);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // SSE 엔드포인트
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.req.socket.setTimeout(0);

    // 초기 데이터 전송
    const initData = {
      recentEvents: allRecentEvents,
      stats: {
        running: state.pendingTools.size,
        completed: state.completedCount,
        errors: state.errorCount,
        sessionStart: state.sessionStart?.toISOString(),
      },
      projects: allTranscripts.map(t => t.project),
    };
    res.write(`event: init\ndata: ${JSON.stringify(initData)}\n\n`);

    clients.add(res);
    res.on('close', () => clients.delete(res));

    // Heartbeat
    const heartbeat = setInterval(() => {
      try { res.write(':\n\n'); } catch { clearInterval(heartbeat); }
    }, HEARTBEAT_MS);
    res.on('close', () => clearInterval(heartbeat));

    return;
  }

  // 파일 내용 API (클릭 시 요청)
  if (url.pathname === '/api/file') {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'path required' }));
      return;
    }
    const fileData = readFileContent(filePath);
    if (fileData && fileData.content) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(fileData));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'file not found or binary' }));
    }
    return;
  }

  // 스크린샷 파일 서빙
  if (url.pathname.startsWith('/screenshots/')) {
    const fileName = path.basename(url.pathname);
    const filePath = path.join(screenshotsDir, fileName);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(fileName).toLowerCase();
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // 메인 HTML
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'dashboard.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(htmlPath).pipe(res);
    } else {
      res.writeHead(500);
      res.end('dashboard.html not found');
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.requestTimeout = 0;

server.listen(PORT, () => {
  console.log('');
  console.log('  monitor-agent');
  console.log(`  http://localhost:${PORT}`);
  console.log('');
  console.log(`  Projects: ${allTranscripts.map(t => t.project).join(', ')}`);
  console.log(`  SSE clients: 0`);
  console.log('');
  console.log('  Ctrl+C로 종료');
  console.log('');
});

// 연결 수 추적
setInterval(() => {
  process.title = `monitor-agent (${clients.size} clients)`;
}, 5000);

process.on('SIGINT', () => {
  console.log('\n  대시보드 종료');
  server.close();
  process.exit(0);
});
