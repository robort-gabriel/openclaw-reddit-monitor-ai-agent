#!/usr/bin/env node
/**
 * Remove reddit-monitor from the live openclaw config; optionally delete workspace and agentDir.
 * Uses OPENCLAW_CONFIG_PATH / OPENCLAW_HOME like the installer.
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseOpenclawConfig } from "./parse_openclaw_config.mjs";
import { resolveOpenclawJsonPath, resolveOpenclawHome } from "./resolve_openclaw_paths.mjs";

const AGENT_ID = "reddit-monitor";
const OPENCLAW_HOME = resolveOpenclawHome();
const OPENCLAW_JSON_PATH = resolveOpenclawJsonPath();
const WS_PATH = join(OPENCLAW_HOME, "workspace-reddit-monitor");

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

async function main() {
  console.log("\n=== reddit-monitor uninstall ===\n");
  console.log(`Config file: ${OPENCLAW_JSON_PATH}\n`);

  if (!existsSync(OPENCLAW_JSON_PATH)) {
    throw new Error(`No config at ${OPENCLAW_JSON_PATH}`);
  }

  const ok = await prompt(`Remove ${AGENT_ID} from ${OPENCLAW_JSON_PATH}? [y/N]: `);
  if (ok !== "y" && ok !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  const w = await prompt(`Delete ${WS_PATH}? [y/N]: `);
  const removeWorkspace = w === "y" || w === "yes";
  const a = await prompt(`Delete ${join(OPENCLAW_HOME, "agents", AGENT_ID)}? [y/N]: `);
  const removeAgentDir = a === "y" || a === "yes";

  backupIfExists(OPENCLAW_JSON_PATH);
  const config = parseOpenclawConfig(readFileSync(OPENCLAW_JSON_PATH, "utf8"));

  config.agents = config.agents || {};
  config.agents.list = (config.agents.list || []).filter((x) => x?.id !== AGENT_ID);
  config.bindings = (config.bindings || []).filter((b) => b?.agentId !== AGENT_ID);

  writeFileSync(OPENCLAW_JSON_PATH, JSON.stringify(config, null, 2), "utf8");
  console.log(`Updated ${OPENCLAW_JSON_PATH}`);

  if (removeWorkspace) {
    if (existsSync(WS_PATH)) {
      rmSync(WS_PATH, { recursive: true, force: true });
      console.log(`Removed ${WS_PATH}`);
    }
  }
  if (removeAgentDir) {
    const p = join(OPENCLAW_HOME, "agents", AGENT_ID);
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true });
      console.log(`Removed ${p}`);
    }
  }

  console.log(
    "Plugins (lobster, llm-task) and Telegram `reddit-monitor` account were not removed; edit the config by hand if nothing else uses them.\n"
  );
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
