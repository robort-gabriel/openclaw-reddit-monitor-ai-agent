#!/usr/bin/env node
/**
 * Chat commands: list/view drafts, digest, help, status.
 * LOBSTER_ARGS_JSON or stdin: workspace_root, message_text
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { getLastDigest, listOpenDraftsFull, getMetaValue, resolveDbPath } from "./lib/db.mjs";
import { readMonitorConfig } from "./lib/read_config.mjs";

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

function parse(message_text) {
  return String(message_text || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "");
}

function main() {
  const a = loadArgs();
  const workspaceRoot = a.workspace_root || process.cwd() || defaultWs;
  const msg = parse(a.message_text || a.command || "");

  if (!msg || msg === "help" || msg === "commands" || msg === "?" || msg === "reddit help") {
    out({
      ok: true,
      action: "help",
      text: [
        "Reddit monitor commands (send the line, or the same in Telegram):",
        "- `view drafts` | `list drafts` — open comment drafts in SQLite",
        "- `view draft 1` | `show draft-2` — show one open draft body",
        "- `digest` | `last digest` — last stored digest (SQLite)",
        "- `status` — monitor config summary + first bootstrap time",
        "- `help` — this list",
        "HITL approval still uses: `approve draft-N` / `reject` / `edit` via `comment-from-approval.lobster`.",
      ].join("\n"),
    });
    return;
  }

  if (msg === "view drafts" || msg === "list drafts" || msg === "show drafts" || msg === "drafts" || msg === "draft list") {
    const rows = listOpenDraftsFull(workspaceRoot);
    const lines = rows.length
      ? rows.map(
          (r) =>
            `**draft-${r.draft_num}** (${r.post_url.slice(0, 60)}…)\n${r.body.slice(0, 400)}${r.body.length > 400 ? "…" : ""}\n---`
        )
      : ["(no open drafts)"];
    out({ ok: true, action: "list_drafts", count: rows.length, text: lines.join("\n\n") });
    return;
  }

  const m1 = msg.match(/^(view|show)\s+draft[:\s-]*(\d+)$/);
  const m2 = msg.match(/^draft[:\s-]*(\d+)$/);
  const mDraft = m1 || m2;
  if (mDraft) {
    const num = parseInt(m1 ? m1[2] : m2[1], 10);
    const rows = listOpenDraftsFull(workspaceRoot);
    const row = rows.find((r) => r.draft_num === num);
    if (!row) {
      out({ ok: true, action: "view_draft", found: false, text: `No open draft for draft_num=${num}` });
      return;
    }
    out({
      ok: true,
      action: "view_draft",
      found: true,
      draftId: `draft-${num}`,
      text: `**draft-${num}**\n${row.post_url}\n\n${row.body}`,
    });
    return;
  }

  if (msg === "digest" || msg === "last digest" || msg === "view digest" || msg === "last-digest") {
    const d = getLastDigest(workspaceRoot);
    out({ ok: true, action: "digest", text: d || "(no digest yet)" });
    return;
  }

  if (msg === "status" || msg === "monitor status") {
    const cfg = readMonitorConfig(workspaceRoot);
    const boot = getMetaValue(workspaceRoot, "first_bootstrap_dry");
    out({
      ok: true,
      action: "status",
      text: [
        `**DB:** \`${resolveDbPath(workspaceRoot)}\``,
        `**Subreddits:** ${cfg.subreddits.join(", ") || "(none)"}`,
        `**Monitor interval (doc):** ${cfg.monitor_interval_minutes} min — see \`config/SCHEDULE.md\` for cron ideas`,
        `**Thread context limit:** ${cfg.thread_context_comment_limit} comments for draft context`,
        `**First dry bootstrap:** ${boot || "not run yet"}`,
      ].join("\n"),
    });
    return;
  }

  out({
    ok: false,
    error: "Unknown command. Say `help` for supported lines.",
  });
}

main();
