#!/usr/bin/env node
/**
 * Create or replace an open draft in SQLite. Used for manual / agent creation (no .md file).
 * Reads LOBSTER_ARGS_JSON or stdin JSON: workspace_root, draft_num, post_url, body
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { upsertDraftOpen } from "./lib/db.mjs";

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

function out(obj) {
  process.stdout.write(JSON.stringify(obj, null, 0));
}

function main() {
  const a = loadArgs();
  const workspaceRoot = a.workspace_root || process.cwd() || defaultWs;
  const draft_num = Number(a.draft_num);
  const post_url = String(a.post_url || "").trim();
  const body = String(a.body || "").trim();

  if (!Number.isFinite(draft_num) || draft_num < 1) {
    out({ ok: false, error: "draft_num must be a positive integer" });
    return;
  }
  if (!post_url.startsWith("http")) {
    out({ ok: false, error: "post_url must be an http(s) URL" });
    return;
  }
  if (!body) {
    out({ ok: false, error: "body must be non-empty" });
    return;
  }

  upsertDraftOpen(workspaceRoot, draft_num, post_url, body);
  out({
    ok: true,
    action: "upserted",
    draftId: `draft-${draft_num}`,
  });
}

main();
