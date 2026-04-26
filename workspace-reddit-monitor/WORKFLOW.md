# WORKFLOW.md — Reddit monitor (Lobster)

All product paths that ship digests, draft pairs, or change approval state go through **Lobster** under `pipelines/`. **SQLite** is at `memory/reddit_monitor.db`. See `config/SCHEDULE.md` and `SECURITY.md` for host cron and hardening.

## Flow 0 — First install (once)

1. **Tool or CLI:** `lobster` with the absolute path to `pipelines/bootstrap-dry.lobster`, `argsJson: { "workspace_root": "<ABS>" }` — **or** `node scripts/lobster_bootstrap_dry.mjs` (stdin or cwd).
2. This runs a **dry** monitor, prints a crontab/schedule hint, and sets `first_bootstrap_dry` in SQLite. No `seen` advance, no digest persistence.

## Flow A — Monitor digest (real)

1. `lobster` with `monitor-digest.lobster`, `argsJson: { "workspace_root": "<ABS>" }` (omit `dry_run` or set `false`).
2. `pre` → `fetch` → `post`. `post` may include **`threadContext`** (public JSON for the first new post) and **`generateTwoDrafts: true`**.
3. If Telegram is not configured, the agent may **message** the digest.
4. If **`generateTwoDrafts`**: the agent uses **`llm-task`** (or the session model) with `prompts/draft-pair.md` + `config/identity.md` + `config/writing_style.md`, then saves **two** open drafts: **draft-1** and **draft-2** (same `post_url`).

## Flow A′ — Command surface

1. `lobster` with `reddit-command.lobster`, `message_text: "view drafts" | "help" | "digest" | "status" | "view draft 1"`.

## Flow B / B2 / C

- **B — approval:** `comment-from-approval.lobster` (same as before).
- **B2 — post approved comment:** `post-approved-comment.lobster` (pick **draft-1** or **draft-2**).
- **C — create-draft:** if not using the two generated options, `create-draft.lobster` for custom rows.

## Related

| Concern | Where |
|--------|--------|
| Subreddits, limits, thread comment depth | `config/monitor.yml` |
| How often to run; cron | `config/SCHEDULE.md` |
| Voice for generated drafts | `config/identity.md`, `config/writing_style.md` |
| Hardening | `SECURITY.md` |
| State | `memory/reddit_monitor.db` |
