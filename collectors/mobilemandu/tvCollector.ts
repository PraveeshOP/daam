import { loadEnvConfig } from "@next/env";
import { formatSummary, runStoreCollection } from "@/collectors/core/run";
import { createMobilemanduCategoryCollector } from "@/collectors/mobilemandu/createCategoryCollector";
import { TV_CATEGORY, TV_URL_HINT, TV_URL_EXCLUDE } from "@/collectors/mobilemandu/parser";

loadEnvConfig(process.cwd());

export const mobilemanduTvCollector = createMobilemanduCategoryCollector({
  storeId: "mobilemandu-tv",
  categoryName: "TVs",
  categorySlug: "televisions",
  expectedCategory: TV_CATEGORY,
  urlHint: TV_URL_HINT,
  urlExclude: TV_URL_EXCLUDE,
});

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArgument = process.argv.find((argument) => argument.startsWith("--limit="));
  const startedAt = new Date();
  const { summary, durationMs } = await runStoreCollection(mobilemanduTvCollector, { dryRun, limit: Number(limitArgument?.split("=")[1] || 20) });
  console.log(formatSummary(mobilemanduTvCollector.store.name, summary, durationMs, startedAt));
  if (summary.errors.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => { console.error(`\nCollector failed: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
}
