#!/usr/bin/env node
/**
 * Step 3 — write seen ids, last digest, daily log; optional Telegram; stdout = envelope for agent.
 * Persists to SQLite: memory/reddit_monitor.db
 * `dryRun` in stdin: skip seen/digest/telegram writes (smoke / bootstrap test).
 * When new posts exist, fetches first thread for llm two-draft context.
 */
import { appendSeenGuidsSync } from "./lib/read_config.mjs";
import { saveLastDigest, appendMonitorDayLog } from "./lib/db.mjs";
import { fetchThreadContextForDraft } from "./lib/fetch_reddit_thread.mjs";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_USER_ID;
  if (!token || !chat) return { sent: false, reason: "missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" };
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    return { sent: false, reason: `HTTP ${res.status}: ${t}` };
  }
  return { sent: true };
}

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  let fetchResult;
  try {
    fetchResult = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(
      JSON.stringify({ ok: false, step: "post_digest", error: "invalid stdin from fetch", detail: String(e) })
    );
    return;
  }

  if (!fetchResult.ok) {
    process.stdout.write(JSON.stringify({ ok: false, step: "post_digest", error: "fetch step not ok" }));
    return;
  }

  const { newItems, newGuids, errors, workspaceRoot, config, dryRun: dry } = fetchResult;
  const dryRun = dry === true;

  const nLimit = config.thread_context_comment_limit ?? 8;
  const maxLen = config.max_comment_length ?? 500;
  const first = newItems?.length ? newItems[0] : null;
  let threadContext = null;
  if (first?.link) {
    threadContext = await fetchThreadContextForDraft(first.link, nLimit);
  }

  if (newGuids?.length && !dryRun) {
    appendSeenGuidsSync(workspaceRoot, newGuids);
  }

  const lines = [];
  lines.push(`[Reddit monitor – ${todayUTC()}]${dryRun ? " (dry run — not saved to DB / seen not advanced)" : ""}`);
  if (!newItems?.length) {
    lines.push("No new posts (after filters) since last run.");
  } else {
    for (const it of newItems) {
      lines.push(`- r/${it.subreddit}: ${it.title} — ${it.link}`);
    }
  }
  if (errors?.length) {
    lines.push("");
    lines.push("Fetch warnings:");
    for (const e of errors) {
      lines.push(`- r/${e.sub}: ${e.error}`);
    }
  }

  const digestMarkdown = lines.join("\n");
  const runAt = new Date().toISOString();
  const day = todayUTC();

  if (!dryRun) {
    saveLastDigest(workspaceRoot, `${digestMarkdown}\n`);
    appendMonitorDayLog(workspaceRoot, day, runAt, digestMarkdown);
  }

  let telegram = { sent: false };
  if (dryRun) {
    telegram = { sent: false, reason: "dry run; Telegram not sent" };
  } else if (newItems?.length || errors?.length) {
    telegram = await sendTelegram(digestMarkdown);
  } else {
    telegram = { sent: false, reason: "empty digest; chat notification skipped" };
  }

  const generateTwoDrafts = Boolean(!dryRun && newItems?.length > 0 && first);

  const out = {
    ok: true,
    step: "post_digest",
    digestMarkdown,
    telegram,
    newGuids: newGuids || [],
    dryRun,
    threadContext: threadContext && { ...threadContext, postUrl: first?.link, postTitle: first?.title },
    configHints: {
      max_comment_length: maxLen,
      draft_options_count: 2,
      read_files_for_drafts: ["config/identity.md", "config/writing_style.md", "prompts/draft-pair.md"],
    },
    generateTwoDrafts,
    draftInstructions: generateTwoDrafts
      ? "Use **llm-task** (or the configured model) with `prompts/draft-pair.md` plus `config/identity.md` and `config/writing_style.md`, filling in PLACEHOLDERS from `threadContext`. Output two short options. Then run **create-draft** (or `lobster_upsert_draft.mjs`) to save **draft_num** 1 and 2 to the same `postUrl` (top post). Never use em dashes (use `-` or commas). Obey `max_comment_length`."
      : null,
    requestAgentSend:
      !dryRun && newItems?.length > 0 && !telegram?.sent
        ? "If digest was not auto-sent, call the **message** tool once with the digest (Telegram) for the user."
        : null,
  };
  process.stdout.write(JSON.stringify(out, null, 0));
}

main().catch((e) => {
  process.stdout.write(JSON.stringify({ ok: false, step: "post_digest", error: String(e) }));
});
