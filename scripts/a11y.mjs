// npm run a11y [-- --no-build]
// Builds, serves the production build, and checks accessibility at 375 and 1280 px:
//
// 1. axe (WCAG 2.0/2.1 A and AA rules) on each route and on the decoder's interactive
//    states (recommended on, a sample with the life panel, the editor showing errors,
//    the letter reader, its review state, About you opened, and the empty state).
// 2. Keyboard walks of the decoder (a sample with recommended on, the life panel, the
//    editor showing errors, and the letter review). Tab goes through every stop and each one is checked for:
//    - a visible focus ring (a 2px+ outline that isn't clipped by an ancestor), and
//    - an accessible name.
//    At 375 (one column) the walk also checks the order, flagging any stop that sits
//    well above the one before it.
//
// Prints the counts, writes the full report to harness/shots/a11y.json, and exits 1
// on any serious or critical axe violation or any keyboard problem.
import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
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

const VIEWS = [
  { name: "/", path: "/" },
  { name: "/ recommended", path: "/", run: turnOnRecommended },
  {
    name: "/ life panel, recommended",
    path: "/",
    run: async (page) => {
      await loadSample(page, "one-income-family");
      await turnOnRecommended(page);
    },
  },
  { name: "/ about you open", path: "/", run: openAboutYou, widths: [375] },
  { name: "/ editor with errors", path: "/", run: editWithErrors },
  { name: "/ letter reader", path: "/", run: openLetterReader },
  { name: "/ letter review", path: "/", run: letterReview },
  { name: "/ empty", path: "/", run: clearOffers },
  { name: "/method", path: "/method" },
  { name: "/dev/components", path: "/dev/components" },
  { name: "/no-such-page", path: "/no-such-page" },
];
const WIDTHS = [375, 1280];
const MAX_TABS = 400;
const REPORT = path.join(ROOT, "harness/shots/a11y.json");

/** Describes the focused element in the page: name, box, ring, and any clipping. */
function describeFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const labelText = () => {
    const by = el.getAttribute("aria-labelledby");
    if (by)
      return by
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ");
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    if (el.labels && el.labels.length) return [...el.labels].map((l) => l.textContent).join(" ");
    if (el.getAttribute("title")) return el.getAttribute("title");
    return el.textContent ?? "";
  };
  const name = (labelText() || "").replace(/\s+/g, " ").trim();
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const width = parseFloat(cs.outlineWidth) || 0;
  const ring = cs.outlineStyle !== "none" && width >= 2;
  const reach = width + (parseFloat(cs.outlineOffset) || 0);
  let clippedBy = null;
  for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const s = getComputedStyle(a);
    if (s.overflowX === "visible" && s.overflowY === "visible") continue;
    const b = a.getBoundingClientRect();
    if (
      r.left - reach < b.left - 0.5 ||
      r.right + reach > b.right + 0.5 ||
      r.top - reach < b.top - 0.5 ||
      r.bottom + reach > b.bottom + 0.5
    ) {
      clippedBy = `${a.tagName.toLowerCase()}.${String(a.className).split(" ").slice(0, 3).join(".")}`;
      break;
    }
  }
  const id = `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}[${el.getAttribute("type") ?? el.getAttribute("role") ?? ""}]`;
  return {
    el: id,
    name: name.slice(0, 60),
    top: r.top + window.scrollY,
    visible: r.width > 0 && r.height > 0,
    ring,
    outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
    clippedBy,
  };
}

const WALKS = [
  {
    name: "sample, recommended",
    run: async (page) => {
      await loadSample(page);
      await turnOnRecommended(page);
    },
  },
  { name: "life panel", run: (page) => loadSample(page, "one-income-family") },
  { name: "editor with errors", run: editWithErrors },
  { name: "letter review", run: letterReview },
];

async function keyboardWalk(page, width, setup) {
  await setup(page);
  // Blurring keeps the browser's tab start point where focus was, so focus a throwaway
  // element at the top of the body instead, then remove it.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const start = document.createElement("span");
    start.tabIndex = -1;
    document.body.prepend(start);
    start.focus();
    start.remove();
  });
  const stops = [];
  const problems = [];
  let first = null;
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(describeFocus);
    if (!f) break;
    const key = `${f.el}|${f.name}|${Math.round(f.top)}`;
    if (key === first) break;
    first ??= key;
    stops.push(f);
    const where = `stop ${stops.length} ${f.el} "${f.name}"`;
    if (!f.visible) problems.push(`${where}: focused but not visible`);
    else if (!f.ring) problems.push(`${where}: no visible focus ring (${f.outline})`);
    else if (f.clippedBy) problems.push(`${where}: focus ring clipped by ${f.clippedBy}`);
    if (!f.name) problems.push(`${where}: no accessible name`);
    const prev = stops[stops.length - 2];
    if (width < 640 && prev && f.top < prev.top - 40)
      problems.push(`${where}: order jumps up ${Math.round(prev.top - f.top)}px`);
  }
  return { stops, problems };
}

const server = await buildAndServe();
const browser = await chromium.launch();
const report = { axe: [], keyboard: [] };
let serious = 0;
let critical = 0;
let keyboardProblems = 0;
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    for (const view of VIEWS) {
      if (view.widths && !view.widths.includes(width)) continue;
      const page = await context.newPage();
      await page.goto(server.url + view.path, { waitUntil: "networkidle" });
      if (view.run) await view.run(page);
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
      console.log(`${view.name} @ ${width}px: serious ${s}, critical ${c}`);
      for (const v of bad)
        console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`);
      report.axe.push({
        view: view.name,
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

    for (const w of WALKS) {
      const page = await context.newPage();
      await page.goto(server.url + "/", { waitUntil: "networkidle" });
      const walk = await keyboardWalk(page, width, w.run);
      keyboardProblems += walk.problems.length;
      console.log(
        `keyboard walk, ${w.name} @ ${width}px: ${walk.stops.length} stops, ${walk.problems.length} problems`,
      );
      for (const p of walk.problems) console.log(`  ${p}`);
      report.keyboard.push({ walk: w.name, width, ...walk });
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
console.log(
  `\nTotal: serious ${serious}, critical ${critical}, keyboard problems ${keyboardProblems}`,
);
console.log(`Report: ${path.relative(ROOT, REPORT)}`);
process.exit(serious + critical + keyboardProblems > 0 ? 1 : 0);
