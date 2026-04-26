# Create or replace an open comment draft in SQLite (no .md file)
#
# argsJson: {"workspace_root":"...","draft_num":1,"post_url":"https://...","body":"…"}

name: create-draft
description: Upsert a pending draft row in SQLite (memory/reddit_monitor.db)

cwd: ${workspace_root}

args:
  workspace_root:
    description: Absolute path to this agent workspace
  draft_num:
    description: "Numeric id for draft (used in approve draft-N, etc.)"
  post_url:
    description: "Full post (thread) URL"
  body:
    description: Comment text (markdown as Reddit will accept)

steps:
  - id: upsert
    command: node scripts/lobster_upsert_draft.mjs
