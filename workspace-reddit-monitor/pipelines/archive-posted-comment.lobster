# After browser post: mark draft as posted in SQLite (comment_url optional)
#
# From OpenClaw agent: call the lobster tool with:
#   pipeline: "{absolute path}/pipelines/archive-posted-comment.lobster"
#   argsJson: {"workspace_root":"...","draft_id":"1" }
#   optional: "comment_url":"https://www.reddit.com/..."  (if you want the URL stored)
#
# cwd must be workspace_root.

name: archive-posted-comment
description: Mark a draft as posted in SQLite; optional comment_url

cwd: ${workspace_root}

args:
  workspace_root:
    description: Absolute path to this agent workspace
  draft_id:
    description: "Draft id, e.g. 1 or draft-1 (must be open in SQLite)"
  comment_url:
    description: Optional. Posted comment permalink (http/https). Omitted = still marks posted.

steps:
  - id: archive
    command: node scripts/lobster_post_comment_archive.mjs
