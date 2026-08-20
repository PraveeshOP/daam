import { trace, SpanStatusCode, type Attributes } from "@opentelemetry/api";

const tracer = trace.getTracer("pricenepal-worker");

/**
 * Wraps `fn` in a span, recording the outcome (error status + message on throw) and re-throwing
 * so callers keep their existing error handling — this only adds observability, it never
 * changes control flow. Used at the collection-job boundaries in worker/processor.ts and
 * collectors/core/run.ts (job → collect → import → per-product), not inside small helpers —
 * see the phase-7 spec's "do not instrument every tiny function".
 */
export async function withSpan<T>(name: string, attributes: Attributes, fn: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : "unknown error" });
      throw error;
    } finally {
      span.end();
    }
  });
}
