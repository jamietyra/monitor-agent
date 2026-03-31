# monitor-agent

Real-time activity dashboard for [Claude Code](https://claude.ai/code). Watch prompts, tool calls, file changes, and code diffs as they happen.

[한국어](README.ko.md)

<p align="center">
  <img src="preview.svg" alt="monitor-agent dashboard preview" width="100%">
</p>

## Features

- **Activity Feed** — Every prompt, tool call, and response grouped in collapsible sections with search and session filters
- **Code Viewer + Diff Viewer** — Side-by-side file content and change tracking. Click any Edit to highlight changed lines
- **Multi-session** — Monitors all Claude Code sessions across sub-projects simultaneously
- **Instant Detection** — New sessions detected immediately via directory watchers
- **Remote Access** — Optional token-based authentication for accessing from other machines
- **Resizable Layout** — Drag to adjust panel sizes to your preference
- **Zero Dependencies** — Just `node server.mjs`. No npm install, no build step

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

Claude Code writes all activity to transcript JSONL files in `~/.claude/projects/`. monitor-agent watches these files and directories in real-time, streaming parsed events to your browser via Server-Sent Events (SSE).

```
Claude Code → transcript.jsonl → monitor-agent (server.mjs) → SSE → Browser Dashboard
```

New sessions are detected instantly via directory watchers, with a 60-second fallback scan.

## Dashboard Layout

```
┌──────────────────────────────────────────────────────────┐
│  monitor-agent       Running: 2  Done: 847  Errors: 3   │
├──────────────────────────────────────────────────────────┤
│  Feeds                                                   │
│  [Search (prompts, files, commands...)]                  │
│  [▶ All] [MAIN] [WEB-APP] [API-SERVER]                   │
│                                                          │
│  ▼ MAIN 10:30 Increase font size by 10%             [5] │
│    10:30:25 ✓ Read dashboard.html  95ms                  │
│    ● Done. All list items scaled up 10%.                 │
│  ▶ MAIN 10:15 Remove footer section                 [3] │
│  ▶ API-SERVER 09:45 Fix order API endpoint          [12] │
│                                                          │
├─ ─ ─ ─ ─ ─ ─ ─ ─ drag to resize ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│  Code Viewer                  │  Diff Viewer             │
│  dashboard.html  1007 lines   │  Edit: dashboard.html    │
│  (syntax highlighted code)    │  - old code (red)        │
│                               │  + new code (green)      │
├───────────────────────────────┴──────────────────────────┤
│  ● Connected                            Actions: 2,662   │
└──────────────────────────────────────────────────────────┘
```

## Remote Access

Enable remote access to the dashboard from other machines:

```bash
MONITOR_REMOTE=true MONITOR_TOKEN=your-secret-token node server.mjs
```

Then access from any machine: `http://your-server-ip:3456/?token=your-secret-token`

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MONITOR_PORT` | `3456` | Server port |
| `MONITOR_REMOTE` | `false` | Enable remote access (`true` to listen on 0.0.0.0) |
| `MONITOR_TOKEN` | (none) | Authentication token (required for remote access) |

Without `MONITOR_REMOTE=true`, the server only accepts connections from localhost.

## Requirements

- Node.js >= 18
- An active Claude Code session

## License

MIT
