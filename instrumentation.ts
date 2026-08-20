import { registerOTel } from "@vercel/otel";

/**
 * Next.js's own instrumentation convention (register() runs once per server instance, before
 * it starts handling requests) — see node_modules/next/dist/docs/01-app/02-guides/instrumentation.md.
 * @vercel/otel wires up fetch/HTTP tracing automatically (so Server Component/Action calls to
 * Supabase's REST API get traced without any extra code) and exports to an OTLP collector when
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is set, otherwise falls back to a no-op/console default.
 *
 * The worker is a separate Node process and isn't covered by this file — see lib/otel/worker.ts.
 */
export function register() {
  registerOTel({ serviceName: "pricenepal-web" });
}
