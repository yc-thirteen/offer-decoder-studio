/**
 * Hand-built SVG: employer match dollars against your contribution % (7B), bending at each
 * tier edge. A marker at the default % (ink) and the recommended % (carbon), each with its
 * dollars written by its dot. When the default stops short of the whole match, a dashed
 * correction bracket shows the money left on the table. Drawn at the container's real
 * pixel width so the 13px labels stay 13px on a phone.
 */
import { formatMoney } from "@/components/stub";
import { niceTicks, scale, tickMoney, yAxisLeft } from "./chartKit";
import type { MarkerKind, MatchChartData } from "./matchData";
import {
  CHAR_PX,
  LINE_LABEL,
  labelBox,
  placeLineLabel,
  type Box,
  type LineLabel,
} from "./matchLabel";
import { useElementWidth } from "./useElementWidth";

const COLOR: Record<MarkerKind, string> = {
  default: "var(--ink)",
  recommended: "var(--carbon)",
  both: "var(--carbon)",
};

function overlaps(a: Box, b: Box): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

/** A box grown by `p` px on the left and right, for text-width estimates that run short. */
function pad(b: Box, p: number): Box {
  return [b[0] - p, b[1], b[2] + p, b[3]];
}

/** Text knocked out of the lines behind it with a stub-colored outline (not a shadow). */
const HALO = { stroke: "var(--stub)", strokeWidth: 4, paintOrder: "stroke" as const };

interface Placed {
  x: number;
  y: number;
  anchor: "start" | "end";
  text: string;
  color: string;
  box: Box;
}

function place(text: string, x: number, y: number, anchor: "start" | "end", color: string): Placed {
  const w = text.length * CHAR_PX;
  const box: Box = anchor === "start" ? [x, y - 13, x + w, y + 3] : [x - w, y - 13, x, y + 3];
  return { x, y, anchor, text, color, box };
}

export function MatchChart({ data, title }: { data: MatchChartData; title: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const W = Math.max(280, width);
  const yTicks = niceTicks(0, data.yMax, W < 480 ? 4 : 5);
  const x0 = yAxisLeft(yTicks.map(tickMoney));
  const x1 = W - 12;
  const x = scale(0, data.xMax, x0, x1);

  // Marker titles sit above the plot, beside their marker; two rows when they would collide.
  const titleAt = (pct: number, label: string, rowY: number): Placed => {
    const xm = x(pct);
    // Titles are 600 weight, a little wider than CHAR_PX, so keep 4px of slack at the edge.
    const fitsRight = xm + 4 + label.length * CHAR_PX <= W - 4;
    return place(label, fitsRight ? xm + 4 : xm - 4, rowY, fitsRight ? "start" : "end", "");
  };
  const oneRow = data.markers.map((mk) => titleAt(mk.pct, mk.label, 0));
  const twoRows = oneRow.length === 2 && overlaps(pad(oneRow[0]!.box, 8), oneRow[1]!.box);
  const inPlotLabel = placeLineLabel(
    data.markers.map((mk) => x(mk.pct)),
    x0,
    x1,
  );
  const headRow = inPlotLabel ? 0 : 16;
  const top = (twoRows ? 46 : 30) + headRow;
  const H = (W < 480 ? 230 : 260) + (twoRows ? 16 : 0) + headRow;
  const y0 = H - 44;
  const y1 = top;

  const yHi = yTicks[yTicks.length - 1] ?? data.yMax;
  const y = scale(0, yHi, y0, y1);
  const xTicks: number[] = [];
  const every = Math.max(1, Math.ceil(48 / ((x1 - x0) / (data.xMax / data.xStep))));
  for (let t = 0, k = 0; t <= data.xMax + 1e-9; t += data.xStep, k++) {
    if (k % every === 0) xTicks.push(Math.round(t * 100) / 100);
  }

  // In two rows, the upper title belongs to the marker whose line won't cross the lower title.
  const crossesLowerTitle = (i: number) => {
    const other = data.markers[1 - i]!;
    const lower = titleAt(other.pct, other.label, y1 - 12);
    const xm = x(data.markers[i]!.pct);
    return xm > lower.box[0] - 8 && xm < lower.box[2] + 8;
  };
  const upper = twoRows ? (crossesLowerTitle(0) ? 1 : 0) : -1;
  const titles = data.markers.map((mk, i) =>
    titleAt(mk.pct, mk.label, i === upper ? y1 - 28 : y1 - 12),
  );

  const dots = data.markers.map((mk) => ({ mk, cx: x(mk.pct), cy: y(mk.match) }));
  // In the plot's top band, or else in its own row above the highest marker title.
  const lineLabelAt = (lx: number, ly: number, rows: string[]): LineLabel => ({
    x: lx,
    y: ly,
    rows,
    box: labelBox(lx, ly, rows),
  });
  const lineLabel = inPlotLabel
    ? lineLabelAt(inPlotLabel.x, y1 + 14, inPlotLabel.rows)
    : lineLabelAt(x0, Math.min(...titles.map((t) => t.y)) - 16, [LINE_LABEL]);
  const inPlot = (b: Box) => b[0] >= x0 + 2 && b[2] <= x1;
  const yFull = y(data.fullMatch);

  // The bracket from the default dot up to the whole match, in correction red. Its label goes
  // above-left of the default dot (empty: the line rises to the right), else above the flat.
  const def = dots.find((dt) => dt.mk.kind === "default");
  let gap: Placed | null = null;
  if (def && data.leftOnTable > 0) {
    const text = `${formatMoney(data.leftOnTable)} left on the table`;
    const red = "var(--correction)";
    const tries = [
      place(text, def.cx - 8, (def.cy + yFull) / 2 + 4, "end", red),
      place(text, def.cx + 6, yFull - 8, "start", red),
      place(text, x1 - 2, yFull - 8, "end", red),
    ];
    gap =
      tries.find((t) => inPlot(t.box) && !overlaps(t.box, lineLabel.box)) ??
      tries[tries.length - 1]!;
  }

  // Values by each dot: below-right on the rising part of the line (empty space); above-right
  // on the flat part, or below it when that spot is taken. A $0 dot on the axis needs no
  // label: the $0 tick already says it. Two equal values that would touch are written once.
  const values: Placed[] = [];
  const taken = (b: Box) =>
    overlaps(b, lineLabel.box) ||
    (gap !== null && overlaps(b, gap.box)) ||
    values.some((v) => overlaps(v.box, b));
  for (const { mk, cx, cy } of [...dots].reverse()) {
    if (Math.round(mk.match) === 0 && cy >= y0 - 1) continue;
    const text = formatMoney(mk.match);
    const color = COLOR[mk.kind];
    const flat = mk.pct >= data.capPct;
    const ys = flat ? [cy - 8, cy + 18] : [cy + 18];
    const tries = ys.flatMap((yy) => [
      place(text, cx + (flat ? 6 : 8), yy, "start", color),
      place(text, cx - 6, yy, "end", color),
    ]);
    const p = tries.find((t) => t.box[2] <= x1 && t.box[0] >= x0 && !taken(t.box));
    if (p) values.push(p);
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
            textAnchor={i === 0 ? "start" : x(t) > x1 - 12 ? "end" : "middle"}
            fill="var(--ink-soft)"
          >
            {`${t}%`}
          </text>
        ))}
        <text x={x1} y={H - 6} textAnchor="end" fill="var(--ink-soft)">
          Your contribution, % of pay
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

        {/* Markers at the default and recommended % */}
        {data.markers.map((mk, i) => (
          <g key={`marker-${mk.kind}`} data-marker={mk.kind}>
            <line
              x1={x(mk.pct)}
              x2={x(mk.pct)}
              y1={titles[i]!.y + 4}
              y2={y0}
              stroke={COLOR[mk.kind]}
              strokeWidth={1}
            />
            <text
              x={titles[i]!.x}
              y={titles[i]!.y}
              textAnchor={titles[i]!.anchor}
              fill={COLOR[mk.kind]}
              fontWeight={600}
            >
              {mk.label}
            </text>
          </g>
        ))}

        {/* The match line */}
        <polyline
          data-match-line=""
          points={data.points.map(([p, m]) => `${x(p)},${y(m)}`).join(" ")}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {data.bends.map(([p, m]) => (
          <circle key={`bend-${p}`} cx={x(p)} cy={y(m)} r={2.5} fill="var(--ink)" />
        ))}
        <text
          data-line-label=""
          x={lineLabel.x}
          y={lineLabel.y}
          textAnchor="start"
          fill="var(--ink)"
          fontWeight={600}
          {...HALO}
        >
          {lineLabel.rows.map((row, i) => (
            <tspan key={row} x={lineLabel.x} dy={i === 0 ? 0 : 16}>
              {/* The space keeps the text content reading as one phrase. */}
              {i < lineLabel.rows.length - 1 ? `${row} ` : row}
            </tspan>
          ))}
        </text>

        {/* Money left on the table */}
        {def && gap && (
          <g data-left-on-table="">
            <line
              x1={def.cx}
              x2={def.cx}
              y1={def.cy}
              y2={y(data.fullMatch)}
              stroke="var(--correction)"
              strokeWidth={2}
              strokeDasharray="4 3"
            />
            <line
              x1={def.cx}
              x2={x(data.capPct)}
              y1={y(data.fullMatch)}
              y2={y(data.fullMatch)}
              stroke="var(--correction)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={gap.x}
              y={gap.y}
              textAnchor={gap.anchor}
              fill="var(--correction)"
              fontWeight={600}
              {...HALO}
            >
              {gap.text}
            </text>
          </g>
        )}

        {/* Dots and values at each marker */}
        {dots.map(({ mk, cx, cy }) => (
          <circle key={`dot-${mk.kind}`} cx={cx} cy={cy} r={4} fill={COLOR[mk.kind]} />
        ))}
        {values.map((v) => (
          <text
            key={`value-${v.text}-${v.x}`}
            x={v.x}
            y={v.y}
            textAnchor={v.anchor}
            fill={v.color}
            fontWeight={600}
            {...HALO}
          >
            {v.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
