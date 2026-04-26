#!/usr/bin/env node
/**
 * After a successful browser post: mark draft as posted in SQLite.
 * Reads LOBSTER_ARGS_JSON or stdin. Keys: workspace_root, draft_id, comment_url (optional)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { markDraftPosted } from "./lib/db.mjs";

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

function normalizeDraftId(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim();
  const m = s.match(/^draft-?(\d+)$/i);
  if (m) return { id: m[1], n: parseInt(m[1], 10) };
  if (/^\d+$/.test(s)) return { id: s, n: parseInt(s, 10) };
  return null;
}

function isHttpOrEmpty(s) {
  const t = String(s || "").trim();
  if (t === "") return true;
  return /^https?:\/\//i.test(t);
}

function main() {
  const a = loadArgs();
  const workspaceRoot = a.workspace_root || process.cwd() || defaultWs;
  const comment_url = (a.comment_url == null || String(a.comment_url).trim() === "" ? null : String(a.comment_url).trim());
  const parsed = normalizeDraftId(a.draft_id);

  if (!parsed) {
    out({
      ok: false,
      error: 'Set draft_id, e.g. "draft_id": "1" or "draft-1".',
    });
    return;
  }

  if (!isHttpOrEmpty(comment_url)) {
    out({
      ok: false,
      error: "If set, comment_url must be an http(s) URL.",
    });
    return;
  }

  const r = markDraftPosted(workspaceRoot, parsed.n, comment_url);
  if (!r.ok) {
    out({ ok: false, error: r.error });
    return;
  }

  out({
    ok: true,
    action: "archived",
    commentUrl: comment_url,
    draftId: `draft-${parsed.n}`,
  });
}

main();
