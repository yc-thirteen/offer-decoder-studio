/**
 * "Health plan costs" (harness/DESIGN.md "Why these elections"): for each offer, one plain
 * sentence with the conclusion, then the chart of every plan's yearly cost against medical
 * spending. A screen-reader list repeats the values written on the chart.
 */
import { formatMoney } from "@/components/stub";
import { memoName } from "@/components/decoder/memoText";
import { useDecoder } from "@/state/DecoderContext";
import { HealthCostChart } from "./HealthCostChart";
import { healthChartData, lineLabel } from "./healthChart";

export function HealthCostsPanel() {
  const { state, view } = useDecoder();
  const ready = view.stubs.filter((s) => s.offer && s.result);
  let names = view.stubs.map((s) => memoName(s.offer?.employer, s.slot));
  if (names[0] === names[1]) names = names.map((n, i) => `${n} (offer ${i + 1})`);

  return (
    <article aria-labelledby="why-health" className="border border-ink bg-stub p-4 md:p-6">
      <h3 id="why-health" className="m-0 mb-4">
        Health plan costs
      </h3>
      {ready.length === 0 ? (
        <p className="m-0 max-w-prose">
          Load a sample or fill in an offer to compare its health plans.
        </p>
      ) : (
        <>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
            {ready.map((stub) => {
              const data = healthChartData(stub.offer!, stub.result!, state.profile);
              const name = names[stub.slot]!;
              const title = `${name}: yearly cost of each health plan against medical spending from $0 to ${formatMoney(data.xMax)}.`;
              return (
                <figure key={stub.slot} className="m-0 min-w-0" data-health-offer={stub.slot}>
                  <h4 className="m-0 mb-1 text-base font-semibold">{name}</h4>
                  <p className="m-0 mb-4 max-w-prose">{data.sentence}</p>
                  <HealthCostChart data={data} title={title} />
                  <ul className="sr-only">
                    {data.lines.map((l) => (
                      <li key={l.plan.id}>
                        {lineLabel(l, data.lines.length)}: {formatMoney(l.costAtSpend)} a year at{" "}
                        {formatMoney(data.spend)} of spending, at most {formatMoney(l.worstCase)}.
                      </li>
                    ))}
                  </ul>
                </figure>
              );
            })}
          </div>
          <p className="m-0 mt-6 max-w-prose text-sm text-ink-soft">
            Each line is what a plan costs you in a year: premium, plus your share of the bills,
            minus any employer HSA deposit. A dashed red line costs more than another plan at every
            level of spending.
          </p>
        </>
      )}
    </article>
  );
}
