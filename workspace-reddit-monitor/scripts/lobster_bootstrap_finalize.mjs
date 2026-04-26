#!/usr/bin/env node
/**
 * Chained after a dry `monitor-digest` run: set first_bootstrap_dry, print crontab hint.
 * Stdin: last step JSON (post_digest). LOBSTER_ARGS_JSON: workspace_root, force (optional)
 */
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { getMetaValue, setMetaValue } from "./lib/db.mjs";
import { readMonitorConfig } from "./lib/read_config.mjs";
import { loadLobsterArgs } from "./lib/lobster_args.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultWs = join(__dirname, "..");

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 0));
}

/**
 * @param {number} minutes
 * @param {string} pathHint
 */
function cronHint(minutes, pathHint) {
  const m = Math.max(15, Math.min(10080, minutes | 0));
  let spec = "";
  if (m % 60 === 0) {
    const h = m / 60;
    if (h >= 1 && h <= 24) spec = `0 */${h} * * *  # ~every ${h}h`;
    else spec = `0 */3 * * *  # example (adjust; config says ${m} min)`;
  } else {
    if (m >= 1 && m <= 59) spec = `*/${m} * * * *  # every ${m} min`;
    else spec = `*/30 * * * *  # example (adjust; config says ${m} min)`;
  }
  return [
    "## Schedule reminder",
    `From config: monitor every **${m}** minutes (see \`config/monitor.yml\` and \`config/SCHEDULE.md\`).`,
    "OpenClaw may support scheduled invocations; otherwise use **cron** or a systemd timer to trigger the same **lobster** + \`monitor-digest.lobster\` your agent would run, or a small wrapper that hits your gateway. Do **not** put API secrets in the command line.",
    `Example crontab line (placeholders only): \`${spec} <your-wrapper>\` (workspace: \`${pathHint}\`)`,
    "",
  ].join("\n");
}

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  const a = loadLobsterArgs();
  const workspaceRoot = a.workspace_root || process.cwd() || defaultWs;
  const force = a.force === true;

  let pre = { ok: false };
  try {
    pre = JSON.parse(raw);
  } catch (e) {
    out({ ok: false, error: "Invalid stdin from post_digest", detail: String(e) });
    return;
  }

  if (!pre.ok) {
    out({ ok: false, step: "bootstrap_finalize", post_digest: "not ok" });
    return;
  }

  if (!pre.dryRun) {
    out({
      ok: true,
      step: "bootstrap_finalize",
      skipped: true,
      message: "Last step was not a dry run; no bootstrap flag set.",
    });
    return;
  }

  const previous = getMetaValue(workspaceRoot, "first_bootstrap_dry");
  if (!previous || force) {
    setMetaValue(workspaceRoot, "first_bootstrap_dry", new Date().toISOString());
  }

  const cfg = readMonitorConfig(workspaceRoot);
  const scheduleText = cronHint(cfg.monitor_interval_minutes, "workspace-reddit-monitor");
  out({
    ok: true,
    step: "bootstrap_finalize",
    first_bootstrap_dry: true,
    scheduleMarkdown: scheduleText,
    next:
      "When ready, run a **real** monitor (dry_run false) or ask the operator to set cron per config/SCHEDULE.md.",
  });
}

main().catch((e) => {
  out({ ok: false, error: String(e) });
});
