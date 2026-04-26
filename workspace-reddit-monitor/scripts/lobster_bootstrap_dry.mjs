#!/usr/bin/env node
/**
 * Local bootstrap without relying on the Lobster runner merging args:
 * sets LOBSTER_ARGS_JSON with dry_run, pipes pre -> fetch -> post -> finalize.
 * Usage: node scripts/lobster_bootstrap_dry.mjs
 * Stdin JSON optional: { "workspace_root": "..." , "force": true }
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { loadLobsterArgs } from "./lib/lobster_args.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultWs = join(__dirname, "..");

function readStdinJson() {
  try {
    const r = readFileSync(0, "utf8").trim();
    if (r) return JSON.parse(r);
  } catch {
    // ignore
  }
  return {};
}

function run() {
  const extra = { ...loadLobsterArgs(), ...readStdinJson() };
  const workspaceRoot = extra.workspace_root || process.cwd() || defaultWs;
  const force = extra.force === true;
  const argsJson = JSON.stringify({
    workspace_root: workspaceRoot,
    dry_run: true,
    force,
  });
  const env = { ...process.env, LOBSTER_ARGS_JSON: argsJson };
  const opts = { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env, cwd: workspaceRoot };

  const pre = execFileSync(process.execPath, [join(__dirname, "lobster_monitor_pre.mjs")], opts);
  const fe = execFileSync(process.execPath, [join(__dirname, "lobster_monitor_fetch.mjs")], { ...opts, input: pre });
  const po = execFileSync(process.execPath, [join(__dirname, "lobster_monitor_post.mjs")], { ...opts, input: fe });
  const fin = execFileSync(
    process.execPath,
    [join(__dirname, "lobster_bootstrap_finalize.mjs")],
    { ...opts, input: po }
  );
  process.stdout.write(fin);
}

run();
