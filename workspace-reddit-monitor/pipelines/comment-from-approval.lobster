# Approve / reject / edit pending Reddit comment drafts (Telegram or chat)
#
# From OpenClaw agent: call the lobster tool with:
#   pipeline: "{absolute path}/pipelines/comment-from-approval.lobster"
#   argsJson: {"workspace_root":"...","message_text":"approve draft-1"}
#
# cwd must be workspace_root.

name: comment-from-approval
description: Parse approve|reject|edit for open draft-N rows in SQLite

cwd: ${workspace_root}

args:
  workspace_root:
    description: Absolute path to this agent workspace
  message_text:
    description: "User message, e.g. approve draft-1, reject draft-2, edit draft-1: new body"
    default: ""

steps:
  - id: approval
    command: node scripts/lobster_comment_approval.mjs
