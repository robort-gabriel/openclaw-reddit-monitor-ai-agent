#!/usr/bin/env node
/**
 * Approve / reject / edit Reddit comment drafts (HITL). Reads LOBSTER_ARGS_JSON or stdin JSON.
 * Expected keys: workspace_root (optional; defaults cwd), message_text
 * Drafts are stored in SQLite: memory/reddit_monitor.db
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { getOpenDraft, updateDraftBody, markDraftRejected } from "./lib/db.mjs";

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

function parseMessage(text) {
  const t = String(text || "")
    .trim()
    .replace(/^\/(approve|reject|edit)\b\s+/i, "$1 ");
  const m = t.match(/^(approve|reject|edit)\s+draft-?(\d+)(?::\s*([\s\S]*))?$/i);
  if (!m) return null;
  return {
    verb: m[1].toLowerCase(),
    num: m[2],
    editBody: m[3] != null ? m[3].trim() : "",
  };
}

function main() {
  const a = loadArgs();
  const workspaceRoot = a.workspace_root || process.cwd() || defaultWs;
  const message_text = a.message_text || "";
  const parsed = parseMessage(message_text);

  if (!parsed) {
    out({
      ok: false,
      error:
        "Could not parse command. Use: `approve draft-1` / `reject draft-1` / `edit draft-1: new text...`",
    });
    return;
  }

  const { verb, num, editBody } = parsed;
  const n = parseInt(num, 10);
  if (!Number.isFinite(n) || n < 1) {
    out({ ok: false, error: "Invalid draft id" });
    return;
  }

  const draft = getOpenDraft(workspaceRoot, n);

  if (!draft) {
    out({ ok: false, error: `No open draft with draft_num=${n} in SQLite` });
    return;
  }

  if (verb === "edit") {
    if (!editBody) {
      out({ ok: false, error: "edit requires text after `draft-N:`" });
      return;
    }
    try {
      updateDraftBody(workspaceRoot, n, editBody);
    } catch (e) {
      out({ ok: false, error: String(e) });
      return;
    }
    out({ ok: true, action: "edited", draftId: `draft-${n}` });
    return;
  }

  if (verb === "reject") {
    try {
      markDraftRejected(workspaceRoot, n);
    } catch (e) {
      out({ ok: false, error: String(e) });
      return;
    }
    out({ ok: true, action: "rejected", draftId: `draft-${n}` });
    return;
  }

  if (verb === "approve") {
    if (!draft.post_url.startsWith("http")) {
      out({ ok: false, error: "Draft post_url must be an http(s) URL" });
      return;
    }
    out({
      ok: true,
      action: "approved_pending_browser",
      postUrl: draft.post_url,
      commentText: draft.body,
      draftId: `draft-${num}`,
      nextPipeline: {
        path: "pipelines/post-approved-comment.lobster",
        argsJson: {
          workspace_root: "<session workspace absolute path>",
          draft_id: `draft-${num}`,
        },
      },
      instruction:
        "Preferred: call **`lobster`** with the **absolute** path to `post-approved-comment.lobster` and `argsJson` including `workspace_root` and `draft_id: \"draft-" +
        num +
        "\"` — the JSON includes `stepsForAgent` and `browser.actFill` / `reddit.evaluateFn`. Use the **default** browser profile (do not override `profile` on tool calls). **After a successful post, your task is done.** Optionally, if the user later wants a permalink on file, call `archive-posted-comment.lobster` with an optional `comment_url`.",
    });
  }
}

main();
