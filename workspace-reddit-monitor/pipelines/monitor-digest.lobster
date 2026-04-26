# Reddit subreddit monitor — fetch → dedupe → digest + optional two-draft context
#
# argsJson: {"workspace_root":"...","dry_run": false}
# dry_run: true = no DB writes, do not mark posts seen, no Telegram (smoke / bootstrap)

name: monitor-digest
description: Load config, fetch new Reddit items, post digest to SQLite and optional thread context

cwd: ${workspace_root}

args:
  workspace_root:
    description: Absolute path to this agent workspace
  dry_run:
    description: If true, skip SQLite writes, seen list updates, and Telegram
    default: false
  force:
    description: (unused in this file; for bootstrap / overrides)

steps:
  - id: pre
    command: node scripts/lobster_monitor_pre.mjs
  - id: fetch
    command: node scripts/lobster_monitor_fetch.mjs
    stdin: $pre.stdout
  - id: post_digest
    command: node scripts/lobster_monitor_post.mjs
    stdin: $fetch.stdout
