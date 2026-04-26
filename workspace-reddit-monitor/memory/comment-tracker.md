# Comment tracker (legacy)

**All HITL / draft / digest state now lives in SQLite:** `memory/reddit_monitor.db`.

- Run: `node scripts/lobster_memory_report.mjs` (stdin: `{"workspace_root":"<ABS_PATH>"}` or set cwd to the workspace) for open drafts, last digest, and `comment_log` rows.
- Create drafts: `pipelines/create-draft.lobster` (see `WORKFLOW.md`).

This file is kept so older docs that link here still have a pointer.
