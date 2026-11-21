/**
 * The two pay stubs, bound to engine output (harness/DESIGN.md "Stub line items").
 * Every amount is the engine's number divided by the view's divisor (1 annual, pay periods
 * per paycheck); nothing here does finance. With "Use recommended elections" on, each
 * amount that changes is struck and the recommended amount written beside it in carbon.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Amount, LineItem, Perforation, Stamp, StubShell } from "@/components/stub";
import type { CalcResult, Offer, OfferResult } from "@/lib/engine";
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
import { LetterReader } from "./LetterReader";
import type { LetterReview } from "./letterDraft";
import { OfferEditor } from "./OfferEditor";
import { blankDraft, draftFromOffer } from "./offerDraft";

interface Panel {
  /** The offer on the stub when the panel opened. */
  for: Offer | null;
  kind: "read" | "edit";
  /** Which header button opened the flow; focus returns to it. */
  origin: "read" | "edit";
  /** The reader's draft and marks, when the editor opened from a letter. */
  review?: LetterReview;
}

type NumericKey = {
  [K in keyof CalcResult]: CalcResult[K] extends number ? K : never;
}[keyof CalcResult];

/** Part of a label that reflects an election: carbon when the recommendation changed it. */
function Elected({ children, changed }: { children: ReactNode; changed: boolean }) {
  return changed ? <span className="text-carbon">{children}</span> : <>{children}</>;
}

function StubHeader({
  view,
  headingId,
  action,
}: {
  view: StubView;
  headingId: string;
  /** "Read offer letter" and "Edit offer" (or "Fill in offer"), with "Offer saved" after a save. */
  action?: ReactNode;
}) {
  const position = `Offer ${view.slot + 1} of 2`;
  return (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1">
      <h2 id={headingId} className="m-0">
        {view.offer ? view.offer.employer : position}
      </h2>
      {view.offer ? <span className="text-sm text-ink-soft">{position}</span> : <span />}
      {view.offer ? (
        <span className="col-span-2 text-sm text-ink-soft">{placeText(view.offer)}</span>
      ) : null}
      <span className="col-span-2 mt-1">{action}</span>
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

/** A blank amount: the line a value would be written on, hidden from screen readers. */
function BlankAmount() {
  return <span aria-hidden="true" className="inline-block w-24 border-b border-ink-soft" />;
}

/**
 * An empty stub (harness/DESIGN.md "Empty and error states"): one sentence of direction,
 * then the stub's line labels with blank amounts, so the page still reads as a pay stub.
 */
function EmptyStub({ perPaycheck }: { perPaycheck: boolean }) {
  const blank = <BlankAmount />;
  return (
    <>
      <p className="m-0 mb-3">Load a sample or read an offer letter to fill this stub.</p>
      <div className="text-ink-soft" data-testid="empty-stub-lines">
        <dl className="m-0">
          <LineItem label="Gross pay" amount={blank} />
          <LineItem label="401(k)" amount={blank} />
          <LineItem label="Health plan" amount={blank} />
          <LineItem label="Federal income tax" amount={blank} />
          <LineItem label="Social Security" amount={blank} />
          <LineItem label="Medicare" amount={blank} />
          <LineItem label="State income tax" amount={blank} />
          <LineItem variant="total" rule="heavy" label="Net pay" amount={blank} />
        </dl>
        <h3 className="mb-1 mt-6 text-base font-semibold">Employer adds (not in your pay)</h3>
        <dl className="m-0">
          <LineItem label="401(k) match" amount={blank} />
          <LineItem rule="light" label="Expected medical bills" amount={blank} />
          <LineItem
            variant="grand"
            rule="heavy"
            label={perPaycheck ? "Your bottom line per paycheck" : "Your yearly bottom line"}
            amount={blank}
          />
        </dl>
      </div>
    </>
  );
}

/**
 * One stub: filled from the engine, the engine's error, empty, or in edit mode. "Save
 * offer" writes the offer to the store and the header then reads "Offer saved" until the
 * offer changes again (another save, a sample, or Clear offers).
 */
export function OfferStub({
  view,
  corrected,
  perPaycheck = false,
  onSave,
}: {
  view: StubView;
  corrected: boolean;
  /** Only used by the empty stub's bottom-line label; a filled stub reads its divisor. */
  perPaycheck?: boolean;
  onSave: (offer: Offer) => void;
}) {
  const headingId = `offer-stub-${view.slot + 1}`;
  const { offer, result, error } = view;
  // A panel belongs to the offer it opened on: loading a sample or clearing closes it.
  // "read" is the letter panel; "edit" is the editor, in its review state after a letter.
  const [panel, setPanel] = useState<Panel | null>(null);
  const open = panel !== null && panel.for === offer ? panel : null;
  const [savedOffer, setSavedOffer] = useState<Offer | null>(null);
  const justSaved = savedOffer !== null && savedOffer === offer;
  const buttons = { read: useRef<HTMLButtonElement>(null), edit: useRef<HTMLButtonElement>(null) };
  const returnFocus = useRef<"read" | "edit" | null>(null);

  useEffect(() => {
    // Back from a panel: focus the button that opened it.
    if (!open && returnFocus.current) {
      buttons[returnFocus.current].current?.focus();
      returnFocus.current = null;
    }
  });

  const leave = () => {
    returnFocus.current = open?.origin ?? "edit";
    setPanel(null);
  };

  const button = "h-10 border border-ink bg-stub px-3 font-semibold";
  const action = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {open ? null : (
        <>
          <button
            ref={buttons.read}
            type="button"
            onClick={() => setPanel({ for: offer, kind: "read", origin: "read" })}
            className={button}
          >
            Read offer letter
          </button>
          <button
            ref={buttons.edit}
            type="button"
            onClick={() => setPanel({ for: offer, kind: "edit", origin: "edit" })}
            className={button}
          >
            {offer ? "Edit offer" : "Fill in offer"}
          </button>
        </>
      )}
      {/* Always mounted, so the change to "Offer saved" is announced. */}
      <span role="status" className="text-sm font-semibold text-carbon">
        {justSaved && !open ? "Offer saved" : ""}
      </span>
    </span>
  );

  return (
    <StubShell aria-labelledby={headingId} data-slot={view.slot}>
      <StubHeader view={view} headingId={headingId} action={action} />
      {open?.kind === "read" ? (
        <LetterReader
          slot={view.slot}
          onRead={(review) => setPanel({ for: offer, kind: "edit", origin: "read", review })}
          onCancel={leave}
        />
      ) : open ? (
        <OfferEditor
          initial={open.review?.draft ?? (offer ? draftFromOffer(offer) : blankDraft(view.slot))}
          marks={open.review?.marks}
          onSave={(next) => {
            onSave(next);
            setSavedOffer(next);
            leave();
          }}
          onCancel={leave}
        />
      ) : offer && result ? (
        <FilledStub view={{ ...view, offer }} result={result} corrected={corrected} />
      ) : error ? (
        <p className="m-0 text-correction">{error}</p>
      ) : (
        <EmptyStub perPaycheck={perPaycheck} />
      )}
    </StubShell>
  );
}

/**
 * Both stubs with the perforation between them: side by side from lg, stacked below
 * (side by side at 768 leaves ~345px stubs where most labels wrap).
 */
export function OfferStubs() {
  const { state, view, dispatch } = useDecoder();
  const corrected = state.electionsMode === "recommended";
  const perPaycheck = state.periodMode === "perPaycheck";
  const save = (slot: 0 | 1) => (offer: Offer) => dispatch({ type: "setOffer", slot, offer });
  return (
    <div className="mt-8 flex flex-col items-stretch lg:flex-row" data-testid="offer-stubs">
      <OfferStub
        view={view.stubs[0]}
        corrected={corrected}
        perPaycheck={perPaycheck}
        onSave={save(0)}
      />
      <Perforation orientation="horizontal" className="lg:hidden" />
      <Perforation orientation="vertical" className="hidden lg:flex" />
      <OfferStub
        view={view.stubs[1]}
        corrected={corrected}
        perPaycheck={perPaycheck}
        onSave={save(1)}
      />
    </div>
  );
}
