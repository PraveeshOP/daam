import { loadEnvConfig } from "@next/env";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import { createMobilemanduCategoryCollector } from "@/collectors/mobilemandu/createCategoryCollector";
import { SMARTWATCH_CATEGORY, SMARTWATCH_URL_HINT, SMARTWATCH_URL_EXCLUDE } from "@/collectors/mobilemandu/parser";

loadEnvConfig(process.cwd());

export const mobilemanduSmartwatchCollector = createMobilemanduCategoryCollector({
  storeId: "mobilemandu-smartwatches",
  categoryName: "Smartwatches",
  categorySlug: "smartwatches",
  expectedCategory: SMARTWATCH_CATEGORY,
  urlHint: SMARTWATCH_URL_HINT,
  urlExclude: SMARTWATCH_URL_EXCLUDE,
});

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(mobilemanduSmartwatchCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(mobilemanduSmartwatchCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
