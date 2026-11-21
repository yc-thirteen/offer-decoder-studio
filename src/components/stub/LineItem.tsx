import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LineItemProps = {
  label: ReactNode;
  /** Usually an <Amount />. */
  amount?: ReactNode;
  /** 15px ink-soft note under the row it explains (vesting, the 401(k) cap, tax rates). */
  note?: ReactNode;
  /** A <Stamp />, set after the label. */
  stamp?: ReactNode;
  /** line: a 17px row. total: Net pay, boxed. grand: Your yearly bottom line, boxed, 800. */
  variant?: "line" | "total" | "grand";
  /** A full-width rule above the row ("heavy" is the 2px rule above Net pay). Use this
   * instead of <StubRule /> inside a <dl>, which may only hold <dt>/<dd> groups. */
  rule?: "light" | "heavy";
  className?: string;
};

/** Rule classes per variant. Boxed rows draw it with ::before so the box keeps its border. */
const RULE: Record<NonNullable<LineItemProps["variant"]>, Record<"light" | "heavy", string>> = {
  line: { light: "mt-2 border-t border-ink pt-3.5", heavy: "mt-2 border-t-2 border-ink pt-3.5" },
  total: {
    light:
      "relative mt-6 before:absolute before:-inset-x-px before:-top-[13px] before:border-t before:border-ink",
    heavy:
      "relative mt-6 before:absolute before:-inset-x-px before:-top-[13px] before:border-t-2 before:border-ink",
  },
  grand: {
    light:
      "relative mt-6 before:absolute before:-inset-x-[2px] before:-top-[14px] before:border-t before:border-ink",
    heavy:
      "relative mt-6 before:absolute before:-inset-x-[2px] before:-top-[14px] before:border-t-2 before:border-ink",
  },
};

/**
 * One row of a stub: label left, amount on a clean right edge. Renders a <div> of <dt>/<dd>,
 * so place it inside a <dl>.
 */
export function LineItem({
  label,
  amount,
  note,
  stamp,
  variant = "line",
  rule,
  className,
}: LineItemProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4",
        variant === "line" && "py-1.5",
        variant === "total" && "my-2 border border-ink px-3 py-2",
        variant === "grand" && "my-2 border-2 border-ink px-3 py-2",
        rule && RULE[variant][rule],
        className,
      )}
    >
      <dt
        className={cn(
          variant === "line" ? "min-w-0" : "min-w-[7em]",
          variant === "total" && "font-semibold",
          variant === "grand" && "font-bold",
        )}
      >
        {label}
        {stamp && <span className="ml-3 inline-block py-1 align-middle">{stamp}</span>}
      </dt>
      <dd className={cn("amount m-0", variant !== "line" && "text-2xl font-bold")}>{amount}</dd>
      {note && <dd className="col-span-2 m-0 text-sm text-ink-soft">{note}</dd>}
    </div>
  );
}
