# OpenClaw Reddit Monitor Agent

An `openclaw` + `ai agent` setup for monitoring subreddits, generating helpful draft replies, and keeping a human in control before posting.

If you are searching for an **openclaw reddit** workflow or a practical **reddit ai** assistant, this repo is built for that.

## What This Project Does

This **OpenClaw AI agent** helps you:

- Watch one or more subreddits for new posts
- Send digest summaries to Telegram (or message output fallback)
- Generate **2 short draft comment options** per target post
- Let you approve exactly one draft (`draft-1` or `draft-2`)
- Post via browser automation only after approval
- Store memory/state in SQLite (`memory/reddit_monitor.db`)

## Key Features

- **Lobster-first pipelines** for repeatable, deterministic flow
- **Human-in-the-loop** posting safety (`approve` required before comment post)
- **Two draft options every cycle** so you can choose the better response
- **Thread-aware drafting** using post context + existing comment samples
- **Persona control** via `config/identity.md` and `config/writing_style.md`
- **Dry-run bootstrap** before production runs
- **Command surface** (`view drafts`, `digest`, `status`, `help`)
- **Security guide included** (`workspace-reddit-monitor/SECURITY.md`)

## Who This Is For (Use Cases)

- Community helpers answering technical setup/config questions across tools and platforms
- Experts in any domain (developer tools, AI, security, infra, product, etc.) who want to customize persona + style and assist Reddit communities
- Builders running a personal **openclaw reddit ai agent** or adapting the same workflow for broader **reddit ai** support
- Teams testing safe social workflows before full automation
- Anyone who wants Reddit monitoring + assisted responses without removing human approval

## Folder Overview

| Path | Purpose |
|------|---------|
| [`workspace-reddit-monitor/`](workspace-reddit-monitor/) | Main agent workspace (pipelines, scripts, config, memory) |
| [`workspace-reddit-monitor/config/`](workspace-reddit-monitor/config/) | Monitor settings, identity, writing style, schedule |
| [`workspace-reddit-monitor/pipelines/`](workspace-reddit-monitor/pipelines/) | Lobster pipelines (`monitor`, `bootstrap`, `command`, approval/post flow) |
| [`openclaw.json.example`](openclaw.json.example) | Example local OpenClaw config to merge into your machine |
| [`scripts/install-reddit-monitor.mjs`](scripts/install-reddit-monitor.mjs) | Helper installer for copying workspace + merging config |

## Step-by-Step Install (Non-Technical Friendly)

### 1) Install OpenClaw First

Follow the official docs: [OpenClaw](https://docs.openclaw.ai/).

Complete onboarding once so your local config exists:

- default path is usually `~/.openclaw/openclaw.json`

### 2) Download This Repo

Clone or download this repository to your computer.

### 3) Open Terminal in `reddit-monitor-agent/`

Run:

```bash
node scripts/install-reddit-monitor.mjs
```

What this does for you:

- copies `workspace-reddit-monitor/` into your OpenClaw home
- runs **`npm install`** there (installs **`better-sqlite3`**) and **`node scripts/init_db.mjs`** (database init)
- merges `openclaw.json.example` into your local OpenClaw config
- creates a backup of your previous config

**In-tree or manual copy:** if you are not using the installer, run **`npm install`** and **`node scripts/init_db.mjs`** inside `workspace-reddit-monitor/`. `better-sqlite3` is a native module and may need a C++ build toolchain (e.g. Xcode CLT on macOS) on first install.

**If Lobster errors with `NODE_MODULE_VERSION` / `ERR_DLOPEN_FAILED` on `better_sqlite3.node`:** the copy under `~/.openclaw/workspace-reddit-monitor` was built for a different `node` than the one the gateway uses (e.g. install used nvm 25, Lobster uses `/usr/local/bin` Node 20). In that folder run **`PATH="/usr/local/bin:$PATH" npm rebuild better-sqlite3`** (on Apple Silicon Homebrew, try **`PATH="/opt/homebrew/bin:$PATH"`**), or re-run the install script with **`REDDIT_MONITOR_NODE=/path/to/same/node/as/gateway node scripts/install-reddit-monitor.mjs`** so the post-install **rebuild** and **`init_db`** use the right binary.

### 4) Add Your Telegram Bot Token (Optional but Recommended)

Set token/env in your OpenClaw gateway environment. Recommended variable:

- `TELEGRAM_BOT_TOKEN_REDDIT_MONITOR`

For auto-digest sending, also set:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (or `TELEGRAM_USER_ID`)

### 5) Browser (default profile)

The agent is written to use OpenClaw’s **default** browser profile (`browser.defaultProfile` in `openclaw.json`, e.g. as in `openclaw.json.example`). Log into Reddit in that profile in your environment; do not require the agent to pass a named `profile` on each browser call.

Reference: [OpenClaw Browser](https://docs.openclaw.ai/tools/browser)

### 6) Configure Your Defaults

Edit these files:

- `workspace-reddit-monitor/config/monitor.yml` (subreddits + intervals)
- `workspace-reddit-monitor/config/identity.md` (persona identity)
- `workspace-reddit-monitor/config/writing_style.md` (response style)

### 7) Run First Dry Bootstrap (Safe Test)

Use either:

- Lobster pipeline: `pipelines/bootstrap-dry.lobster`
- or CLI:

```bash
node workspace-reddit-monitor/scripts/lobster_bootstrap_dry.mjs
```

This tests the flow without writing normal run state.

### 8) Run Real Monitor

Run `monitor-digest.lobster` with your absolute workspace path (`workspace_root`).

After new posts are found, the agent can create `draft-1` and `draft-2` for you to approve.

## Daily Usage

- `view drafts` — see open draft options
- `view draft 1` — inspect one draft body
- `digest` — show last digest
- `status` — check monitor config/health
- `approve draft-1` — approve one draft for posting

## Security Notes (Read Before Production)

- Start with `workspace-reddit-monitor/SECURITY.md`
- Keep secrets in environment variables, not repo files
- Keep tool/plugin allowlists minimal
- Do not bypass Reddit auth, captcha, or rate limits
- Maintain HITL approval before posting

## Uninstall

From `reddit-monitor-agent/`:

```bash
node scripts/uninstall-reddit-monitor.mjs
```

## Keywords

`openclaw`, `ai agent`, `reddit ai`, `openclaw reddit`

## License

Use and modify in line with your parent project’s license.
# openclaw-reddit-monitor-ai-agent
