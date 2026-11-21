/**
 * Money formatting for the stub (harness/DESIGN.md "Copy"): $ with thousands separators,
 * no cents for annual amounts, cents for per-paycheck amounts. Negative amounts use a
 * true minus sign. Values that round to zero never print as "-$0".
 */
const WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const CENTS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type MoneyOptions = { cents?: boolean };

export function formatMoney(value: number, { cents = false }: MoneyOptions = {}): string {
  const scale = cents ? 100 : 1;
  const rounded = Math.round(value * scale) / scale;
  if (rounded === 0) return (cents ? CENTS : WHOLE).format(0);
  const text = (cents ? CENTS : WHOLE).format(Math.abs(rounded));
  return rounded < 0 ? `−${text}` : text;
}
