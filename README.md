# monitor-agent

Real-time activity dashboard for [Claude Code](https://claude.ai/code). Watch tool calls, file changes, and browser actions as they happen.

![monitor-agent dashboard](https://raw.githubusercontent.com/jamietyra/monitor-agent/main/preview.png)

## Features

- **Activity Feed** — See every tool call (Read, Write, Edit, Bash, Grep, Agent...) in real-time
- **Code Viewer** — Automatically displays file contents with syntax highlighting when Claude reads or edits files
- **Browser View** — Shows Playwright screenshots when Claude interacts with a browser
- **Multi-project** — Monitors all sub-projects under your working directory
- **Zero dependencies** — Pure Node.js, no `npm install` needed

## Quick Start

```bash
# Run from your project directory
npx monitor-agent

# Then open in your browser
# http://localhost:3456
```

Or clone and run directly:

```bash
git clone https://github.com/jamietyra/monitor-agent.git
cd monitor-agent
node server.mjs
```

## Usage

1. Start Claude Code in your project directory
2. Run `npx monitor-agent` in a separate terminal (or open VS Code's Simple Browser → `http://localhost:3456`)
3. The dashboard automatically detects your active Claude Code session
4. Watch the Activity Feed update in real-time as Claude works

### Options

```bash
# Monitor a specific directory
npx monitor-agent /path/to/your/project

# Custom port (default: 3456)
PORT=8080 npx monitor-agent
```

## How It Works

Claude Code writes all activity to transcript JSONL files in `~/.claude/projects/`. monitor-agent watches these files and streams parsed events to your browser via Server-Sent Events (SSE).

```
Claude Code → transcript.jsonl → monitor-agent → SSE → Browser Dashboard
```

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
│  ✓ Edit ..   │  Browser View                        │
│  ▶ Bash ..   │  (Playwright screenshots)             │
│              │                                       │
├──────────────┴───────────────────────────────────────┤
│  Projects: my-app, sub-project                       │
└──────────────────────────────────────────────────────┘
```

## Requirements

- Node.js >= 18
- An active Claude Code session

## License

MIT
