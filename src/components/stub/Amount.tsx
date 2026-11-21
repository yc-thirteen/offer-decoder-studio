import { cn } from "@/lib/utils";
import { formatMoney } from "./format";

export type AmountProps = {
  /** The amount with default elections, or the only amount. `null` renders a blank amount. */
  value: number | null;
  /** The amount with recommended elections. Only shown while `corrected` is on. */
  next?: number | null;
  /** Show the correction: strike `value` in red and write `next` to its right in carbon. */
  corrected?: boolean;
  /** Per-paycheck amounts show cents. */
  cents?: boolean;
  className?: string;
};

/**
 * A right-aligned, tabular stub amount with the one motion on the site (harness/DESIGN.md
 * "The correction"): when `corrected` turns on, a 2px correction line is drawn through the
 * old amount left to right in 180ms and the new amount appears to its right in carbon.
 * Turning it off retracts the line. With prefers-reduced-motion the swap is instant.
 *
 * States: static (no `next`, the same amount, or `corrected` off), struck + new (`corrected`
 * on), and blank (`value` null). Screen readers hear "was $4,500, now $9,000".
 */
export function Amount({ value, next, corrected = false, cents = false, className }: AmountProps) {
  if (value === null) {
    return (
      <span className={cn("amount inline-block min-w-[4ch]", className)} data-state="blank">
        <span className="sr-only">No amount yet</span>
      </span>
    );
  }

  const was = formatMoney(value, { cents });
  const now = next === undefined || next === null ? null : formatMoney(next, { cents });
  const changes = now !== null && now !== was;
  const showNew = changes && corrected;

  return (
    <span
      className={cn("amount inline-flex flex-wrap items-baseline justify-end gap-x-2", className)}
      data-state={showNew ? "corrected" : "static"}
    >
      {showNew && <span className="sr-only">{`was ${was}, now ${now}`}</span>}
      <span className="relative inline-block" aria-hidden={showNew || undefined}>
        {was}
        {changes && (
          <span
            aria-hidden="true"
            data-strike
            className={cn(
              "pointer-events-none absolute inset-x-0 top-[calc(50%-1px)] h-[2px] origin-left bg-correction",
              "transition-transform duration-180 ease-linear motion-reduce:transition-none",
              showNew ? "scale-x-100" : "scale-x-0",
            )}
          />
        )}
      </span>
      {showNew && (
        <span aria-hidden="true" className="text-carbon">
          {now}
        </span>
      )}
    </span>
  );
}
