# Backlog

Do tasks top to bottom. `[ ]` todo, `[x]` done, `[!]` blocked (with reason). One task per iteration.

## Phase 0: foundations
- [x] Inspect the repo and record in PROGRESS.md: framework, router, styling, UI kit, package manager, and existing scripts. Run `npm install` and `npm run build` and record the results. Don't change anything else.
- [x] Add `harness/logs/`, `harness/shots/`, `.env`, and `.env.local` to `.gitignore`. Add `.env.example` with placeholder names only.
- [x] Add Vitest with jsdom and Testing Library. Add scripts: `test` (vitest run), `typecheck` (tsc --noEmit for the app tsconfig), and `verify` (typecheck, lint if a lint script exists, test, build). Add one trivial passing test.
- [x] Add Playwright (chromium only) and `scripts/shots.mjs`, which builds, starts `vite preview`, and captures the screenshots listed in HARNESS.md into `harness/shots/latest/`, overwriting each run. Add the `shots` npm script. Add `scripts/a11y.mjs` with @axe-core/playwright, which prints the serious and critical violation counts, and the `a11y` script.
- [x] Copy `harness/fixtures/cases.json` to `src/data/sampleCases.json`, the letters to `src/data/letters/`, and add a test asserting the copies are byte-identical to the originals.

## Phase 1: engine (`src/lib/engine/`, pure TypeScript, no React)
- [x] `types.ts` (Profile, Offer, HealthPlan, MatchTier, Vesting, Elections, CalcResult, LifeResult, CaseResult) and `constants.ts`, both taken exactly from FINANCE_SPEC.md.
- [x] `tax.ts` (income tax, marginal rate, payroll taxes, state) plus the `lecture-checks` test using `harness/fixtures/lecture-checks.json`.
- [x] `health.ts` (out-of-pocket, plan cost, breakpoints, dominated plans, worst case, recommended plan) with unit tests.
- [x] `retirement.ts` (match tiers, match cap, max match %, vesting) with unit tests, including the 7B example where 6% in gets 9% total.
- [x] `calculate.ts` (the full pay calculation and bottom line) and `recommend.ts` (recommended elections).
- [x] `life.ts` (human capital and coverage) and `checklist.ts` (ordered ids), and replace the two `it.todo` entries in `src/lib/engine/lecture-checks.test.ts` with real checks (human capital ≈ $1.6M ± 5,000; life fractions 0.90 / 0.48 ± 0.01).
- [x] `runCase()` in `index.ts`, plus `fixtures.test.ts` comparing every field of every case to `harness/fixtures/expected.json` (within $1, ids exact, booleans exact). This must pass before any UI task.

## Phase 2: design system
- [x] Tokens in `src/index.css` and `tailwind.config.ts`, Public Sans loading, tabular numbers, and base element styles. Neutralize the default shadcn look for anything used (no shadows, no rounding, token colors only).
- [x] Components in `src/components/stub/`: `GuillocheBackground`, `Perforation` (vertical and horizontal), `StubShell` (with notches), `LineItem`, `Amount` (static, struck, and new states with the 180ms correction and reduced-motion support, plus an accessible label like "was $4,500, now $9,000"), and `Stamp`. Add a `/dev/components` route showing every state. Check it with screenshots.

## Phase 3: decoder page
- [x] App state (profile, two offers, elections mode, annual or per-paycheck, chosen sample) in one store, using React context or useReducer. The engine runs from state, and components only format.
- [x] Header and controls row (sample picker with all 6 cases, the Annual/Per paycheck toggle, and the recommended switch).
- [x] About you block (all profile fields; spouse's wages only when filing jointly; a disclosure on mobile).
- [x] The two stubs bound to engine output, with every line item, note, stamp, and both modes. Check them against the fixture numbers for chicago-vs-austin in a component test.
- [x] Memo line (the winner sentence, plus the flip sentence when the default and recommended winners differ).
- [x] Back-of-stub checklist with the offer tabs and all copy from DESIGN.md, with dynamic values and zero amounts omitted.
- [x] Edit offer mode: inline fields in `--carbon`, add and remove health plans and match tiers, choose the vesting type, and validation with directive error messages. "Save offer" leads to "Offer saved".
- [x] Empty state (blank stubs with direction) and a "Clear offers" control.

## Phase 4: why these elections
- [x] Health plan costs chart (SVG, from the engine's breakpoints, dominated plans dashed red, recommended in carbon, an expected-spending marker, direct labels).
- [x] Match and vesting chart, plus the vesting timeline for years 0–6.
- [x] Life insurance panel, shown only with dependents (risk aversion and markup sliders that recompute live).
- [x] Marginal vs average tax panel.

## Phase 5: AI features (mock first)
- [x] `src/lib/ai/`: `types.ts` (ExtractRequest, ExtractResult with per-field `source: "letter" | "missing"`, and ExplainRequest/ExplainResult), an `AIClient` interface, and a `getAIClient()` factory. The factory returns the HTTP client when the env vars for the Lovable Cloud (Supabase) URL and publishable key are present (check `VITE_SUPABASE_URL`, plus `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`), and the mock otherwise.
- [x] `MockAIClient.extractOffer`, using deterministic parsing that extracts the 3 sample letters exactly into the matching fixture offers. Unknown text returns every field as missing, never invented values. Add tests for all 3 letters.
- [x] `MockAIClient.explainStub`, a templated 3–4 sentence summary built only from engine numbers. Add a test.
- [x] `HttpAIClient`, which POSTs to `<supabaseUrl>/functions/v1/decode-offer` and `/functions/v1/explain-stub` with the publishable key header, and has a 20s timeout and a directive error message.
- [x] `supabase/functions/decode-offer/index.ts` and `supabase/functions/explain-stub/index.ts` (Deno). They read `Deno.env.get("ANTHROPIC_API_KEY")`, call `https://api.anthropic.com/v1/messages` (model `claude-sonnet-5-5`, `anthropic-version: 2023-06-01`), and ask for JSON only that matches the types. Validate the output, return 400 on invalid input, and handle CORS. Never log the letter text. The explain function must instruct the model to use only the numbers provided.
- [x] The "Read offer letter" panel (paste text or drop a .txt file), the review state with "from letter" markers and missing-field underlines, and the sample-reader note.
- [x] The "Plain-English summary" under the memo line.
- [x] `docs/AI_SETUP_LOVABLE.md`: the exact steps and a copy-paste prompt for Lovable to enable Cloud, deploy the two existing functions unchanged, and add the `ANTHROPIC_API_KEY` secret, plus how to confirm it's working.

## Phase 6: content and finish
- [x] `/method` page per DESIGN.md (the rules, the constants table with slide references, and the simplifications list).
- [x] A 404 page in the site's voice, the page title and meta description, and the SVG favicon fallback.
- [x] `IMAGE_PROMPTS.md` at the repo root, with one prompt per slot in DESIGN.md (exact sizes, exact hex colors, the pay-stub/security-paper style, and no text in images except the share card's title). Wire each slot with a fallback.
- [x] Accessibility pass: zero serious axe violations, keyboard order, a visible focus ring, and labels on every input.
- [x] Responsive pass at 375 and 768: no horizontal scroll, and nothing overlapping the notches or the perforation.
- [x] Deflake `src/components/decoder/LetterReader.test.tsx` "reads a pasted sample letter into the review state": under full-suite load the review sentence sometimes lacks focus at the sync `toHaveFocus` check (seen once in 5 runs). Wait for focus with `waitFor`/`findBy`, or move focus synchronously in `OfferEditor`.
- [x] `README.md`: what it is, the lecture-to-feature mapping, how to run and test it, what is mocked, and how to connect AI.

- [x] Say plainly in About you that head of household isn't supported (FINANCE_SPEC: "The UI must say so plainly"). Today only the Method page says it. Add a 13px ink-soft note under the Filing select in `src/components/decoder/AboutYou.tsx` linking to `/method#simplifications`.

- [x] Give the two heaviest render tests headroom: `src/test/a11yLabels.test.tsx` "labels every control with the editor, the letter reader, and the life panel open" and `src/components/decoder/OfferStub.test.tsx` "shows every default amount from expected.json on both stubs" take ~1.8s alone and hit vitest's 5000ms default when 3+ suites run at once. Pass a per-test timeout (e.g. 15000) to those two `it` calls; don't change what they assert.

## Critique rounds
(The harness adds tasks here; see Self-improvement in HARNESS.md.)

### Critique round 1 (2026-11-21)
- [x] Rubric 6: in `src/components/why/MatchChart.tsx` (line ~95) the "Employer match per year" label at the top left is crossed by the default-% marker line whenever the default sits under the label (both chicago-vs-austin charts at 1280: "Employer match p|er year"). Place the label so its box clears every marker's x (e.g. start it past the rightmost marker it would hit, or drop it below the marker titles in the free band left of the first marker), and add a test in `MatchVestingPanel.test.tsx` that the label's estimated box doesn't contain any marker x.
- [x] Rubric 6: in `src/components/why/HealthCostChart.tsx` the cost label beside the expected-spending dot ("$3,200" on Northfield's dashed PPO 500 line, "$3,000" on Lakeshore's PPO 1000 line, chicago-vs-austin at 1280) is drawn across its own plan line. Offset each dot label away from the line using its slope at the dot (above-left when the line rises to the right, below-right as the fallback), keep it clear of the other plan's label, and add a test in `HealthCostsPanel.test.tsx` that no dot label's box intersects its own line segment.
- [x] Rubric 6 (found in iteration 45): in `src/components/why/MatchChart.tsx` the red "$X left on the table" label crosses the recommended marker line at 375 (chicago-vs-austin Northfield, university-staff Midway, new-grad-roth offer 2). With no room above-left of the default dot, it falls back to the right edge (`x1 - 2`, end-anchored) on top of the recommended marker. Add marker-x clearance to its `tries` (like `placeLineLabel` in `matchLabel.ts`), with a two-line fallback ("$X left" / "on the table") in the gap between markers. Add a test in `MatchVestingPanel.test.tsx` across all samples at 300/420/560/700px.
- [x] Rubric 6 (found in iteration 47): in `src/components/why/MatchChart.tsx` two-row marker titles can both be crossed: new-grad-roth offer 2 at 375 puts "Recommended 8%" on the upper row and "Default 5%" on the lower row, start-anchored, so the 8% marker line runs through "Default 5%". `crossesLowerTitle` only checks the upper marker's own line against the lower title. When the lower title would be crossed, end-anchor it left of its marker (when it fits right of x0) before choosing rows, and add a test in `MatchVestingPanel.test.tsx` that no marker line passes through another marker's title box across all samples at 300/420/560/700px.

### Critique round 2 (2026-11-21)
- [x] Rubric 6: in `src/components/why/HealthCostChart.tsx`, at 375 (chicago-vs-austin Northfield) the blue "$1,600" cost label sits on the solid $0 line (`y(0)`, drawn when the y domain goes below zero). Its baseline touches the line, so it reads as underlined. When `yLo < 0`, pass the zero line to `placeValueLabels` as an extra `avoid` box (e.g. `[x0, y(0) - 1, x1, y(0) + 1]`), so the label moves to a clear spot. In `HealthCostsPanel.test.tsx`, extend the rendered sweep (every sample at 300/420/560/700px) to check that no cost label's estimated box crosses the zero line.

### Critique round 3 (2026-11-21)
- [x] Rubric 6: in `src/components/why/TaxChart.tsx` (rate labels ~line 89, average label ~line 105), labels collide with chart lines at 375. (a) The dashed average line runs through a lower step's rate label: "12%" in chicago-vs-austin (both offers) and plan-crossover (both). (b) The blue taxable-income marker runs through your own rate label: university-staff "22%" (both offers), because that label centers on the whole bracket step (a..b), even past the marker at `xt`. (c) In high-earner-family offer 2, no spot passes `fitsRight`, so the average label falls back to `above` at `x0 + 6`, where "Average 21.3% of your pay" sits on the 22% step line and next to "24%". Fix: treat the average line `[x0, ya±1, xt, ya±1]` and the marker x (±4px) as obstacles for rate labels (move a crossed label above its step only in the part left of `xt`, or drop it if it can't fit). Reject average spots whose box crosses a staircase segment, and add the short "Average X%" text to the left-end tries. In `TaxPanel.test.tsx`, add a rendered sweep (every sample at 300/420/560/700px) checking that no rate or average label box crosses the average line, the marker line, or a staircase segment.

### Critique round 4 (2026-11-21)
- [x] Rubric 6: in `src/components/why/healthValueLabels.ts` (`placeValueLabels`), at 375 new-grad-roth offer 2 (Lakeshore-style two-plan chart, spending $500) puts the blue "$2,000" PPO 750 cost label below-right of its dot, where the steep ink HSA Plan 3200 line runs through its "$". The ink "$800" label also lands several steps above its own dot. `lineCrosses` only compares the other line's y at the box's two edges, so a line that enters through the box's left side and bends past it can slip through, and a crossing only weighs 2, the same as one `step`-pair. Fix: test other plans' lines against the box by sampling the line across the box (or by segment–box intersection), weigh a crossing above `clash` (e.g. 6), and keep the nearest clear spot. In `HealthCostsPanel.test.tsx`, extend the rendered sweep (every sample at 300/420/560/700px) to check that no cost label box touches any plan's polyline, not just its own.

### Critique round 5 (2026-11-21)
- [x] Rubric 6: in `src/components/why/TaxChart.tsx` (`centered`, ~line 28), rate labels are sized as `text.length * CHAR_PX` (24px for "12%"), but they render 30.2px wide at 13px/600 (measured with `getComputedTextLength`), plus the 4px `HALO` stroke. So at 375 the "%" of a lower-step "12%" touches the next step's riser, and its halo cuts a notch in it (chicago-vs-austin both offers, high-earner-family both offers). Fix: size rate labels from a 600-weight estimate (e.g. digits 8.5px, "%" 13px, space 4px, letters 8px) plus 2px halo each side, in a helper in `chartKit.ts` that only TaxChart uses for now. In `TaxPanel.test.tsx`, make the rendered sweep's label boxes use the same helper, and add a unit check that the helper's width for "12%" is at least 30px.
