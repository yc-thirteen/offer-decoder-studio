/**
 * Hand-built SVG: the federal brackets as a staircase of rates (Lecture 4B), with the income
 * they tax hatched in ink up to your taxable income (carbon marker) and the average rate on
 * your pay as a dashed line. The steps past your income are dashed: a raise lands there, and
 * only the new dollars pay that rate. Drawn at the container's real pixel width so the 13px
 * labels stay 13px on a phone.
 */
import { useId } from "react";
import { formatMoney } from "@/components/stub";
import { pct } from "@/components/decoder/stubFormat";
import { CHAR_PX, niceTicks, overlaps, scale, textBox, tickMoney, type Box } from "./chartKit";
import type { TaxChartData } from "./taxData";
import { useElementWidth } from "./useElementWidth";

/** Text knocked out of the lines behind it with a stub-colored outline (not a shadow). */
const HALO = { stroke: "var(--stub)", strokeWidth: 4, paintOrder: "stroke" as const };

interface Label {
  text: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  color: string;
  box: Box;
  yours: boolean;
}

function centered(text: string, x: number, y: number, color: string, yours: boolean): Label {
  const w = text.length * CHAR_PX;
  return { text, x, y, anchor: "middle", color, box: [x - w / 2, y - 13, x + w / 2, y + 3], yours };
}

export function TaxChart({
  data,
  title,
  household,
}: {
  data: TaxChartData;
  title: string;
  household: boolean;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const hatch = `tax-hatch-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const W = Math.max(280, width);
  const x0 = 44;
  const x1 = W - 12;
  const H = W < 480 ? 230 : 260;
  const y0 = H - 44;
  const y1 = 30;
  const x = scale(0, data.xMax, x0, x1);

  const topRate = Math.max(...data.steps.map((s) => s.rate * 100));
  // Rates on a 10-point grid, with room above the top step for its label.
  const yHi = Math.ceil((topRate + 5) / 10) * 10;
  const yTicks = Array.from({ length: yHi / 10 + 1 }, (_, i) => i * 10);
  const y = scale(0, yHi, y0, y1);
  const xTicks = niceTicks(0, data.xMax, W < 480 ? 3 : 4).filter((t) => t <= data.xMax);

  const xt = x(Math.min(data.taxable, data.xMax));
  const segs = data.steps.map((s) => ({
    s,
    a: x(s.lo),
    b: x(Math.min(s.hi, data.xMax)),
    yy: y(s.rate * 100),
  }));

  // The staircase as one path, split at your taxable income: solid up to it, dashed past it.
  const stairs = (from: number, to: number): string => {
    const pts: string[] = [];
    for (const { a, b, yy } of segs) {
      const l = Math.max(a, from);
      const r = Math.min(b, to);
      if (r <= l) continue;
      pts.push(`${pts.length ? "L" : "M"}${l} ${yy}`, `L${r} ${yy}`);
    }
    return pts.join(" ");
  };
  const taxedArea = (() => {
    if (xt <= x0) return "";
    const pts = [`M${x0} ${y0}`];
    for (const { a, b, yy } of segs) {
      if (a >= xt) break;
      pts.push(`L${a} ${yy}`, `L${Math.min(b, xt)} ${yy}`);
    }
    pts.push(`L${xt} ${y0}`, "Z");
    return pts.join(" ");
  })();

  const markerText = `${household ? "Household taxable income" : "Your taxable income"}, ${formatMoney(data.taxable)}`;
  const markerW = markerText.length * CHAR_PX;
  const markerAnchor: "start" | "end" = xt + 4 + markerW <= W ? "start" : "end";
  const markerX = markerAnchor === "start" ? xt + 4 : Math.max(xt - 4, markerW);

  // Everything a label must not touch: the staircase (steps and risers), the marker and its
  // title, and the average line. Lines are padded 1.5px each side (they draw 1.5–2px wide);
  // the marker 4px, so a label never hugs it.
  const ya = y(data.averagePct);
  const hasAverage = data.taxable > 0 && data.averagePct > 0;
  const obstacles: Box[] = [
    [xt - 4, y1 - 8, xt + 4, y0],
    textBox(markerText, markerX, y1 - 12, markerAnchor),
  ];
  segs.forEach(({ a, b, yy }, i) => {
    obstacles.push([a, yy - 1.5, b, yy + 1.5]);
    const prev = segs[i - 1];
    if (prev) obstacles.push([a - 1.5, Math.min(prev.yy, yy), a + 1.5, Math.max(prev.yy, yy)]);
  });
  if (hasAverage) obstacles.push([x0, ya - 1.5, xt, ya + 1.5]);
  const blocked = (box: Box) => box[1] < 0 || obstacles.some((o) => overlaps(o, box));

  // Rate labels sit above each step, centered on it, or on the part left or right of your
  // income when the marker splits it. When the average line runs through that spot, the label
  // lifts just above the line. A label with no clear spot is left off (the y axis has the rate).
  const rateLabels: Label[] = [];
  for (const { s, a, b, yy } of segs) {
    const r = pct(s.rate * 100);
    const color = s.yours ? "var(--carbon)" : "var(--ink)";
    const tries = s.yours ? [`${r} marginal`, r] : [r];
    const spans: [number, number][] = [[a, b]];
    if (a < xt && xt < b) spans.push([a, xt], [xt, b]);
    const ys = [yy - 8, ya - 5].filter((v) => v <= yy - 8);
    let placed: Label | undefined;
    for (const text of tries) {
      for (const [l, rr] of spans) {
        for (const yb of ys) {
          const lab = centered(text, (l + rr) / 2, yb, color, s.yours);
          if (lab.box[0] >= l + 3 && lab.box[2] <= rr - 3 && !blocked(lab.box)) {
            placed = lab;
            break;
          }
        }
        if (placed) break;
      }
      if (placed) break;
    }
    if (placed) rateLabels.push(placed);
  }

  // The average line runs from the axis to your income. Its label sits just past the marker,
  // in the empty space under the dashed steps (the average is below the marginal rate), on two
  // lines when one is too wide. Where it doesn't fit there, it goes above or below the line's
  // left end. Every spot must clear the lines; one that only covers a lower-bracket rate label
  // drops that label.
  let average: Label[] = [];
  let shown = rateLabels;
  if (hasAverage) {
    const long = `Average ${pct(data.averagePct)} of your pay`;
    const short = `Average ${pct(data.averagePct)}`;
    const at = (t: string, xx: number, yy: number): Label => {
      const b = textBox(t, xx, yy, "start");
      return { text: t, x: xx, y: yy, anchor: "start", color: "var(--ink)", box: b, yours: false };
    };
    const ownY = segs.find((sg) => sg.s.yours)?.yy ?? y1;
    // Right of the marker: level with the line's end, or just under your step when it's close.
    const ry = Math.max(ya + 4, ownY + 16.5);
    const candidates: Label[][] = [
      [at(long, xt + 6, ry)],
      [at(short, xt + 6, ry)],
      [at("Average", xt + 6, ry), at(pct(data.averagePct), xt + 6, ry + 16)],
      ...[long, short].flatMap((t) => [[at(t, x0 + 6, ya - 7)], [at(t, x0 + 6, ya + 17)]]),
    ];
    const fits = (ls: Label[]) =>
      ls.every((l) => l.box[2] <= x1 && l.box[3] < y0 - 2 && !blocked(l.box));
    const covers = (ls: Label[], r: Label) => ls.some((l) => overlaps(l.box, r.box));
    const pick =
      candidates.find((ls) => fits(ls) && !rateLabels.some((r) => covers(ls, r))) ??
      candidates.find((ls) => fits(ls) && !rateLabels.some((r) => r.yours && covers(ls, r))) ??
      candidates[0]!;
    average = pick;
    shown = rateLabels.filter((r) => r.yours || !covers(pick, r));
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
        <defs>
          <pattern
            id={hatch}
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={6} stroke="var(--ink)" strokeWidth={1.5} />
          </pattern>
        </defs>
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
            textAnchor={i === 0 ? "start" : x(t) > x1 - 24 ? "end" : "middle"}
            fill="var(--ink-soft)"
          >
            {W < 480 && t >= 1000 ? `$${t / 1000}k` : tickMoney(t)}
          </text>
        ))}
        <text x={x1} y={H - 6} textAnchor="end" fill="var(--ink-soft)">
          Taxable income
        </text>

        {/* The income your brackets tax, then the staircase of rates */}
        {taxedArea && (
          <path d={taxedArea} fill={`url(#${hatch})`} fillOpacity={0.35} data-taxed="" />
        )}
        <path
          d={stairs(x0, xt)}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={2}
          data-stairs="taxed"
        />
        <path
          d={stairs(xt, x1)}
          fill="none"
          stroke="var(--ink)"
          strokeOpacity={0.6}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          data-stairs="above"
        />

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

        {/* Average rate on your pay */}
        {average.length > 0 && (
          <g data-average={data.averagePct}>
            <line
              x1={x0}
              x2={xt}
              y1={y(data.averagePct)}
              y2={y(data.averagePct)}
              stroke="var(--ink)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            {average.map((l) => (
              <text key={l.text} x={l.x} y={l.y} fill={l.color} fontWeight={600} {...HALO}>
                {l.text}
              </text>
            ))}
          </g>
        )}

        {/* Your taxable income */}
        <line
          x1={xt}
          x2={xt}
          y1={y1 - 8}
          y2={y0}
          stroke="var(--carbon)"
          strokeWidth={1.5}
          data-marker={data.taxable}
        />
        <text
          x={markerX}
          y={y1 - 12}
          textAnchor={markerAnchor}
          fill="var(--carbon)"
          fontWeight={600}
        >
          {markerText}
        </text>

        {shown.map((l) => (
          <text
            key={l.text}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            fill={l.color}
            fontWeight={600}
            data-rate-label={l.yours ? "yours" : ""}
            {...HALO}
          >
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
