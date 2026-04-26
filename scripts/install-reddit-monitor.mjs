#!/usr/bin/env node
/**
 * Install: copy workspace to OPENCLAW_HOME and merge into the live openclaw config.
 * Resolves the config file like OpenClaw: OPENCLAW_CONFIG_PATH, else OPENCLAW_HOME/openclaw.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, cpSync, rmSync } from "node:fs";
import { join, dirname, basename, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { spawnSync } from "node:child_process";
import { parseOpenclawConfig } from "./parse_openclaw_config.mjs";
import { resolveOpenclawJsonPath, resolveOpenclawHome } from "./resolve_openclaw_paths.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..");
const TEMPLATE_PATH = join(PACKAGE_ROOT, "openclaw.json.example");
const WS_SOURCE = join(PACKAGE_ROOT, "workspace-reddit-monitor");

const AGENT_ID = "reddit-monitor";
const TELEGRAM_ACCOUNT_ID = "reddit-monitor";
const OPENCLAW_JSON_PATH = resolveOpenclawJsonPath();
const OPENCLAW_HOME_RESOLVED = resolveOpenclawHome();
const WS_DEST = join(OPENCLAW_HOME_RESOLVED, "workspace-reddit-monitor");

const REQUIRED_ALLOW = ["group:fs", "group:web", "browser", "message", "lobster", "llm-task"];

const VALID_EXEC_SECURITY = new Set(["deny", "allowlist", "full"]);
const VALID_EXEC_ASK = new Set(["off", "on-miss", "always"]);

/**
 * OpenClaw gateway schema: tools.exec.security and tools.exec.ask (see `openclaw doctor`).
 * Migrates legacy template values and drops invalid strings so a merge produces a valid config.
 */
function sanitizeToolsExec(exec) {
  if (!exec || typeof exec !== "object") return;
  if (exec.security === "on" || exec.security === true) {
    exec.security = "allowlist";
  }
  if (exec.ask === "on-request" || exec.ask === "on") {
    exec.ask = "on-miss";
  }
  if (exec.security != null && !VALID_EXEC_SECURITY.has(String(exec.security))) {
    exec.security = "allowlist";
  }
  if (exec.ask != null && !VALID_EXEC_ASK.has(String(exec.ask))) {
    exec.ask = "on-miss";
  }
}

/**
 * @param {Record<string, unknown>} config
 */
function sanitizeAllAgentsToolsExec(config) {
  const list = config.agents?.list;
  if (!Array.isArray(list)) return;
  for (const agent of list) {
    if (agent && typeof agent === "object" && agent.tools && typeof agent.tools === "object") {
      sanitizeToolsExec(agent.tools.exec);
    }
  }
  if (config.agents && typeof config.agents === "object" && config.agents.defaults) {
    const d = config.agents.defaults;
    if (d && typeof d === "object" && d.tools && typeof d.tools === "object") {
      sanitizeToolsExec(d.tools.exec);
    }
  }
}

function backupIfExists(filePath) {
  if (!existsSync(filePath)) return;
  const ext = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const backupPath = `${filePath}.bak.${ext}`;
  copyFileSync(filePath, backupPath);
  console.log(`Backed up ${filePath} -> ${backupPath}`);
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase());
    });
  });
}

function safeClone(obj) {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}

function shouldCopyPath(src) {
  const b = basename(src);
  if (b === "node_modules" || b === ".git") return false;
  return true;
}

/**
 * @param {string} nodePath
 * @returns {number | null}
 */
function getNodeMajor(nodePath) {
  if (!existsSync(nodePath)) return null;
  const r = spawnSync(nodePath, ["-e", "process.stdout.write(process.version.slice(1).split('.')[0])"], {
    encoding: "utf8",
  });
  if (r.status !== 0) return null;
  const m = parseInt(String(r.stdout).trim(), 10);
  return Number.isFinite(m) ? m : null;
}

/**
 * OpenClaw / Lobster usually runs a stable system Node (often v20 on macOS, e.g. /usr/local/bin/node).
 * `npm install` may use a different `node` (e.g. nvm 25) and leave better-sqlite3 built for the wrong NODE_MODULE_VERSION.
 * Pick a node likely to match the gateway; override with REDDIT_MONITOR_NODE or OPENCLAW_RFM_REBUILD_NODE.
 * @returns {string}
 */
function nodeForGatewayAlignedWorkspace() {
  const fromEnv = process.env.REDDIT_MONITOR_NODE || process.env.OPENCLAW_RFM_REBUILD_NODE;
  if (fromEnv && existsSync(fromEnv)) {
    return fromEnv;
  }
  const common = ["/opt/homebrew/bin/node", "/usr/local/bin/node"];
  for (const p of common) {
    if (getNodeMajor(p) === 20) return p;
  }
  for (const p of common) {
    if (existsSync(p)) return p;
  }
  if (getNodeMajor(process.execPath) === 20) {
    return process.execPath;
  }
  return process.execPath;
}

/**
 * Recompile better-sqlite3 for `nodePath` (PATH is prefixed so that `npm` pairs with the same install).
 * @param {string} cwd
 * @param {string} nodePath
 */
function npmRebuildBetterSqlite3(cwd, nodePath) {
  const bin = dirname(nodePath);
  const env = { ...process.env, PATH: [bin, process.env.PATH || ""].filter(Boolean).join(delimiter) };
  const npmName = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npmName, ["rebuild", "better-sqlite3"], { cwd, stdio: "inherit", env, shell: process.platform === "win32" });
  if (r.status === 0) return;
  const abs = join(bin, npmName);
  if (existsSync(abs)) {
    const r2 = spawnSync(abs, ["rebuild", "better-sqlite3"], { cwd, stdio: "inherit", env });
    if (r2.status === 0) return;
  }
  throw new Error(
    `npm rebuild better-sqlite3 failed in ${cwd}. Set REDDIT_MONITOR_NODE to the same node binary the OpenClaw gateway uses, then re-run, or: cd that folder && npm rebuild better-sqlite3 (with the gateway's node first on PATH).`
  );
}

function copyWorkspace() {
  if (!existsSync(WS_SOURCE)) {
    throw new Error(`Workspace source not found: ${WS_SOURCE}`);
  }
  mkdirSync(dirname(WS_DEST), { recursive: true });
  if (existsSync(WS_DEST)) {
    rmSync(WS_DEST, { recursive: true, force: true });
  }
  cpSync(WS_SOURCE, WS_DEST, {
    recursive: true,
    filter: (s) => shouldCopyPath(s),
  });
  console.log(`Copied workspace -> ${WS_DEST}`);
}

/**
 * @param {Record<string, unknown>} existing
 * @param {Record<string, unknown>} template
 */
function mergeConfig(existing, template) {
  const config = existing && typeof existing === "object" ? safeClone(existing) : {};

  if (!config.agents || typeof config.agents !== "object" || config.agents === null) {
    config.agents = { list: [] };
  } else if (!Array.isArray(config.agents.list)) {
    if (Array.isArray(config.agents)) {
      config.agents = { list: safeClone(config.agents) };
    } else {
      const a = safeClone(config.agents);
      const list = Array.isArray(a.list) ? a.list : [];
      delete a.list;
      config.agents = { ...a, list };
    }
  }

  const currentAgents = (config.agents.list || []).filter((a) => a?.id !== AGENT_ID);
  const tplAgent = (template.agents?.list || []).find((a) => a?.id === AGENT_ID);
  if (!tplAgent) {
    throw new Error(`Template must include agents.list entry id "${AGENT_ID}"`);
  }

  const normalized = safeClone(tplAgent);
  normalized.workspace = "~/.openclaw/workspace-reddit-monitor";
  normalized.agentDir = "~/.openclaw/agents/reddit-monitor/agent";
  normalized.tools = normalized.tools || {};
  const allow = Array.isArray(normalized.tools.allow) ? normalized.tools.allow : [];
  const alsoAllow = Array.isArray(normalized.tools.alsoAllow) ? normalized.tools.alsoAllow : [];
  normalized.tools.allow = Array.from(new Set([...allow, ...alsoAllow, ...REQUIRED_ALLOW]));
  delete normalized.tools.alsoAllow;
  currentAgents.push(normalized);
  config.agents.list = currentAgents;

  config.channels = config.channels || {};
  config.channels.telegram = config.channels.telegram || {};
  config.channels.telegram.accounts = config.channels.telegram.accounts || {};

  const tplAccount = template.channels?.telegram?.accounts?.[TELEGRAM_ACCOUNT_ID] || {};
  config.channels.telegram.accounts[TELEGRAM_ACCOUNT_ID] = {
    ...safeClone(tplAccount),
    ...(config.channels.telegram.accounts[TELEGRAM_ACCOUNT_ID] || {}),
  };
  if (config.channels.telegram.enabled === undefined) {
    config.channels.telegram.enabled = true;
  }

  config.bindings = Array.isArray(config.bindings) ? config.bindings : [];
  config.bindings = config.bindings.filter(
    (b) =>
      !(
        b?.agentId === AGENT_ID &&
        b?.match?.channel === "telegram" &&
        b?.match?.accountId === TELEGRAM_ACCOUNT_ID
      ),
  );
  config.bindings.push({
    agentId: AGENT_ID,
    match: { channel: "telegram", accountId: TELEGRAM_ACCOUNT_ID },
  });

  if (template.plugins?.entries) {
    config.plugins = config.plugins || {};
    config.plugins.entries = {
      ...(config.plugins.entries || {}),
      ...safeClone(template.plugins.entries),
    };
  }

  if (template.browser) {
    config.browser = { ...(config.browser || {}), ...safeClone(template.browser) };
  }

  sanitizeAllAgentsToolsExec(config);

  return config;
}

async function main() {
  console.log("\n=== reddit-monitor install ===\n");
  console.log(`OPENCLAW_CONFIG_PATH=${process.env.OPENCLAW_CONFIG_PATH || "(not set; using OPENCLAW_HOME/openclaw.json)"}`);
  console.log(`OPENCLAW_HOME=${OPENCLAW_HOME_RESOLVED}`);
  console.log(`Config file (source of truth for merge): ${OPENCLAW_JSON_PATH}`);
  console.log(`Workspace copy dest: ${WS_DEST}\n`);

  if (!existsSync(TEMPLATE_PATH)) {
    throw new Error(`Template not found: ${TEMPLATE_PATH}`);
  }
  if (!existsSync(OPENCLAW_JSON_PATH)) {
    throw new Error(
      `No config at ${OPENCLAW_JSON_PATH}\n` +
        "Run `openclaw onboard` first, or set OPENCLAW_CONFIG_PATH to the path OpenClaw actually loads (see `openclaw config get` / gateway logs), then re-run."
    );
  }
  if (!existsSync(WS_SOURCE)) {
    throw new Error(`Workspace source not found: ${WS_SOURCE}`);
  }

  const ok = await prompt(`Install ${AGENT_ID} and merge into the file above? [y/N]: `);
  if (ok !== "y" && ok !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  const template = parseOpenclawConfig(readFileSync(TEMPLATE_PATH, "utf8"));
  const existing = parseOpenclawConfig(readFileSync(OPENCLAW_JSON_PATH, "utf8"));

  copyWorkspace();

  const pkg = join(WS_DEST, "package.json");
  if (existsSync(pkg)) {
    console.log("\nRunning npm install in workspace (better-sqlite3)...");
    const npm = spawnSync("npm", ["install"], { cwd: WS_DEST, stdio: "inherit", env: process.env });
    if (npm.status !== 0) {
      throw new Error("npm install in workspace failed. Ensure npm is on PATH, then re-run or run `npm install` in " + WS_DEST);
    }
    const gatewayNode = nodeForGatewayAlignedWorkspace();
    const maj = getNodeMajor(gatewayNode);
    console.log(
      `Rebuilding better-sqlite3 for the Node that runs OpenClaw/Lobster (using ${gatewayNode}` +
        (maj != null ? `, major ${maj}` : "") +
        ")…\n" +
        "  Tip: if the rebuild targets the wrong Node, set REDDIT_MONITOR_NODE to the gateway’s node path and re-run this installer."
    );
    npmRebuildBetterSqlite3(WS_DEST, gatewayNode);
    const init = spawnSync(gatewayNode, ["scripts/init_db.mjs"], { cwd: WS_DEST, stdio: "inherit" });
    if (init.status !== 0) {
      throw new Error("Database init (scripts/init_db.mjs) failed in " + WS_DEST);
    }
  } else {
    console.warn("No package.json in workspace; skip npm install. SQLite scripts need better-sqlite3 (see workspace-reddit-monitor/package.json).");
  }

  backupIfExists(OPENCLAW_JSON_PATH);
  const merged = mergeConfig(existing, template);
  const out = JSON.stringify(merged, null, 2);
  writeFileSync(OPENCLAW_JSON_PATH, out, "utf8");
  console.log(`Wrote ${out.length} bytes to ${OPENCLAW_JSON_PATH}`);

  const roundTrip = parseOpenclawConfig(readFileSync(OPENCLAW_JSON_PATH, "utf8"));
  const hasAgent =
    Array.isArray(roundTrip.agents?.list) && roundTrip.agents.list.some((a) => a?.id === AGENT_ID);
  if (!hasAgent) {
    console.error("Warning: re-read of config does not list agent", AGENT_ID);
  } else {
    console.log(`Verified: "${AGENT_ID}" is present in ${OPENCLAW_JSON_PATH}`);
  }

  console.log(
    "\nNext: set TELEGRAM_BOT_TOKEN_REDDIT_MONITOR, run `openclaw channels login` if needed, restart the gateway, then `openclaw doctor`.\n"
  );
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
