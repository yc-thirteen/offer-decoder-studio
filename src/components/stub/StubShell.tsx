import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The stub surface (harness/DESIGN.md "Stub shape"): square corners, a 1px ink border, no
 * shadow, on --stub so the guilloché never sits behind its text. The semicircular notches are
 * drawn by <Perforation /> at its two ends, so they stay centered on the perforation where it
 * meets the stubs at every width (top and bottom on desktop, left and right when stacked).
 */
export function StubShell({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-stub=""
      className={cn("relative min-w-0 flex-1 border border-ink bg-stub p-4 md:p-6", className)}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * A full-width rule inside a stub, outside any <dl> (inside one, use LineItem's `rule`).
 * "heavy" is 2px.
 */
export function StubRule({
  weight = "light",
  className,
}: {
  weight?: "light" | "heavy";
  className?: string;
}) {
  return (
    <hr
      className={cn("my-2 border-ink", weight === "heavy" ? "border-t-2" : "border-t", className)}
    />
  );
}
