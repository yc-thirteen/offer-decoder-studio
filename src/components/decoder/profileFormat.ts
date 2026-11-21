/** Pure helpers for the About you block (kept apart so the component file only exports components). */
import type { Profile } from "@/lib/engine";

/** "12,000" from 12000; 0 stays "0" so a zero still reads as a value. */
export function groupDigits(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Parses "$12,000" or "12000" to 12000; null when it isn't a whole, non-negative amount. */
export function parseDollars(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned));
}

export function parseAge(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 16 && n <= 100 ? n : null;
}

/** One line for the collapsed mobile view, e.g. "Single, just me, $2,000 medical spending". */
export function profileSummary(p: Profile): string {
  const filing = p.filingStatus === "mfj" ? "Married filing jointly" : "Single";
  const coverage = p.coverage === "family" ? "family coverage" : "just me";
  return `${filing}, ${coverage}, $${groupDigits(p.expectedMedicalSpend)} medical spending`;
}
