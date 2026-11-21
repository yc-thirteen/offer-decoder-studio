import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Amount, LineItem, Perforation, Stamp, StubShell, formatMoney } from "@/components/stub";

describe("formatMoney", () => {
  it("uses $, thousands separators, no cents by default", () => {
    expect(formatMoney(150000)).toBe("$150,000");
    expect(formatMoney(4499.6)).toBe("$4,500");
  });
  it("shows cents for per-paycheck amounts", () => {
    expect(formatMoney(173.076, { cents: true })).toBe("$173.08");
    expect(formatMoney(5, { cents: true })).toBe("$5.00");
  });
  it("uses a true minus and never prints -$0", () => {
    expect(formatMoney(-2000)).toBe("−$2,000");
    expect(formatMoney(-0.4)).toBe("$0");
    expect(formatMoney(-0.004, { cents: true })).toBe("$0.00");
  });
});

describe("Amount", () => {
  it("static: just the amount", () => {
    const { container } = render(<Amount value={4500} />);
    expect(container.textContent).toBe("$4,500");
    expect(container.querySelector("[data-state]")).toHaveAttribute("data-state", "static");
    expect(container.querySelector("[data-strike]")).toBeNull();
  });

  it("off: shows the old amount, strike drawn at zero width, no new amount", () => {
    const { container } = render(<Amount value={4500} next={9000} corrected={false} />);
    expect(container.textContent).toBe("$4,500");
    const strike = container.querySelector("[data-strike]");
    expect(strike).toHaveClass("scale-x-0", "origin-left", "duration-180");
    expect(strike).toHaveClass("motion-reduce:transition-none");
  });

  it("on: strikes the old amount, writes the new one in carbon, and labels both", () => {
    const { container } = render(<Amount value={4500} next={9000} corrected />);
    expect(container.querySelector("[data-strike]")).toHaveClass("scale-x-100", "bg-correction");
    expect(container.querySelector(".text-carbon")?.textContent).toBe("$9,000");
    expect(screen.getByText("was $4,500, now $9,000")).toHaveClass("sr-only");
    expect(container.querySelector("[data-state]")).toHaveAttribute("data-state", "corrected");
  });

  it("reverses when the switch turns off", () => {
    const { container, rerender } = render(<Amount value={4500} next={9000} corrected />);
    rerender(<Amount value={4500} next={9000} corrected={false} />);
    expect(container.querySelector("[data-strike]")).toHaveClass("scale-x-0");
    expect(container.querySelector(".text-carbon")).toBeNull();
    expect(screen.queryByText(/was \$4,500/)).toBeNull();
  });

  it("does not correct an amount that rounds to the same display", () => {
    const { container } = render(<Amount value={4500.2} next={4499.9} corrected />);
    expect(container.textContent).toBe("$4,500");
    expect(container.querySelector("[data-strike]")).toBeNull();
  });

  it("per paycheck uses cents in the label too", () => {
    render(<Amount value={173.08} next={346.15} cents corrected />);
    expect(screen.getByText("was $173.08, now $346.15")).toBeInTheDocument();
  });

  it("blank renders no number but tells screen readers", () => {
    const { container } = render(<Amount value={null} />);
    expect(container.textContent).toBe("No amount yet");
    expect(container.querySelector("[data-state]")).toHaveAttribute("data-state", "blank");
  });
});

describe("Stamp", () => {
  it("has exactly the two allowed texts, in sentence case", () => {
    render(
      <>
        <Stamp kind="dominated" />
        <Stamp kind="match-not-claimed" />
      </>,
    );
    expect(screen.getByText("Dominated plan")).toHaveClass("-rotate-4", "border-2", "opacity-85");
    expect(screen.getByText("Match not claimed")).toHaveClass("border-correction");
  });
});

describe("LineItem and StubShell", () => {
  it("renders label, amount, note and stamp as a definition row", () => {
    const { container } = render(
      <StubShell aria-label="Offer 1">
        <dl>
          <LineItem
            label="401(k) match"
            amount={<Amount value={2250} />}
            note="Match vests after 3 years. Leave sooner and you forfeit it."
            stamp={<Stamp kind="match-not-claimed" />}
          />
          <LineItem
            variant="grand"
            label="Your yearly bottom line"
            amount={<Amount value={106585} />}
          />
        </dl>
      </StubShell>,
    );
    expect(screen.getByRole("region", { name: "Offer 1" })).toHaveClass("border", "bg-stub");
    expect(container.querySelector("dt")?.textContent).toContain("401(k) match");
    expect(container.querySelector("dt [data-stamp]")).toHaveTextContent("Match not claimed");
    expect(screen.getByText("$106,585").closest("dd")).toHaveClass("text-2xl", "font-bold");
    expect(screen.getByText(/Match vests after 3 years/)).toHaveClass("text-ink-soft");
  });

  it("draws rules on the row so a <dl> holds only dt/dd groups", () => {
    const { container } = render(
      <dl>
        <LineItem label="Medicare" amount={<Amount value={2175} />} rule="light" />
        <LineItem variant="total" rule="heavy" label="Net pay" amount={<Amount value={101647} />} />
      </dl>,
    );
    const rows = container.querySelectorAll("dl > div");
    expect(rows[0]).toHaveClass("border-t");
    expect(rows[1]).toHaveClass("before:border-t-2", "border");
    expect(container.querySelector("dl > :not(div)")).toBeNull();
  });

  it("perforation is decorative and renders both orientations with notches", () => {
    const { container } = render(
      <>
        <Perforation />
        <Perforation orientation="horizontal" />
      </>,
    );
    const strips = container.querySelectorAll("[data-orientation]");
    expect(strips).toHaveLength(2);
    strips.forEach((s) => expect(s).toHaveAttribute("aria-hidden", "true"));
    // two notches + the hole strip per orientation
    expect(strips[0]!.querySelectorAll("svg")).toHaveLength(3);
    expect(strips[0]!.querySelector("circle")).toHaveAttribute("r", "2");
  });
});
