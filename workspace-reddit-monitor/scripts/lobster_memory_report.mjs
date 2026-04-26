#!/usr/bin/env node
/**
 * Print a human-readable memory summary from SQLite to stdout.
 * Reads LOBSTER_ARGS_JSON or stdin JSON: workspace_root (optional; defaults cwd)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { buildMemoryReportText } from "./lib/db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultWs = join(__dirname, "..");

function loadArgs() {
  if (process.env.LOBSTER_ARGS_JSON) {
    try {
      return JSON.parse(process.env.LOBSTER_ARGS_JSON);
    } catch {
      /* fall through */
    }
  }
  try {
    const raw = readFileSync(0, "utf8").trim();
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function main() {
  const a = loadArgs();
  const workspaceRoot = a.workspace_root || process.cwd() || defaultWs;
  process.stdout.write(buildMemoryReportText(workspaceRoot, { dayLogLimit: a.dayLogLimit || 14 }));
}

main();
