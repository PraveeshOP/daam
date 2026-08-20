import { startWorkerTelemetry } from "@/lib/otel/worker";
import { logError } from "@/lib/logger";

/**
 * Deliberately tiny — see worker/run.ts for why the actual worker only gets imported
 * (dynamically) after telemetry is started, not before.
 */
async function main() {
  startWorkerTelemetry();
  const { runWorker } = await import("@/worker/run");
  await runWorker();
}

main().catch((error) => {
  logError("worker", `fatal: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
