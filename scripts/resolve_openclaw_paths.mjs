import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Resolve `~/.openclaw` or `OPENCLAW_HOME` when set. */
export function resolveOpenclawHome() {
  if (process.env.OPENCLAW_HOME?.trim()) {
    return resolve(process.env.OPENCLAW_HOME.trim());
  }
  return join(homedir(), ".openclaw");
}

/**
 * Live gateway config. Prefer OPENCLAW_CONFIG_PATH when set.
 */
export function resolveOpenclawJsonPath() {
  if (process.env.OPENCLAW_CONFIG_PATH?.trim()) {
    return resolve(process.env.OPENCLAW_CONFIG_PATH.trim());
  }
  return join(resolveOpenclawHome(), "openclaw.json");
}

export function defaultWorkspaceRedditDest() {
  return join(resolveOpenclawHome(), "workspace-reddit-monitor");
}
