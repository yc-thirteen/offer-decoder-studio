/**
 * Hand-built SVG: the share of your human capital worth insuring against the markup on the
 * coverage (7A slide 28), one straight line that falls to 0% where the markup outweighs the
 * protection. A dot at the markup through work (carbon: it follows the slider) and at the
 * 100% markup on your own (ink), each with its share written beside it. Drawn at the
 * container's real pixel width so the 13px labels stay 13px on a phone.
 */
import { overlaps, scale, textBox, type Box } from "./chartKit";
import { MARKUP_X_MAX, type LifeChartData, type LifeMarkerKind } from "./lifeData";
import { useElementWidth } from "./useElementWidth";

const COLOR: Record<LifeMarkerKind, string> = {
  work: "var(--carbon)",
  own: "var(--ink)",
};

/** Text knocked out of the lines behind it with a stub-colored outline (not a shadow). */
const HALO = { stroke: "var(--stub)", strokeWidth: 4, paintOrder: "stroke" as const };

const Y_TITLE = "Share of your human capital to insure";

interface Label {
  x: number;
  y: number;
  anchor: "start" | "end";
  box: Box;
}

export function LifeChart({ data, title }: { data: LifeChartData; title: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const W = Math.max(280, width);
  const narrow = W < 480;
  const x0 = 48;
  const x1 = W - 12;
  const y1 = 34;
  const H = narrow ? 220 : 240;
  const y0 = H - 44;
  const x = scale(0, MARKUP_X_MAX, x0, x1);
  const y = scale(0, 100, y0, y1);

  const yTicks = narrow ? [0, 50, 100] : [0, 25, 50, 75, 100];
  const step = (x1 - x0) / (MARKUP_X_MAX / 25) < 48 ? 50 : 25;
  const xTicks: number[] = [];
  for (let t = 0; t <= MARKUP_X_MAX; t += step) xTicks.push(t);

  const yTitleBox = textBox(Y_TITLE, 0, 14, "start");
  const dots = data.markers.map((mk) => ({ mk, cx: x(mk.markupPct), cy: y(mk.fractionPct) }));

  // Each share goes beside its dot: above-right first (the line falls to the right, so that
  // side is empty), then below-left, below-right, above-left. Never over the other label.
  const labels: Label[] = [];
  const dotBoxes = dots.map(({ cx, cy }): Box => [cx - 6, cy - 6, cx + 6, cy + 6]);
  for (const { mk, cx, cy } of dots) {
    const right = (dy: number): Omit<Label, "box"> => ({ x: cx + 10, y: cy + dy, anchor: "start" });
    const left = (dy: number): Omit<Label, "box"> => ({ x: cx - 10, y: cy + dy, anchor: "end" });
    // When the two dots meet (or sit on the axis), the higher rows keep the labels apart.
    const spots = [
      right(-8),
      left(18),
      right(18),
      left(-8),
      right(-24),
      left(-24),
      right(-40),
      left(-40),
    ];
    const tries = spots.map((t): Label => ({ ...t, box: textBox(mk.label, t.x, t.y, t.anchor) }));
    const fits = (b: Box) =>
      b[0] >= x0 + 2 &&
      b[2] <= W &&
      b[1] >= 0 &&
      b[3] <= y0 - 2 &&
      !overlaps(b, yTitleBox) &&
      !dotBoxes.some((d) => overlaps(d, b)) &&
      !labels.some((l) => overlaps(l.box, b));
    labels.push(tries.find((t) => fits(t.box)) ?? tries[0]!);
  }

  return (
    <div ref={ref} className="w-full">
      <svg
        role="img"
        aria-label={title}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="block overflow-visible tabular-nums"
        fontSize={13}
      >
        <text x={0} y={14} fill="var(--ink-soft)">
          {Y_TITLE}
        </text>
        {/* Gridlines and y labels */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={x0}
              x2={x1}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--ink)"
              strokeOpacity={0.2}
              strokeDasharray="1 3"
            />
            <text x={x0 - 8} y={y(t) + 4} textAnchor="end" fill="var(--ink-soft)">
              {`${t}%`}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xTicks.map((t, i) => (
          <text
            key={`x${t}`}
            x={x(t)}
            y={y0 + 18}
            textAnchor={i === 0 ? "start" : x(t) > x1 - 12 ? "end" : "middle"}
            fill="var(--ink-soft)"
          >
            {`${t}%`}
          </text>
        ))}
        <text x={x1} y={H - 6} textAnchor="end" fill="var(--ink-soft)">
          Markup on the coverage
        </text>
        {/* Axes */}
        <line
          x1={x0}
          x2={x0}
          y1={y1}
          y2={y0}
          stroke="var(--ink)"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />
        <line
          x1={x0}
          x2={x1}
          y1={y0}
          y2={y0}
          stroke="var(--ink)"
          strokeOpacity={0.6}
          strokeWidth={1.5}
        />

        {/* Drop lines from each dot to its markup on the axis */}
        {dots.map(({ mk, cx, cy }) => (
          <line
            key={`drop-${mk.kind}`}
            x1={cx}
            x2={cx}
            y1={cy}
            y2={y0}
            stroke={COLOR[mk.kind]}
            strokeWidth={1}
          />
        ))}

        {/* The formula's line */}
        <polyline
          data-life-line=""
          points={data.points.map(([m, f]) => `${x(m)},${y(f)}`).join(" ")}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {dots.map(({ mk, cx, cy }) => (
          <circle
            key={`dot-${mk.kind}`}
            data-life-marker={mk.kind}
            cx={cx}
            cy={cy}
            r={4}
            fill={COLOR[mk.kind]}
          />
        ))}
        {dots.map(({ mk }, i) => (
          <text
            key={`label-${mk.kind}`}
            x={labels[i]!.x}
            y={labels[i]!.y}
            textAnchor={labels[i]!.anchor}
            fill={COLOR[mk.kind]}
            fontWeight={600}
            {...HALO}
          >
            {mk.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
