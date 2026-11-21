import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MethodPage } from "./MethodPage";
import { bracketRows, formatRate, listJoin } from "./methodContent";

function setup() {
  render(<MethodPage />);
}

function rowFor(table: HTMLElement, name: string) {
  return within(table).getByRole("rowheader", { name }).closest("tr") as HTMLElement;
}

describe("Method page", () => {
  it("has the single 40px page headline and a section for every rule", () => {
    setup();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
      "How the numbers work",
    ]);
    for (const title of [
      "Your yearly bottom line",
      "Taxes on your pay",
      "Money the employer adds",
      "Choosing a health plan",
      "The recommended elections",
      "Life insurance",
      "The day-one checklist",
      "The 2026 numbers and where they come from",
      "What the site simplifies or leaves out",
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeTruthy();
      // The contents list links to every section.
      expect(screen.getByRole("link", { name: title }).getAttribute("href")).toMatch(/^#/);
    }
  });

  it("lists the federal brackets from FINANCE_SPEC for both filing statuses", () => {
    setup();
    const table = screen.getByRole("table", { name: /federal income tax brackets/i });
    expect(within(table).getAllByRole("row")).toHaveLength(8); // header + 7 brackets
    expect(within(rowFor(table, "10%")).getByText("$12,400")).toBeTruthy();
    expect(within(rowFor(table, "10%")).getByText("$24,800")).toBeTruthy();
    expect(within(rowFor(table, "24%")).getByText("$201,775")).toBeTruthy();
    expect(within(rowFor(table, "24%")).getByText("$403,550")).toBeTruthy();
    expect(within(rowFor(table, "37%")).getByText("over $640,600")).toBeTruthy();
    expect(within(rowFor(table, "37%")).getByText("over $768,700")).toBeTruthy();
    expect(bracketRows().map((r) => r.rate)).toEqual([
      "10%",
      "12%",
      "22%",
      "24%",
      "32%",
      "35%",
      "37%",
    ]);
  });

  it("shows every 2026 constant with the lecture slide it came from", () => {
    setup();
    const table = screen.getByRole("table", { name: "Every other number" });
    const expected: [string, RegExp, string][] = [
      [
        "Standard deduction",
        /\$16,100 single, \$32,200 married filing jointly/,
        "Taxes 4B, slide 17",
      ],
      ["Social Security", /6\.2% of wages up to \$184,500/, "Taxes 4B, slide 6"],
      ["Medicare", /1\.45%.*0\.9% above \$200,000 single or \$250,000 joint/, "Taxes 4B, slide 6"],
      ["401(k) limit on your own contributions", /^\$24,500$/, "Retirement 7B, slide 33"],
      [
        "HSA limit, yours and the employer's combined",
        /\$4,400 just you, \$8,750 family/,
        "Taxes 4B, slide 47; Insurance 7A, slide 36",
      ],
      ["Retirement savings target", /15% of pay/, "Retirement 7B, slides 24 and 49"],
      ["Tax rate in retirement", /^15%$/, "Retirement 7B, slide 7"],
      ["Roth or traditional", /12% or less/, "Retirement 7B, slide 40"],
      ["Markup on life insurance", /20% through work, 100% on your own/, "Insurance 7A, slide 28"],
      ["Risk aversion", /^3$/, "Insurance 7A, slide 27"],
      [
        "Human capital",
        /5% a year, discounted at 10%, until you retire at 67/,
        "Insurance 7A, slide 27",
      ],
      [
        "State income tax on wages",
        /Illinois 4\.95% flat; 0% in Alaska, .*Wyoming; every other state and DC uses its 2026 brackets/,
        "Illinois: Taxes 4B. Other states: Tax Foundation, 2026 State Income Tax Rates and Brackets (February 2026)",
      ],
    ];
    expect(within(table).getAllByRole("row")).toHaveLength(expected.length + 1);
    for (const [name, value, source] of expected) {
      // cells[0] is the value (with the slide repeated under it for phones), cells[1] the slide.
      const [valueCell, sourceCell] = within(rowFor(table, name)).getAllByRole("cell");
      expect(valueCell!.firstChild!.textContent).toMatch(value);
      expect(valueCell!.lastChild!.textContent).toBe(source);
      expect(sourceCell!.textContent).toBe(source);
    }
  });

  it("lists every simplification DESIGN.md requires, honestly", () => {
    setup();
    const list = within(
      screen.getByRole("region", { name: "What the site simplifies or leaves out" }),
    ).getByRole("list");
    const text = list.textContent ?? "";
    expect(text).toMatch(/No head of household/);
    expect(text).toMatch(
      /2026 brackets, standard deduction, and exemptions, but leaves out dependents/,
    );
    expect(text).toMatch(/No local or city income tax/);
    expect(text).toMatch(/No HSA catch-up/);
    expect(text).toMatch(/imputed income on group life/);
    expect(text).toMatch(/taxed at 15% when you take it out in retirement/);
  });

  it("explains the bottom line, the marginal method, dominance, and the life formula", () => {
    setup();
    const page = document.body.textContent ?? "";
    expect(page).toMatch(
      /Your yearly bottom line = net pay \+ savings in your name after future tax − expected medical bills/,
    );
    expect(page).toMatch(/times 85%/);
    expect(page).toMatch(/minus the tax on your spouse's wages alone/);
    expect(page).toMatch(/costs the same or less at every level of medical spending/);
    expect(page).toMatch(/Share worth insuring = 1 − \(markup ÷ risk aversion\)/);
    expect(page).toMatch(/Ties go to the lower premium/);
  });

  it("follows the copy rules", () => {
    setup();
    const page = document.body.textContent ?? "";
    expect(page).not.toMatch(/→|·|!/);
    expect(page).not.toMatch(/lorem|unlock|supercharge|seamless|empower/i);
  });
});

describe("method content helpers", () => {
  it("formats rates and lists", () => {
    expect(formatRate(0.0495)).toBe("4.95%");
    expect(formatRate(0.2)).toBe("20%");
    expect(formatRate(0.0145)).toBe("1.45%");
    expect(listJoin(["a"])).toBe("a");
    expect(listJoin(["a", "b"])).toBe("a and b");
    expect(listJoin(["a", "b", "c"])).toBe("a, b, and c");
  });
});
