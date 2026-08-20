const TONES = {
  green: "bg-[#f0fbf7] text-[#0c8b67]",
  amber: "bg-[#fff6e6] text-[#a8710b]",
  red: "bg-[#fdecea] text-[#c0392b]",
  gray: "bg-[#f2f5f2] text-[#66736e]",
} as const;

export function StatusBadge({ label, tone }: { label: string; tone: keyof typeof TONES }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${TONES[tone]}`}>{label}</span>;
}
