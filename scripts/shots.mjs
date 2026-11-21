// npm run shots [-- --no-build]
// Builds, serves the production build, and saves full-page screenshots of the
// views listed in harness/HARNESS.md at 375, 768, and 1280 px into
// harness/shots/latest/ (wiped and rewritten every run).
//
// Controls are found by their accessible names from harness/DESIGN.md
// ("Load a sample", "Use recommended elections", the checklist tab, "Clear offers").
// If a control doesn't exist yet, the step is logged as skipped and the
// screenshot is still taken, so the run never fails just because the UI is
// unfinished. Update the selectors here if the UI copy changes.
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { ROOT, buildAndServe } from "./lib/serve.mjs";

const OUT = path.join(ROOT, "harness/shots/latest");
const WIDTHS = [375, 768, 1280];
const FIRST_CASE = JSON.parse(readFileSync(path.join(ROOT, "harness/fixtures/cases.json"), "utf8"))
  .cases[0];

/** Clicks the first visible match, or logs a skip. Returns true if clicked. */
async function clickIfPresent(page, locator, what) {
  const el = locator.first();
  if ((await el.count()) === 0 || !(await el.isVisible())) {
    console.log(`  skipped: ${what} not found`);
    return false;
  }
  await el.scrollIntoViewIfNeeded();
  await el.click();
  return true;
}

async function turnOnRecommended(page) {
  const name = /use recommended elections/i;
  const sw = page.getByRole("switch", { name }).or(page.getByRole("checkbox", { name }));
  const el = sw.first();
  if ((await el.count()) === 0) return console.log("  skipped: recommended switch not found");
  const state = (await el.getAttribute("aria-checked")) ?? String(await el.isChecked());
  if (state !== "true") await el.click();
  await page.waitForTimeout(600); // let the 180ms correction strike finish
}

async function loadFirstSample(page) {
  const picker = page
    .getByLabel(/load a sample/i)
    .or(page.getByRole("combobox", { name: /sample/i }));
  const el = picker.first();
  if ((await el.count()) === 0) return console.log("  skipped: sample picker not found");
  const tag = await el.evaluate((n) => n.tagName.toLowerCase());
  if (tag === "select") {
    const values = await el.locator("option").evaluateAll((os) => os.map((o) => o.value));
    await el.selectOption(values.includes(FIRST_CASE.id) ? FIRST_CASE.id : { index: 0 });
  } else {
    await el.click();
    const opt = page.getByRole("option", { name: new RegExp(FIRST_CASE.title.slice(0, 20), "i") });
    const target = (await opt.count()) > 0 ? opt.first() : page.getByRole("option").first();
    await target.click();
  }
  await clickIfPresent(
    page,
    page.getByRole("button", { name: /^load sample$/i }),
    "Load sample button",
  );
}

async function openChecklist(page) {
  // The checklist sits on the page under the memo; its tabs pick the offer (the first is selected).
  const heading = page.getByRole("heading", { name: /back of the stub/i }).first();
  if ((await heading.count()) === 0) return console.log("  skipped: checklist not found");
  await heading.scrollIntoViewIfNeeded();
  const tick = page.locator("[data-checklist-id] input[type=checkbox]").first();
  if ((await tick.count()) > 0) await tick.check(); // show one ticked item in carbon
  await page.waitForTimeout(300);
}

const VIEWS = [
  { name: "home-defaults", path: "/" },
  { name: "home-recommended", path: "/", run: turnOnRecommended },
  {
    name: "home-checklist",
    path: "/",
    run: async (page) => {
      await loadFirstSample(page);
      await openChecklist(page);
    },
  },
  // Not in HARNESS.md's list: About you opened behind its mobile disclosure (skipped at md and up).
  {
    name: "home-about-open",
    path: "/",
    run: (page) =>
      clickIfPresent(
        page,
        page.getByRole("button", { name: /change your details/i }),
        "Change your details button",
      ),
  },
  { name: "method", path: "/method" },
  // Not in HARNESS.md's list: the component sheet, so stub parts can be checked visually.
  { name: "dev-components", path: "/dev/components" },
  { name: "dev-components-recommended", path: "/dev/components", run: turnOnRecommended },
  {
    name: "empty",
    path: "/",
    run: (page) =>
      clickIfPresent(
        page,
        page.getByRole("button", { name: /clear offers/i }),
        "Clear offers button",
      ),
  },
];

const server = await buildAndServe();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let failures = 0;
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });
    for (const view of VIEWS) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      console.log(`${view.name} @ ${width}px`);
      try {
        const res = await page.goto(server.url + view.path, { waitUntil: "networkidle" });
        if (res && res.status() >= 400)
          console.log(`  note: HTTP ${res.status()} for ${view.path}`);
        await page.evaluate(() => document.fonts.ready);
        if (view.run) await view.run(page);
        const file = path.join(OUT, `${view.name}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (overflow > 0) console.log(`  WARNING: horizontal overflow of ${overflow}px`);
        for (const e of errors) console.log(`  page error: ${e}`);
      } catch (e) {
        failures++;
        console.log(`  FAILED: ${e.message.split("\n")[0]}`);
      }
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
console.log(`\nScreenshots in ${path.relative(ROOT, OUT)}/ (${failures} failed)`);
process.exit(failures ? 1 : 0);
