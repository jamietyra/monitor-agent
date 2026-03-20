# monitor-agent

Real-time activity dashboard for [Claude Code](https://claude.ai/code). Watch tool calls, file changes, and Playwright browser actions as they happen.

<p align="center">
  <img src="preview.svg" alt="monitor-agent dashboard preview" width="100%">
</p>

## Features

- **Activity Feed** — See every tool call (Read, Write, Edit, Bash, Grep, Agent...) in real-time with color-coded status
- **Code Viewer** — Automatically displays file contents with syntax highlighting when Claude reads or edits files. Click any file entry to view its code.
- **Browser View** — When Claude uses the [Playwright MCP plugin](https://github.com/anthropics/claude-code/tree/main/packages/playwright) to control a browser, screenshots are displayed in the dashboard
- **Multi-project** — Monitors all sub-projects under your working directory simultaneously
- **Zero dependencies** — Pure Node.js built-in modules only, no `npm install` needed

## Quick Start

```bash
git clone https://github.com/jamietyra/monitor-agent.git
cd monitor-agent
node server.mjs
```

Then open **http://localhost:3456** in your browser.

You can also use VS Code's built-in Simple Browser:
`Ctrl+Shift+P` → `Simple Browser: Show` → `http://localhost:3456`

## Usage

1. Start Claude Code in your project directory
2. In a separate terminal, run `node server.mjs` from the monitor-agent folder
3. Open `http://localhost:3456` in your browser
4. The dashboard automatically detects your active Claude Code session and updates in real-time

### Monitor a specific directory

```bash
node server.mjs /path/to/your/project
```

By default, monitor-agent uses the current working directory to find Claude Code sessions.

## How It Works

Claude Code writes all activity to transcript JSONL files in `~/.claude/projects/`. monitor-agent watches these files via polling (1s interval) and streams parsed events to your browser via Server-Sent Events (SSE).

```
Claude Code → transcript.jsonl → monitor-agent → SSE → Browser Dashboard
```

### Browser View

The Browser View panel appears when Claude uses the **Playwright MCP plugin** (`/plugin install playwright`). When Claude navigates pages, clicks elements, or takes screenshots via Playwright, those actions appear in the Activity Feed and screenshots are displayed in the dashboard.

> Note: This does NOT capture your personal Chrome browser. It only shows the browser that Claude controls through Playwright.

## Dashboard Layout

```
┌──────────────────────────────────────────────────────┐
│  monitor-agent              Running: 2  Done: 15     │
├──────────────┬───────────────────────────────────────┤
│              │                                       │
│  Activity    │  Code Viewer                          │
│  Feed        │  (syntax highlighted file contents)   │
│              │                                       │
│  ▶ Read ..   ├───────────────────────────────────────┤
│  ✓ Edit ..   │  Browser View                         │
│  ▶ Bash ..   │  (Playwright screenshots)             │
│              │                                       │
├──────────────┴───────────────────────────────────────┤
│  Projects: my-app, sub-project                       │
└──────────────────────────────────────────────────────┘
```

## Requirements

- Node.js >= 18
- An active Claude Code session
- (Optional) Playwright MCP plugin for Browser View

## License

MIT
