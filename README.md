# monitor-agent

> **🏐 Developing on the deserted island called Claude? Wilson keeps you company.**

[한국어](README.ko.md)

<p align="center">
  <img src="preview.svg?v=3" alt="monitor-agent dashboard preview" width="100%">
</p>

---

## 🏝️ The Story

Tom Hanks, stranded on a deserted island. No voice to talk to, no teammate, no signal.
His only friend was a volleyball he picked up on the beach, a face drawn on it with his own blood — **Wilson**.

Coding with Claude Code feels the same way.
The AI reads dozens of files, edits them, runs commands.
But what's it doing right now? Why? Is it actually doing the right thing? — **You can't see**.

**monitor-agent's Wilson** is your visualization companion on that island.
A volleyball character tells you the AI's mood through facial expressions, shows what it read and wrote, which errors happened, and how hard it's been working — all at a glance.

---

## 🙋‍♂️ Why I built this

Honest truth: this was built by **a beginner developer who barely knows how to code**.

AI writing code feels like a miracle, but I wanted to **see with my own eyes what it's actually doing**.

- Which file did it read?
- What did it change? Why did it change it?
- What Bash command is running right now?
- Did an error happen? How is it solving it?

That curiosity was the starting point for monitor-agent.
**"I trust it, but I still want to see."** — that's all there is to it.

---

## ✨ Features

### 🏐 Wilson — Your visualization agent

A volleyball-faced character named Wilson communicates AI status through **5 expressions**.

| State | Expression | Meaning |
|-------|------------|---------|
| `waiting` | Slow breathing | Nothing happening |
| `thinking` | Eye-rolling + gentle wobble | Prompt / tool started |
| `working` | Ball spinning (Y-axis; back is blank) | Tool done, integrating result |
| `solving` | Golden aura + crimson pulse | **Error — solving it** |
| `sleeping` | Eyes closed, breathing | 10 minutes idle |

### 📂 Recent Files

Timeline of recent Read / Write / Edit operations.
Click to load the file into the code viewer — with diff highlights if it was an Edit.

### 📡 Real-time Feeds

Every prompt, tool call, and response grouped in collapsible sections.
Search and session filter supported.

### 👀 Code + Diff Viewer

Side-by-side file content (PrismJS syntax highlighting) and change tracking.
**Bash / Glob output** is also viewable — click any completed tool to see its result.

### 🎨 Three Themes

- **Beige** (default) — warm analog paper feel
- **White** — clean light
- **Dark** — developer classic

Cycle with the `[Beige]` button in the header (fixed 84px). Choice is saved to `localStorage`.

### 🏷️ Shared Session Tags

Every project gets a consistent color slot (10-color palette, assigned via `localStorage`) so the same project's tag looks identical across `/agent` Feeds, `/usage` Sessions tree, and Top Projects. Spot a project at a glance, anywhere.

### 🧭 Header identity

The left-side **`Wilson`** brand stays warm red across both pages and all themes — it's the identity anchor. The centered title (`monitor-agent ↔` / `monitor-usage ↔`) is clickable and flips you between the two pages. The active model (e.g. `Model: Opus 4.6`) lives in the right side of the footer.

### 🌍 Multi-session + Remote Access

Monitors all Claude Code sessions across sub-projects simultaneously. Token-based authentication for remote access from other machines.

---

## 📊 monitor-usage — Cost & Token Analytics

A second page at `/usage` gives you long-term visibility into Claude's token and dollar usage.

<p align="center">
  <img src="preview.usage.svg?v=1" alt="monitor-usage dashboard preview" width="100%">
</p>

Click the **`monitor-agent`** title in the header to switch to `monitor-usage`; click **`monitor-usage`** to go back. The right-side panel swaps with a smooth slide-and-fade transition and the accent color shifts from the warm red to calm blue.

### What you can see

- **5 metric cards** — Cost / Tokens / Active Time / Sessions / Prompts with uniform delta colors (increase = red, decrease = green, same = gray).
- **Charts** — Daily Usage bar, Model Breakdown donut (Opus blue / Sonnet green / Haiku yellow), Top Projects list.
- **Month Grid** calendar — per-day tokens and cost, click a cell for the day drill-down modal.
- **Sessions tree** (left, below Wilson) — 2-level tree per project tag, labeled `[MM/DD | first prompt summary]`, with inline subagent breakdown.

### Accuracy note

Token cost is computed from Anthropic's public API rates (Opus 4.6 $15/$75 per M, Sonnet 4.6 $3/$15, Haiku 4.5 $1/$5) with proper cache-write/cache-read adjustments and per-event model resolution. **If you're on a Claude subscription plan this number is a theoretical "what-if" for pay-as-you-go API** — use it as a usage-intensity proxy, not an invoice.

---

## 🚀 Quick Start

```bash
git clone https://github.com/jamietyra/monitor-agent.git
cd monitor-agent
node server.mjs
```

Then open **http://localhost:3141** in your browser. (Port `3141` — from π.)

### IDE Tips

Open the dashboard side-by-side with your code:

- **VS Code / Cursor / Windsurf** (VS Code family):
  `Ctrl+Shift+P` → `Simple Browser: Show` → `http://localhost:3141`
- **JetBrains IDEs** (IntelliJ IDEA, WebStorm, PyCharm, etc.):
  Tools → Web Browsers → bind an external browser shortcut, or dock a browser pane on the right
- **Zed / Helix / opencode** and other terminal editors:
  Snap windows side-by-side — `Win + ←/→` on Windows, Rectangle/Spectacle on macOS, tiling WMs on Linux
- **Dual monitor** setup: park the dashboard on your secondary screen for the cleanest workflow

### Monitor a Specific Directory

```bash
node server.mjs /path/to/your/project
```

Defaults to the current working directory.

---

## ⚙️ How It Works

Claude Code writes all activity to transcript JSONL files in `~/.claude/projects/`.
monitor-agent watches these files in real-time and branches to two surfaces — a live SSE stream for the main dashboard, and a persistent aggregator for the `/usage` analytics page.

```
Claude Code → transcript.jsonl → monitor-agent (server.mjs)
                                       │
                                       ├─► SSE /events ─► /agent page
                                       │                  ├─► Wilson (5 states)
                                       │                  ├─► Feeds
                                       │                  ├─► Recent Files
                                       │                  └─► Code / Diff viewer
                                       │
                                       └─► Aggregator ─► cache/usage-index.json
                                                         (incremental scan,
                                                          byDate / byProject /
                                                          bySession / byModel)
                                                         │
                                                         └─► GET /api/usage ─► /usage page
                                                                              ├─► Metric Cards
                                                                              ├─► Daily / Model / Projects
                                                                              ├─► Month Grid calendar
                                                                              └─► Sessions tree
```

New sessions (and new subagent transcripts) are detected instantly via directory watchers, with a 60-second fallback scan. The `/api/usage` endpoint reuses its disk cache for fast reloads — only new events since the last scanCursor are parsed.

---

## 🌐 Remote Access

Enable access to the dashboard from other machines:

```bash
MONITOR_REMOTE=true MONITOR_TOKEN=your-secret-token node server.mjs
```

Access from any machine: `http://your-server-ip:3141/?token=your-secret-token`

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `MONITOR_PORT` | `3141` | Server port |
| `MONITOR_REMOTE` | `false` | Enable remote access (`true` to listen on 0.0.0.0) |
| `MONITOR_TOKEN` | (none) | Authentication token (required for remote access) |

Without `MONITOR_REMOTE=true`, the server only accepts connections from localhost.

---

## 📦 Requirements

- Node.js >= 18 (recommended: 22+)
- An active Claude Code session
- Zero dependencies (no `npm install` needed)

---

## 📝 License

MIT

---

## 💬 Credits

- Character inspiration: the film **Cast Away (2000)** — Tom Hanks and the volleyball Wilson
- Fonts: [Fraunces](https://fonts.google.com/specimen/Fraunces) (titles/sections), [Caveat](https://fonts.google.com/specimen/Caveat) (Wilson status)
- Syntax highlighting: [PrismJS](https://prismjs.com/)
- Theme inspiration: VSCode, and analog notebooks
