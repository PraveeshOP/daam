import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { createMetricReader, createTraceExporter } from "@/lib/otel/exporters";
import { log } from "@/lib/logger";

let sdk: NodeSDK | null = null;

/**
 * The worker is a standalone Node process (not Next.js), so it sets up OpenTelemetry itself —
 * there's no `instrumentation.ts` convention here. Call this once, before anything else runs,
 * from worker/index.ts. See lib/otel/tracing.ts for the collection-job spans this enables and
 * lib/otel/metrics.ts for the counters/histograms recorded through it.
 */
export function startWorkerTelemetry(): void {
  if (sdk) return;
  sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "pricenepal-worker" }),
    traceExporter: createTraceExporter(),
    metricReaders: [createMetricReader()],
  });
  sdk.start();
  log("otel", `worker telemetry started (exporting ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? `to ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}` : "to console — set OTEL_EXPORTER_OTLP_ENDPOINT to export elsewhere"})`);
}

export async function shutdownWorkerTelemetry(): Promise<void> {
  await sdk?.shutdown();
  sdk = null;
}
