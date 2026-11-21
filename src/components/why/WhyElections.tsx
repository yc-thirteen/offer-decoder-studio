/**
 * "Why these elections" (harness/DESIGN.md): panels on --stub that each open with the
 * conclusion, then the chart that shows it. Panels are added here as they are built.
 */
import { HealthCostsPanel } from "./HealthCostsPanel";

export function WhyElections() {
  return (
    <section aria-labelledby="why-heading" className="border-t border-ink pt-6 pb-12">
      <h2 id="why-heading" className="m-0 mb-4">
        Why these elections
      </h2>
      <div className="flex flex-col gap-6">
        <HealthCostsPanel />
      </div>
    </section>
  );
}
