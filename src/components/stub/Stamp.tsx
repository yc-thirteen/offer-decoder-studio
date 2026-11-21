import { cn } from "@/lib/utils";

export type StampKind = "dominated" | "match-not-claimed";

const TEXT: Record<StampKind, string> = {
  dominated: "Dominated plan",
  "match-not-claimed": "Match not claimed",
};

/**
 * The rubber stamp (harness/DESIGN.md "The stamp"): rotated -4deg, 2px correction border,
 * 600-weight text at 85% like ink. Only two kinds exist, and a stub shows at most two.
 */
export function Stamp({ kind, className }: { kind: StampKind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block -rotate-4 whitespace-nowrap border-2 border-correction px-2 py-0.5",
        "text-sm font-semibold leading-tight text-correction opacity-85",
        className,
      )}
      data-stamp={kind}
    >
      {TEXT[kind]}
    </span>
  );
}
