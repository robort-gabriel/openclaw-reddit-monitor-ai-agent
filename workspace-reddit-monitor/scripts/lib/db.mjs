/**
 * SQLite workspace store: drafts, digests, seen RSS ids, HITL log.
 * Uses `better-sqlite3` for the workspace SQLite store.
 * DB path: <workspace>/memory/reddit_monitor.db
 */
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import Database from "better-sqlite3";

const DB_NAME = "reddit_monitor.db";
const META_VERSION = 1;

/** @type {Map<string, import("better-sqlite3").Database>} */
const pool = new Map();

/**
 * @param {string} workspaceRoot
 * @returns {import("better-sqlite3").Database}
 */
export function getDb(workspaceRoot) {
  const key = resolveDbPath(workspaceRoot);
  if (pool.has(key)) return pool.get(key);
  mkdirSync(dirname(key), { recursive: true });
  const db = new Database(key);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  pool.set(key, db);
  return db;
}

/**
 * @param {string} workspaceRoot
 * @returns {string}
 */
export function resolveDbPath(workspaceRoot) {
  return join(workspaceRoot, "memory", DB_NAME);
}

/**
 * @param {import("better-sqlite3").Database} db
 */
function migrate(db) {
  const t = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get();
  if (!t) {
    db.exec(`
      CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE seen_post_ids (
        guid TEXT PRIMARY KEY
      );
      CREATE TABLE drafts (
        draft_num INTEGER PRIMARY KEY,
        post_url TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL,
        comment_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE last_digest (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE monitor_day_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        run_at TEXT NOT NULL,
        digest_markdown TEXT NOT NULL
      );
      CREATE TABLE comment_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        draft_num INTEGER,
        event_type TEXT NOT NULL,
        comment_url TEXT,
        detail TEXT
      );
    `);
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(
      String(META_VERSION)
    );
    return;
  }
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
  const v = row && row.value != null ? Number(row.value) : 0;
  if (v < 1) {
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(
      String(META_VERSION)
    );
  }
}

/**
 * @param {string} workspaceRoot
 * @param {string} key
 * @returns {string | null}
 */
export function getMetaValue(workspaceRoot, key) {
  const db = getDb(workspaceRoot);
  const r = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return r && r.value != null ? r.value : null;
}

/**
 * @param {string} workspaceRoot
 * @param {string} key
 * @param {string} value
 */
export function setMetaValue(workspaceRoot, key, value) {
  const db = getDb(workspaceRoot);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, value);
}

// --- seen posts ---

/**
 * @param {string} workspaceRoot
 * @returns {Set<string>}
 */
export function readSeenGuidsFromDb(workspaceRoot) {
  const db = getDb(workspaceRoot);
  const rows = db.prepare("SELECT guid FROM seen_post_ids").all();
  return new Set(rows.map((r) => r.guid));
}

/**
 * @param {string} workspaceRoot
 * @param {string[]} newGuids
 */
export function appendSeenGuidsToDb(workspaceRoot, newGuids) {
  if (!newGuids?.length) return;
  const db = getDb(workspaceRoot);
  const ins = db.prepare("INSERT OR IGNORE INTO seen_post_ids (guid) VALUES (?)");
  const run = db.transaction((guids) => {
    for (const g of guids) {
      if (g) ins.run(g);
    }
  });
  run(newGuids);
}

// --- last digest + day log ---

/**
 * @param {string} workspaceRoot
 * @param {string} digestMarkdown
 */
export function saveLastDigest(workspaceRoot, digestMarkdown) {
  const db = getDb(workspaceRoot);
  const now = new Date().toISOString();
  db.prepare("INSERT OR REPLACE INTO last_digest (id, content, updated_at) VALUES (1, ?, ?)").run(
    digestMarkdown,
    now
  );
}

/**
 * @param {string} workspaceRoot
 * @param {string} day - YYYY-MM-DD
 * @param {string} runAt - ISO
 * @param {string} digestMarkdown
 */
export function appendMonitorDayLog(workspaceRoot, day, runAt, digestMarkdown) {
  const db = getDb(workspaceRoot);
  db.prepare("INSERT INTO monitor_day_log (day, run_at, digest_markdown) VALUES (?, ?, ?)").run(
    day,
    runAt,
    digestMarkdown
  );
}

/**
 * @param {string} workspaceRoot
 * @returns {string | null}
 */
export function getLastDigest(workspaceRoot) {
  const db = getDb(workspaceRoot);
  const row = db.prepare("SELECT content FROM last_digest WHERE id = 1").get();
  return row ? row.content : null;
}

// --- drafts ---

/**
 * @param {string} workspaceRoot
 * @param {number} draftNum
 * @param {string} postUrl
 * @param {string} body
 */
export function upsertDraftOpen(workspaceRoot, draftNum, postUrl, body) {
  const db = getDb(workspaceRoot);
  const now = new Date().toISOString();
  const row = db.prepare("SELECT created_at FROM drafts WHERE draft_num = ?").get(draftNum);
  const created = row?.created_at || now;
  db.prepare(
    `INSERT INTO drafts (draft_num, post_url, body, status, comment_url, created_at, updated_at)
     VALUES (?, ?, ?, 'open', NULL, ?, ?)
     ON CONFLICT(draft_num) DO UPDATE SET
       post_url = excluded.post_url,
       body = excluded.body,
       status = 'open',
       comment_url = NULL,
       updated_at = excluded.updated_at`
  ).run(draftNum, postUrl, body, created, now);
}

/**
 * @param {string} workspaceRoot
 * @param {number} draftNum
 * @param {string} body
 */
export function updateDraftBody(workspaceRoot, draftNum, body) {
  const db = getDb(workspaceRoot);
  const now = new Date().toISOString();
  const u = db
    .prepare("UPDATE drafts SET body = ?, updated_at = ? WHERE draft_num = ? AND status = 'open'")
    .run(body, now, draftNum);
  if (u.changes === 0) throw new Error("No open draft to edit for draft_num " + draftNum);
}

/**
 * @param {string} workspaceRoot
 * @param {number} draftNum
 */
export function markDraftRejected(workspaceRoot, draftNum) {
  const db = getDb(workspaceRoot);
  const now = new Date().toISOString();
  const u = db
    .prepare("UPDATE drafts SET status = 'rejected', updated_at = ? WHERE draft_num = ? AND status = 'open'")
    .run(now, draftNum);
  if (u.changes === 0) throw new Error("No open draft to reject for draft_num " + draftNum);
  db.prepare(
    "INSERT INTO comment_log (created_at, draft_num, event_type, comment_url, detail) VALUES (?, ?, 'rejected', NULL, NULL)"
  ).run(now, draftNum);
}

/**
 * @param {string} workspaceRoot
 * @param {number} draftNum
 * @returns {{ post_url: string, body: string } | null}
 */
export function getOpenDraft(workspaceRoot, draftNum) {
  const db = getDb(workspaceRoot);
  return db
    .prepare("SELECT post_url, body FROM drafts WHERE draft_num = ? AND status = 'open'")
    .get(draftNum);
}

/**
 * @param {string} workspaceRoot
 * @returns {Array<{ draft_num: number, post_url: string, body: string, updated_at: string }>}
 */
export function listOpenDraftsFull(workspaceRoot) {
  const db = getDb(workspaceRoot);
  return db
    .prepare("SELECT draft_num, post_url, body, updated_at FROM drafts WHERE status = 'open' ORDER BY draft_num")
    .all();
}

/**
 * @param {string} workspaceRoot
 * @param {number} draftNum
 * @param {string | null} commentUrl
 */
export function markDraftPosted(workspaceRoot, draftNum, commentUrl) {
  const db = getDb(workspaceRoot);
  const now = new Date().toISOString();
  const u = db
    .prepare(
      "UPDATE drafts SET status = 'posted', comment_url = ?, updated_at = ? WHERE draft_num = ? AND status = 'open'"
    )
    .run(commentUrl, now, draftNum);
  if (u.changes === 0) {
    return { ok: false, error: "No open draft for that id (wrong id or already posted)." };
  }
  db.prepare(
    "INSERT INTO comment_log (created_at, draft_num, event_type, comment_url, detail) VALUES (?, ?, 'posted', ?, ?)"
  ).run(now, draftNum, commentUrl, null);
  return { ok: true, draftNum, commentUrl, updatedAt: now };
}

// --- report ---

/**
 * @param {string} workspaceRoot
 * @param {object} [opts]
 * @param {number} [opts.dayLogLimit]
 */
export function buildMemoryReportText(workspaceRoot, opts = {}) {
  const limit = opts.dayLogLimit ?? 14;
  const db = getDb(workspaceRoot);
  const last = getLastDigest(workspaceRoot);
  const lines = [];
  lines.push("# Memory report (SQLite)");
  lines.push("");
  lines.push("Database: " + resolveDbPath(workspaceRoot));
  lines.push("");
  lines.push("## Last digest");
  lines.push(last ? last.trim() : "(none yet)");
  lines.push("");
  lines.push("## Open drafts (status=open)");
  const openRows = db
    .prepare("SELECT draft_num, post_url, updated_at FROM drafts WHERE status = 'open' ORDER BY draft_num")
    .all();
  if (!openRows.length) {
    lines.push("(none)");
  } else {
    for (const r of openRows) {
      lines.push(`- draft-${r.draft_num} — ${r.post_url} (updated ${r.updated_at})`);
    }
  }
  lines.push("");
  lines.push("## Recent comment / HITL log");
  const logRows = db
    .prepare(
      "SELECT created_at, draft_num, event_type, comment_url FROM comment_log ORDER BY id DESC LIMIT ?"
    )
    .all(30);
  if (!logRows.length) {
    lines.push("(none)");
  } else {
    for (const r of logRows) {
      const url = r.comment_url ? ` ${r.comment_url}` : "";
      lines.push(
        `- ${r.created_at} | draft ${r.draft_num ?? "—"} | ${r.event_type}${url}`
      );
    }
  }
  lines.push("");
  lines.push("## Recent monitor runs (per day, newest first in window)");
  const dayRows = db
    .prepare("SELECT day, run_at, digest_markdown FROM monitor_day_log ORDER BY id DESC LIMIT ?")
    .all(limit);
  for (const r of dayRows) {
    lines.push("");
    lines.push(`### ${r.day} @ ${r.run_at}`);
    lines.push(r.digest_markdown.trim());
  }
  return lines.join("\n") + "\n";
}
