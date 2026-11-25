// Shared page steps for scripts/shots.mjs and scripts/a11y.mjs.
// Controls are found by their accessible names from harness/DESIGN.md. A missing
// control is logged as skipped rather than failing the run.
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./serve.mjs";

export const CASES = JSON.parse(
  readFileSync(path.join(ROOT, "harness/fixtures/cases.json"), "utf8"),
).cases;
export const FIRST_CASE = CASES[0];

/** Clicks the first visible match, or logs a skip. Returns true if clicked. */
export async function clickIfPresent(page, locator, what) {
  const el = locator.first();
  if ((await el.count()) === 0 || !(await el.isVisible())) {
    console.log(`  skipped: ${what} not found`);
    return false;
  }
  await el.scrollIntoViewIfNeeded();
  await el.click();
  return true;
}

export async function turnOnRecommended(page) {
  const suggested = page.getByRole("radio", { name: "Suggested plan", exact: true });
  if (await suggested.count()) {
    await suggested.check();
    return;
  }
  // The component showcase retains its isolated correction switch.
  const showcase = page.getByRole("switch", { name: /use recommended elections/i });
  if (await showcase.count()) await showcase.check();
}

/**
 * Opens a page. The site starts with both stubs empty, so "/" loads the first sample, which
 * the views and walks expect. A view that wants the empty state runs clearOffers after.
 */
export async function openPage(page, baseUrl, pagePath) {
  const res = await page.goto(baseUrl + pagePath, { waitUntil: "networkidle" });
  if (pagePath === "/") await loadSample(page);
  return res;
}

export async function loadSample(page, id = FIRST_CASE.id) {
  const sample = CASES.find((c) => c.id === id) ?? FIRST_CASE;
  const picker = page
    .getByLabel(/load a sample/i)
    .or(page.getByRole("combobox", { name: /sample/i }));
  const el = picker.first();
  if ((await el.count()) === 0) return console.log("  skipped: sample picker not found");
  const tag = await el.evaluate((n) => n.tagName.toLowerCase());
  if (tag === "select") {
    const values = await el.locator("option").evaluateAll((os) => os.map((o) => o.value));
    await el.selectOption(values.includes(sample.id) ? sample.id : { index: 0 });
  } else {
    await el.click();
    const opt = page.getByRole("option", { name: new RegExp(sample.title.slice(0, 20), "i") });
    const target = (await opt.count()) > 0 ? opt.first() : page.getByRole("option").first();
    await target.click();
  }
  await clickIfPresent(
    page,
    page.getByRole("button", { name: /^load sample$/i }),
    "Load sample button",
  );
}

/** Opens the first stub's editor and tries to save with the salary blank, so errors show. */
export async function editWithErrors(page) {
  if (
    !(await clickIfPresent(
      page,
      page.getByRole("button", { name: /^edit offer$/i }),
      "Edit offer button",
    ))
  )
    return;
  await page.getByLabel("Yearly salary").first().fill("");
  await page
    .getByRole("button", { name: /^save offer$/i })
    .first()
    .click();
}

export function openLetterReader(page) {
  return clickIfPresent(
    page,
    page.getByRole("button", { name: /^upload documents$/i }),
    "Upload documents button",
  );
}

/** Reads the Lakeshore sample letter into the first stub's review state. */
export async function letterReview(page) {
  if (!(await openLetterReader(page))) return;
  await page.getByRole("button", { name: "Lakeshore Systems" }).first().click();
  await page.getByRole("button", { name: "Fill from documents", exact: true }).click();
  await page.getByLabel("Yearly salary").first().waitFor();
}

export function openAboutYou(page) {
  return clickIfPresent(
    page,
    page.getByRole("button", { name: /change your details/i }),
    "Change your details button",
  );
}

export function clearOffers(page) {
  return clickIfPresent(
    page,
    page.getByRole("button", { name: /clear offers/i }),
    "Clear offers button",
  );
}
