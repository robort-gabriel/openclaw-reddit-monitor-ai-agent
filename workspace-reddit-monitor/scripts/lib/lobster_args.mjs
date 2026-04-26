/**
 * Merged args from the Lobster `argsJson` for the run (injected as LOBSTER_ARGS_JSON).
 */
export function loadLobsterArgs() {
  if (process.env.LOBSTER_ARGS_JSON) {
    try {
      return JSON.parse(process.env.LOBSTER_ARGS_JSON);
    } catch {
      return {};
    }
  }
  return {};
}

export function isDryRun() {
  const a = loadLobsterArgs();
  return a.dry_run === true || a.dry === true;
}
