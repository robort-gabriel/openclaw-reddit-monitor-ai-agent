# Monitor schedule and cron (operator guide)

- **`config/monitor.yml`** — `monitor_interval_minutes` documents how often you *intend* to run the digest (e.g. `180` = every 3 hours). The scripts do not install cron by themselves; you set that on the **host** or use OpenClaw’s own scheduling if available.

## First run (dry)

1. One-time: run **`bootstrap-dry.lobster`** (with absolute `pipeline` path) and `argsJson: { "workspace_root": "<ABS>" }`, **or** from the workspace:  
   `node scripts/lobster_bootstrap_dry.mjs`  
   with stdin: `{"workspace_root":"<ABS>"}` (optional; cwd can be the workspace).  
2. This performs a **dry** monitor: no `seen` updates, no digest written to DB, and prints a schedule reminder in the JSON. It sets `first_bootstrap_dry` in SQLite when successful.

## Ongoing

- For a **real** run, use `monitor-digest.lobster` with `dry_run` omitted or `false`.  
- **Cron (Linux/macOS)**: add a line that invokes **your** wrapper (shell script, `curl` to a gateway, or `openclaw` CLI if your version supports it). **Do not** put bot tokens in the crontab.

### Example (placeholders)

```text
# Every 3 hours (match monitor_interval_minutes: 180 if you use that)
0 */3 * * * /path/to/your/wrapper.sh
```

`wrapper.sh` should change to the machine’s workspace, then trigger the agent or gateway the same way you do manually. Adjust paths; test with a dry run first.

## Security

- Tokens belong in the environment of the long-running process (gateway) or a secrets manager — not in world-readable cron files when avoidable. See `SECURITY.md`.
