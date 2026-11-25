/**
 * The memo line's words (harness/DESIGN.md "Memo line"). Pure: it only reads the engine's
 * bottom lines and winners from the view and formats them. Amounts are always yearly,
 * even in per-paycheck mode, because the two offers can have different pay periods.
 */
import { formatMoney } from "@/components/stub";
import type { DecoderView, ElectionsMode, PlanMode } from "@/state/decoderState";

/** "Midway University (staff plan)" → "Midway University". Falls back to "Offer N". */
export function memoName(employer: string | undefined, slot: number): string {
  const name = (employer ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  return name || `Offer ${slot + 1}`;
}

const LEAD: Record<ElectionsMode, string> = {
  default: "With the defaults",
  recommended: "With the recommended elections",
};

/** The memo sentences for the current view, or a direction when there is nothing to compare. */
export function memoText(view: DecoderView, mode: PlanMode): string {
  const [a, b] = view.stubs;
  if (a.error || b.error) return "Fix the offer marked in red to see which one is worth more.";
  if (!a.result && !b.result) {
    return "Load a sample or enter one offer to see its yearly result. Add a second offer to compare.";
  }
  if (mode === "custom") {
    const ready = view.stubs.filter((s) => s.calc && s.offer);
    if (ready.length === 1)
      return `${memoName(ready[0]!.offer?.employer, ready[0]!.slot)} has an estimated yearly bottom line of ${formatMoney(ready[0]!.calc!.bottomLine)}, including savings, with your plan. Add a second offer if you'd like to compare.`;
    if (a.calc && b.calc) {
      const gap = Math.abs(Math.round(a.calc.bottomLine - b.calc.bottomLine));
      if (gap === 0) return "With your plan, the two offers come out even.";
      const winner = view.activeWinnerSlot ?? 0;
      const name = memoName(view.stubs[winner].offer?.employer, winner);
      const duplicate = memoName(a.offer?.employer, 0) === memoName(b.offer?.employer, 1);
      return `With your plan, ${name}${duplicate ? ` (offer ${winner + 1})` : ""} is worth ${formatMoney(gap)} more a year, including savings.`;
    }
    return "Finish your contribution settings to see the yearly result.";
  }
  if (!a.result || !b.result || !view.winners) {
    const stub = a.result ? a : b;
    return `${memoName(stub.offer?.employer, stub.slot)} has an estimated yearly bottom line of ${formatMoney(stub.result![mode].bottomLine)}, including savings. Add a second offer if you'd like to compare.`;
  }

  let names = [memoName(a.offer?.employer, 0), memoName(b.offer?.employer, 1)];
  if (names[0] === names[1]) names = names.map((n, i) => `${n} (offer ${i + 1})`);
  const results = [a.result, b.result] as const;

  const compare = (m: ElectionsMode) => {
    const win = results[1].offerId === view.winners![m] ? 1 : 0;
    const lose = win === 1 ? 0 : 1;
    const gap = Math.round(results[win][m].bottomLine - results[lose][m].bottomLine);
    return { name: names[win], gap: Math.abs(gap), slot: win };
  };

  const sentence = (m: ElectionsMode, closer: boolean) => {
    const c = compare(m);
    if (c.gap === 0) return `${LEAD[m]}, the two offers come out even.`;
    const money = formatMoney(c.gap);
    if (m === "default") return `${LEAD[m]}, ${c.name} looks ${money} better a year.`;
    return closer
      ? `Elect correctly and ${c.name} is worth ${money} more a year.`
      : `${LEAD[m]}, ${c.name} is worth ${money} more a year.`;
  };

  const other: ElectionsMode = mode === "default" ? "recommended" : "default";
  const now = compare(mode);
  const then = compare(other);
  const flips = now.gap > 0 && then.gap > 0 && now.slot !== then.slot;
  if (!flips) return sentence(mode, false);
  return `${sentence(mode, false)} ${sentence(other, mode === "default")}`;
}
