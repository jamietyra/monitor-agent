# monitor-agent

Real-time activity dashboard for [Claude Code](https://claude.ai/code). Watch prompts, tool calls, file changes, and code diffs as they happen.

[한국어](README.ko.md)

<p align="center">
  <img src="preview.svg" alt="monitor-agent dashboard preview" width="100%">
</p>

## Features

- **Prompt-grouped Activity Feed** — Tool calls are grouped under the user prompt that triggered them, with collapsible groups
- **Session Filter Buttons** — Auto-detected, color-coded pill buttons to filter by project (e.g. main, web-app, api-server)
- **Search / Filter Bar** — Search across prompts, filenames, and commands
- **Code Viewer** — Displays file contents with syntax highlighting when Claude reads or edits files
- **Diff Viewer** — Click any past Edit item to review exactly what changed (red = removed, green = added)
- **Assistant Text Responses** — Shown inline with a green dot indicator
- **Panel Resize** — Drag the handle between panels to adjust layout
- **Multi-session Support** — Loads all transcripts from the last 7 days across sub-projects
- **Long-term Event Retention** — Keeps a large rolling window of recent events in memory
- **Auto Session Detection** — Detects new Claude Code sessions every 10 seconds without restart
- **Zero Dependencies** — Pure Node.js built-in modules only, no `npm install` needed

## Quick Start

```bash
git clone https://github.com/jamietyra/monitor-agent.git
cd monitor-agent
node server.mjs
```

Then open **http://localhost:3456** in your browser.

### VS Code Tip

Use VS Code's built-in Simple Browser for a side-by-side view:

`Ctrl+Shift+P` → `Simple Browser: Show` → `http://localhost:3456`

### Monitor a Specific Directory

```bash
node server.mjs /path/to/your/project
```

By default, monitor-agent uses the current working directory to find Claude Code sessions.

## How It Works

Claude Code writes all activity to transcript JSONL files in `~/.claude/projects/`. monitor-agent watches these files via polling (1s interval) and streams parsed events to your browser via Server-Sent Events (SSE).

```
Claude Code → transcript.jsonl → monitor-agent (server.mjs) → SSE → Browser Dashboard
```

New sessions are automatically detected every 10 seconds, so you don't need to restart the server when starting a new Claude Code session.

## Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│  monitor-agent         실행중: 2  완료: 2472  에러: 188  │
├──────────────────────────────────────────────────────────┤
│  활동 피드                                               │
│  [검색 (프롬프트, 파일명, 명령어...)]                    │
│  [MAIN] [WEB-APP] [API-SERVER]                           │
│                                                          │
│  ▼ MAIN 10:30 Increase font size by 10%             [5] │
│    10:30:25 ✓ Read dashboard.html  95ms                  │
│    ● Done. All list items scaled up 10%.                 │
│  ▶ MAIN 10:15 Remove footer section                 [3] │
│  ▶ API-SERVER 09:45 Fix order API endpoint          [12] │
│                                                          │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ drag to resize ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│  Code Viewer: dashboard.html                    1007 줄  │
│  (syntax highlighted file contents)                      │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Diff: Edit dashboard.html                     17:20:14  │
│  - old code (red)                                        │
│  + new code (green)                                      │
├──────────────────────────────────────────────────────────┤
│  ● 연결됨                              이벤트: 2,662개  │
└──────────────────────────────────────────────────────────┘
```

## Requirements

- Node.js >= 18
- An active Claude Code session

## License

MIT
