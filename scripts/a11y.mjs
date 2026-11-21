// npm run a11y [-- --no-build]
// Builds, serves the production build, runs axe (WCAG 2.0/2.1 A and AA rules)
// on each route at 375 and 1280 px, prints the serious and critical violation
// counts, and writes the full report to harness/shots/a11y.json.
// Exits 1 when any serious or critical violation is found.
import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, buildAndServe } from "./lib/serve.mjs";

const ROUTES = ["/", "/method", "/dev/components", "/no-such-page"];
const WIDTHS = [375, 1280];
const REPORT = path.join(ROOT, "harness/shots/a11y.json");

const server = await buildAndServe();
const browser = await chromium.launch();
const report = [];
let serious = 0;
let critical = 0;
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    for (const route of ROUTES) {
      const page = await context.newPage();
      await page.goto(server.url + route, { waitUntil: "networkidle" });
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const bad = result.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      const s = bad.filter((v) => v.impact === "serious").length;
      const c = bad.filter((v) => v.impact === "critical").length;
      serious += s;
      critical += c;
      console.log(`${route} @ ${width}px: serious ${s}, critical ${c}`);
      for (const v of bad)
        console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
      report.push({
        route,
        width,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          targets: v.nodes.map((n) => n.target.join(" ")),
        })),
      });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
mkdirSync(path.dirname(REPORT), { recursive: true });
writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(`\nTotal: serious ${serious}, critical ${critical}`);
console.log(`Report: ${path.relative(ROOT, REPORT)}`);
process.exit(serious + critical > 0 ? 1 : 0);
