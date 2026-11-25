/**
 * Accessibility pass (harness/DESIGN.md rubric item 7): every form control on the decoder
 * has an accessible name, no control is pulled out of reading order with a positive
 * tabIndex, and ids are unique. The page is rendered with every panel open at once: a
 * sample where someone depends on the income (so the life sliders show), the editor on
 * the first stub after a failed save, and the letter reader on the second stub.
 * `npm run a11y` covers the rest in a real browser: axe, focus rings, and Tab order.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AboutYou,
  Checklist,
  DecoderControls,
  DecoderHeader,
  MemoLine,
  MonthlyPlan,
  OfferStubs,
} from "@/components/decoder";
import { WhyElections } from "@/components/why";
import { DecoderProvider } from "@/state/DecoderContext";

function renderDecoder(sampleId: string | null) {
  return render(
    <DecoderProvider initialSampleId={sampleId}>
      <DecoderHeader />
      <main>
        <DecoderControls />
        <AboutYou />
        <OfferStubs />
        <MemoLine />
        <MonthlyPlan />
        <Checklist />
        <WhyElections />
      </main>
    </DecoderProvider>,
  );
}

/** Every visible form control and button; toHaveAccessibleName() with no argument checks the name isn't empty. */
function controls(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("input, select, textarea, button")].filter(
    (el) => (el as HTMLInputElement).type !== "hidden",
  );
}

function checkPage(root: HTMLElement) {
  const all = controls(root);
  expect(all.length).toBeGreaterThan(5);
  for (const el of all) expect(el, el.outerHTML.slice(0, 120)).toHaveAccessibleName();
  const positive = [...root.querySelectorAll<HTMLElement>("[tabindex]")].filter(
    (el) => el.tabIndex > 0,
  );
  expect(positive.map((el) => el.outerHTML.slice(0, 120))).toEqual([]);
  const ids = [...root.querySelectorAll("[id]")].map((el) => el.id);
  expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
}

// One of the two heaviest render tests (~1.8s alone). With several suites running at once
// it can exceed vitest's 5000ms default, so it gets more headroom. Its assertions are unchanged.
const HEAVY_RENDER_TIMEOUT_MS = 15_000;

describe("decoder accessibility", () => {
  it(
    "labels every control with the editor, the letter reader, and the life panel open",
    { timeout: HEAVY_RENDER_TIMEOUT_MS },
    () => {
      const { container } = renderDecoder("one-income-family");
      const [first, second] = screen
        .getAllByRole("region", { name: /./ })
        .filter((r) => within(r).queryByRole("button", { name: "Edit offer" }));
      fireEvent.click(within(first!).getByRole("button", { name: "Edit offer" }));
      fireEvent.change(within(first!).getByLabelText("Yearly salary"), { target: { value: "" } });
      fireEvent.click(within(first!).getByRole("button", { name: "Save offer" }));
      expect(within(first!).getByLabelText("Yearly salary")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      fireEvent.click(within(second!).getByRole("button", { name: "Upload documents" }));
      expect(within(second!).getByRole("textbox", { name: /^Offer letter text/ })).toBeTruthy();
      expect(screen.getAllByRole("slider").length).toBeGreaterThan(0);
      checkPage(container);
    },
  );

  it("labels every control on the empty page", () => {
    const { container } = renderDecoder(null);
    checkPage(container);
  });
});
