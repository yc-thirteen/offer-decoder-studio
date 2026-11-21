/**
 * Hand-built SVG: each plan's total yearly cost against medical spending (7A slide 37).
 * Dominated plans are a dashed correction line, the recommended plan a solid carbon line,
 * others ink. Lines are labeled directly, a vertical marker shows your expected spending,
 * and each plan's cost there is written beside its dot, off its own line. Drawn at the container's real pixel
 * width so the 13px labels stay 13px on a phone.
 */
import { formatMoney } from "@/components/stub";
import { planCost } from "@/lib/engine";
import { niceTicks, scale, spreadLabels, tickMoney, yAxisLeft, type Box } from "./chartKit";
import { placeValueLabels } from "./healthValueLabels";
import { lineLabel, type HealthChartData, type PlanLineKind } from "./healthChart";
import { useElementWidth } from "./useElementWidth";

const STROKE: Record<PlanLineKind, string> = {
  recommended: "var(--carbon)",
  dominated: "var(--correction)",
  other: "var(--ink)",
};

/** Rough width of one 13px, 600-weight character, for deciding when a label must wrap. */
const CHAR_PX = 7.4;

/** Text knocked out of the lines behind it with a stub-colored outline (not a shadow). */
const HALO = { stroke: "var(--stub)", strokeWidth: 4, paintOrder: "stroke" as const };

export function HealthCostChart({ data, title }: { data: HealthChartData; title: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const W = Math.max(280, width);
  const H = W < 480 ? 260 : 300;
  const m = { right: 12, top: 30, bottom: 44 };
  const x1 = W - m.right;
  const y0 = H - m.bottom;
  const y1 = m.top;

  // Labels that don't fit the plot width in one line break after the plan name.
  const n = data.lines.length;
  const labels = data.lines.map((l) => ({
    name: lineLabel(l, n),
    most: `at most ${formatMoney(l.worstCase)}`,
  }));
  const longest = Math.max(...labels.map((t) => t.name.length + t.most.length + 2));
  const twoLineAt = (left: number) => longest * CHAR_PX > x1 - left - 8;
  // Leave room above the highest line end for every line label, stacked labelGap apart.
  const topEnd = Math.max(...data.lines.map((l) => l.points[l.points.length - 1]![1]));
  const ticksFor = (gap: number) => {
    const room = n * gap + 8;
    let ticks = niceTicks(data.yMin, data.yMax, W < 480 ? 4 : 5);
    for (let top = data.yMax, k = 0; k < 8; k++) {
      const lo = ticks[0]!;
      const hi = ticks[ticks.length - 1]!;
      if (((hi - topEnd) / (hi - lo || 1)) * (y0 - y1) >= room) break;
      top *= 1.15;
      ticks = niceTicks(data.yMin, top, W < 480 ? 4 : 5);
    }
    return ticks;
  };
  // The plot starts where the widest y label fits. A narrower plot can push the line labels
  // onto two lines, which can change the ticks, so settle it in a second pass.
  let twoLine = twoLineAt(62);
  let yTicks = ticksFor(twoLine ? 32 : 16);
  let x0 = yAxisLeft(yTicks.map(tickMoney));
  if (twoLineAt(x0) !== twoLine) {
    twoLine = true;
    yTicks = ticksFor(32);
    x0 = Math.max(x0, yAxisLeft(yTicks.map(tickMoney)));
  }
  const labelGap = twoLine ? 32 : 16;
  const yLo = yTicks[0] ?? data.yMin;
  const yHi = yTicks[yTicks.length - 1] ?? data.yMax;
  const x = scale(0, data.xMax, x0, x1);
  const y = scale(yLo, yHi, y0, y1);
  const xTicks = niceTicks(0, data.xMax, Math.max(2, Math.floor((x1 - x0) / 110))).filter(
    (t) => t <= data.xMax,
  );

  const xs = x(data.spend);

  // Line labels are right-aligned at the plot edge. First try each one just above its own
  // line end; if any would cross a line, stack them in the band above the highest line end,
  // which no line reaches (cost only rises with spending). Same top-to-bottom order either way.
  const tailY = data.lines.map((l) => y(l.points[l.points.length - 1]![1]));
  const boxesAt = (ys: readonly number[]) =>
    labels.map((t, i): Box => {
      const chars = twoLine
        ? Math.max(t.name.length, t.most.length)
        : t.name.length + t.most.length + 2;
      const bottom = ys[i]! + 3;
      return [x1 - 2 - chars * CHAR_PX, bottom - labelGap, x1 - 2, bottom];
    });
  const sx = (px: number) => ((px - x0) / (x1 - x0)) * data.xMax;
  const crossesALine = (box: Box) =>
    data.lines.some((l) => {
      // Cost never falls as spending rises, so over the box's width the line spans these ys.
      const top = y(planCost(l.plan, sx(Math.min(box[2], x1))));
      const bottom = y(planCost(l.plan, sx(Math.max(box[0], x0))));
      return top < box[3] && box[1] < bottom;
    });
  const nearYs = spreadLabels(
    tailY.map((t) => t - 8),
    labelGap,
    y1 + labelGap - 6,
    y0 - 6,
  );
  const highest = Math.min(...tailY);
  const rank = tailY.map((t, i) => ({ t, i })).sort((p, q) => q.t - p.t || q.i - p.i);
  const stackYs = new Array<number>(n);
  rank.forEach(({ i }, k) => (stackYs[i] = highest - 8 - k * labelGap));
  const endYs = boxesAt(nearYs).some(crossesALine) ? stackYs : nearYs;
  const labelBoxes = boxesAt(endYs);
  // Each cost sits beside its dot, off its own line (healthValueLabels).
  const values = placeValueLabels(
    data.lines.map((l) => ({
      y: y(l.costAtSpend),
      text: formatMoney(l.costAtSpend),
      lineY: (px: number) => y(planCost(l.plan, sx(Math.min(Math.max(px, x0), x1)))),
    })),
    { xs, plot: [x0, y1, x1, y0], avoid: labelBoxes },
  );

  // The marker label sits beside the marker, on whichever side it fits, inside the chart.
  const markerText = `Your spending, ${formatMoney(data.spend)}`;
  const markerW = markerText.length * CHAR_PX;
  const markerAnchor: "start" | "end" = xs + 4 + markerW <= W ? "start" : "end";
  const markerX = markerAnchor === "start" ? xs + 4 : Math.max(xs - 4, markerW);

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
              {tickMoney(t)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xTicks.map((t, i) => (
          <text
            key={`x${t}`}
            x={x(t)}
            y={y0 + 18}
            textAnchor={i === 0 ? "start" : x(t) > x1 - 24 ? "end" : "middle"}
            fill="var(--ink-soft)"
          >
            {tickMoney(t)}
          </text>
        ))}
        <text x={x1} y={H - 6} textAnchor="end" fill="var(--ink-soft)">
          Medical spending this year
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
        {yLo < 0 && (
          <line x1={x0} x2={x1} y1={y(0)} y2={y(0)} stroke="var(--ink)" strokeOpacity={0.6} />
        )}

        {/* Expected-spending marker */}
        <line x1={xs} x2={xs} y1={y1 - 8} y2={y0} stroke="var(--ink)" strokeWidth={1} />
        <text x={markerX} y={y1 - 12} textAnchor={markerAnchor} fill="var(--ink)" fontWeight={600}>
          {markerText}
        </text>

        {/* Plan lines: other plans first, recommended on top */}
        {[...data.lines]
          .sort((a, b) => order(a.kind) - order(b.kind))
          .map((l) => (
            <polyline
              key={l.plan.id}
              data-plan-id={l.plan.id}
              data-kind={l.kind}
              points={l.points.map(([s, c]) => `${x(s)},${y(c)}`).join(" ")}
              fill="none"
              stroke={STROKE[l.kind]}
              strokeWidth={l.kind === "recommended" ? 2.5 : 2}
              strokeDasharray={l.kind === "dominated" ? "7 5" : undefined}
              strokeLinejoin="round"
            />
          ))}

        {/* Direct labels at the right end of each line */}
        {data.lines.map((l, i) => (
          <text
            key={`label-${l.plan.id}`}
            x={x1 - 2}
            y={endYs[i]}
            textAnchor="end"
            fill={STROKE[l.kind]}
            fontWeight={600}
            {...HALO}
          >
            {twoLine ? (
              <>
                <tspan x={x1 - 2} dy={-16}>
                  {labels[i]!.name}
                </tspan>
                <tspan x={x1 - 2} dy={16}>
                  {labels[i]!.most}
                </tspan>
              </>
            ) : (
              `${labels[i]!.name}, ${labels[i]!.most}`
            )}
          </text>
        ))}

        {/* Each plan's cost at your expected spending */}
        {data.lines.map((l, i) => (
          <g key={`value-${l.plan.id}`}>
            <circle cx={xs} cy={y(l.costAtSpend)} r={3.5} fill={STROKE[l.kind]} />
            <text
              data-value-label={l.plan.id}
              x={values[i]!.x}
              y={values[i]!.y}
              textAnchor={values[i]!.anchor}
              fill={STROKE[l.kind]}
              fontWeight={600}
              {...HALO}
            >
              {formatMoney(l.costAtSpend)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function order(kind: PlanLineKind): number {
  return kind === "recommended" ? 2 : kind === "other" ? 1 : 0;
}
