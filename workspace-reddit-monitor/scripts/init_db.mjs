#!/usr/bin/env node
/**
 * Create DB file and schema under memory/reddit_monitor.db (same as first getDb()).
 * Run from workspace root after `npm install`:
 *   node scripts/init_db.mjs
 */
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { getDb, resolveDbPath } from "./lib/db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "..");

getDb(workspaceRoot);
process.stdout.write(`Database ready: ${resolveDbPath(workspaceRoot)}\n`);
