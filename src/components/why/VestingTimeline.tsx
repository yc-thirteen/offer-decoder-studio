/**
 * Hand-built SVG: how much of the employer's match you keep if you leave after 0–6 years.
 * One column per year: a 1px frame for 100%, filled in ink up to the vested percent, with
 * the percent written above (in correction red where you would forfeit all of it).
 */
import { useElementWidth } from "./useElementWidth";

export function VestingTimeline({ vested, title }: { vested: readonly number[]; title: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const W = Math.max(280, width);
  const H = 128;
  const top = 24;
  const barH = 56;
  const y0 = top + barH;
  const n = vested.length;
  const cw = W / n;
  const bw = Math.min(44, cw - 12);
  const yearText = (i: number) => (cw >= 56 ? `Year ${i}` : `${i}`);

  return (
    <div ref={ref} className="w-full">
      <svg
        role="img"
        aria-label={title}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="block tabular-nums"
        fontSize={13}
      >
        {vested.map((v, i) => {
          const cx = cw * i + cw / 2;
          const h = (Math.max(0, Math.min(100, v)) / 100) * barH;
          return (
            <g key={i} data-year={i} data-vested={v}>
              <rect
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={barH}
                fill="none"
                stroke="var(--ink)"
                strokeOpacity={0.6}
                strokeWidth={1}
              />
              {h > 0 && <rect x={cx - bw / 2} y={y0 - h} width={bw} height={h} fill="var(--ink)" />}
              <text
                x={cx}
                y={top - 8}
                textAnchor="middle"
                fill={v <= 0 ? "var(--correction)" : "var(--ink)"}
                fontWeight={600}
              >
                {`${v}%`}
              </text>
              <text x={cx} y={y0 + 18} textAnchor="middle" fill="var(--ink-soft)">
                {yearText(i)}
              </text>
            </g>
          );
        })}
        <line
          x1={0}
          x2={W}
          y1={y0}
          y2={y0}
          stroke="var(--ink)"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
        <text x={W} y={H - 6} textAnchor="end" fill="var(--ink-soft)">
          Years at the job
        </text>
      </svg>
    </div>
  );
}
