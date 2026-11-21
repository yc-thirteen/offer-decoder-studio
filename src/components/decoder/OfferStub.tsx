/**
 * The two pay stubs, bound to engine output (harness/DESIGN.md "Stub line items").
 * Every amount is the engine's number divided by the view's divisor (1 annual, pay periods
 * per paycheck); nothing here does finance. With "Use recommended elections" on, each
 * amount that changes is struck and the recommended amount written beside it in carbon.
 */
import type { ReactNode } from "react";
import { Amount, LineItem, Perforation, Stamp, StubShell } from "@/components/stub";
import type { CalcResult, OfferResult } from "@/lib/engine";
import type { StubView } from "@/state/decoderState";
import { useDecoder } from "@/state/DecoderContext";
import {
  accountLabel,
  federalNote,
  limitNote,
  placeText,
  stateTaxNote,
  stateTaxRowLabel,
  vestingNote,
} from "./stubFormat";

type NumericKey = {
  [K in keyof CalcResult]: CalcResult[K] extends number ? K : never;
}[keyof CalcResult];

/** Part of a label that reflects an election: carbon when the recommendation changed it. */
function Elected({ children, changed }: { children: ReactNode; changed: boolean }) {
  return changed ? <span className="text-carbon">{children}</span> : <>{children}</>;
}

function StubHeader({ view, headingId }: { view: StubView; headingId: string }) {
  const position = `Offer ${view.slot + 1} of 2`;
  return (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4">
      <h2 id={headingId} className="m-0">
        {view.offer ? view.offer.employer : position}
      </h2>
      {view.offer ? <span className="text-sm text-ink-soft">{position}</span> : <span />}
      {view.offer && <span className="text-sm text-ink-soft">{placeText(view.offer)}</span>}
    </div>
  );
}

function FilledStub({
  view,
  result,
  corrected,
}: {
  view: StubView & { offer: NonNullable<StubView["offer"]> };
  result: OfferResult;
  corrected: boolean;
}) {
  const { offer, divisor } = view;
  const d = result.default;
  const r = result.recommended;
  const now = corrected ? r : d;
  const perPaycheck = divisor !== 1;

  const amount = (key: NumericKey, sign = 1) => (
    <Amount
      value={(sign * d[key]) / divisor}
      next={(sign * r[key]) / divisor}
      corrected={corrected}
      cents={perPaycheck}
    />
  );
  const changed = (key: keyof CalcResult) => corrected && d[key] !== r[key];

  const plan = offer.healthPlans.find((p) => p.id === now.planId);
  const planDominated = result.dominatedPlanIds.includes(now.planId);
  const matchUnclaimed = now.employeePct < result.matchCapPct;
  const showHsa = d.employeeHsa > 0 || r.employeeHsa > 0;
  const showHsaDeposit = d.employerHsa > 0 || r.employerHsa > 0;
  const showMatch = d.employerMatch > 0 || r.employerMatch > 0 || result.matchCapPct > 0;
  const stateTax = now.stateIncomeTax;

  return (
    <>
      {perPaycheck && (
        <p className="m-0 mb-2 text-sm text-ink-soft">
          Per paycheck, {offer.payPeriods} paychecks a year
        </p>
      )}
      <dl className="m-0">
        <LineItem label="Gross pay" amount={amount("grossPay")} />
        <LineItem
          label={
            <>
              401(k),{" "}
              <Elected changed={changed("accountType")}>{accountLabel(now.accountType)}</Elected>{" "}
              <Elected changed={changed("employeePct")}>{now.employeePct}%</Elected>
            </>
          }
          amount={amount("employee401k")}
          note={now.hitsLimit401k ? limitNote() : undefined}
        />
        <LineItem
          label={
            <>
              Health plan: <Elected changed={changed("planId")}>{plan?.name ?? now.planId}</Elected>
            </>
          }
          amount={amount("healthPremium")}
          stamp={planDominated ? <Stamp kind="dominated" /> : undefined}
        />
        {showHsa && <LineItem label="HSA contribution" amount={amount("employeeHsa")} />}
        <LineItem
          label="Federal income tax"
          amount={amount("federalIncomeTax")}
          note={federalNote(now.federalMarginalRate, now.federalAverageRateOnJob)}
        />
        <LineItem label="Social Security" amount={amount("socialSecurity")} />
        <LineItem label="Medicare" amount={amount("medicare")} />
        <LineItem
          label={stateTaxRowLabel(offer, stateTax)}
          amount={amount("stateIncomeTax")}
          note={stateTaxNote(offer) ?? undefined}
        />
        <LineItem variant="total" rule="heavy" label="Net pay" amount={amount("netPay")} />
      </dl>

      <h3 className="mb-1 mt-6 text-base font-semibold">Employer adds (not in your pay)</h3>
      <dl className="m-0">
        {showMatch && (
          <LineItem
            label="401(k) match"
            amount={amount("employerMatch")}
            stamp={matchUnclaimed ? <Stamp kind="match-not-claimed" /> : undefined}
            note={vestingNote(offer.retirement.vesting)}
          />
        )}
        {showHsaDeposit && <LineItem label="HSA deposit" amount={amount("employerHsa")} />}
        <LineItem
          rule="light"
          label="Savings in your name, after future tax"
          amount={amount("savingsAfterFutureTax")}
          note="Your 401(k) and HSA money plus the employer's, less 15% tax at withdrawal on traditional dollars."
        />
        <LineItem label="Expected medical bills" amount={amount("expectedOutOfPocket", -1)} />
        <LineItem
          variant="grand"
          rule="heavy"
          label={perPaycheck ? "Your bottom line per paycheck" : "Your yearly bottom line"}
          amount={amount("bottomLine")}
        />
      </dl>
    </>
  );
}

/** One stub: filled from the engine, the engine's error, or empty. */
export function OfferStub({ view, corrected }: { view: StubView; corrected: boolean }) {
  const headingId = `offer-stub-${view.slot + 1}`;
  const { offer, result, error } = view;
  return (
    <StubShell aria-labelledby={headingId} data-slot={view.slot}>
      <StubHeader view={view} headingId={headingId} />
      {offer && result ? (
        <FilledStub view={{ ...view, offer }} result={result} corrected={corrected} />
      ) : error ? (
        <p className="m-0 text-correction">{error}</p>
      ) : (
        <p className="m-0 text-ink-soft">
          Load a sample or read an offer letter to fill this stub.
        </p>
      )}
    </StubShell>
  );
}

/**
 * Both stubs with the perforation between them: side by side from lg, stacked below
 * (side by side at 768 leaves ~345px stubs where most labels wrap).
 */
export function OfferStubs() {
  const { state, view } = useDecoder();
  const corrected = state.electionsMode === "recommended";
  return (
    <div className="mt-8 flex flex-col items-stretch lg:flex-row" data-testid="offer-stubs">
      <OfferStub view={view.stubs[0]} corrected={corrected} />
      <Perforation orientation="horizontal" className="lg:hidden" />
      <Perforation orientation="vertical" className="hidden lg:flex" />
      <OfferStub view={view.stubs[1]} corrected={corrected} />
    </div>
  );
}
