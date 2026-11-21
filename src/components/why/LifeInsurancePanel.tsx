/**
 * "Life insurance" (harness/DESIGN.md "Why these elections"): only when someone depends on
 * your income. Two sliders (risk aversion 1–6 and the markup on coverage through work) feed
 * the engine's lifeInsurance() live. For each offer: the coverage to get, why, the share of
 * human capital worth insuring against the markup, and the dollars line by line.
 */
import { useId, useState } from "react";
import { formatMoney, LineItem } from "@/components/stub";
import { memoName } from "@/components/decoder/memoText";
import { useDecoder } from "@/state/DecoderContext";
import { LifeChart } from "./LifeChart";
import {
  LECTURE_SETTINGS,
  MARKUP_RANGE,
  RISK_AVERSION_RANGE,
  formatRiskAversion,
  isLectureSettings,
  lifeChartData,
  type LifeSettings,
} from "./lifeData";

function Slider({
  label,
  hint,
  value,
  valueText,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  valueText: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <output htmlFor={id} className="font-semibold text-carbon tabular-nums">
          {valueText}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 block w-full accent-carbon"
      />
      <p id={`${id}-hint`} className="m-0 mt-1 text-sm text-ink-soft">
        {hint}
      </p>
    </div>
  );
}

export function LifeInsurancePanel() {
  const { state, view } = useDecoder();
  const [settings, setSettings] = useState<LifeSettings>({ ...LECTURE_SETTINGS });
  if (!state.profile.hasDependents) return null;

  const ready = view.stubs.filter((s) => s.offer && s.result);
  let names = view.stubs.map((s) => memoName(s.offer?.employer, s.slot));
  if (names[0] === names[1]) names = names.map((n, i) => `${n} (offer ${i + 1})`);
  const markupPct = Math.round(settings.employerMarkup * 100);
  const lecture = isLectureSettings(settings);

  return (
    <article aria-labelledby="why-life" className="border border-ink bg-stub p-4 md:p-6">
      <h3 id="why-life" className="m-0 mb-4">
        Life insurance
      </h3>
      {ready.length === 0 ? (
        <p className="m-0 max-w-prose">
          Load a sample or fill in an offer to see how much life insurance to get.
        </p>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 md:gap-8" data-life-controls="">
            <Slider
              label="Risk aversion"
              hint="1 shrugs off risk, 6 pays a lot to avoid it. The lecture uses 3."
              value={settings.riskAversion}
              valueText={formatRiskAversion(settings.riskAversion)}
              {...RISK_AVERSION_RANGE}
              onChange={(riskAversion) => setSettings((s) => ({ ...s, riskAversion }))}
            />
            <Slider
              label="Markup on coverage through work"
              hint="What the group plan charges above expected payouts. The lecture uses 20%; a policy on your own runs about 100%."
              value={markupPct}
              valueText={`${markupPct}%`}
              {...MARKUP_RANGE}
              onChange={(pct) => setSettings((s) => ({ ...s, employerMarkup: pct / 100 }))}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={() => setSettings({ ...LECTURE_SETTINGS })}
              className="h-10 shrink-0 border border-ink bg-stub px-4 font-semibold underline-offset-3 hover:underline"
            >
              Use lecture values
            </button>
            <p className="m-0 text-sm text-ink-soft" aria-live="polite">
              {lecture
                ? ""
                : `The checklist still uses the lecture values: risk aversion ${formatRiskAversion(LECTURE_SETTINGS.riskAversion)} and a ${Math.round(LECTURE_SETTINGS.employerMarkup * 100)}% markup through work.`}
            </p>
          </div>

          <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-8">
            {ready.map((stub) => {
              const data = lifeChartData(stub.offer!, stub.result!, state.profile, settings);
              if (!data) return null;
              const name = names[stub.slot]!;
              return (
                <figure key={stub.slot} className="m-0 min-w-0" data-life-offer={stub.slot}>
                  <h4 className="m-0 mb-1 text-base font-semibold">{name}</h4>
                  <p className="m-0 mb-2 max-w-prose" data-life-sentence="">
                    {data.sentence}
                  </p>
                  <p className="m-0 mb-4 max-w-prose">{data.reason}</p>
                  <LifeChart
                    data={data}
                    title={`${name}: share of your human capital worth insuring against the markup on the coverage, from 0% to 150%.`}
                  />
                  <ul className="sr-only">
                    {data.markers.map((mk) => (
                      <li key={mk.kind}>
                        {mk.kind === "work" ? "Through work" : "On your own"}, at a {mk.markupPct}%
                        markup: insure {Math.round(mk.fractionPct)}% of your human capital.
                      </li>
                    ))}
                  </ul>
                  <dl className="m-0 mt-6">
                    <LineItem label="Human capital" amount={formatMoney(data.life.humanCapital)} />
                    {data.rows.map((row) => (
                      <LineItem
                        key={row.label}
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
            The share worth insuring is 1 − (markup ÷ risk aversion) ÷ (human capital ÷ household
            wealth), from Lecture 7A. Buy through work first, since group coverage costs less, up to
            the plan's maximum. Top up on your own only to the smaller on-your-own share. Term, not
            whole life.
          </p>
        </>
      )}
    </article>
  );
}
