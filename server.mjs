#!/usr/bin/env node
/**
 * monitor-agent Server
 * Real-time activity dashboard for Claude Code — http://localhost:3456
 *
 * Usage: node server.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.MONITOR_PORT || '3456');
const MAX_FILE_LINES = 1500;
const DEBOUNCE_MS = 100;
const HEARTBEAT_MS = 30000;

// ─── Remote access mode ────────────────────────────────────
const REMOTE = process.env.MONITOR_REMOTE === 'true';
const TOKEN = process.env.MONITOR_TOKEN || '';
const HOST = REMOTE ? '0.0.0.0' : '127.0.0.1';

function authenticate(req, res) {
  if (!TOKEN) return true; // no token = no auth required
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const queryToken = url.searchParams.get('token');
  const headerToken = (req.headers.authorization || '').replace('Bearer ', '');
  if (queryToken === TOKEN || headerToken === TOKEN) return true;
  res.writeHead(401, { 'Content-Type': 'text/plain' });
  res.end('Unauthorized — token required');
  return false;
}

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

const MAX_EVENTS = 25555;
const RETENTION_DAYS = 7;

// ─── Byte-offset 캐시 (빠른 재시작용) ─────────────────────

const OFFSETS_PATH = path.join(__dirname, 'offsets.json');
const OFFSET_SAVE_INTERVAL_MS = 30000; // 30초마다 자동 저장

/** 메모리 내 offset 캐시: { "filename.jsonl": byteOffset, ... } */
let offsetCache = {};

function loadOffsets() {
  try {
    if (fs.existsSync(OFFSETS_PATH)) {
      const raw = fs.readFileSync(OFFSETS_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        offsetCache = parsed;
        console.log(`  Loaded ${Object.keys(offsetCache).length} cached offsets from offsets.json`);
      }
    }
  } catch {
    offsetCache = {};
  }
}

function saveOffsets() {
  try {
    fs.writeFileSync(OFFSETS_PATH, JSON.stringify(offsetCache, null, 2), 'utf8');
  } catch { /* 저장 실패 시 무시 — 다음 주기에 재시도 */ }
}

// 서버 시작 시 offset 로드
loadOffsets();

// 주기적 offset 저장 (30초)
const offsetSaveTimer = setInterval(saveOffsets, OFFSET_SAVE_INTERVAL_MS);

// ─── 세션 발견 함수 ─────────────────────────────────────

function discoverAllTranscripts() {
  const claudeDir = path.join(os.homedir(), '.claude');
  const projectsDir = path.join(claudeDir, 'projects');
  if (!fs.existsSync(projectsDir)) return [];

  const workDir = process.argv[2] || process.cwd();
  const baseDirName = cwdToProjectDir(workDir);
  const results = [];
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const dirs = fs.readdirSync(projectsDir);
  for (const dir of dirs) {
    if (!dir.toLowerCase().startsWith(baseDirName.toLowerCase())) continue;

    const projectDir = path.join(projectsDir, dir);
    if (!fs.statSync(projectDir).isDirectory()) continue;

    const jsonlFiles = fs.readdirSync(projectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        full: path.join(projectDir, f),
        mtime: fs.statSync(path.join(projectDir, f)).mtimeMs,
      }));

    for (const f of jsonlFiles) {
      if (f.mtime >= cutoff) {
        results.push({
          project: extractProjectName(dir, baseDirName),
          transcriptPath: f.full,
          dirName: dir,
          mtime: f.mtime,
        });
      }
      // 7일 초과 파일은 무시만 함 (삭제/이동 안 함)
    }
  }

  // 시간순 정렬 (오래된 것 먼저)
  results.sort((a, b) => a.mtime - b.mtime);
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
      return cmd;
    }
    case 'Agent':
    case 'Task': {
      const desc = input.description || input.prompt;
      const subType = input.subagent_type;
      if (subType && desc) return `${subType}: ${desc}`;
      if (subType) return subType;
      if (desc) return desc;
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

  // 사용자 프롬프트 감지
  if (entry.type === 'user' && entry.message?.role === 'user') {
    const content = entry.message.content;
    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      text = content.filter(b => b.type === 'text').map(b => b.text).join(' ');
    }
    // 시스템 메시지 제외
    if (text && !text.startsWith('<') && text.trim().length > 0) {
      state.promptId = (state.promptId || 0) + 1;
      events.push({
        type: 'prompt',
        text: text.slice(0, 200),
        time: timestamp.toISOString(),
        promptId: state.promptId,
      });
    }
  }

  // assistant 텍스트 응답 감지
  if (entry.message?.role === 'assistant' && Array.isArray(entry.message.content)) {
    for (const block of entry.message.content) {
      if (block.type === 'text' && block.text && block.text.trim().length > 0) {
        events.push({
          type: 'assistant_text',
          text: block.text.slice(0, 300),
          time: timestamp.toISOString(),
          promptId: state.promptId || 0,
        });
        break; // 첫 텍스트 블록만
      }
    }
  }

  const msgContent = entry.message?.content;
  if (!msgContent || !Array.isArray(msgContent)) return events;

  for (const block of msgContent) {
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

        const ev = {
          type: 'tool_start',
          name: displayName,
          target,
          time: timestamp.toISOString(),
          id: block.id,
          promptId: state.promptId || 0,
          isPlaywright,
          filePath: (block.name === 'Read' || block.name === 'Edit' || block.name === 'Write')
            ? (block.input?.file_path || block.input?.path) : null,
        };

        // Edit 도구: diff 데이터 추가
        if (block.name === 'Edit' && block.input) {
          ev.diff = {
            oldString: block.input.old_string || '',
            newString: block.input.new_string || '',
            replaceAll: block.input.replace_all || false,
          };
        }

        events.push(ev);
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

// ─── 프롬프트 단위 페이지네이션 ────────────────────────────

function sliceByPrompts(beforeIdx, promptLimit) {
  const end = Math.min(beforeIdx, allRecentEvents.length);

  // beforeIdx 이전의 모든 prompt 위치를 수집
  const promptPositions = [];
  for (let i = 0; i < end; i++) {
    if (allRecentEvents[i].type === 'prompt') {
      promptPositions.push(i);
    }
  }

  // 마지막 N개 prompt의 시작 위치에서 자르기
  // → 항상 prompt 이벤트에서 시작하므로 orphan 액션 없음
  let startIdx;
  if (promptPositions.length === 0) {
    startIdx = 0;
  } else if (promptPositions.length <= promptLimit) {
    startIdx = promptPositions[0];
  } else {
    startIdx = promptPositions[promptPositions.length - promptLimit];
  }

  return {
    events: allRecentEvents.slice(startIdx, end),
    startIdx,
    hasMore: startIdx > 0,
  };
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
  const cacheKey = path.basename(transcriptPath);
  // 초기 로드는 항상 0부터 (히스토리 전체 읽기)
  // offset 캐시는 초기 로드 후 실시간 감시에서만 사용
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

    // offset 캐시 갱신
    offsetCache[cacheKey] = byteOffset;

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
  const recentEvents = initialEvents.slice(-MAX_EVENTS);

  // 초기 로드 후 offset 저장
  offsetCache[cacheKey] = byteOffset;

  // 새 이벤트 처리 + 브로드캐스트
  function processAndBroadcast() {
    const newEvents = readNewLines();
    if (newEvents.length === 0) return;

    for (const ev of newEvents) {
      // 최근 이벤트 목록 갱신 (새로고침 시 최신 상태 유지)
      allRecentEvents.push(ev);
      if (allRecentEvents.length > MAX_EVENTS) allRecentEvents.shift();

      broadcast('activity', ev);

      if (ev.type === 'tool_start' && ev.filePath) {
        const fileData = readFileContent(ev.filePath);
        if (fileData && fileData.content) {
          broadcast('file_content', fileData);
        }
      }

      // Edit diff 전송
      if (ev.type === 'tool_start' && ev.diff) {
        broadcast('file_diff', {
          filePath: ev.filePath,
          fileName: ev.target,
          diff: ev.diff,
          time: ev.time,
        });
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

// 감시 중인 transcript 경로 추적
const watchedTranscripts = new Set();

function startWatchingTranscript(t) {
  if (watchedTranscripts.has(t.transcriptPath)) return;
  watchedTranscripts.add(t.transcriptPath);
  const { recentEvents } = watchTranscript(t.transcriptPath, state, t.project);
  allRecentEvents.push(...recentEvents);
  allRecentEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
  if (allRecentEvents.length > MAX_EVENTS) allRecentEvents = allRecentEvents.slice(-MAX_EVENTS);
  console.log(`  + New session: ${t.project} (${path.basename(t.transcriptPath).slice(0, 8)}...)`);
}

// ─── 디렉토리 감시 (fs.watch) + 폴백 스캔 ──────────────

const dirWatchers = new Map(); // dirPath → fs.FSWatcher

/**
 * 프로젝트 디렉토리에 fs.watch를 설정하여 새 .jsonl 파일 감지
 */
function watchProjectDirectory(dirPath) {
  if (dirWatchers.has(dirPath)) return;

  try {
    const watcher = fs.watch(dirPath, (eventType, filename) => {
      // 새 .jsonl 파일이 생겼을 때만 반응
      if (!filename || !filename.endsWith('.jsonl')) return;

      const fullPath = path.join(dirPath, filename);
      if (!fs.existsSync(fullPath)) return;

      // discoverAllTranscripts로 메타데이터 포함한 전체 발견 후 매칭
      const allCurrent = discoverAllTranscripts();
      for (const t of allCurrent) {
        if (t.transcriptPath === fullPath) {
          startWatchingTranscript(t);
          break;
        }
      }
    });

    dirWatchers.set(dirPath, watcher);
    console.log(`  👁 Watching dir: ${path.basename(dirPath)}`);
  } catch {
    // fs.watch 실패 시 무시 — 폴백 스캔이 커버함
  }
}

/**
 * 매칭되는 프로젝트 디렉토리들을 찾아서 fs.watch 설정
 */
function setupDirectoryWatchers() {
  const claudeDir = path.join(os.homedir(), '.claude');
  const projectsDir = path.join(claudeDir, 'projects');
  if (!fs.existsSync(projectsDir)) return;

  const workDir = process.argv[2] || process.cwd();
  const baseDirName = cwdToProjectDir(workDir);

  try {
    const dirs = fs.readdirSync(projectsDir);
    for (const dir of dirs) {
      if (!dir.toLowerCase().startsWith(baseDirName.toLowerCase())) continue;

      const projectDir = path.join(projectsDir, dir);
      try {
        if (fs.statSync(projectDir).isDirectory()) {
          watchProjectDirectory(projectDir);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  // projects 디렉토리 자체도 감시 — 새 프로젝트 폴더 생성 감지
  if (!dirWatchers.has(projectsDir)) {
    try {
      const parentWatcher = fs.watch(projectsDir, (eventType, filename) => {
        if (!filename) return;
        const newDir = path.join(projectsDir, filename);
        if (!filename.toLowerCase().startsWith(baseDirName.toLowerCase())) return;

        try {
          if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
            watchProjectDirectory(newDir);
          }
        } catch { /* skip */ }
      });
      dirWatchers.set(projectsDir, parentWatcher);
    } catch { /* skip */ }
  }
}

// 폴백: 60초마다 전체 스캔 (fs.watch가 놓칠 수 있는 경우 대비)
const FALLBACK_SCAN_INTERVAL_MS = 60000;

setInterval(() => {
  const current = discoverAllTranscripts();
  for (const t of current) {
    startWatchingTranscript(t);
  }
  // 새 디렉토리가 생겼을 수 있으므로 watcher도 갱신
  setupDirectoryWatchers();
}, FALLBACK_SCAN_INTERVAL_MS);

// 모든 IT 하위 프로젝트 transcript 감시
const allTranscripts = discoverAllTranscripts();
let allRecentEvents = [];

if (allTranscripts.length === 0) {
  console.log('  No active Claude Code sessions found. Watching for new sessions...');
} else {
  for (const t of allTranscripts) {
    startWatchingTranscript(t);
  }
}

// 디렉토리 감시 시작
setupDirectoryWatchers();

// 초기 로드 후 offset 저장
saveOffsets();

const server = http.createServer((req, res) => {
  if (!authenticate(req, res)) return;

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

    // 초기 데이터 전송 (최근 50 프롬프트)
    const PROMPT_PAGE = 50;
    const initEvents = sliceByPrompts(allRecentEvents.length, PROMPT_PAGE);
    const initData = {
      recentEvents: initEvents.events,
      totalEvents: allRecentEvents.length,
      startIdx: initEvents.startIdx,
      hasMore: initEvents.hasMore,
      stats: {
        running: state.pendingTools.size,
        completed: state.completedCount,
        errors: state.errorCount,
        sessionStart: state.sessionStart?.toISOString(),
      },
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

  // 이벤트 페이지네이션 API (프롬프트 단위)
  if (url.pathname === '/api/events') {
    const beforeIdx = parseInt(url.searchParams.get('before') || allRecentEvents.length);
    const promptLimit = Math.min(parseInt(url.searchParams.get('prompts') || 10), 50);
    const result = sliceByPrompts(beforeIdx, promptLimit);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
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

  // Dashboard static files
  const dashDir = path.join(__dirname, 'dashboard');
  const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const htmlPath = path.join(dashDir, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(htmlPath).pipe(res);
    } else {
      // fallback to legacy single file
      const legacyPath = path.join(__dirname, 'dashboard.html');
      if (fs.existsSync(legacyPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(legacyPath).pipe(res);
      } else {
        res.writeHead(500);
        res.end('dashboard not found');
      }
    }
    return;
  }

  // Serve CSS/JS from dashboard/
  const ext = path.extname(url.pathname);
  if (mimeTypes[ext]) {
    const filePath = path.join(dashDir, path.basename(url.pathname));
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] + '; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.requestTimeout = 0;

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  monitor-agent');
  console.log(`  http://${HOST}:${PORT}`);
  if (REMOTE) {
    console.log('  ⚠ Remote access: ON');
    console.log(TOKEN ? '  🔑 Token auth: ON' : '  ⚠ Token auth: OFF (unprotected!)');
  }
  console.log('');
  console.log(`  Projects: ${allTranscripts.map(t => t.project).join(', ')}`);
  console.log(`  Offset cache: ${Object.keys(offsetCache).length} entries`);
  console.log('');
  console.log('  Ctrl+C to stop');
  console.log('');
});

// 연결 수 추적
setInterval(() => {
  process.title = `monitor-agent (${clients.size} clients)`;
}, 5000);

process.on('SIGINT', () => {
  console.log('\n  Saving offsets before shutdown...');
  saveOffsets();

  // 디렉토리 watcher 정리
  for (const [, watcher] of dirWatchers) {
    try { watcher.close(); } catch { /* ignore */ }
  }

  clearInterval(offsetSaveTimer);
  console.log('  Dashboard stopped');
  server.close();
  process.exit(0);
});
