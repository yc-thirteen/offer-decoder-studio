// npm run responsive [-- --no-build]
// Builds, serves the production build, and checks the layout rules in harness/DESIGN.md
// (rubric item 8) at 375 and 768 px, plus 1024 px, the narrowest width where the stubs
// sit side by side:
//   - the page never scrolls sideways, and no inner box scrolls sideways;
//   - no visible text or control runs off the screen or is cut off by a clipping box;
//   - no text or control overlaps the perforation strip or its notches;
//   - text and controls inside a stub stay inside the stub's border;
//   - chart labels stay inside their SVG (SVGs clip what falls outside).
// Each state comes from scripts/lib/steps.mjs. Prints every problem and exits 1 if any.
import { chromium } from "@playwright/test";
import { buildAndServe } from "./lib/serve.mjs";
import {
  CASES,
  clearOffers,
  editWithErrors,
  letterReview,
  loadSample,
  openAboutYou,
  openLetterReader,
  openPage,
  turnOnRecommended,
} from "./lib/steps.mjs";

const WIDTHS = [375, 768, 1024];

async function perPaycheck(page) {
  // The radio is visually hidden inside its label, so check it directly.
  const radio = page.getByRole("radio", { name: /^per paycheck$/i }).first();
  if ((await radio.count()) === 0) return console.log("  skipped: Per paycheck toggle not found");
  await radio.check({ force: true });
}

const VIEWS = [
  { name: "defaults", path: "/" },
  { name: "recommended", path: "/", run: turnOnRecommended },
  {
    name: "per paycheck, recommended",
    path: "/",
    run: async (p) => {
      await perPaycheck(p);
      await turnOnRecommended(p);
    },
  },
  // The "Change your details" disclosure exists only below md.
  { name: "about you open", path: "/", run: openAboutYou, widths: [375] },
  { name: "edit with errors", path: "/", run: editWithErrors },
  { name: "letter reader", path: "/", run: openLetterReader },
  { name: "letter review", path: "/", run: letterReview },
  { name: "empty", path: "/", run: clearOffers },
  // Every sample with recommended on (the longest stubs: corrected amounts sit beside struck ones).
  ...CASES.slice(1).map((c) => ({
    name: `${c.id}, recommended`,
    path: "/",
    run: async (p) => {
      await loadSample(p, c.id);
      await turnOnRecommended(p);
    },
  })),
  { name: "method", path: "/method" },
  { name: "not found", path: "/no-such-page" },
  { name: "dev components, recommended", path: "/dev/components", run: turnOnRecommended },
];

/** Runs in the page. Returns a list of problem strings. */
function inspect() {
  const vw = document.documentElement.clientWidth;
  const problems = [];
  const seen = new Set();
  const add = (msg) => {
    if (seen.has(msg)) return;
    seen.add(msg);
    problems.push(msg);
  };
  const TOL = 1;
  const label = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls =
      typeof el.className === "string" && el.className
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : "";
    return `<${el.tagName.toLowerCase()}${id}${cls}>`;
  };
  const snippet = (s) => JSON.stringify(s.replace(/\s+/g, " ").trim().slice(0, 50));
  const overlaps = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > TOL &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > TOL;

  const pageOverflow = document.documentElement.scrollWidth - vw;
  if (pageOverflow > 0) add(`page scrolls sideways by ${pageOverflow}px`);

  // Hidden content (sr-only, display:none, visibility:hidden) is not checked.
  const hidden = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") return true;
      if (cs.clip && cs.clip !== "auto") return true;
      if (cs.position === "absolute" && n.offsetWidth <= 1 && n.offsetHeight <= 1) return true;
    }
    return false;
  };
  // The nearest ancestor that clips horizontally.
  const clipper = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      if (n instanceof SVGElement) continue;
      const ox = getComputedStyle(n).overflowX;
      if (ox !== "visible") return n;
    }
    return null;
  };

  for (const el of document.body.querySelectorAll("*")) {
    if (el instanceof SVGElement) continue;
    const ox = getComputedStyle(el).overflowX;
    if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + TOL && !hidden(el))
      add(`${label(el)} scrolls sideways by ${el.scrollWidth - el.clientWidth}px`);
  }

  const perforations = [...document.querySelectorAll("[data-perforation]")]
    .filter((p) => !hidden(p))
    .map((p) => p.getBoundingClientRect());
  const stubs = [...document.querySelectorAll("[data-stub]")];

  // Boxes to check: each line of each visible text node, and each control.
  const items = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || el.closest("script,style,noscript") || hidden(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(t);
    if (el instanceof SVGElement) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) items.push({ el, r, what: snippet(t.textContent), svg: true });
      continue;
    }
    for (const r of range.getClientRects())
      if (r.width && r.height) items.push({ el, r, what: snippet(t.textContent) });
  }
  for (const el of document.body.querySelectorAll("input,select,textarea,button")) {
    if (hidden(el)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const name = el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "";
    items.push({ el, r, what: `${el.tagName.toLowerCase()} ${snippet(name)}` });
  }

  for (const { el, r, what, svg } of items) {
    const where = label(el);
    if (r.right > vw + TOL || r.left < -TOL)
      add(
        `${what} in ${where} runs off the screen (${Math.round(r.left)} to ${Math.round(r.right)} of ${vw}px)`,
      );
    if (svg) {
      let root = el.ownerSVGElement;
      while (root && root.ownerSVGElement) root = root.ownerSVGElement;
      const s = root?.getBoundingClientRect();
      const clips = root && getComputedStyle(root).overflow !== "visible";
      if (s && !clips) {
        // An overflow-visible chart may draw labels past its box, but not past its panel.
        const panel = root.parentElement.closest("figure,section,[data-stub]");
        const pr = panel?.getBoundingClientRect();
        if (pr && (r.left < pr.left - TOL || r.right > pr.right + TOL))
          add(
            `chart label ${what} runs ${Math.round(Math.max(pr.left - r.left, r.right - pr.right))}px past its figure, in ${snippet(root.getAttribute("aria-label") || "")}`,
          );
      } else if (
        s &&
        (r.left < s.left - TOL ||
          r.right > s.right + TOL ||
          r.top < s.top - TOL ||
          r.bottom > s.bottom + TOL)
      ) {
        const by = Math.round(
          Math.max(s.left - r.left, r.right - s.right, s.top - r.top, r.bottom - s.bottom),
        );
        const chart =
          root.getAttribute("aria-label") ||
          root.closest("figure")?.querySelector("figcaption,p")?.textContent ||
          "";
        add(`chart label ${what} spills ${by}px out of its SVG ${snippet(chart)} and is cut off`);
      }
    } else {
      const c = clipper(el);
      if (c) {
        const cr = c.getBoundingClientRect();
        if (r.right > cr.right + TOL || r.left < cr.left - TOL)
          add(`${what} in ${where} is cut off by ${label(c)}`);
      }
    }
    for (const p of perforations)
      if (overlaps(r, p)) add(`${what} in ${where} overlaps the perforation`);
    const stub = el.closest("[data-stub]");
    if (stub) {
      const s = stub.getBoundingClientRect();
      if (r.left < s.left + 1 - TOL || r.right > s.right - 1 + TOL)
        add(`${what} in ${where} crosses its stub's edge`);
    }
  }
  if (stubs.length && !perforations.length && location.pathname === "/")
    add("stubs render with no perforation between them");
  return problems;
}

/**
 * Plants one of each fault on the defaults page, so a checker that silently stops seeing
 * them (a renamed data attribute, a broken selector) fails the run instead of passing it.
 */
async function selfTest(context) {
  const page = await context.newPage();
  await openPage(page, server.url, "/");
  await page.evaluate(() => {
    const perf = document.querySelector("[data-perforation]").getBoundingClientRect();
    const stub = document.querySelector("[data-stub]");
    const over = document.createElement("span");
    over.textContent = "planted over the perforation";
    Object.assign(over.style, { position: "fixed", left: `${perf.left}px`, top: `${perf.top}px` });
    document.body.append(over);
    const edge = document.createElement("span");
    edge.textContent = "planted across the stub edge";
    Object.assign(edge.style, { position: "absolute", left: "-30px", top: "40px" });
    stub.append(edge);
    const wide = document.createElement("div");
    wide.textContent = "planted wide";
    wide.style.cssText = "position:absolute;left:340px;top:0;white-space:nowrap";
    document.body.append(wide);
    const box = document.createElement("div");
    box.style.cssText = "overflow-x:auto;width:100px";
    box.innerHTML = '<div style="width:400px">planted scroller</div>';
    document.body.append(box);
  });
  const problems = await page.evaluate(inspect);
  await page.close();
  const expect = [
    /^page scrolls sideways/,
    /scrolls sideways by 300px/,
    /"planted over the perforation".*overlaps the perforation/,
    /"planted across the stub edge".*crosses its stub's edge/,
    /"planted wide".*runs off the screen/,
  ];
  const missed = expect.filter((re) => !problems.some((p) => re.test(p)));
  console.log(
    `self-test: ${expect.length - missed.length} of ${expect.length} planted faults caught`,
  );
  for (const re of missed) console.log(`  MISSED ${re}`);
  return missed.length;
}

const server = await buildAndServe();
const browser = await chromium.launch();
let total = 0;
let failures = 0;
try {
  {
    const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
    failures += await selfTest(context);
    await context.close();
  }
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    for (const view of VIEWS) {
      if (view.widths && !view.widths.includes(width)) continue;
      const page = await context.newPage();
      try {
        await openPage(page, server.url, view.path);
        await page.evaluate(() => document.fonts.ready);
        if (view.run) await view.run(page);
        await page.waitForTimeout(250);
        const problems = await page.evaluate(inspect);
        total += problems.length;
        console.log(`${view.name} @ ${width}px: ${problems.length} problems`);
        for (const p of problems) console.log(`  ${p}`);
      } catch (e) {
        failures++;
        console.log(`${view.name} @ ${width}px: FAILED ${e.message.split("\n")[0]}`);
      }
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}
console.log(`\nResponsive: ${total} problems, ${failures} views failed`);
process.exit(total || failures ? 1 : 0);
