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
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { ROOT, buildAndServe } from "./lib/serve.mjs";
import {
  clearOffers,
  editWithErrors,
  letterReview,
  loadSample,
  openAboutYou,
  openLetterReader,
  turnOnRecommended,
} from "./lib/steps.mjs";

const OUT = path.join(ROOT, "harness/shots/latest");
const WIDTHS = [375, 768, 1280];

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
      await loadSample(page);
      await openChecklist(page);
    },
  },
  // Not in HARNESS.md's list: About you opened behind its mobile disclosure (skipped at md and up).
  { name: "home-about-open", path: "/", run: openAboutYou },
  // Not in HARNESS.md's list: the first stub in Edit offer mode, after a failed save so the
  // directive errors show (the salary is cleared first).
  { name: "home-edit", path: "/", run: editWithErrors },
  // Not in HARNESS.md's list: the "Read offer letter" panel open on the first stub.
  { name: "home-letter", path: "/", run: openLetterReader },
  // Not in HARNESS.md's list: the review state after the reader reads a sample letter.
  { name: "home-letter-review", path: "/", run: letterReview },
  // Not in HARNESS.md's list: a sample where someone depends on your income, so the life
  // insurance panel shows (it is hidden for the first sample).
  { name: "home-life", path: "/", run: (page) => loadSample(page, "one-income-family") },
  { name: "method", path: "/method" },
  { name: "not-found", path: "/no-such-page" },
  // Not in HARNESS.md's list: the component sheet, so stub parts can be checked visually.
  { name: "dev-components", path: "/dev/components" },
  { name: "dev-components-recommended", path: "/dev/components", run: turnOnRecommended },
  { name: "empty", path: "/", run: clearOffers },
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
