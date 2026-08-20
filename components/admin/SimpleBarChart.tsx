/** A small hand-rolled bar chart matching the visual style already used for price history on
 * the public product page (components/PriceHistory.tsx) — no charting library, since a simple
 * div-based chart is all any of these admin metrics need (§14: "keep charts simple and
 * readable... do not create charts merely for decoration"). */
export function SimpleBarChart({ points, formatLabel }: { points: { day: string; count: number }[]; formatLabel?: (day: string) => string }) {
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-[#66736e]">Not enough data yet for this range.</p>;
  }
  const max = Math.max(...points.map((point) => point.count), 1);
  return (
    <div className="relative h-40 border-b border-l border-[#dce6e0] pl-3">
      <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#e3e9e5]" />
      <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#e3e9e5]" />
      <div className="flex h-full items-end justify-around gap-1 px-2">
        {points.map((point) => {
          const height = point.count === 0 ? 2 : 10 + (point.count / max) * 85;
          return (
            <div key={point.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${point.day}: ${point.count}`}>
              <span className="text-[10px] font-bold text-[#66736e]">{point.count}</span>
              <div className="w-full max-w-[28px] rounded-t-[2px] bg-[#0c8b67] transition hover:bg-[#ef745f]" style={{ height: `${height}%` }} />
              <span className="text-[10px] text-[#88948e]">{formatLabel ? formatLabel(point.day) : point.day.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
