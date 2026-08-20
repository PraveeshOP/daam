import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";

/**
 * Both the web app (instrumentation.ts) and the worker (lib/otel/worker.ts) pick exporters the
 * same way: export to a real collector if one is configured, otherwise fall back to the console
 * so telemetry is visible in local dev without requiring any infrastructure. Standard OTel env
 * vars (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, etc.) are read directly by
 * the OTLP exporters themselves — no custom config plumbing needed here.
 */
export function hasOtlpEndpoint(): boolean {
  return Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
}

export function createTraceExporter() {
  return hasOtlpEndpoint() ? new OTLPTraceExporter() : new ConsoleSpanExporter();
}

export function createMetricReader() {
  const exporter = hasOtlpEndpoint() ? new OTLPMetricExporter() : new ConsoleMetricExporter();
  // 60s is frequent enough to be useful in the admin dashboard's "recent" sense without being
  // chatty — metrics here are a debugging aid, not the primary source the admin UI reads (that's
  // still Supabase/BullMQ directly, per lib/admin/*).
  return new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 });
}
