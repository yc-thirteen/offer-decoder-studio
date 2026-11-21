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
  placeGapLabel,
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
  // A title goes right of its marker when it fits, else left; `side` forces one or the other.
  const titleAt = (pct: number, label: string, rowY: number, side?: "start" | "end"): Placed => {
    const xm = x(pct);
    // Titles are 600 weight, a little wider than CHAR_PX, so keep 4px of slack at the edge.
    const fitsRight = xm + 4 + label.length * CHAR_PX <= W - 4;
    const anchor = side ?? (fitsRight ? "start" : "end");
    return place(label, anchor === "start" ? xm + 4 : xm - 4, rowY, anchor, "");
  };
  const oneRow = data.markers.map((mk) => titleAt(mk.pct, mk.label, 0));
  const twoRows = oneRow.length === 2 && overlaps(pad(oneRow[0]!.box, 8), oneRow[1]!.box);
  // The line label goes in the plot's top band when a gap between markers holds it, else in
  // its own row above the marker titles. When the top band leaves the red gap label no room,
  // the line label takes its own row so the gap label can sit by its bracket.
  const layout = (ownRow: boolean) => {
    const inPlotLabel = ownRow
      ? null
      : placeLineLabel(
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
    // In two rows, the upper marker's line runs down through the lower row, so it must miss
    // the lower title. Try each marker on top with the lower title on its usual side, then on
    // the other side of its marker (when that stays inside the chart). The lower marker's line
    // starts under its own title, so it never reaches the upper one.
    const rows = (() => {
      if (!twoRows) return { upper: -1, lower: null as Placed | null };
      const tries: { upper: number; lower: Placed }[] = [];
      for (const flip of [false, true]) {
        for (const up of [0, 1]) {
          const mk = data.markers[1 - up]!;
          const usual = titleAt(mk.pct, mk.label, y1 - 12);
          const side = flip ? (usual.anchor === "start" ? "end" : "start") : undefined;
          const lower = titleAt(mk.pct, mk.label, y1 - 12, side);
          if (flip && (lower.box[0] < x0 || lower.box[2] > W - 4)) continue;
          tries.push({ upper: up, lower });
        }
      }
      const clear = tries.find(({ upper: up, lower }) => {
        const xm = x(data.markers[up]!.pct);
        return xm <= lower.box[0] - 8 || xm >= lower.box[2] + 8;
      });
      return clear ?? tries[0]!;
    })();
    const titles = data.markers.map((mk, i) =>
      i === rows.upper
        ? titleAt(mk.pct, mk.label, y1 - 28)
        : twoRows
          ? rows.lower!
          : titleAt(mk.pct, mk.label, y1 - 12),
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
    const yFull = y(data.fullMatch);

    // The bracket from the default dot up to the whole match, in correction red. Its label
    // stays clear of every marker line and of the match line (see placeGapLabel).
    const def = dots.find((dt) => dt.mk.kind === "default");
    const gap =
      def && data.leftOnTable > 0
        ? placeGapLabel({
            amount: formatMoney(data.leftOnTable),
            dot: [def.cx, def.cy],
            yFull,
            markerXs: dots.map((dt) => dt.cx),
            line: data.points.map(([p, m]) => [x(p), y(m)] as const),
            plot: { x0, x1, top: y1, bottom: y0 },
            avoid: [lineLabel.box],
          })
        : null;
    return { inPlotLabel, H, y0, y1, y, titles, dots, lineLabel, def, gap };
  };
  let L = layout(false);
  if (L.def && data.leftOnTable > 0 && !L.gap && L.inPlotLabel) L = layout(true);
  const { H, y0, y1, y, titles, dots, lineLabel, def, gap } = L;
  const xTicks: number[] = [];
  const every = Math.max(1, Math.ceil(48 / ((x1 - x0) / (data.xMax / data.xStep))));
  for (let t = 0, k = 0; t <= data.xMax + 1e-9; t += data.xStep, k++) {
    if (k % every === 0) xTicks.push(Math.round(t * 100) / 100);
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
        {def && data.leftOnTable > 0 && (
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
            {gap && (
              <text
                data-gap-label=""
                x={gap.x}
                y={gap.y}
                textAnchor={gap.anchor}
                fill="var(--correction)"
                fontWeight={600}
                {...HALO}
              >
                {gap.rows.map((row, i) => (
                  <tspan key={row} x={gap.x} dy={i === 0 ? 0 : 16}>
                    {i < gap.rows.length - 1 ? `${row} ` : row}
                  </tspan>
                ))}
              </text>
            )}
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
