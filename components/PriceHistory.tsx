import type { PricePoint } from "@/types";

const npr = (value: number) => `NPR ${value.toLocaleString("en-IN")}`;
const short = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 0 });

/**
 * Price over time.
 *
 * Previously drawn as bars with `height = 22 + ((max - price) / (max - min)) * 65`, which was
 * wrong twice over and produced a genuinely misleading picture:
 *
 *  1. **Inverted.** `(max - price)` gave the *cheapest* price the *tallest* bar, so a price drop
 *     rendered as a rise. Observed live: 75,000 -> 74,990 drew a 22% bar next to an 87% one.
 *  2. **Rank, not magnitude.** Normalising by `max - min` stretched whatever gap existed across
 *     the full plot, so a 10-rupee move and a 10,000-rupee move looked identical.
 *
 * It is a line now because the job is trend-over-time, not magnitude comparison across
 * categories. That also resolves the axis problem honestly: a bar encodes length from zero, so a
 * zoomed bar axis always lies — whereas a line encodes *position*, and may sit on a zoomed axis
 * as long as that axis is labelled. Both end labels and the axis bounds are drawn, and the
 * caption states outright that the axis does not start at zero.
 */
export function PriceHistory({ points }: { points: PricePoint[] }) {
  if (points.length < 2) {
    return (
      <div className="rounded-[4px] border border-[#e3e9e5] bg-white p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#88948e]">Price history</p>
        <h2 className="mt-1 text-2xl font-bold">Not enough price history yet</h2>
        <p className="mt-3 text-sm leading-6 text-[#66736e]">We need at least two recorded prices to show a meaningful trend.</p>
      </div>
    );
  }

  const prices = points.map((point) => point.price);
  const dataMin = Math.min(...prices);
  const dataMax = Math.max(...prices);
  const span = dataMax - dataMin;
  /*
   * A labelled axis makes zooming legitimate, but it does not make an arbitrarily tight zoom
   * *honest*: fitting the axis to the data alone means a 10-rupee move on a 75,000-rupee phone
   * swings the line across the whole plot, which is the same "rank, not magnitude" lie the old
   * bars told. So the axis never spans less than MIN_AXIS_SPAN_RATIO of the price level — a
   * trivial change then renders as a visibly trivial one, while a real move still fills the plot.
   */
  const MIN_AXIS_SPAN_RATIO = 0.02;
  const level = (dataMax + dataMin) / 2;
  const axisSpan = Math.max(span * 1.4, level * MIN_AXIS_SPAN_RATIO, 1);
  const midpoint = level;
  const yMin = midpoint - axisSpan / 2;
  const yMax = midpoint + axisSpan / 2;
  const yRange = yMax - yMin || 1;

  const width = 640;
  const height = 220;
  const padding = { top: 22, right: 22, bottom: 30, left: 66 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const xFor = (index: number) => padding.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const yFor = (price: number) => padding.top + (1 - (price - yMin) / yRange) * innerHeight;

  const coordinates = points.map((point, index) => ({ ...point, x: xFor(index), y: yFor(point.price) }));
  const linePath = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coordinates[coordinates.length - 1].x.toFixed(1)},${(padding.top + innerHeight).toFixed(1)} L${coordinates[0].x.toFixed(1)},${(padding.top + innerHeight).toFixed(1)} Z`;

  const first = points[0].price;
  const last = points[points.length - 1].price;
  const change = last - first;
  const changePercent = first ? (change / first) * 100 : 0;
  const gridValues = [yMax, (yMax + yMin) / 2, yMin];

  // Selective direct labels: the two endpoints define the trend. Every other point carries its
  // value in a native <title> tooltip instead of a permanent label that would collide.
  const labelled = new Set([0, coordinates.length - 1]);

  return (
    <div className="rounded-[4px] border border-[#e3e9e5] bg-white p-5 sm:p-7">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#88948e]">Price history</p>
          <h2 className="mt-1 text-2xl font-bold">Lowest prices over time</h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#d9f5ec] px-3 py-1.5 text-xs font-bold text-[#0c8b67]">Last 6 months</span>
      </div>

      {/* The headline the old chart tried (and failed) to convey through bar heights. */}
      <p className="mb-4 text-sm text-[#66736e]">
        {change === 0 ? (
          <>Unchanged at <strong className="text-[#17221f]">{npr(last)}</strong> over this period.</>
        ) : (
          <>
            <strong className={change < 0 ? "text-[#0c8b67]" : "text-[#ef745f]"}>
              {change < 0 ? "▼" : "▲"} {npr(Math.abs(change))} ({Math.abs(changePercent).toFixed(changePercent && Math.abs(changePercent) < 1 ? 2 : 1)}%)
            </strong>{" "}
            since {points[0].label}, now <strong className="text-[#17221f]">{npr(last)}</strong>.
          </>
        )}
      </p>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Lowest price from ${points[0].label} to ${points[points.length - 1].label}, ${npr(first)} to ${npr(last)}`}>
        {gridValues.map((value, index) => {
          const y = yFor(value);
          return (
            <g key={index}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e3e9e5" strokeDasharray="3 3" />
              {/* Labelled bounds are what make a non-zero axis honest rather than misleading. */}
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#88948e">{short(value)}</text>
            </g>
          );
        })}

        <path d={areaPath} fill="#0c8b67" fillOpacity="0.08" />
        <path d={linePath} fill="none" stroke="#0c8b67" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {coordinates.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="#0c8b67" stroke="#ffffff" strokeWidth="2">
              <title>{`${point.label}: ${npr(point.price)}`}</title>
            </circle>
            {labelled.has(index) && (
              <text
                x={point.x}
                y={point.y - 12}
                textAnchor={index === 0 ? "start" : "end"}
                fontSize="11"
                fontWeight="700"
                fill="#17221f"
              >
                {short(point.price)}
              </text>
            )}
            <text x={point.x} y={height - 8} textAnchor="middle" fontSize="11" fill="#88948e">{point.label}</text>
          </g>
        ))}
      </svg>

      <p className="mt-3 text-[11px] text-[#88948e]">
        Axis starts at {short(yMin)}, not zero, so small changes stay visible.
      </p>
    </div>
  );
}
