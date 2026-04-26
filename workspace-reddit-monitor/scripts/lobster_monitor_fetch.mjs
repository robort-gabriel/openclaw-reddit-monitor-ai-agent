#!/usr/bin/env node
/**
 * Step 2 — read pre JSON from stdin; fetch RSS per subreddit; emit new items not in seen.
 */
import { fetchSubredditNewItems, itemPassesKeywords } from "./lib/fetch_subreddit_rss.mjs";

async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  let pre;
  try {
    pre = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(
      JSON.stringify({ ok: false, step: "fetch", error: "invalid stdin JSON from pre", detail: String(e) })
    );
    return;
  }

  const { config, seen, workspaceRoot, dryRun } = pre;
  const fileSeen = new Set(seen);
  const { subreddits, keyword_include, keyword_exclude, max_posts_per_digest } = config;
  const byGuid = new Map();
  const errors = [];

  for (const sub of subreddits) {
    try {
      const items = await fetchSubredditNewItems(sub, 25);
      for (const it of items) {
        if (!itemPassesKeywords(it, keyword_include, keyword_exclude)) continue;
        if (fileSeen.has(it.guid)) continue;
        if (!byGuid.has(it.guid)) byGuid.set(it.guid, it);
      }
    } catch (e) {
      errors.push({ sub, error: String(e) });
    }
  }

  const allNew = [...byGuid.values()];
  allNew.sort((a, b) => a.guid.localeCompare(b.guid));
  const cap = max_posts_per_digest > 0 ? max_posts_per_digest : 10;
  const newItems = allNew.slice(0, cap);
  const newGuids = newItems.map((i) => i.guid);

  const out = {
    ok: true,
    step: "fetch",
    workspaceRoot,
    config,
    newItems,
    newGuids,
    errors,
    dryRun: dryRun === true,
  };
  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => {
  process.stdout.write(JSON.stringify({ ok: false, step: "fetch", error: String(e) }));
});
