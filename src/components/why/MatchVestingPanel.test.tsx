import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { employee401kDollars, employerMatch } from "@/lib/engine";
import { SAMPLE_CASES, deriveView, initialDecoderState } from "@/state/decoderState";
import { DecoderProvider } from "@/state/DecoderContext";
import { matchChartData, pctWindow, vestingSentence } from "./matchData";
import {
  MARKER_CLEARANCE,
  placeGapLabel,
  placeLineLabel,
  segmentHitsBox,
  type Box,
} from "./matchLabel";
import { MatchVestingPanel } from "./MatchVestingPanel";

function dataFor(sampleId: string, slot: 0 | 1) {
  const s = initialDecoderState(sampleId);
  const stub = deriveView(s).stubs[slot];
  return matchChartData(stub.offer!, stub.result!);
}

describe("matchChartData", () => {
  it("states the chicago-vs-austin conclusions", () => {
    const north = dataFor("chicago-vs-austin", 0);
    expect(north.sentence).toBe(
      "Put in at least 6% to get the whole match: at the default 3% the employer adds $2,250 a " +
        "year, at 6% it adds $4,500, so the default leaves $2,250 on the table. The recommended " +
        "12% saves more of your own pay past that.",
    );
    expect(north.vestingSentence).toBe(
      "The match vests all at once after 3 years: leave sooner and you forfeit all of it. At " +
        "the recommended 12%, that is $4,500 of match a year.",
    );
    expect(north.leftOnTable).toBe(2250);
    expect(north.markers.map((m) => [m.label, m.match])).toEqual([
      ["Default 3%", 2250],
      ["Recommended 12%", 4500],
    ]);
    const lake = dataFor("chicago-vs-austin", 1);
    expect(lake.sentence).toBe(
      "The default 4% already gets the whole match, $5,600 a year; the match stops growing at " +
        "4% of pay. The recommended 11% saves more of your own pay past that.",
    );
    expect(lake.vestingSentence).toBe(
      "The match is yours from day one, so leaving early forfeits none of it.",
    );
    expect(lake.leftOnTable).toBe(0);
  });

  it("bends at every tier edge, including the Midway 4/3 then 2× match", () => {
    const midway = dataFor("university-staff", 0);
    expect(midway.bends.map(([p]) => p)).toEqual([3, 5]);
    expect(midway.fullMatch).toBeCloseTo(7600, 6);
    const cascade = dataFor("new-grad-roth", 0);
    expect(cascade.bends.map(([p]) => p)).toEqual([3, 5]);
    expect(cascade.markers[0]!.label).toBe("Default 0%");
    expect(cascade.sentence).toContain("at the default 0% the employer adds $0 a year");
  });

  it("reads graded vesting off the timeline", () => {
    expect(dataFor("new-grad-roth", 1).vestingSentence).toBe(
      "You keep 20% of the match after 1 year, rising to 100% after 5 years. Leave sooner and " +
        "you forfeit the unvested part. At the recommended 8%, that is $2,480 of match a year.",
    );
    expect(dataFor("plan-crossover", 1).vestingSentence).toMatch(
      /^You keep 50% of the match after 2 years, rising to 100% after 3 years\./,
    );
    expect(vestingSentence([0, 0, 0, 0, 0, 0, 0], 0, 5)).toBe(
      "None of the match vests in the first 6 years.",
    );
    expect(vestingSentence([0, 25, 50, 50, 50, 50, 50], 1000, 5)).toMatch(
      /rising to 50% after 6 years/,
    );
  });

  it("follows the engine for every offer of every sample", () => {
    for (const sample of SAMPLE_CASES) {
      const s = initialDecoderState(sample.id);
      for (const stub of deriveView(s).stubs) {
        const offer = stub.offer!;
        const r = stub.result!;
        const d = matchChartData(offer, r);
        // Every point is on the engine's match curve, from 0% to the window edge.
        expect(d.points[0]![0]).toBe(0);
        expect(d.points[d.points.length - 1]![0]).toBe(d.xMax);
        for (const [p, m] of d.points) {
          expect(m).toBeCloseTo(employerMatch(offer, employee401kDollars(offer, p)), 6);
        }
        // The window shows both markers and the whole match.
        expect(d.xMax).toBeGreaterThan(Math.max(r.matchCapPct, r.recommended.employeePct));
        expect(d.fullMatch).toBeCloseTo((r.maxMatchPctOfSalary * offer.salary) / 100, 0);
        const def = d.markers.find((m) => m.kind !== "recommended")!;
        const rec = d.markers.find((m) => m.kind !== "default")!;
        expect(def.match).toBe(r.default.employerMatch);
        expect(rec.match).toBe(r.recommended.employerMatch);
        expect(d.leftOnTable).toBeCloseTo(Math.max(0, d.fullMatch - r.default.employerMatch), 6);
        expect(d.vested).toEqual(r.vestedPctByYear);
        expect(d.sentence + d.vestingSentence).not.toMatch(/undefined|NaN|Infinity/);
      }
    }
  });

  it("picks a % window with round ticks", () => {
    expect(pctWindow(3)).toEqual({ xMax: 6, xStep: 1 });
    expect(pctWindow(12)).toEqual({ xMax: 14, xStep: 2 });
    expect(pctWindow(19)).toEqual({ xMax: 25, xStep: 5 });
  });
});

describe("MatchVestingPanel", () => {
  it("draws the match line, both markers, the gap in red, and the vesting timeline", () => {
    render(
      <DecoderProvider initialSampleId="chicago-vs-austin">
        <MatchVestingPanel />
      </DecoderProvider>,
    );
    expect(screen.getByRole("heading", { name: "The match and vesting" })).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: /^Northfield Health: employer match/ });
    expect(chart.querySelector("[data-match-line]")!.getAttribute("stroke")).toBe("var(--ink)");
    const def = chart.querySelector('[data-marker="default"] line')!;
    const rec = chart.querySelector('[data-marker="recommended"] line')!;
    expect(def.getAttribute("stroke")).toBe("var(--ink)");
    expect(rec.getAttribute("stroke")).toBe("var(--carbon)");
    const gap = chart.querySelector("[data-left-on-table]")!;
    expect(gap.querySelector("line")!.getAttribute("stroke")).toBe("var(--correction)");
    const text = chart.textContent ?? "";
    expect(text).toContain("Default 3%");
    expect(text).toContain("Recommended 12%");
    expect(text).toContain("$2,250 left on the table");
    expect(text).toContain("$4,500");
    expect(text).toContain("Employer match per year");
    expect(text).toContain("Your contribution, % of pay");
    // No legend boxes in the match chart.
    expect(chart.querySelectorAll("rect")).toHaveLength(0);

    const timeline = screen.getByRole("img", { name: /^Northfield Health: percent of the match/ });
    const years = [...timeline.querySelectorAll("[data-year]")];
    expect(years.map((g) => g.getAttribute("data-vested"))).toEqual([
      "0",
      "0",
      "0",
      "100",
      "100",
      "100",
      "100",
    ]);
    expect(timeline.textContent).toContain("Years at the job");

    const figure = chart.closest("figure")!;
    expect(
      within(figure).getByText("Default 3%: the employer adds $2,250 a year."),
    ).toBeInTheDocument();
    expect(within(figure).getByText("After 3 years: 100% vested.")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /^Lakeshore Systems: employer match/ }),
    ).toBeInTheDocument();
  });

  it("gives direction when there are no offers", () => {
    render(
      <DecoderProvider initialSampleId={null}>
        <MatchVestingPanel />
      </DecoderProvider>,
    );
    expect(
      screen.getByText(
        "Load a sample or fill in an offer to see what its employer match is worth.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("the match line's label", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Make every chart measure `width` px, as a ResizeObserver would in a browser. */
  function stubWidth(width: number) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: (e: { contentRect: { width: number } }[]) => void) {}
        observe() {
          this.cb([{ contentRect: { width } }]);
        }
        disconnect() {}
      },
    );
  }

  it("starts past a marker that would cross it, and breaks in two when one line won't fit", () => {
    // Clear of markers: the top left, as before.
    expect(placeLineLabel([400, 500], 62, 548)).toEqual({ x: 70, rows: [LINE] });
    // A default marker under the label (chicago-vs-austin): start just past it.
    expect(placeLineLabel([120, 450], 62, 548)).toEqual({ x: 126, rows: [LINE] });
    // No gap holds one line: two lines in the first gap that holds them.
    expect(placeLineLabel([150, 290], 50, 300)).toEqual({
      x: 156,
      rows: ["Employer match", "per year"],
    });
    // No gap holds even two lines: the chart gives it a row of its own.
    expect(placeLineLabel([126, 240], 62, 288)).toBeNull();
  });

  const LINE = "Employer match per year";

  for (const width of [300, 420, 560, 700]) {
    it(`keeps every marker line out of its box for every sample at ${width}px`, () => {
      stubWidth(width);
      for (const sample of SAMPLE_CASES) {
        const { unmount, container } = render(
          <DecoderProvider initialSampleId={sample.id}>
            <MatchVestingPanel />
          </DecoderProvider>,
        );
        const charts = [...container.querySelectorAll("svg")].filter((svg) =>
          svg.querySelector("[data-match-line]"),
        );
        expect(charts.length).toBeGreaterThan(0);
        for (const svg of charts) {
          const label = svg.querySelector("[data-line-label]")!;
          const rows = [...label.querySelectorAll("tspan")].map((t) => t.textContent!.trim());
          expect(rows.join(" ")).toBe(LINE);
          const left = Number(label.getAttribute("x"));
          const right = left + Math.max(...rows.map((r) => r.length)) * 8;
          const markers = [...svg.querySelectorAll("[data-marker] line")];
          // In its own row above the plot, it sits above where every marker line starts.
          const bottom = Number(label.getAttribute("y")) + 3 + 16 * (rows.length - 1);
          const tops = markers.map((l) => Number(l.getAttribute("y1")));
          if (bottom < Math.min(...tops)) continue;
          const markerXs = markers.map((l) => Number(l.getAttribute("x1")));
          for (const xm of markerXs) {
            const inside = xm >= left - MARKER_CLEARANCE && xm <= right + MARKER_CLEARANCE;
            expect(
              inside,
              `${sample.id} at ${width}px: marker at ${xm} in [${left}, ${right}]`,
            ).toBe(false);
          }
        }
        unmount();
      }
    });
  }
});

describe("the left-on-the-table label", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubWidth(width: number) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: (e: { contentRect: { width: number } }[]) => void) {}
        observe() {
          this.cb([{ contentRect: { width } }]);
        }
        disconnect() {}
      },
    );
  }

  // A line rising from (60, 200) to the whole match at (200, 100), flat after.
  const line = [
    [60, 200],
    [200, 100],
    [400, 100],
  ] as const;
  const plot = { x0: 60, x1: 400, top: 30, bottom: 200 };

  it("goes left of the default dot when there is room, else past a marker, else in two or three lines", () => {
    // Room left of the default: end-anchored 8px left of it, halfway up the bracket.
    const left = placeGapLabel({
      amount: "$2,250",
      dot: [316, 120],
      yFull: 100,
      markerXs: [316, 380],
      line: [
        [60, 200],
        [380, 100],
        [400, 100],
      ],
      plot,
      avoid: [],
    });
    expect(left).toMatchObject({
      x: 308,
      y: 114,
      anchor: "end",
      rows: ["$2,250 left on the table"],
    });
    // No room left of the default; one line past it or at the right edge would cross the
    // recommended marker at 230, so two lines fit between them, above the flat line.
    const two = placeGapLabel({
      amount: "$2,250",
      dot: [90, 180],
      yFull: 100,
      markerXs: [90, 230],
      line,
      plot,
      avoid: [],
    });
    expect(two).toMatchObject({ x: 96, anchor: "start", rows: ["$2,250 left", "on the table"] });
    expect(two!.box[3]).toBeLessThan(100);
    // Markers closer still: three lines.
    expect(
      placeGapLabel({
        amount: "$2,250",
        dot: [90, 180],
        yFull: 100,
        markerXs: [90, 180, 260, 330],
        line,
        plot,
        avoid: [],
      }),
    ).toMatchObject({ x: 96, anchor: "start", rows: ["$2,250", "left on", "the table"] });
    // Nothing fits: null, never a label across a line.
    expect(
      placeGapLabel({
        amount: "$2,250",
        dot: [90, 180],
        yFull: 100,
        markerXs: [90, 130, 170, 230, 290, 350],
        line,
        plot,
        avoid: [],
      }),
    ).toBeNull();
  });

  it("clips segments against boxes", () => {
    const box: Box = [10, 10, 20, 20];
    expect(segmentHitsBox([0, 15], [30, 15], box)).toBe(true);
    expect(segmentHitsBox([0, 0], [30, 5], box)).toBe(false);
    expect(segmentHitsBox([12, 12], [14, 14], box)).toBe(true);
    expect(segmentHitsBox([0, 30], [30, 0], box)).toBe(true);
    expect(segmentHitsBox([0, 25], [25, 50], box)).toBe(false);
  });

  for (const width of [300, 420, 560, 700]) {
    it(`keeps every marker line and the match line out of it for every sample at ${width}px`, () => {
      stubWidth(width);
      let seen = 0;
      for (const sample of SAMPLE_CASES) {
        const { unmount, container } = render(
          <DecoderProvider initialSampleId={sample.id}>
            <MatchVestingPanel />
          </DecoderProvider>,
        );
        for (const svg of container.querySelectorAll("svg")) {
          const group = svg.querySelector("[data-left-on-table]");
          if (!group) continue;
          const label = group.querySelector("[data-gap-label]");
          const where = `${sample.id} at ${width}px`;
          expect(label, `${where}: no label`).not.toBeNull();
          seen++;
          const rows = [...label!.querySelectorAll("tspan")].map((t) => t.textContent!.trim());
          expect(rows.join(" "), where).toMatch(/^\$[\d,]+ left on the table$/);
          const ax = Number(label!.getAttribute("x"));
          const ay = Number(label!.getAttribute("y"));
          const w = Math.max(...rows.map((r) => r.length)) * 8;
          const left = label!.getAttribute("text-anchor") === "end" ? ax - w : ax;
          const box: Box = [left, ay - 13, left + w, ay + 3 + 16 * (rows.length - 1)];
          for (const l of svg.querySelectorAll("[data-marker] line")) {
            const xm = Number(l.getAttribute("x1"));
            const inside = xm >= box[0] - MARKER_CLEARANCE && xm <= box[2] + MARKER_CLEARANCE;
            expect(inside, `${where}: marker at ${xm} in [${box[0]}, ${box[2]}]`).toBe(false);
          }
          const pts = svg
            .querySelector("[data-match-line]")!
            .getAttribute("points")!
            .split(" ")
            .map((pt) => pt.split(",").map(Number) as [number, number]);
          const hit = pts.some((p, i) => i > 0 && segmentHitsBox(pts[i - 1]!, p, box));
          expect(hit, `${where}: the match line crosses it`).toBe(false);
        }
        unmount();
      }
      expect(seen).toBeGreaterThan(0);
    });
  }
});

describe("the marker titles", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubWidth(width: number) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: (e: { contentRect: { width: number } }[]) => void) {}
        observe() {
          this.cb([{ contentRect: { width } }]);
        }
        disconnect() {}
      },
    );
  }

  for (const width of [300, 420, 560, 700]) {
    it(`keep every marker line out of the other marker's title for every sample at ${width}px`, () => {
      stubWidth(width);
      let pairs = 0;
      for (const sample of SAMPLE_CASES) {
        const { unmount, container } = render(
          <DecoderProvider initialSampleId={sample.id}>
            <MatchVestingPanel />
          </DecoderProvider>,
        );
        for (const svg of container.querySelectorAll("svg")) {
          const markers = [...svg.querySelectorAll("[data-marker]")].map((g) => {
            const line = g.querySelector("line")!;
            const text = g.querySelector("text")!;
            const tx = Number(text.getAttribute("x"));
            const ty = Number(text.getAttribute("y"));
            const w = text.textContent!.length * 8;
            const left = text.getAttribute("text-anchor") === "end" ? tx - w : tx;
            const title: Box = [left, ty - 13, left + w, ty + 3];
            return {
              kind: g.getAttribute("data-marker"),
              x: Number(line.getAttribute("x1")),
              top: Number(line.getAttribute("y1")),
              bottom: Number(line.getAttribute("y2")),
              title,
            };
          });
          if (markers.length < 2) continue;
          pairs++;
          for (const a of markers) {
            for (const b of markers) {
              if (a === b) continue;
              const crosses =
                a.x >= b.title[0] - 4 &&
                a.x <= b.title[2] + 4 &&
                a.top < b.title[3] &&
                a.bottom > b.title[1];
              expect(
                crosses,
                `${sample.id} at ${width}px: ${a.kind} line at ${a.x} crosses the ${b.kind} title [${b.title.join(", ")}]`,
              ).toBe(false);
            }
          }
        }
        unmount();
      }
      expect(pairs).toBeGreaterThan(0);
    });
  }
});
