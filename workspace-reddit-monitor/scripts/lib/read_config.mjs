/**
 * Minimal YAML subset reader for config/monitor.yml (no external deps).
 * Seen RSS ids live in SQLite — see `lib/db.mjs` (`readSeenGuidsFromDb`, `appendSeenGuidsToDb`).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readSeenGuidsFromDb, appendSeenGuidsToDb } from "./db.mjs";

/**
 * @param {string} workspaceRoot
 */
export function readMonitorConfig(workspaceRoot) {
  const p = join(workspaceRoot, "config", "monitor.yml");
  if (!existsSync(p)) {
    return defaultMonitor();
  }
  const raw = readFileSync(p, "utf8");
  const subreddits = [];
  const keyword_include = [];
  const keyword_exclude = [];
  const nums = {
    max_posts_per_digest: 10,
    max_comment_drafts_per_day: 5,
    thread_context_comment_limit: 8,
    max_comment_length: 500,
    monitor_interval_minutes: 180,
  };

  let mode = null;
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("subreddits:")) {
      mode = "subreddits";
      continue;
    }
    if (t.startsWith("keyword_include:")) {
      mode = "keyword_include";
      continue;
    }
    if (t.startsWith("keyword_exclude:")) {
      mode = "keyword_exclude";
      continue;
    }
    const scalar = (key) => {
      if (t.startsWith(key + ":")) {
        const n = parseInt(t.split(":").slice(1).join(":").trim(), 10);
        if (Number.isFinite(n) && n > 0) nums[key] = n;
        mode = null;
        return true;
      }
      return false;
    };
    if (scalar("max_posts_per_digest")) continue;
    if (scalar("max_comment_drafts_per_day")) continue;
    if (scalar("thread_context_comment_limit")) continue;
    if (scalar("max_comment_length")) continue;
    if (scalar("monitor_interval_minutes")) continue;
    if (draft_options_scalar(t)) {
      mode = null;
      continue;
    }
    const m = t.match(/^\s*-\s+(.+)$/);
    if (m && (mode === "subreddits" || mode === "keyword_include" || mode === "keyword_exclude")) {
      const v = m[1].replace(/^['"]|['"]$/g, "").trim();
      if (mode === "subreddits") subreddits.push(v.replace(/^r\//, ""));
      if (mode === "keyword_include") keyword_include.push(v);
      if (mode === "keyword_exclude") keyword_exclude.push(v);
    }
  }

  return {
    subreddits,
    keyword_include,
    keyword_exclude,
    max_posts_per_digest: nums.max_posts_per_digest,
    max_comment_drafts_per_day: nums.max_comment_drafts_per_day,
    thread_context_comment_limit: Math.max(1, Math.min(25, nums.thread_context_comment_limit)),
    max_comment_length: Math.max(80, Math.min(4000, nums.max_comment_length)),
    monitor_interval_minutes: Math.max(15, Math.min(10080, nums.monitor_interval_minutes)),
    draft_options_count: 2,
  };
}

/**
 * @param {string} t
 */
function draft_options_scalar(t) {
  if (t.toLowerCase().startsWith("draft_options_count:")) {
    // ignored: product always offers exactly 2 options (draft-1, draft-2)
    return true;
  }
  return false;
}

function defaultMonitor() {
  return {
    subreddits: [],
    keyword_include: [],
    keyword_exclude: [],
    max_posts_per_digest: 10,
    max_comment_drafts_per_day: 5,
    thread_context_comment_limit: 8,
    max_comment_length: 500,
    monitor_interval_minutes: 180,
    draft_options_count: 2,
  };
}

/**
 * @param {string} workspaceRoot
 * @returns {Set<string>}
 */
export function readSeenGuids(workspaceRoot) {
  return readSeenGuidsFromDb(workspaceRoot);
}

/**
 * @param {string} workspaceRoot
 * @param {string[]} newGuids
 */
export function appendSeenGuidsSync(workspaceRoot, newGuids) {
  appendSeenGuidsToDb(workspaceRoot, newGuids);
}
