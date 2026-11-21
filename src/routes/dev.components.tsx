import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  Amount,
  GuillocheBackground,
  LineItem,
  Perforation,
  Stamp,
  StubRule,
  StubShell,
} from "@/components/stub";

export const Route = createFileRoute("/dev/components")({
  head: () => ({
    meta: [
      { title: "Stub components (dev) | Offer Decoder" },
      { name: "description", content: "Every state of the pay stub components, for checking." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Stub components (dev) | Offer Decoder" },
      {
        property: "og:description",
        content: "Every state of the Offer Decoder pay stubs, for checking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevComponents,
});

/** Illustrative values only; the real stubs are bound to the engine in Phase 3. */
function DemoStub({
  name,
  place,
  position,
  corrected,
}: {
  name: string;
  place: string;
  position: string;
  corrected: boolean;
}) {
  const headingId = `demo-${position.replace(/\s/g, "-")}`;
  return (
    <StubShell aria-labelledby={headingId}>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
        <h3 id={headingId} className="m-0">
          {name}
        </h3>
        <span className="text-sm text-ink-soft">{position}</span>
        <span className="text-sm text-ink-soft">{place}</span>
      </div>
      <dl className="m-0">
        <LineItem label="Gross pay" amount={<Amount value={150000} />} />
        <LineItem
          label="401(k), traditional 3%"
          amount={<Amount value={4500} next={18000} corrected={corrected} />}
          note="Capped at the $24,500 limit"
        />
        <LineItem
          label="Health plan: PPO 500"
          amount={<Amount value={2400} next={1200} corrected={corrected} />}
          stamp={<Stamp kind="dominated" />}
        />
        <LineItem
          label="Federal income tax"
          amount={<Amount value={23094} next={19814} corrected={corrected} />}
          note="Federal marginal rate 24%, average 15.4%"
        />
        <LineItem
          label="State income tax"
          amount={<Amount value={0} />}
          note="Texas has no state income tax"
        />
        <LineItem
          variant="total"
          rule="heavy"
          label="Net pay"
          amount={<Amount value={101647} next={98420} corrected={corrected} />}
        />
        <LineItem
          label="401(k) match"
          amount={<Amount value={2250} next={6750} corrected={corrected} />}
          stamp={<Stamp kind="match-not-claimed" />}
          note="Match vests after 3 years. Leave sooner and you forfeit it."
        />
        <LineItem
          variant="grand"
          label="Your yearly bottom line"
          amount={<Amount value={106585} next={108479} corrected={corrected} />}
        />
      </dl>
    </StubShell>
  );
}

function DevComponents() {
  const [corrected, setCorrected] = useState(false);
  return (
    <>
      <GuillocheBackground />
      <main className="mx-auto max-w-page px-4 py-8 md:px-6">
        <h2 className="mt-0">Stub components</h2>
        <p>Every state of the pay stub parts, for checking. Values are illustrative.</p>

        <label className="my-4 inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={corrected}
            onChange={(e) => setCorrected(e.target.checked)}
            className="size-4 accent-carbon"
          />
          Use recommended elections
        </label>

        <section aria-labelledby="sheet" className="mt-4">
          <h2 id="sheet">Stubs, perforation, and notches</h2>
          <div className="flex flex-col md:flex-row">
            <DemoStub
              name="Northfield Health"
              place="Chicago, IL"
              position="Offer 1 of 2"
              corrected={corrected}
            />
            <Perforation orientation="horizontal" className="md:hidden" />
            <Perforation orientation="vertical" className="hidden md:flex" />
            <DemoStub
              name="Lakeshore Systems"
              place="Austin, TX"
              position="Offer 2 of 2"
              corrected={corrected}
            />
          </div>
        </section>

        <section aria-labelledby="amounts" className="mt-8">
          <h2 id="amounts">Amount states</h2>
          <StubShell className="max-w-prose">
            <dl className="m-0">
              <LineItem label="Static" amount={<Amount value={4500} />} />
              <LineItem
                label="Struck and new (always on)"
                amount={<Amount value={4500} next={9000} corrected />}
              />
              <LineItem
                label="Follows the switch"
                amount={<Amount value={4500} next={9000} corrected={corrected} />}
              />
              <LineItem
                label="Same amount, nothing to correct"
                amount={<Amount value={4500} next={4500} corrected />}
              />
              <LineItem
                label="Per paycheck, with cents"
                amount={<Amount value={173.08} next={346.15} cents corrected />}
              />
              <LineItem label="Expected medical bills" amount={<Amount value={-2000} />} />
              <LineItem label="Blank (empty stub)" amount={<Amount value={null} />} />
            </dl>
          </StubShell>
        </section>

        <section aria-labelledby="lines" className="mt-8">
          <h2 id="lines">Line item variants and stamps</h2>
          <StubShell className="max-w-prose">
            <dl className="m-0">
              <LineItem label="Line" amount={<Amount value={150000} />} />
              <LineItem
                label="Line with a note"
                amount={<Amount value={9300} />}
                note="Social Security stops at the wage base."
              />
              <LineItem
                label="Health plan: PPO 500"
                amount={<Amount value={2400} />}
                stamp={<Stamp kind="dominated" />}
              />
              <LineItem
                label="401(k) match"
                amount={<Amount value={0} />}
                stamp={<Stamp kind="match-not-claimed" />}
              />
              <LineItem label="Light rule above" amount={<Amount value={1200} />} rule="light" />
              <LineItem label="Heavy rule above" amount={<Amount value={1200} />} rule="heavy" />
              <LineItem
                variant="total"
                rule="heavy"
                label="Net pay"
                amount={<Amount value={101647} next={98420} corrected />}
              />
              <LineItem
                variant="grand"
                label="Your yearly bottom line"
                amount={<Amount value={106585} next={108479} corrected />}
              />
            </dl>
            <StubRule weight="heavy" />
            <p className="m-0 text-sm text-ink-soft">A heavy StubRule, used outside a list.</p>
          </StubShell>
        </section>
      </main>
    </>
  );
}
