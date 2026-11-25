/**
 * "Marginal vs average tax" (harness/DESIGN.md "Why these elections", Lecture 4B): for each
 * offer, under the elections shown on the stubs, the conclusion, a staircase of the federal
 * brackets with your taxable income marked, and the tax worked out bracket by bracket. It
 * answers "a raise pushes all my income into a higher bracket": only the new dollars move.
 */
import { formatMoney, LineItem } from "@/components/stub";
import { memoName } from "@/components/decoder/memoText";
import { pct } from "@/components/decoder/stubFormat";
import { useDecoder } from "@/state/DecoderContext";
import { TaxChart } from "./TaxChart";
import { taxChartData } from "./taxData";

export function TaxPanel() {
  const { state, view } = useDecoder();
  const ready = view.stubs.filter((s) => s.offer && s.calc);
  let names = view.stubs.map((s) => memoName(s.offer?.employer, s.slot));
  if (names[0] === names[1]) names = names.map((n, i) => `${n} (offer ${i + 1})`);
  const elections =
    state.electionsMode === "custom"
      ? "your selected contribution settings"
      : state.electionsMode === "recommended"
        ? "the recommended elections"
        : "the default elections";

  return (
    <article aria-labelledby="why-tax" className="border border-ink bg-stub p-4 md:p-6">
      <h3 id="why-tax" className="m-0 mb-4">
        Marginal vs average tax
      </h3>
      {ready.length === 0 ? (
        <p className="m-0 max-w-prose">
          Load a sample or fill in an offer to see how its federal tax is worked out.
        </p>
      ) : (
        <>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
            {ready.map((stub) => {
              const data = taxChartData(stub.calc!, state.profile);
              const household = data.spouseWages > 0;
              const name = names[stub.slot]!;
              const own = data.steps.find((s) => s.yours)!;
              return (
                <figure key={stub.slot} className="m-0 min-w-0" data-tax-offer={stub.slot}>
                  <h4 className="m-0 mb-1 text-base font-semibold">{name}</h4>
                  <p className="m-0 mb-2 max-w-prose" data-tax-sentence="">
                    {data.sentence}
                  </p>
                  <p className="m-0 mb-4 max-w-prose">{data.raiseSentence}</p>
                  <TaxChart
                    data={data}
                    household={household}
                    title={`${name}: federal tax rate on each dollar of taxable income, from $0 to ${formatMoney(data.xMax)}.`}
                  />
                  <ul className="sr-only">
                    <li>
                      {household ? "Household taxable income" : "Your taxable income"} is{" "}
                      {formatMoney(data.taxable)}, in the {pct(own.rate * 100)} bracket, your
                      marginal rate.
                    </li>
                    <li>The average federal rate on your pay is {pct(data.averagePct)}.</li>
                  </ul>
                  <dl className="m-0 mt-6">
                    {data.incomeRows.map((row) => (
                      <LineItem
                        key={row.label}
                        label={row.label}
                        amount={formatMoney(row.amount)}
                      />
                    ))}
                    <LineItem
                      rule="light"
                      label="Taxable income"
                      amount={formatMoney(data.taxable)}
                    />
                    {data.bracketRows.map((row) => (
                      <LineItem
                        key={row.label}
                        label={row.label}
                        amount={formatMoney(row.amount)}
                      />
                    ))}
                    {data.spouseRows.map((row, i) => (
                      <LineItem
                        key={row.label}
                        {...(i === 0 ? { rule: "light" as const } : {})}
                        label={row.label}
                        amount={formatMoney(row.amount)}
                      />
                    ))}
                    <LineItem
                      rule="heavy"
                      label={<span className="font-semibold">{data.total.label}</span>}
                      amount={
                        <span className="font-semibold">{formatMoney(data.total.amount)}</span>
                      }
                    />
                  </dl>
                </figure>
              );
            })}
          </div>
          <p className="m-0 mt-6 max-w-prose text-sm text-ink-soft">
            Figures use {elections}. Each bracket&apos;s rate applies only to the income inside it,
            so your marginal rate is the rate on your last dollar and your average rate is the tax
            divided by your pay. A traditional 401(k), health premiums, and HSA contributions come
            out before tax and lower your taxable income.
          </p>
        </>
      )}
    </article>
  );
}
