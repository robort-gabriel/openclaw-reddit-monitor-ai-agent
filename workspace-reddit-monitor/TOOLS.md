# TOOLS.md — local conventions

- **Lobster** — Use **absolute** paths for:
  - `monitor-digest.lobster` (with optional `dry_run: true`)
  - `bootstrap-dry.lobster` (first run smoke)
  - `create-draft.lobster` (upserters for draft rows)
  - `comment-from-approval.lobster`, `post-approved-comment.lobster`, `archive-posted-comment.lobster`
  - **`reddit-command.lobster`** — `view drafts`, `help`, `digest`, `status`, `view draft 1`  
  See `pipelines/README.md`.
- **llm-task** — Required for the **two short drafts** after a successful **non-dry** monitor when `generateTwoDrafts` is true. Follow `prompts/draft-pair.md` and `config/identity.md` / `config/writing_style.md`.
- **Memory** — `memory/reddit_monitor.db`; `node scripts/lobster_memory_report.mjs` for a dump.
- **Browser** — **Default** profile only (`openclaw.json` → `browser.defaultProfile`); do not pass `profile` on tool calls. For posting, follow **`reddit.evaluateFn` + `text`** from the post recipe JSON. See `skills/reddit-comment-hitl`.
- **Config** — `config/monitor.yml` (feeds, limits, `thread_context_comment_limit`, `max_comment_length`, `monitor_interval_minutes` for schedule docs); **`config/identity.md`**, **`config/writing_style.md`**, `config/SCHEDULE.md`, **`SECURITY.md`**.
- **Reddit** — `scripts/lib/fetch_subreddit_rss.mjs` (new) and `fetch_reddit_thread.mjs` (public JSON for comment context; best-effort only).

## Skills

- `skills/reddit-comment-hitl` — HITL and composer quirks.
- `skills/reddit-browser-snapshot` — optional listings snapshot.
