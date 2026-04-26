/**
 * Parse ~/.openclaw/openclaw.json (JSON5) with fallback for plain JSON.
 * Prefer the `json5` package when installed (`npm install` in reddit-monitor-agent).
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let json5Parse = null;
try {
  json5Parse = require("json5").parse;
} catch {
  // optional dependency: install with npm install
}

export function stripJsonComments(source) {
  if (!source) return "";
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock.replace(/^\s*\/\/.*$/gm, "");
}

function stripTrailingCommas(source) {
  let current = source;
  let previous = "";
  while (current !== previous) {
    previous = current;
    current = current.replace(/,(\s*[}\]])/g, "$1");
  }
  return current;
}

export function parseOpenclawConfig(raw) {
  const text = String(raw || "");

  if (json5Parse) {
    try {
      return json5Parse(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`openclaw.json parse error (json5): ${msg}`);
    }
  }

  const cleaned = stripTrailingCommas(stripJsonComments(text));
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `openclaw.json parse error: ${msg}\n` +
        "If your config is JSON5 (unquoted keys, etc.), run: cd reddit-monitor-agent && npm install"
    );
  }
}
