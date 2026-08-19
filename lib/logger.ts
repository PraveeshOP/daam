/** Minimal timestamped logging so job states (waiting/active/completed/failed) are visible
 * during development without standing up a dashboard (see phase-4 spec, section 19). Shared by
 * the worker process and the price-alert evaluation hook it triggers from the collector pipeline. */
export function log(scope: string, message: string) {
  console.log(`[${new Date().toISOString()}] [${scope}] ${message}`);
}

export function logError(scope: string, message: string) {
  console.error(`[${new Date().toISOString()}] [${scope}] ${message}`);
}
