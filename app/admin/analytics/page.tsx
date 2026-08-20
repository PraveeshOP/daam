import Link from "next/link";
import type { Metadata } from "next";
import {
  rangeSince,
  RANGE_LABELS,
  getUserMetrics,
  getSearchMetrics,
  getProductMetrics,
  getStoreMetrics,
  getAlertMetrics,
  getConversionMetrics,
  getOutboundClickMetrics,
  getDailySeries,
  type TimeRange,
} from "@/lib/admin/analytics";
import { SimpleBarChart } from "@/components/admin/SimpleBarChart";

export const metadata: Metadata = { title: "Analytics — PriceNepal Admin" };

const RANGES: TimeRange[] = ["today", "7d", "30d", "90d"];
const formatCount = (value: number) => value.toLocaleString("en-IN");

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = (RANGES.includes(params.range as TimeRange) ? params.range : "7d") as TimeRange;
  const since = rangeSince(range);

  const [users, search, products, stores, alerts, conversion, outbound, viewsSeries, searchSeries, clicksSeries, alertsSeries] = await Promise.all([
    getUserMetrics(since),
    getSearchMetrics(since),
    getProductMetrics(since),
    getStoreMetrics(since),
    getAlertMetrics(),
    getConversionMetrics(since),
    getOutboundClickMetrics(since),
    getDailySeries(since, "product_view"),
    getDailySeries(since, "search"),
    getDailySeries(since, "store_click"),
    getDailySeries(since, "price_alert_triggered"),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="mt-2 text-[#66736e]">How people use PriceNepal.</p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((item) => (
            <Link
              key={item}
              href={`/admin/analytics?range=${item}`}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${range === item ? "bg-[#17221f] text-white" : "border border-[#d6dfda] text-[#66736e] hover:border-[#0c8b67] hover:text-[#0c8b67]"}`}
            >
              {RANGE_LABELS[item]}
            </Link>
          ))}
        </div>
      </div>

      {/* Users */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Users</h2>
        <div className="grid grid-cols-3 gap-4">
          <Metric label="Total users" value={users.totalUsers} />
          <Metric label={`New users (${RANGE_LABELS[range]})`} value={users.newUsers} />
          <Metric label={`Active users (${RANGE_LABELS[range]})`} value={users.activeUsers} />
        </div>
      </section>

      {/* Searches */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Searches</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Searches today" value={search.searchesToday} />
          <Metric label="Searches this week" value={search.searchesThisWeek} />
        </div>
        <div className="mt-4 rounded-[4px] border border-[#e3e9e5] bg-white p-5">
          <p className="mb-3 text-sm font-bold text-[#66736e]">Searches over time ({RANGE_LABELS[range]})</p>
          <SimpleBarChart points={searchSeries} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TopList title="Top searches" rows={search.topSearches.map((row) => ({ label: row.query, count: row.count }))} />
          <TopList
            title="Zero-result searches"
            rows={search.zeroResultSearches.map((row) => ({ label: row.query, count: row.count }))}
            emptyText="No zero-result searches in this range — nice."
          />
        </div>
      </section>

      {/* Products */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Products</h2>
        <div className="mb-4 rounded-[4px] border border-[#e3e9e5] bg-white p-5">
          <p className="mb-3 text-sm font-bold text-[#66736e]">Product views over time ({RANGE_LABELS[range]})</p>
          <SimpleBarChart points={viewsSeries} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TopList title="Most viewed" rows={products.mostViewed.map((row) => ({ label: row.name, count: row.count, href: row.slug ? `/product/${row.slug}` : undefined }))} />
          <TopList title="Most favorited" rows={products.mostFavorited.map((row) => ({ label: row.name, count: row.count, href: row.slug ? `/product/${row.slug}` : undefined }))} />
          <TopList title="Most alerted" rows={products.mostAlerted.map((row) => ({ label: row.name, count: row.count, href: row.slug ? `/product/${row.slug}` : undefined }))} />
        </div>
      </section>

      {/* Stores */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Stores</h2>
        <div className="mb-4 rounded-[4px] border border-[#e3e9e5] bg-white p-5">
          <p className="mb-3 text-sm font-bold text-[#66736e]">Store clicks over time ({RANGE_LABELS[range]})</p>
          <SimpleBarChart points={clicksSeries} />
        </div>
        <TopList title="Most clicked stores" rows={stores.mostClicked.map((row) => ({ label: row.name, count: row.count }))} />
      </section>

      {/* Price alerts */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Price alerts</h2>
        <div className="grid grid-cols-3 gap-4">
          <Metric label="Active alerts" value={alerts.activeAlerts} />
          <Metric label="Triggered alerts (all time)" value={alerts.triggeredAlerts} />
          <Metric label="Triggered today" value={alerts.triggeredToday} />
        </div>
        <div className="mt-4 rounded-[4px] border border-[#e3e9e5] bg-white p-5">
          <p className="mb-3 text-sm font-bold text-[#66736e]">Alerts triggered over time ({RANGE_LABELS[range]})</p>
          <SimpleBarChart points={alertsSeries} />
        </div>
      </section>

      {/* Affiliate / outbound clicks */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Affiliate performance ({RANGE_LABELS[range]})</h2>
        <div className="grid grid-cols-3 gap-4">
          <Metric label="Total outbound clicks" value={outbound.total} />
          <Metric label="Via affiliate link" value={outbound.affiliate} />
          <Metric label="Direct to store" value={outbound.direct} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TopList title="Outbound clicks by store" rows={outbound.byStore.map((row) => ({ label: row.name, count: row.count }))} />
          <TopList title="Outbound clicks by product" rows={outbound.byProduct.map((row) => ({ label: row.name, count: row.count, href: row.slug ? `/product/${row.slug}` : undefined }))} />
        </div>
        <p className="mt-3 rounded-[3px] border border-dashed border-[#d6dfda] px-3 py-2.5 text-xs font-semibold text-[#88948e]">
          Purchases / revenue: Not available. PriceNepal only ever observes the outbound click — no store partner currently reports back whether it became a sale, so no conversion or revenue figure is shown here.
        </p>
      </section>

      {/* Conversion */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Conversion ({RANGE_LABELS[range]})</h2>
        <p className="mb-3 text-xs text-[#88948e]">
          Aggregate rates over the period (total store clicks ÷ total product views, etc.) — not a per-visitor funnel, since no session id links one visitor&apos;s search to their later click.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <ConversionCard title="View → Store click" from={conversion.productViews} fromLabel="Product views" to={conversion.storeClicks} toLabel="Store clicks" rate={conversion.storeClickRate} />
          <ConversionCard title="View → Favorite" from={conversion.productViews} fromLabel="Product views" to={conversion.favoritesAdded} toLabel="Favorites" rate={conversion.favoriteRate} />
          <ConversionCard title="View → Price alert" from={conversion.productViews} fromLabel="Product views" to={conversion.alertsCreated} toLabel="Alerts created" rate={conversion.alertRate} />
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[4px] border border-[#e3e9e5] bg-white p-4">
      <p className="text-2xl font-bold">{formatCount(value)}</p>
      <p className="text-xs font-semibold text-[#66736e]">{label}</p>
    </div>
  );
}

function TopList({ title, rows, emptyText = "No data yet." }: { title: string; rows: { label: string; count: number; href?: string }[]; emptyText?: string }) {
  return (
    <div className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
      <p className="mb-3 text-sm font-bold text-[#66736e]">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-[#88948e]">{emptyText}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((row, index) => (
            <li key={`${row.label}-${index}`} className="flex items-center justify-between gap-3">
              {row.href ? (
                <Link href={row.href} className="min-w-0 flex-1 truncate hover:text-[#0c8b67]">
                  {row.label}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
              )}
              <span className="shrink-0 font-bold">{formatCount(row.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConversionCard({ title, from, fromLabel, to, toLabel, rate }: { title: string; from: number; fromLabel: string; to: number; toLabel: string; rate: number | null }) {
  return (
    <div className="rounded-[4px] border border-[#e3e9e5] bg-white p-5">
      <p className="text-sm font-bold text-[#66736e]">{title}</p>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span>{fromLabel}</span>
        <span className="font-bold">{formatCount(from)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span>{toLabel}</span>
        <span className="font-bold">{formatCount(to)}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-[#0c8b67]">{rate === null ? "—" : `${rate}%`}</p>
    </div>
  );
}
