# Bootstrap (one-time, after install)

**Do not use this file to install.** Run **`node scripts/install-reddit-monitor.mjs`** from the repo root (`reddit-monitor-agent/`) as described in **`README.md`** — that script copies the workspace, runs **`npm install`**, database init, and merges config.

1. Edit **`config/monitor.yml`**, **`config/identity.md`**, and **`config/writing_style.md`** to match how you want digests and the **two** generated drafts to sound.
2. Set your OpenClaw agent `workspace` in **your** `openclaw.json` to the **absolute path** of this `workspace-reddit-monitor` directory (e.g. under `~/.openclaw/` after install). Restart the gateway if required. See `../README.md`.
3. **First dry run (recommended):** run `node scripts/lobster_bootstrap_dry.mjs` (stdin: `{"workspace_root":"<absolute path to this folder>"}`) or call **`lobster`** with the absolute path to `pipelines/bootstrap-dry.lobster` and `argsJson: { "workspace_root": "<ABS>" }`. This does not advance “seen” ids or store the digest, but fetches a sample and prints schedule advice.
4. **Real monitor test:** `lobster` with `monitor-digest.lobster` and `argsJson: { "workspace_root": "<ABS>" }` (no `dry_run`). If the JSON shows `generateTwoDrafts`, have the agent run **llm-task** and create **draft-1** and **draft-2** (see `AGENTS.md`), then try **`reddit-command`**: `view drafts` and an approval `approve draft-1` with `comment-from-approval` if you want to exercise the full HITL path.
5. Optional: set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` on the gateway; see `AGENTS.md`.
6. Plan host scheduling from **`config/SCHEDULE.md`**; keep secrets in env per **`SECURITY.md`**.

Do not put secrets in this repo.
