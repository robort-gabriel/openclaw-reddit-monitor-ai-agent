# Chat / Telegram one-off commands (view drafts, digest, help)
#
# argsJson: { "workspace_root": "...", "message_text": "view drafts" }

name: reddit-command
description: List or view drafts, show digest, help, or status (SQLite)

cwd: ${workspace_root}

args:
  workspace_root:
    description: Absolute path to this workspace
  message_text:
    description: "Command, e.g. help, view drafts, view draft 1, digest, status"
    default: "help"

steps:
  - id: cmd
    command: node scripts/lobster_reddit_command.mjs
