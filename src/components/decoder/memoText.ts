/**
 * The memo line's words (harness/DESIGN.md "Memo line"). Pure: it only reads the engine's
 * bottom lines and winners from the view and formats them. Amounts are always yearly,
 * even in per-paycheck mode, because the two offers can have different pay periods.
 */
import { formatMoney } from "@/components/stub";
import type { DecoderView, ElectionsMode } from "@/state/decoderState";

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
export function memoText(view: DecoderView, mode: ElectionsMode): string {
  const [a, b] = view.stubs;
  if (a.error || b.error) return "Fix the offer marked in red to see which one is worth more.";
  if (!a.result && !b.result) {
    return "Load a sample or fill in two offers to see which one is worth more.";
  }
  if (!a.result || !b.result || !view.winners) {
    return "Fill in a second offer to see which one is worth more.";
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
