/**
 * "The match and vesting" (harness/DESIGN.md "Why these elections"): for each offer, the
 * conclusion, the employer match against your contribution % with markers at the default
 * and recommended %, then the vesting timeline for years 0–6. Screen-reader lists repeat
 * the values written on the charts.
 */
import { formatMoney } from "@/components/stub";
import { memoName } from "@/components/decoder/memoText";
import { useDecoder } from "@/state/DecoderContext";
import { MatchChart } from "./MatchChart";
import { matchChartData } from "./matchData";
import { VestingTimeline } from "./VestingTimeline";

export function MatchVestingPanel() {
  const { view } = useDecoder();
  const ready = view.stubs.filter((s) => s.offer && s.result);
  let names = view.stubs.map((s) => memoName(s.offer?.employer, s.slot));
  if (names[0] === names[1]) names = names.map((n, i) => `${n} (offer ${i + 1})`);

  return (
    <article aria-labelledby="why-match" className="border border-ink bg-stub p-4 md:p-6">
      <h3 id="why-match" className="m-0 mb-4">
        The match and vesting
      </h3>
      {ready.length === 0 ? (
        <p className="m-0 max-w-prose">
          Load a sample or fill in an offer to see what its employer match is worth.
        </p>
      ) : (
        <>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
            {ready.map((stub) => {
              const data = matchChartData(stub.offer!, stub.result!);
              const name = names[stub.slot]!;
              return (
                <figure key={stub.slot} className="m-0 min-w-0" data-match-offer={stub.slot}>
                  <h4 className="m-0 mb-1 text-base font-semibold">{name}</h4>
                  <p className="m-0 mb-4 max-w-prose">{data.sentence}</p>
                  <MatchChart
                    data={data}
                    title={`${name}: employer match a year against your 401(k) contribution from 0% to ${data.xMax}% of pay.`}
                  />
                  <ul className="sr-only">
                    {data.markers.map((mk) => (
                      <li key={mk.kind}>
                        {mk.label}: the employer adds {formatMoney(mk.match)} a year.
                      </li>
                    ))}
                    <li>
                      The whole match is {formatMoney(data.fullMatch)} a year, reached at{" "}
                      {data.capPct}% of pay.
                    </li>
                  </ul>
                  <p className="m-0 mt-6 mb-2 max-w-prose">{data.vestingSentence}</p>
                  <VestingTimeline
                    vested={data.vested}
                    title={`${name}: percent of the match you keep if you leave after 0 to 6 years.`}
                  />
                  <ul className="sr-only">
                    {data.vested.map((v, year) => (
                      <li key={year}>
                        After {year === 1 ? "1 year" : `${year} years`}: {v}% vested.
                      </li>
                    ))}
                  </ul>
                </figure>
              );
            })}
          </div>
          <p className="m-0 mt-6 max-w-prose text-sm text-ink-soft">
            The line is what the employer adds to your 401(k) in a year at each contribution. It
            bends where a match tier ends and goes flat once you have the whole match. Vesting is
            the share of that money you keep if you leave.
          </p>
        </>
      )}
    </article>
  );
}
