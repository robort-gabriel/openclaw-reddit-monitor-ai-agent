# Deterministic prepare step for posting an approved comment (browser = agent, recipe = JSON)
#
# Run after `comment-from-approval.lobster` returns approved_pending_browser, or when the user
# wants to post a specific pending draft without re-parsing the approval line.
#
# From OpenClaw agent: call the lobster tool with:
#   pipeline: "{absolute path}/pipelines/post-approved-comment.lobster"
#   argsJson: {"workspace_root":"...","draft_id":"1"}
#
# cwd must be workspace_root.

name: post-approved-comment
description: Read open draft from SQLite and emit a JSON browser recipe (fill with fields, submit)

cwd: ${workspace_root}

args:
  workspace_root:
    description: Absolute path to this agent workspace
  draft_id:
    description: "Pending draft id: e.g. 1, draft-1, or draft-2 (required)"

steps:
  - id: prepare
    command: node scripts/lobster_post_comment.mjs
