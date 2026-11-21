import { useId } from "react";
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "left" | "right";

/** Notch radius 12px. Paths start on the stubs' 1px border center line (0.5px in). */
const NOTCH: Record<Side, { w: number; h: number; fill: string; arc: string }> = {
  top: { w: 24, h: 13, arc: "M0 .5A12 12 0 0 0 24 .5", fill: "M0 .5A12 12 0 0 0 24 .5V13H0Z" },
  bottom: {
    w: 24,
    h: 13,
    arc: "M0 12.5A12 12 0 0 1 24 12.5",
    fill: "M0 12.5A12 12 0 0 1 24 12.5V0H0Z",
  },
  left: { w: 13, h: 24, arc: "M.5 0A12 12 0 0 1 .5 24", fill: "M.5 0A12 12 0 0 1 .5 24H13V0Z" },
  right: {
    w: 13,
    h: 24,
    arc: "M12.5 0A12 12 0 0 0 12.5 24",
    fill: "M12.5 0A12 12 0 0 0 12.5 24H0V0Z",
  },
};

function Notch({ side }: { side: Side }) {
  const n = NOTCH[side];
  return (
    <svg
      width={n.w}
      height={n.h}
      viewBox={`0 0 ${n.w} ${n.h}`}
      className="block shrink-0 overflow-visible"
      focusable="false"
    >
      <path d={n.fill} className="fill-stub" />
      <path d={n.arc} className="fill-none stroke-ink" strokeWidth={1} />
    </svg>
  );
}

/**
 * The perforation between the two stubs (harness/DESIGN.md "Perforation"): 4px holes every
 * 10px showing --paper, on a 24px strip of stub with a 12px semicircular notch cut into each
 * end. Vertical between side-by-side stubs; horizontal when they stack on mobile. Place it
 * flush between two <StubShell>s in a flex container that stretches its children.
 */
export function Perforation({
  orientation = "vertical",
  className,
}: {
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  const patternId = `perf-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const vertical = orientation === "vertical";
  return (
    <div
      aria-hidden="true"
      data-orientation={orientation}
      className={cn(
        "flex shrink-0",
        vertical ? "w-6 flex-col self-stretch" : "h-6 w-full flex-row",
        className,
      )}
    >
      <Notch side={vertical ? "top" : "left"} />
      <div className={cn("flex-1 bg-stub", vertical ? "min-h-5" : "min-w-5")}>
        <svg className="block h-full w-full" focusable="false">
          <defs>
            <pattern
              id={patternId}
              width={vertical ? 24 : 10}
              height={vertical ? 10 : 24}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={vertical ? 12 : 5}
                cy={vertical ? 5 : 12}
                r={2}
                className="fill-paper stroke-ink"
                strokeOpacity={0.4}
                strokeWidth={0.75}
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
      </div>
      <Notch side={vertical ? "bottom" : "right"} />
    </div>
  );
}
