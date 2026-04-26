#!/usr/bin/env node
/**
 * Load a pending draft and emit a JSON action plan for browser posting.
 * Uses the gateway default browser profile (do not set a profile in tool calls; see `openclaw.json` `browser.defaultProfile`).
 * Reads LOBSTER_ARGS_JSON or stdin JSON. Keys: workspace_root, draft_id (e.g. "1" or "draft-1").
 * Drafts in SQLite: memory/reddit_monitor.db
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { getOpenDraft, resolveDbPath } from "./lib/db.mjs";

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
  if (m) return { id: m[1], fileBase: `draft-${m[1]}`, n: parseInt(m[1], 10) };
  if (/^\d+$/.test(s)) return { id: s, fileBase: `draft-${s}`, n: parseInt(s, 10) };
  return null;
}

function buildActFill(commentText) {
  return {
    name: "fill_comment_box",
    kind: "fill",
    fields: [
      {
        ref: "REPLACE_WITH_EDITOR_OR_TEXTBOX_REF_FROM_SNAPSHOT",
        value: commentText,
      },
    ],
  };
}

function buildActClickComment(ref) {
  return {
    name: "submit_comment",
    kind: "click",
    ref: ref || "REPLACE_WITH_COMMENT_BUTTON_REF_FROM_SNAPSHOT",
  };
}

/**
 * Reddit new UI uses a ProseMirror/Lexical-style composer: setting value on the outer
 * "textbox" ref often does not update editor state, so the UI still shows "empty" and
 * the Comment control stays disabled. This evaluate body targets an inner
 * [contenteditable="true"] and uses insertText + input events. Pass OpenClaw `text`
 * with the same string as the draft body (separate from `fn` per browser tool).
 */
function proseMirrorStyleEvaluateFn() {
  return String.raw`(el, txt) => {
  if (txt == null || String(txt) === "") return { ok: false, reason: "empty text" };
  const pick = (e) =>
    (e && e.querySelector && e.querySelector('[contenteditable="true"]')) ||
    (e && e.isContentEditable ? e : null) ||
    (e && e.querySelector && e.querySelector("p[contenteditable], div[contenteditable]"));
  const target = pick(el) || el;
  try { target.scrollIntoView({ block: "center" }); } catch (_) {}
  target.focus();
  try {
    const s = getSelection();
    if (s && target) {
      const r = document.createRange();
      r.selectNodeContents(target);
      r.collapse(false);
      s.removeAllRanges();
      s.addRange(r);
    }
  } catch (_) {}
  if (document.execCommand && document.execCommand("insertText", false, String(txt)))
    return { ok: true, method: "execCommand" };
  target.textContent = String(txt);
  target.dispatchEvent(
    new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(txt) })
  );
  return { ok: true, method: "textContent+input" };
}`;
}

function main() {
  const a = loadArgs();
  const workspaceRoot = a.workspace_root || process.cwd() || defaultWs;
  const parsed = normalizeDraftId(a.draft_id);

  if (!parsed) {
    out({
      ok: false,
      error:
        "Set draft_id in argsJson, e.g. \"draft_id\": \"1\" or \"draft-1\" (open draft in SQLite).",
    });
    return;
  }

  const draft = getOpenDraft(workspaceRoot, parsed.n);

  if (!draft) {
    out({
      ok: false,
      error: `No open draft for draft_num=${parsed.n} in ${resolveDbPath(workspaceRoot)}`,
    });
    return;
  }

  if (!draft.post_url.startsWith("http")) {
    out({ ok: false, error: "Draft post_url must be a post URL" });
    return;
  }

  if (!draft.body.trim()) {
    out({ ok: false, error: "Draft body is empty" });
    return;
  }

  const actFill = buildActFill(draft.body);
  const actClick = buildActClickComment();
  const evaluateFn = proseMirrorStyleEvaluateFn();

  out({
    ok: true,
    action: "browser_post_recipe",
    existingSession: true,
    postUrl: draft.post_url,
    commentText: draft.body,
    draftId: parsed.fileBase,
    draftKey: { storage: "sqlite", path: resolveDbPath(workspaceRoot), draft_num: parsed.n },
    maxSnapshotBytesHint: 32000,
    tpmNote:
      "Large snapshots (full thread + sidebar) burn model TPM. Prefer snapshot with compact=true, depth<=3, and avoid repeated full-page snapshots; only re-snapshot after the composer opens.",
    stepsForAgent: [
      "1) browser start or attach with the **default** profile (do not pass a `profile` argument; use `browser.defaultProfile` in OpenClaw config). If attaching to an existing session, do not set `slowly=true`.",
      "2) browser navigate to postUrl.",
      "3) If the main composer is not open yet, click the control that opens it (snapshot often shows a button like 'N Go to comments' with ref 1_46 — use the ref from *your* snapshot, not this example).",
      "4) One **small** snapshot (compact=true, depth 2–3) to capture `textbox \"Join the conversation\"` [ref=3_0] (or similar) and `button \"Comment\"` [ref=3_2]. Refs are examples and change by page.",
      "5) **Reddit (new UI):** Prefer **`act` + `kind: evaluate`** on the textbox `ref` using **`reddit.evaluateFn`** from this JSON and pass **`text`** = the full `commentText` (same as draft). Plain `fill` on the outer textbox often does **not** update ProseMirror state — you get 'The field is required and cannot be empty' and a disabled Comment button. Only if evaluate is unavailable, try `fill` with `fields: [{ ref, value }]` after clicking the textbox to focus it.",
      "6) Short wait; optional tiny snapshot to confirm the error line is gone. If Comment is still disabled, repeat evaluate or ask the user to paste manually (HITL).",
      "7) `act` `click` the Comment/Reply button (`ref` from snapshot). If the tool supports `timeoutMs` on the act, use 10000–15000ms because Reddit can delay interactivity when validation is still catching up.",
      "8) **After a successful post, stop** — the posting task is complete. Do **not** treat fetching a comment permalink as required. (Optional) If the user later wants a permalink on file, call `lobster` with `archive-posted-comment.lobster` and `comment_url`, or they can skip archival.",
      "9) Captcha / login / hard blocks: stop; use manual paste + Comment per `skills/reddit-comment-hitl`.",
    ],
    browser: {
      navigate: { action: "navigate", url: draft.post_url },
      actFill: actFill,
      actSubmitComment: actClick,
    },
    reddit: {
      whyAutomationFails:
        "The visible 'Join the conversation' field is a wrapper; the real editor is an inner [contenteditable]. CDP 'fill' may not update React/ProseMirror document state, so client-side validation still sees an empty post.",
      preferredInsert:
        "act evaluate on the textbox ref from a depth-3 snapshot, with `text` = exact comment body, `fn` = `reddit.evaluateFn` from this JSON.",
      evaluateFn,
    },
    followUpPipeline:
      "Optional: if you want a permalink stored in the workspace DB, call lobster with the absolute path to `pipelines/archive-posted-comment.lobster` and argsJson: workspace_root, draft_id, and an optional `comment_url`. You may omit `comment_url` to only mark the draft as posted in SQLite after a successful post.",
  });
}

main();
