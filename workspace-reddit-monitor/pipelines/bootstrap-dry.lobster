# One-time smoke: dry monitor + schedule hint; sets first_bootstrap_dry in SQLite
# Uses a single script so dry_run and piping are always correct.
#
# argsJson: { "workspace_root": "..." , "force": false }  (optional; cwd defaults to workspace)

name: bootstrap-dry
description: Run monitor in dry_run mode, finalize bootstrap, print cron/schedule help

cwd: ${workspace_root}

args:
  workspace_root:
    description: Absolute path to workspace-reddit-monitor
  force:
    description: Re-record bootstrap time even if already set
    default: false

steps:
  - id: chain
    command: node scripts/lobster_bootstrap_dry.mjs
