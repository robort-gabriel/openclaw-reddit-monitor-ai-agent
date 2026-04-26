# Lobster pipelines — Reddit monitor agent

This folder holds [Lobster](https://docs.openclaw.ai/tools/lobster) workflow files. The embedded runner in the OpenClaw Gateway executes them when the agent calls the **`lobster` tool** (not the standalone `lobster` shell binary).

## Workflows

| File | Purpose |
|------|--------|
| `monitor-digest.lobster` | `lobster_monitor_pre` → `fetch` → `post` (dedupe, SQLite, `threadContext` for first new post, `generateTwoDrafts` when applicable). Optional **`dry_run: true`**. |
| `bootstrap-dry.lobster` | `lobster_bootstrap_dry.mjs` — **dry** monitor in one chain + `bootstrap_finalize` (schedule text, `first_bootstrap_dry` in SQLite) |
| `reddit-command.lobster` | `lobster_reddit_command.mjs` — `view drafts`, `view draft N`, `digest`, `status`, `help` |
| `create-draft.lobster` | `lobster_upsert_draft.mjs` — create/replace an **open** draft row in `memory/reddit_monitor.db` (use for **draft-1** and **draft-2** with same `post_url` after the agent runs **llm-task** per `prompts/draft-pair.md`) |
| `comment-from-approval.lobster` | `lobster_comment_approval.mjs` — parse `approve draft-N` / `reject` / `edit draft-N: text` for open SQLite drafts |
| `post-approved-comment.lobster` | `lobster_post_comment.mjs` — load open draft from SQLite and print a **JSON browser recipe** (`stepsForAgent`, `browser.actFill` with `fields[]`, submit act, snapshot hints). Call this after approval so the agent does not improvise the control flow. |
| `archive-posted-comment.lobster` | `lobster_post_comment_archive.mjs` — mark draft as **posted** in SQLite; `comment_url` is **optional** (store permalink if you have it) |

## Enable (user config, outside this repo)

In your `openclaw.json` (e.g. `~/.openclaw/openclaw.json`):

1. Enable plugins **`lobster`** and **`llm-task`** (needed for the **two** generated drafts) under `plugins.entries`.
2. For agent `reddit-monitor`, set `tools.alsoAllow: ["lobster", "llm-task"]` and minimal other tools — see `reddit-monitor-agent/openclaw.json.example` in this repo. Read **`../workspace-reddit-monitor/SECURITY.md`** before going to production.

Do not commit tokens or live paths that contain secrets.

## Agent usage (non-negotiables)

- **`pipeline` value:** Use an **absolute filesystem path** to the `.lobster` file, e.g. `"/path/to/.../workspace-reddit-monitor/pipelines/monitor-digest.lobster"`. Relative paths or `run pipelines/...` will fail the embedded parser. See the [Lobster tool docs](https://docs.openclaw.ai/tools/lobster) and this workspace’s `AGENTS.md`.
- **`argsJson` for monitor:** must include at least:
  - `workspace_root`: the **absolute** path to this `workspace-reddit-monitor` directory (equals session `cwd` on the gateway when correctly configured).
  - optional **`dry_run`**: if `true`, do not write digest/seen, no Telegram. **`generateTwoDrafts` is false** in that mode (no auto draft creation). For first-run, prefer **`bootstrap-dry.lobster`**, which always runs a dry monitor and records bootstrap + schedule help.
- **`argsJson` for `reddit-command`:** `workspace_root` and `message_text` (e.g. `view drafts`, `help`).
- **`argsJson` for `bootstrap-dry`:** `workspace_root`; optional `force` to re-stamp `first_bootstrap_dry`.
- **`argsJson` for comment approval:** must include:
  - `workspace_root` (as above)
  - `message_text`: the user’s line, e.g. `approve draft-1`
- **`argsJson` for create-draft:** `workspace_root`, `draft_num` (integer), `post_url`, `body`.
- **`argsJson` for post-approved-comment:** `workspace_root` and `draft_id` (`"1"`, `"draft-1"`, etc. — must match an open row in `drafts`).
- **`argsJson` for archive-posted-comment:** `workspace_root` and `draft_id`. `comment_url` is optional; omit to mark posted without a stored link.

**First tool call for these triggers = `lobster` only** — do not read `SOUL.md` or `config/` before a scheduled monitor or approval run if your routing requires strict ordering (align with your `AGENTS.md`).

## Optional: Telegram auto-send

If the gateway process has `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (or `TELEGRAM_USER_ID`) in its environment, `lobster_monitor_post.mjs` will try `sendMessage`. Otherwise the JSON result instructs the agent to send the digest via the **message** tool.

## Testing locally

From the workspace root, with the Lobster CLI installed:

```bash
lobster run pipelines/monitor-digest.lobster --args-json '{"workspace_root":"'$(pwd)'"}'
```

(Adjust to your machine’s path if `cd` is not the workspace root.)
