import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/logger";

/**
 * §I-analytics (phase-9 audit): analytics_events has no retention/rollup plan and grows
 * unbounded on every search/view/click. All current read paths are already time-bounded
 * (`created_at >= since`), so this isn't hurting query latency yet — but "no plan at all" is a
 * real gap the audit called out. This is a plain deletion, not an aggregation/rollup: the admin
 * dashboard's own metrics only ever look back 90 days at most (lib/admin/analytics.ts's
 * `TimeRange`), so a generous multi-year retention window loses nothing any current view reads,
 * while still keeping a genuinely long history available if that ever changes.
 *
 * Deliberately a plain runnable script (`npm run analytics:prune`), not a new BullMQ queue/
 * worker processor — at today's event volume there's no operational need for a fully automated
 * recurring job yet (see docs/production-hardening.md's caching/retention section for why this
 * is scoped as "give the operator a documented command" rather than new always-on
 * infrastructure). Wiring this into worker/scheduler.ts as a low-frequency BullMQ job is the
 * natural next step once it's actually needed on a recurring basis without operator involvement.
 */
export async function pruneOldAnalyticsEvents(retentionDays = 400): Promise<{ deleted: number }> {
  const client = createServiceClient();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await client.from("analytics_events").delete({ count: "exact" }).lt("created_at", cutoff);
  if (error) throw new Error(`analytics_events prune failed: ${error.message}`);
  return { deleted: count ?? 0 };
}

async function main() {
  const retentionDaysArg = process.argv.find((argument) => argument.startsWith("--days="));
  const retentionDays = retentionDaysArg ? Number(retentionDaysArg.split("=")[1]) : undefined;
  const { deleted } = await pruneOldAnalyticsEvents(retentionDays);
  log("analytics", `pruned ${deleted} analytics_events row(s) older than ${retentionDays ?? 400} days`);
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nanalytics prune failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
