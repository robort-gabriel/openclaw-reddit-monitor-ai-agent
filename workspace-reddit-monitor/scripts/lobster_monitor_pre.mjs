#!/usr/bin/env node
/**
 * Step 1 — load config + seen guids. Stdout JSON for fetch step.
 * Cwd must be workspace root (Lobster cwd: ${workspace_root}).
 * Optional: LOBSTER_ARGS_JSON `dry_run: true` to skip later DB writes and seen-marking.
 */
import { readMonitorConfig, readSeenGuids } from "./lib/read_config.mjs";
import { isDryRun } from "./lib/lobster_args.mjs";

const workspaceRoot = process.cwd();
const config = readMonitorConfig(workspaceRoot);
const seen = readSeenGuids(workspaceRoot);

const out = {
  ok: true,
  step: "pre",
  workspaceRoot,
  config,
  seen: [...seen],
  dryRun: isDryRun(),
};
process.stdout.write(JSON.stringify(out));
