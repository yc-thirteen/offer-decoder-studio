import { useId } from "react";
import { cn } from "@/lib/utils";

/** One tile. Every wave's period divides W, and each is drawn at -H, 0, +H, so it tiles. */
const W = 240;
const H = 64;

function wavePath(k: number, amp: number, phase: number): string {
  const pts: string[] = [];
  for (let x = 0; x <= W; x += 6) {
    const y = H / 2 + amp * Math.sin((2 * Math.PI * k * x) / W + phase);
    pts.push(`${x} ${y.toFixed(1)}`);
  }
  return `M${pts.join("L")}`;
}

/** Two families of interleaved sine waves, like the anti-forgery print on a check. */
const WAVES: string[] = [
  ...[0, 1, 2, 3, 4, 5].map((i) => wavePath(2, 14, (i * Math.PI) / 3)),
  ...[0, 1, 2, 3].map((i) => wavePath(1, 30, (i * Math.PI) / 2)),
];

/**
 * The guilloché page background (harness/DESIGN.md "Guilloché background"): fine overlapping
 * sine waves in --ink at 5% opacity, tiled on --paper, generated in code. It is fixed behind
 * everything; stubs and panels sit on opaque --stub, so it never shows behind their text.
 */
export function GuillocheBackground({ className }: { className?: string }) {
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const patternId = `guilloche-${base}`;
  const groupId = `guilloche-waves-${base}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn("pointer-events-none fixed inset-0 -z-10 h-full w-full", className)}
    >
      <defs>
        <pattern id={patternId} width={W} height={H} patternUnits="userSpaceOnUse">
          <g id={groupId} className="fill-none stroke-ink" strokeOpacity={0.05} strokeWidth={1}>
            {WAVES.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <use href={`#${groupId}`} y={-H} />
          <use href={`#${groupId}`} y={H} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
