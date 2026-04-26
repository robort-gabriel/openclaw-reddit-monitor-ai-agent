# Memory directory

- **`reddit_monitor.db`** — SQLite: seen post IDs, last digest, per-day run log, open/posted comment drafts, HITL `comment_log`.
- **`lobster_memory_report.mjs`** (in `../scripts/`) — prints a human-readable dump of the database.

The legacy flat files (`last-digest.md`, `seen-post-ids.txt`, `pending/draft-*.md`) are replaced by the database above.

Pipelines use **`better-sqlite3`**. The database is created when you run the repo **install script** (`scripts/install-reddit-monitor.mjs` — see `README.md`). Do not use the `sqlite3` CLI on the DB file; use the scripts in `scripts/`.
