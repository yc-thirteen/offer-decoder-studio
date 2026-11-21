# Progress log

Append one entry per iteration (format in HARNESS.md). Newest at the bottom.

## 2026-11-21T04:30:22Z | iteration 1
Task: Inspect the repo and record framework, router, styling, UI kit, package manager, scripts; run npm install and npm run build.
Result: done
What changed: Only BACKLOG/PROGRESS. Findings:
- Framework: TanStack Start 1.168 (React 19.2, SSR) on Vite 8.1.5 via `@lovable.dev/vite-tanstack-config` (bundles tanstackStart, react, tailwind, tsconfig paths, nitro → Cloudflare worker build in `.output/`). No `src/main.tsx` and no `index.html`: the entry is `src/start.ts`/`src/server.ts`/`src/router.tsx`; head/meta live in `src/routes/__root.tsx` and per-route `head()`.
- Router: TanStack Router, file-based (`src/routes/`, generated `src/routeTree.gen.ts` — do not hand-edit). Routes today: `__root.tsx`, `index.tsx` (empty `<main>`).
- Styling: Tailwind v4 CSS-first in `src/styles.css` (`@theme inline`, oklch shadcn tokens, tw-animate-css). There is NO `tailwind.config.ts` and NO `src/index.css`; later tasks that name those files should use `src/styles.css`. Web fonts must load via `<link>` in `__root.tsx` head, not CSS @import.
- UI kit: shadcn/ui (46 components in `src/components/ui/`, Radix, lucide-react, cva). `recharts` is a dependency but must not be used (HARNESS bans chart libs).
- Package manager: Lovable uses bun (`bun.lock`, `bunfig.toml`); bun is not installed here, so the harness runs npm (node 25.9, npm 11.12). `npm install` produced an untracked `package-lock.json`; decision: do NOT commit it (would add a second lockfile type). Added it to `.git/info/exclude` (local only, not a repo change). New dev deps must still be added to package.json; bun.lock will be refreshed by Lovable.
- Scripts: dev, build, build:dev, preview, lint (eslint .), format, test (vitest run), test:watch. Vitest 4 + jsdom + Testing Library + jest-dom are ALREADY installed and configured (`vitest.config.ts`, `src/test/setup.ts`, one routing test passing). Missing: typecheck, verify, shots, a11y; Playwright not installed.
- Results: `npm install` ok (audit warnings only). `npm run build` ok. `npx vitest run` 1/1 pass. `npm run lint` 0 errors, 6 warnings (shadcn fast-refresh). `npx tsc --noEmit` clean. `.gitignore` already has `logs` (covers harness/logs) and `*.local`; not `harness/shots/` or `.env`.
Verify: pass (npm run build; verify script not yet created)
Screens checked: no (no UI change)
Next: Add harness/logs, harness/shots, .env, .env.local to .gitignore and .env.example.

## 2026-11-21T04:32:07Z | iteration 2
Task: Add harness/logs/, harness/shots/, .env, and .env.local to .gitignore. Add .env.example with placeholder names only.
Result: done
What changed: Appended harness/logs/, harness/shots/, .env, .env.local to `.gitignore` (confirmed with `git check-ignore`; .env.example stays tracked). New `.env.example` lists VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, commented VITE_SUPABASE_ANON_KEY (the names the Phase 5 AI factory will check), and a commented ANTHROPIC_API_KEY noted as a server-only Lovable Cloud secret. All values are placeholders. Decision: did not ignore `.env.*` broadly, so .env.example cannot be accidentally excluded.
Verify: pass (npm run build; verify script not yet created)
Screens checked: no (no UI change)
Next: Add Vitest/jsdom/Testing Library scripts: test, typecheck, verify, plus a trivial passing test (Vitest is already installed; mostly adding typecheck + verify).

## 2026-11-21T04:33:49Z | iteration 3
Task: Add Vitest with jsdom and Testing Library. Add scripts: test, typecheck, verify. Add one trivial passing test.
Result: done
What changed: Vitest 4/jsdom/Testing Library/jest-dom were already installed and configured, so no new deps. Added `typecheck` (`tsc --noEmit -p tsconfig.json`; the repo has a single app tsconfig) and `verify` (typecheck → lint → test → build, chained with &&) to package.json; `test` already was `vitest run`. Added `src/test/sanity.test.ts` (arithmetic + jsdom document check).
Verify: pass (exit 0; 2 test files / 2 tests; lint 0 errors, 6 pre-existing shadcn fast-refresh warnings; build ok)
Screens checked: no (no UI change)
Next: Add Playwright (chromium only), scripts/shots.mjs + shots script, scripts/a11y.mjs + a11y script.

## 2026-11-21T04:37:44Z | iteration 4
Task: Add Playwright (chromium only), scripts/shots.mjs + shots script, scripts/a11y.mjs + a11y script.
Result: done
What changed: Dev deps @playwright/test and @axe-core/playwright (both allowed); chromium installed locally via `npx playwright install chromium` (cache, not repo). bun.lock not refreshed (no bun here; Lovable refreshes it, same as iteration 1).
- Decision: `vite preview` cannot serve this build (TanStack's preview plugin wants dist/server/server.js, but Nitro emits a Cloudflare worker in .output/ → every request 500). So `scripts/lib/serve.mjs` builds with `NITRO_PRESET=node-server` (honored outside the Lovable sandbox; Vite config untouched) and runs `node .output/server/index.mjs` on a free port. `npm run build`/verify still make the Cloudflare build. Both scripts accept `--no-build` to reuse the last preview build.
- `npm run shots`: wipes harness/shots/latest/ and saves home-defaults, home-recommended, home-checklist, method, empty at 375/768/1280 (full page). Controls are located by DESIGN.md copy ("Use recommended elections" switch/checkbox, "Load a sample" picker → first case, checklist tab, "Clear offers"); missing controls log "skipped" instead of failing. Also warns on horizontal overflow and page errors.
- `npm run a11y`: axe (wcag2a/aa, 21a/aa) on / and /method at 375 and 1280; prints serious/critical counts, writes harness/shots/a11y.json, exits 1 if any. Currently 0/0.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 2 tests, build)
Screens checked: yes; home is still an empty <main> (expected), /method is the stock 404 (expected until Phase 6). All steps for unbuilt controls logged as skipped.
Next: Copy harness/fixtures/cases.json and letters into src/data/ with a byte-identical test.

## 2026-11-21T04:39:40Z | iteration 5
Task: Copy harness/fixtures/cases.json to src/data/sampleCases.json, the letters to src/data/letters/, and add a byte-identical test.
Result: done
What changed: New `src/data/sampleCases.json` and `src/data/letters/` (cascade.txt, lakeshore.txt, northfield.txt, and expected-extractions.json — copied too since the Phase 5 mock-reader tests will need it). New `src/data/fixtureCopies.test.ts` compares bytes (Buffer.equals) for cases.json and every file in harness/fixtures/letters, and asserts the two letter directories list the same files, so a new fixture letter without a copy fails. Decision: kept the default jsdom environment (a `// @vitest-environment node` directive breaks the shared setup file, which touches `window`); node:fs works under jsdom.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 3 files/8 tests, build)
Screens checked: no (no UI change)
Next: Phase 1 — engine types.ts and constants.ts from FINANCE_SPEC.md.

## 2026-11-21T04:42:27Z | iteration 6
Task: `types.ts` (Profile, Offer, HealthPlan, MatchTier, Vesting, Elections, CalcResult, LifeResult, CaseResult) and `constants.ts`, both taken exactly from FINANCE_SPEC.md.
Result: done
What changed: New `src/lib/engine/types.ts`: field names mirror cases.json/expected.json exactly (e.g. `filingStatus: "single" | "mfj"`, `otherHouseholdWages`, `winnerBy_default`) so fixtures load with no mapping layer; also OfferResult, ChecklistId union, CostPoint, SampleCase, Vesting as a discriminated union (immediate / cliff years / graded schedule), optional `customStateRate` for OTHER. New `src/lib/engine/constants.ts`: brackets as [upTo, rate] with Infinity top edge, std deduction, SS/Medicare, 401(k)/HSA limits, 15% target, Roth ≤12%, 15% retirement tax, STATE_RATES, LIFE — values copied from engine.py (agrees with the spec; no discrepancy found).
- `constants.test.ts`: compile-time exhaustive key lists for CalcResult/LifeResult/OfferResult/Profile, checked at runtime against every fixture object, plus spot checks of the constants. Decision: fixture JSON is cast to loose records in tests because TS infers per-case literal unions for JSON imports that don't unify.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 4 files/13 tests, build)
Screens checked: no (no UI change)
Next: `tax.ts` plus the `lecture-checks` test.

## 2026-11-21T04:45:00Z | iteration 7
Task: `tax.ts` (income tax, marginal rate, payroll taxes, state) plus the `lecture-checks` test using `harness/fixtures/lecture-checks.json`.
Result: done
What changed: New `src/lib/engine/tax.ts`: incomeTax, marginalRate (an edge belongs to the lower bracket, as in engine.py), taxableIncome, federalTaxOnJob (marginal method vs spouse wages), federalMarginalRate, socialSecurityTax, medicareTax (surtax only on what this job adds over the threshold), stateRate/stateIncomeTax. All unrounded; rounding is left to calculate.ts. Decision: OTHER with no customStateRate yet uses 0, not a crash (engine.py would fail; the UI validates the field).
- `lecture-checks.test.ts` (describe "lecture-checks") covers the 4 tax checks from the fixture. The human-capital and life-fraction checks are `it.todo` because life.ts doesn't exist yet. The life.ts backlog task now says to replace them, so the tax task stays small.
- `tax.test.ts`: bracket, edge, marginal-method, SS cap, Medicare surtax, and state unit tests, plus every tax line (federal, marginal rate, SS, Medicare, state) for all 12 offers × default/recommended against expected.json, within $1.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 6 files/51 tests + 2 todo, build)
Screens checked: no (no UI change)
Next: `health.ts` (out-of-pocket, plan cost, breakpoints, dominated plans, worst case, recommended plan) with unit tests.

## 2026-11-21T04:48:03Z | iteration 8
Task: `health.ts` (out-of-pocket, plan cost, breakpoints, dominated plans, worst case, recommended plan) with unit tests.
Result: done
What changed: New `src/lib/engine/health.ts`: outOfPocket, employerHsaDeposit, planCost, worstCaseCost, breakpoints (Set-deduped, sorted, +1 point at max×1.5+1000 exactly like engine.py), planCostCurves (unrounded [spend, cost] per plan, for the chart and runCase), dominatedPlanIds (same 1e-9 slack, identity-based self-skip, input order), recommendedPlan (score rounded to 6 dp, tie → lower premium → earlier plan).
- Decisions: recommendedPlan throws "An offer needs at least one health plan." on an empty list (the edit form must validate this); if every plan is filtered out (only possible with duplicate ids) it falls back to all plans instead of crashing.
- `health.test.ts`: unit tests for each function (deductible/coinsurance/cap, HSA only on eligible plans, kinks incl. coinsurance 0, crossing vs dominated vs identical plans, buffer vs no-buffer choice, premium tie-break) plus dominated ids, recommended plan id, and every cost-curve point for all 12 offers vs expected.json (within $1).
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 7 files/80 tests + 2 todo, build)
Screens checked: no (no UI change)
Next: `retirement.ts` (match tiers, match cap, max match %, vesting) with unit tests, including the 7B 6%→9% example.

## 2026-11-21T04:50:31Z | iteration 9
Task: `retirement.ts` (match tiers, match cap, max match %, vesting) with unit tests, including the 7B example where 6% in gets 9% total.
Result: done
What changed: New `src/lib/engine/retirement.ts`: matchCapPct, employee401kDollars (capped at 24,500), hitsLimit401k (strict `>` like engine.py, so exactly 24,500 is not "hits limit"), employerMatch (cumulative bands sorted by upToPct, on actual capped dollars), fullMatchDollars, maxMatchPct, vestedPct/vestedPctByYear (years 0–6; graded walks the schedule in order like engine.py). All unrounded. Decisions: no tiers → cap 0 and match 0; salary ≤ 0 → match 0 instead of dividing by zero. The 401(k) dollar/limit helpers live here so calculate.ts and recommend.ts share them.
- `retirement.test.ts`: 7B 50%-to-6% example (6% in → 9% total), unsorted cumulative tiers, no-match, 401(k)-cap interaction, limit edge, immediate/cliff/graded vesting, plus matchCapPct, maxMatchPctOfSalary, vestedPctByYear, employee401k, hitsLimit401k and employerMatch (default + recommended) for all 12 offers vs expected.json.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 8 files/100 tests + 2 todo, build)
Screens checked: no (no UI change)
Next: `calculate.ts` (full pay calculation and bottom line) and `recommend.ts` (recommended elections).

## 2026-11-21T04:53:20Z | iteration 10
Task: `calculate.ts` (the full pay calculation and bottom line) and `recommend.ts` (recommended elections).
Result: done
What changed: New `src/lib/engine/calculate.ts`: r2 (cents, +1e-9 nudge like engine.py), otherWages (spouse only when mfj), defaultElections, findPlan, calculate() composing tax/health/retirement into every CalcResult field (rounded like engine.py; marginal rate unrounded). New `recommend.ts`: isReady and recommend() per the funds hierarchy (match cap → ceil(15 − max match %) when ready → never below default → HSA = tier limit − employer deposit when ready and eligible → Roth if offered and marginal ≤ 12% under the traditional probe).
- Decisions: unknown planId throws "Choose one of this offer's health plans…" (engine.py would crash; the UI only offers valid ids); payPeriods ≤ 0 or salary ≤ 0 avoid division by zero instead of producing NaN.
- Tests: `calculate.test.ts` (section 125 vs traditional vs Roth, HSA ignored on non-eligible plans, bottom-line identity, 401(k) cap, mfj spouse wages, r2) plus every CalcResult key for all 12 offers × default/recommended vs expected.json (numbers within $1, ids/booleans/account types exact). `recommend.test.ts` (ready/not ready, default floor, Roth threshold, no-match → 15%) plus recommendedElections deep-equal for all 12 offers.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 10 files/139 tests + 2 todo, build)
Screens checked: no (no UI change)
Next: `life.ts` and `checklist.ts`, and replace the two lecture-checks `it.todo` entries.

## 2026-11-21T04:56:38Z | iteration 11
Task: `life.ts` (human capital and coverage) and `checklist.ts` (ordered ids), and replace the two `it.todo` entries in lecture-checks.test.ts.
Result: done
What changed: New `src/lib/engine/life.ts`: humanCapital (growing annuity; r = g uses the limit salary×n/(1+r) instead of dividing by zero), insuredFraction (0 when L/W or γ ≤ 0), lifeInsurance(offer, profile, params?) with optional LifeParams overrides (risk aversion, markups, …) for the Phase 4 sliders; null without dependents; age ≥ 67 gives all-zero coverage, not NaN (engine.py would divide by zero). New `checklist.ts`: checklist(offer, profile, {defaults, recommended, defaultCalc}?) mirroring engine.py order; precomputed pieces are optional so runCase can pass them.
- Tests: `life.test.ts` (edges, cap on supplemental, single ignores spouse, overrides, all 12 offers' LifeResult vs expected.json within $1), `checklist.test.ts` (ready/not-ready, unclaimed match, vesting, precomputed = computed, all 12 offers exact and in funds-hierarchy order). Lecture checks: both todos replaced.
- Decision: the fixture's human-capital tolerance (±5,000 of 1.6M) can't be met even by engine.py itself (got 1,607,435.08, $7,435 off). The spec only says "≈ 1.6M". The test now asserts the stricter thing (within $1 of the oracle's `got`) and that the value rounds to $1.6M at the slide's printed precision. The fixture is unchanged. The life fractions use the fixture tolerance as written (0.90/0.48 ± 0.01).
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 12 files/178 tests, build)
Screens checked: no (no UI change)
Next: `runCase()` in `index.ts` plus `fixtures.test.ts` against expected.json.

## 2026-11-21T04:59:08Z | iteration 12
Task: `runCase()` in `index.ts`, plus `fixtures.test.ts` comparing every field of every case to `harness/fixtures/expected.json` (within $1, ids exact, booleans exact).
Result: done
What changed: New `src/lib/engine/index.ts`: runOffer() and runCase() mirroring engine.py run_case (cost curves and max match % rounded with r2; checklist reuses the precomputed elections/default calc; winner = highest bottom line, first offer wins a tie like Python's max). It also re-exports the engine's public API so the UI imports only from `@/lib/engine`.
- `fixtures.test.ts`: a recursive diff over all 6 cases and 12 offers. The key sets must match exactly (no missing or extra fields) and array lengths are exact. Strings and booleans are exact. Dollars use the fixture's toleranceDollars ($1). Decision: ratios get scale-appropriate tolerances (fractions 1e-4, percents 0.01), because a $1 tolerance would accept any rate. Includes a self-test showing the comparer catches each kind of mismatch.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 13 files/186 tests, build)
Screens checked: no (no UI change)
Next: Phase 2 — design tokens in `src/index.css` and `tailwind.config.ts`, Public Sans, tabular numbers, neutralized shadcn.

## 2026-11-21T05:03:30Z | iteration 13
Task: Tokens in `src/index.css` and `tailwind.config.ts`, Public Sans loading, tabular numbers, and base element styles. Neutralize the default shadcn look (no shadows, no rounding, token colors only).
Result: done
What changed: The repo is Tailwind v4 CSS-first, with no tailwind.config.ts or index.css (see iteration 1), so everything lives in `src/styles.css`. The six DESIGN.md tokens are hex CSS vars mapped to `bg-paper`/`text-ink`/`text-carbon`/etc. Every shadcn var (--background, --primary, --border, --ring, chart-*, sidebar-*) aliases a token. The .dark block is removed (light-only); the dark variant still points at `.dark`, so shadcn `dark:` classes never fire.
- A plain `@theme` resets the default color palette, shadows, blur, tracking, fonts, animations and type scale. `bg-slate-*`, `shadow-*`, `tracking-*` and `font-mono` now emit nothing. Type scale: xs 13 / sm 15 / base 17 / lg,xl 21 / 2xl,3xl 28 / 4xl 40. Weights map onto 400/600/800. All radii are 0 (rounded-full kept for the round perforation holes). Added `--container-page` 1120px, `--container-prose` 68ch, and an `amount` utility (right-aligned, tabular, nowrap).
- Base: body 17/1.5 Public Sans, ink on paper, tabular-nums globally. h1 40/800, h2 21/800, h3 17/600. Inputs are carbon; focus ring is a 2px carbon outline (not a box shadow); monospace is forced back to the sans. Underlines apply only to plain `a:not([class])` links, so button-styled links aren't underlined. Reduced-motion guard.
- Decision: tw-animate-css @import removed (the package stays in deps) because DESIGN.md allows only the correction motion. Public Sans is loaded through a Google Fonts <link> (400;600;800) in `__root.tsx` head, per the styles.css rule against remote @import. Contrast checked: ink-soft 4.85 on paper and 5.48 on stub; carbon 6.66/7.53; correction 5.41/6.12.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 13 files/186 tests, build). The built CSS contains only the six token hexes plus Tailwind internals and recharts attribute selectors.
Screens checked: yes. `/` is blank paper (no UI yet). The 404 view shows Public Sans, ink, a square button with no shadow, and no underline on the button link after the fix. The centered 404 copy is left for the Phase 6 404 task.
Next: Components in `src/components/stub/` (GuillocheBackground, Perforation, StubShell, LineItem, Amount, Stamp) plus the `/dev/components` route.

## 2026-11-21T05:16:44Z | iteration 14
Task: Components in `src/components/stub/` (GuillocheBackground, Perforation, StubShell, LineItem, Amount, Stamp) plus the `/dev/components` route.
Result: done
What changed: New `src/components/stub/`: `formatMoney` (whole dollars or cents, a true minus sign, never "-$0"); `Amount` (static, blank, and struck + new; a 2px correction line drawn left to right in 180ms with scale-x, retracting when turned off; `motion-reduce:transition-none`; sr-only "was $4,500, now $9,000"; amounts that format the same are never corrected); `Stamp` (only "Dominated plan" and "Match not claimed"; -4°, 2px border, 85%); `LineItem` (dt/dd row in three variants (line, total boxed, grand boxed 2px), plus note, stamp, and a `rule` prop); `StubShell` and `StubRule`; `Perforation` (vertical and horizontal, holes 4px every 10px, notches at both ends); `GuillocheBackground` (a fixed inline SVG pattern of 10 sine waves at 5% ink). New route `src/routes/dev.components.tsx` (noindex) with a "Use recommended elections" checkbox. `routeTree.gen.ts` was regenerated by the build. 11 component tests.
- Decisions: the notches live on the perforation strip, not the shell (noted in DESIGN.md Harness notes). An `<hr>` inside a `<dl>` failed axe, so in-list rules are a LineItem prop. The guilloché was invisible because body's opaque background covered the -z-10 layer, so body is now transparent and html keeps the paper color. Boxed labels get min-w 7em so "Net pay" doesn't break at 375; the amounts wrap instead. The shots script gained dev-components views (off and on), and a11y now also checks /dev/components.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 14 files/200 tests, build). a11y: 0 serious, 0 critical on /, /method, and /dev/components.
Screens checked: yes, at 375, 768, and 1280. The stub, notches, perforation, strike, stamps, and right edge are good, with no overflow. Deferred to the Phase 6 responsive pass: at 768, side-by-side stubs are about 345px wide, so many labels wrap to two lines. Consider stacking until lg.
Next: Phase 3, app state (profile, two offers, elections mode, annual or per paycheck, chosen sample) in one store.

## 2026-11-21T05:19:38Z | iteration 15
Task: App state (profile, two offers, elections mode, annual or per-paycheck, chosen sample) in one store, using React context or useReducer. The engine runs from state, and components only format.
Result: done
What changed: New `src/state/decoderState.ts` (pure, no React): SAMPLE_CASES, DecoderState {profile, offers: [Offer|null, Offer|null], electionsMode default|recommended, periodMode annual|perPaycheck, sampleId}, decoderReducer (loadSample, setProfile patch, setOffer, clearOffers, setElectionsMode, setPeriodMode), and deriveView(), which runs the engine and returns per-stub {offer, result, calc for the current mode, divisor (1 or payPeriods), error} plus winners. New `src/state/DecoderContext.tsx`: DecoderProvider (useReducer + memoized view) and useDecoder(). `/` is wrapped in the provider (nothing visible yet).
- Decisions: starts on the first sample (chicago-vs-austin) with defaults and annual amounts; `initialSampleId={null}` starts empty. Samples are structuredClone'd so edits never mutate the imported JSON. Editing an offer keeps sampleId (the picker still names what was loaded); Clear offers sets it to null. Both offers run through runCase so the winner logic stays in the engine; if the engine throws (e.g. a bad plan id), each offer runs alone so the directive error lands on the right stub and the other stub still renders. Per-paycheck is exposed as a divisor so components only divide-and-format.
- Tests: 10 reducer/view tests (all 6 samples load and match expected.json winners and net pay in both modes, no mutation, profile recompute, modes, clear, lone offer, error isolation) and 3 provider tests.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 16 files/213 tests, build)
Screens checked: no (no visible UI change; `/` still renders an empty main)
Next: Header and controls row (sample picker with all 6 cases, Annual/Per paycheck toggle, recommended switch).

## 2026-11-21T05:25:32Z | iteration 16
Task: Header and controls row (sample picker with all 6 cases, the Annual/Per paycheck toggle, and the recommended switch).
Result: done
What changed: New `src/components/decoder/DecoderHeader.tsx` (exported from `@/components/decoder`). DecoderHeader is the brand at 21/800 on the left and "Pay period: your first year" in 13px ink-soft on the right, with a 2px ink rule beneath. DecoderControls holds three controls:
- SamplePicker: a native select labeled "Load a sample" listing all 6 SAMPLE_CASES by title, plus a "Load sample" submit button that dispatches loadSample.
- PeriodToggle: a fieldset "Show amounts" with two sr-only radios styled as square segments. The selected one is carbon, and the focus ring sits on the segment via :has(:focus-visible).
- RecommendedSwitch: a native checkbox with role="switch", "Use recommended elections", that turns carbon/600 when on.
`/` now renders GuillocheBackground, the header, an sr-only h1, and the controls inside the 1120px column. 5 new tests in DecoderHeader.test.tsx.
- Decisions: the select doesn't load on change. Changing context on select is a WCAG 3.2.2 problem, and DESIGN.md names the button "Load sample". The picker keeps its own choice: it follows state.sampleId when a sample loads and keeps the last choice after Clear offers, so Load sample always works from empty. The select is capped at 24rem (sm and up) so the row fits on one line at 1280. Longer titles are clipped in the closed select, but the open list shows them in full.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 17 files/218 tests, build). a11y: 0 serious, 0 critical.
Screens checked: yes, at 375, 768, and 1280, with no overflow. Controls take one row at 1280 and two at 768. At 375 they take three rows (picker+button, toggle, switch), because the toggle and the switch label together are wider than 343px. DESIGN.md says two rows; that's left for the Phase 6 responsive pass.
Next: About you block (all profile fields; spouse's wages only when filing jointly; a disclosure on mobile).

## 2026-11-21T05:31:02Z | iteration 17
Task: About you block (all profile fields; spouse's wages only when filing jointly; a disclosure on mobile).
Result: done
What changed: New `src/components/decoder/AboutYou.tsx`, set like the employee information block: an "About you" h2 plus one wrapping row of labeled fields (labels above, 13px ink-soft; controls are square, ink-bordered, carbon text). Fields: Filing (Single / Married filing jointly), Spouse's wages (only when filing jointly), Coverage (Just me / My family), Medical spending this year, Emergency fund, High-interest debt, Someone depends on my income (Yes/No selects), Age, Current savings. Pure helpers (parseDollars, parseAge, groupDigits, profileSummary) are in `profileFormat.ts` so the component file adds no fast-refresh warnings. It is mounted on `/` under the controls. 9 new tests. `scripts/shots.mjs` gains a `home-about-open` view that opens the mobile disclosure.
- Decisions: number fields keep a local draft. Valid typing commits on every keystroke, so the stubs recompute live. Invalid typing keeps the last good value in the store and shows a directive error in correction red (aria-invalid plus aria-describedby), e.g. "Type your age in whole years, 16 to 100." On blur the amount is reformatted with thousands separators. Switching back to Single only hides spouse's wages and keeps the value, because the engine already ignores it unless filing jointly. Age and current savings are included because "all profile fields" covers them and life insurance uses both. Below md, the fields hide behind a "Change your details" button (aria-expanded/aria-controls) with a one-line summary such as "Single, just me, $2,000 medical spending". I used a button instead of <details> because a closed <details> can't be forced open with CSS at md and up.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 18 files/227 tests, build). a11y: 0 serious, 0 critical.
Screens checked: yes, at 375 (collapsed and open), 768, and 1280, with no overflow and no banned items. Selects were stretched to their label width, so fields now use items-start. At 1280 About you takes two rows of fields. Fitting one row would need shorter labels than DESIGN.md's, so it's left as is.
Next: The two stubs bound to engine output, with every line item, note, stamp, and both modes (component test against chicago-vs-austin).

## 2026-11-21T05:36:54Z | iteration 18
Task: The two stubs bound to engine output, with every line item, note, stamp, and both modes. Check them against the fixture numbers for chicago-vs-austin in a component test.
Result: done
What changed: New `src/components/decoder/OfferStub.tsx` (OfferStub, OfferStubs) and `stubFormat.ts` (pure label/note helpers: place, state tax row, rates, 401(k) cap, vesting note). OfferStubs is mounted on `/` under About you: two StubShells with a horizontal perforation below lg and a vertical one from lg. Every amount is an Amount with value = default calc ÷ divisor and next = recommended calc ÷ divisor, corrected when "Use recommended elections" is on, so every changed line and total gets the strike plus a carbon amount. Labels follow the current elections, and the parts the recommendation changed (%, Roth/traditional, plan name) turn carbon. Stamps: "Dominated plan" when the shown plan is dominated; "Match not claimed" when the shown % is under the match cap (max two). Notes: 401(k) cap, federal marginal/average, vesting, custom state rate. Per paycheck shows cents, "Per paycheck, N paychecks a year", and "Your bottom line per paycheck". An empty stub shows the DESIGN.md direction sentence; an engine error shows its message in correction red.
- Decisions: added a "Savings in your name, after future tax" row so the stub's arithmetic adds up to the bottom line (DESIGN.md Harness notes). Medical bills show as a negative (true minus). HSA rows show only when either mode has HSA dollars (Lakeshore has none). "Edit offer" is left to the edit-mode task, so no inert button. Blank labels in the empty state are left to the empty-state task.
- Tests: `OfferStub.test.tsx` (6 tests) checks every row of both chicago-vs-austin stubs against expected.json defaults, plus labels/notes/stamps, the recommended corrections (sr-only "was/now", carbon labels, no stamps), per paycheck ($3,909.51), the empty direction, and the word helpers.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 19 files/233 tests, build). a11y: 0 serious, 0 critical.
Screens checked: yes, at 375, 768, and 1280, defaults and recommended. Clean right edge, the strikes are legible, no horizontal scroll, and the notches and perforation are clear of text. At 375 with recommended on, long labels ("Savings in your name, after future tax") wrap to three lines next to the two amounts. That is readable and left for the Phase 6 responsive pass.
Next: Memo line (the winner sentence, plus the flip sentence when the default and recommended winners differ).

## 2026-11-21T05:41:48Z | iteration 19
Task: Memo line (the winner sentence, plus the flip sentence when the default and recommended winners differ).
Result: done
What changed: New `src/components/decoder/memoText.ts` (pure: memoName, memoText from the view's engine winners and bottom lines) and `MemoLine.tsx` (a "Memo" region: "Memo:" plus the sentence on a 1px ink underline, 21px below md and 28px from md, 600 weight, max 68ch, aria-live polite). It is mounted on `/` under the stubs. chicago-vs-austin reads exactly as the DESIGN.md sketch, with "a year" added: "With the defaults, Lakeshore Systems looks $3,205 better a year. Elect correctly and Northfield Health is worth $1,894 more a year." 8 tests: the DESIGN example in both modes; all 6 samples name the engine's winner with the fixture gap; only chicago-vs-austin and university-staff flip; parentheticals; ties; the empty, one-offer, and error directions; the component following the switch; yearly amounts in per-paycheck mode.
- Decisions (also in DESIGN.md Harness notes): the amounts stay yearly in per-paycheck mode. Full employer names are used, minus a trailing parenthetical, rather than DESIGN's first-word shorthand, because the full name is unambiguous. A $0 gap reads "come out even" and never counts as a flip. With no or one offer, or an engine error, the memo gives direction ("Load a sample or fill in two offers…", "Fill in a second offer…", "Fix the offer marked in red…").
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 20 files/241 tests, build). a11y: 0 serious, 0 critical.
Screens checked: yes, at 1280 (defaults) and 375 (recommended), plus 768. The memo is the most prominent sentence after the stub totals, the underline sits under the wrapped text, and there is no overflow. At 375 the "Memo:" label hangs to the left, so the text column is narrow (6 lines). That is readable; it's left for the Phase 6 responsive pass.
Next: Back-of-stub checklist with the offer tabs and all copy from DESIGN.md, with dynamic values and zero amounts omitted.

## 2026-11-21T05:48:47Z | iteration 20
Task: Back-of-stub checklist with the offer tabs and all copy from DESIGN.md, with dynamic values and zero amounts omitted.
Result: done
What changed: New `src/components/decoder/checklistText.ts` (pure: checklistSentence/checklistItems fill the DESIGN.md copy from engine values in the engine's id order, plus vestingDateText) and `Checklist.tsx`, mounted on `/` under the memo. It has an h2 "Back of the stub: what to elect on day one", a WAI-ARIA tablist named by employer (roving tabindex, arrow/Home/End keys, carbon when selected), and a bordered --stub tabpanel of real checkboxes. Ticks are kept in memory per sample, slot, and offer, and ticked text turns carbon. With no offer there are no tabs, just the sentence "Load a sample or read an offer letter to see what to elect on day one."; an engine error shows its message in correction red. 9 tests in `Checklist.test.tsx`: Northfield's exact copy, ids and order for all 12 offers with no $0 or blank values, the life-insurance rephrasings, the 0% default, vesting text, tabs and keys, ticks per offer, and the empty state. `scripts/shots.mjs` openChecklist now scrolls to the heading and ticks the first item (there is no tab named "checklist").
- Decisions (also in DESIGN.md Harness notes): $0 rephrasings for the 0% default, no employer HSA, and life coverage with nothing through work. The Roth/traditional rate is the bracket the engine's recommend() compared (traditional probe), not the Roth calc's bracket. The plan in "costs more than" is checked with the engine's dominatedPlanIds, so the sentence is never false. The unclaimed match is fullMatchDollars − the default match, the same quantity the engine's checklist tests.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 21 files/250 tests, build). a11y: 0 serious, 0 critical.
Screens checked: yes, at 375, 768, and 1280. At 375 the tabs first wrapped onto two misaligned rows; now they split one row (Lakeshore Systems wraps inside its tab). Prose is under 75ch, with no overflow and no banned items.
Next: Edit offer mode (inline fields in carbon, add and remove health plans and match tiers, vesting type, validation, "Save offer" → "Offer saved").

## 2026-11-21T06:20:00Z | iteration 21
Task: Edit offer mode: inline fields in carbon, add and remove health plans and match tiers, choose the vesting type, and validation with directive error messages. "Save offer" leads to "Offer saved".
Result: done
What changed: New `src/components/decoder/offerDraft.ts` (pure). It holds OfferDraft (the offer as editable text, with rates typed as percents), draftFromOffer, blankDraft/blankPlan/blankTier/blankStep, parseNumber/parseMoney, and validateDraft, which returns an engine Offer or directive errors keyed by field. New `OfferEditor.tsx`: four fieldsets (The job, 401(k), Health plans, Life insurance) with add/remove for match tiers, plans, and graded vesting steps, a vesting-type select (right away / cliff / graded) that shows only the fields its type needs, a flat-rate field only for "Another state", "Save offer", and Cancel. `OfferStub.tsx`: each stub header gets "Edit offer" ("Fill in offer" on an empty stub) and an always-mounted status that reads "Offer saved" after a save. Saving dispatches setOffer for that slot. `scripts/shots.mjs` gains a `home-edit` view (stub 1 in edit mode after a failed save).
- Decisions: errors show only after the first save attempt, then follow the draft live so they clear as you fix them. Focus goes to the first invalid field, then back to "Edit offer" on save or cancel. An untouched percent field keeps its exact loaded rate, so every sample offer round-trips unchanged (the Midway 4/3 match shows as 133.33%). The editor is tied to the offer it opened on, so loading a sample closes it without saving. The last health plan can't be removed. Removing the default plan makes the first remaining plan the default. A plan that isn't HSA-eligible saves an employer HSA deposit of $0. Tiers must rise in % of pay. Graded steps must rise in year, never drop in %, and end at 100%.
- Tests: 10 in offerDraft.test.ts (all 12 sample offers round-trip exactly, parsing, edits, errors per field, tiers, vesting types, other-state rate, HSA drop, blank form) and 8 in OfferEditor.test.tsx (edit and save updates the stub with "Offer saved" and focus return, a blocked save with aria-invalid/description/focus/summary, add and remove plans and tiers, vesting type switching, other state, cancel, a sample load closing the editor, filling an empty stub).
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 23 files/268 tests, build). a11y: 0 serious, 0 critical; a one-off axe run on edit mode with errors showing also found 0 violations at 375 and 1280.
Screens checked: yes, home-edit at 375, 768, and 1280. The first pass clipped the vesting select ("All at once after some ye…") and long labels wrapped, so fields sat out of line at 1280. I shortened the labels ("All at once (cliff)", "Employer match rate", "On pay up to", "Default contribution"). No overflow and no banned items.
Next: Empty state (blank stubs with direction) and a "Clear offers" control.

## 2026-11-21T06:45:00Z | iteration 22
Task: Empty state (blank stubs with direction) and a "Clear offers" control.
Result: done
What changed: `OfferStub.tsx` adds EmptyStub. It shows "Load a sample or read an offer letter to fill this stub." and then every stub line label in ink-soft, with an aria-hidden blank line in place of each amount. The bottom-line label follows Annual/Per paycheck through a new perPaycheck prop. `DecoderHeader.tsx` adds ClearOffersButton, a secondary button placed after "Load sample" in the controls row that dispatches clearOffers. 2 new tests in OfferStub.test.tsx: the empty labels with blank amounts and no $, plus the per-paycheck label; and Clear offers empties both stubs, a second clear is harmless, and Load sample refills them with the fixture numbers.
- Decisions (also in DESIGN.md Harness notes): Clear offers keeps the profile and stays enabled even when empty. A disabled button would drop focus to the page right after the click, and the memo's live region already announces the empty state. The error state stays as the engine's message in correction red, with no blank lines, so the fix is the only thing on the stub.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 23 files/270 tests, build). a11y: 0 serious, 0 critical.
Screens checked: yes, empty, defaults, and recommended at 375, 768, and 1280. On the first pass, grouping Clear offers with the picker squeezed the 375 select to three letters, and at 1280 the switch fell to a second row. Fix: Clear offers is now its own item in the row, and the select is 16rem from lg. At 375 the controls take four rows (picker, Clear offers, toggle, switch); that is left for the Phase 6 responsive pass. At 1280 the row fits on one line, even with the switch on. No overflow, and the blank lines sit clear of the notches and the perforation.
Next: Health plan costs chart (SVG, from the engine's breakpoints, dominated plans dashed red, recommended in carbon, an expected-spending marker, direct labels).

## 2026-11-21T07:10:00Z | iteration 23
Task: Health plan costs chart (SVG, from the engine's breakpoints, dominated plans dashed red, recommended in carbon, an expected-spending marker, direct labels).
Result: done
What changed: New `src/components/why/`, with five files:
- `chartKit.ts` (pure scale, nice ticks, label spreading, and tick money, shared by the later panels).
- `healthChart.ts` (pure: the spending window, the plan lines built from OfferResult.planCostCurves plus the engine's planCost/worstCaseCost, the conclusion sentence, and the line labels).
- `HealthCostChart.tsx` (hand-built SVG, measured with ResizeObserver via `useElementWidth.ts`).
- `HealthCostsPanel.tsx`.
- `WhyElections.tsx` (h2 "Why these elections", mounted on `/` under the checklist).

The engine index also re-exports `planCost` and `worstCaseCost`; the engine logic is unchanged. Charts use 1.5px ink axes at 60%, dotted gridlines at 20%, and 13px tabular labels. Dominated plans are a dashed correction line and the recommended plan is a solid 2.5px carbon line. A vertical marker shows "Your spending, $X", and each plan's cost there is written by its dot. The x-axis title is "Medical spending this year". There is no legend and no tooltip, and a screen-reader list repeats every value. 11 tests: chicago-vs-austin colors and dashes, the labels, the marker, no rects, the conclusion sentences (dominated default, single plan, no emergency fund, non-dominated default), every line of all 12 offers checked against the engine's planCost/kind, and the empty direction.
- Decisions: one chart per offer, so a one-plan offer still shows its cost and its ceiling. The plan kind is also written in each label, so meaning never rests on color alone. The y range grows until every label fits above the highest line end. When a label beside its own line end would cross any line, the labels stack in that band instead (cost never falls as spending rises, so no line reaches it). Value labels flip to the left of the marker when they would hit a line label. The marker label stays inside the chart.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 24 files/281 tests, build). a11y: 0 serious, 0 critical.
Screens checked: yes, home at 375, 768, and 1280, plus one-off panel shots of all 6 samples at 375 and 1280 (not committed). On the first pass, long labels at 375 spilled over the y axis and the right edge, the plan-crossover labels collided with the values and lines, and "Your spending, $12,000" was clipped. All of that is fixed above. Two things are left as is: the panel h3 and the employer h4 are both 17/600, so the hierarchy is soft (I'll look at it in the critique round), and the stacked labels can cross the marker line, but the knockout outline keeps them legible.
Next: Match and vesting chart, plus the vesting timeline for years 0–6.

## 2026-11-21T06:37:13Z | iteration 24
Task: Match and vesting chart, plus the vesting timeline for years 0–6.
Result: done
What changed: New files in `src/components/why/`:
- `matchData.ts` (pure): the match line from the engine's employerMatch on dollars capped by employee401kDollars, with points at 0%, every tier edge, the 401(k) limit %, and the window edge. It also holds the bends, the default/recommended markers taken from the engine's calcs, the money left on the table, the % window, the match sentence, and the vesting sentence read off vestedPctByYear.
- `MatchChart.tsx` (hand-built SVG).
- `VestingTimeline.tsx` (SVG, years 0–6).
- `MatchVestingPanel.tsx`, mounted in WhyElections under Health plan costs.

The engine index also re-exports `employerMatch` and `employee401kDollars`; the engine logic is unchanged. 7 tests in `MatchVestingPanel.test.tsx`: the chicago-vs-austin sentences and markers, the bends of the Midway 4/3 then 2x match and of Cascade's 0% default, graded/cliff/none vesting sentences, every point of all 12 offers on the engine's curve with markers equal to the engine's default/recommended match, the % window, the rendered colors/labels/gap/timeline values, the sr-only lists, and the empty direction.
- Decisions: the data module is `matchData.ts` and not `matchChart.ts`, because macOS is case-insensitive and that name collided with `MatchChart.tsx` (TS1149). A $0 dot on the axis gets no value label (the $0 tick says it). Equal values that would touch are written once, by the recommended dot. The vesting sentence names the yearly match at stake, using the recommended elections. The vesting columns use framed rects (the "no rects" check applies only to the match chart, since there is no legend in either).
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 25 files/288 tests, build). a11y: 0 serious, 0 critical.
Screens checked: yes, the full page at 375, 768, and 1280, plus one-off panel shots of all 6 samples at 375 and 1280 (script deleted, not committed). The first pass had crowded x ticks at 375 ("12%14%") and at 1280 ("9% 10%"), a "Recommended" title crossed by the default marker line, and the gap label colliding with the line label at 375. All fixed: ticks are now at least 48px apart, the width estimate went from 7.4 to 8px a character with an 8px collision margin, and the gap label is placed first, avoiding the line label, with values moving below the flat line when their spot is taken. Left as is: marker lines pass behind "Employer match per year" (the knockout outline keeps it legible), and the vesting columns are heavy solid ink. I'll revisit the latter in the critique round.
Next: Life insurance panel, shown only with dependents (risk aversion and markup sliders that recompute live).

## 2026-11-21T07:35:00Z | iteration 25
Task: Life insurance panel, shown only with dependents (risk aversion and markup sliders that recompute live).
Result: done
What changed: New files in `src/components/why/`:
- `lifeData.ts` (pure): LifeSettings/LECTURE_SETTINGS, lifeFor (at the lecture values it returns the case's own lifeInsurance, otherwise it calls the engine's lifeInsurance() with the slider values), the chart line from insuredFraction(), the two markers, the coverage sentence (via checklistSentence, so the panel and checklist share words), the reason sentence, and the dollar rows.
- `LifeChart.tsx` (hand-built SVG of the share to insure against the markup).
- `LifeInsurancePanel.tsx`, mounted in WhyElections under the match panel.

Also: the engine index re-exports `insuredFraction` (engine logic unchanged). chartKit gains Box/overlaps/textBox/CHAR_PX. `src/styles.css` styles range inputs in tokens only, because the native track was an off-token grey pill. `checklistText.ts` gets a basic-only life rephrasing. `scripts/shots.mjs` gains loadSample(id) and a `home-life` view (one-income-family). 8 tests in LifeInsurancePanel.test.tsx: the Harbor/Evergreen/Riverbend sentences, null without dependents, engine parity at the lecture values and at 5.5/45% for all 4 dependents offers, the line on the formula with markers on it, the harsh-settings rephrasings, panel hidden for chicago-vs-austin, colors/labels/no rects, live slider recompute plus the checklist note plus reset, and the empty direction.
- Decisions: the single "markup" slider from DESIGN.md controls the markup through work. It moves the carbon dot and changes the dollars. The on-your-own markup stays at the lecture's 100%, the reference point the chart compares against. Slider state is local to the panel, and the checklist keeps the lecture values; the panel says so whenever they differ, so the two never disagree silently.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 26 files/296 tests, build). a11y: 0 serious, 0 critical. A one-off axe run on one-income-family (life panel showing) found 0 violations, and scrollWidth equals the viewport at 375 and 1280.
Screens checked: yes, home-life at 375, 768, and 1280, plus one-off panel shots of both dependents samples at lecture and harsh (1, 100%) settings (script deleted, not committed). On the first pass the grey native slider track broke the token rule, and when both dots met on the axis the labels collided ("On your own: 0%" clipped at 375). Fixed with token-styled sliders and higher label rows that avoid the dots. Left as is: at the harsh settings, "On your own: 0%" crosses the falling line near the zero crossing (the knockout outline keeps it legible).
Next: Marginal vs average tax panel.

## 2026-11-21T08:00:00Z | iteration 26
Task: Marginal vs average tax panel.
Result: done
What changed: New files in `src/components/why/`:
- `taxData.ts` (pure): federal wages from the CalcResult (salary − traditional 401(k) − premium − employee HSA), household taxable income via the engine's taxableIncome, the bracket steps from BRACKETS with the tax in each, the chart window, the conclusion and raise sentences, and the rows from wages to the job's tax.
- `TaxChart.tsx` (hand-built SVG staircase).
- `TaxPanel.tsx`, mounted last in WhyElections.

The engine index also re-exports `incomeTax`, `marginalRate`, `taxableIncome`, and `federalTaxOnJob` (engine logic unchanged). 8 tests in `TaxPanel.test.tsx`: the chicago-vs-austin sentences, rows, window, and steps; recommended elections lowering taxable income; the high-earner-family joint/marginal-method rows; engine parity for every offer of all 6 samples under both elections (federalTaxOnJob, marginal rate, average, rows summing to taxable income and to the job's tax, steps equal to the brackets); the lowest-bracket and under-the-deduction rephrasings; the rendered marker, labels, dashed steps, hatching, sr list, rows, and footnote; the live switch to recommended plus the empty direction; the household label.
- Decisions: the panel follows the current elections mode (like the stub's "Federal marginal rate 24%, average 15.4%" note) rather than a fixed set, so the two always agree. The average shown is the engine's tax on the job ÷ salary, the same number as the stub, labeled "of your pay". It is not tax ÷ taxable income, which would disagree with the stub. The taxed area is ink hatching rather than a tinted fill, to stay inside the tokens and read as engraving. No spouse marker on the chart: the rows show the marginal method instead, which keeps the chart to one marker.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 27 files/304 tests, build). a11y: 0 serious, 0 critical.
Screens checked: yes, full shots (0 failed), plus one-off panel shots of chicago-vs-austin, new-grad-roth, high-earner-family, and one-income-family at 375 and 1280 (script deleted, not committed). scrollWidth equals the viewport in all 8. The first pass had a y axis up to 60%, the average label running through the steps and the 22% riser, and "$200,000$300,000" colliding at 375. Fixed with a 10-point rate grid sized to the top step, the average label placed past the marker (shortened to "Average 20.6%" when the long form doesn't fit), and compact "$100k" ticks under 480px. Left as is: at 375 the dashed average line passes through the "12%" label (the knockout outline keeps it legible), and long row labels wrap to two lines at 375.
Next: Phase 5, `src/lib/ai/` types, AIClient interface, and the getAIClient() factory.

## 2026-11-21T08:25:00Z | iteration 27
Task: `src/lib/ai/` types, AIClient interface, and the getAIClient() factory.
Result: done
What changed: New `src/lib/ai/`:
- `types.ts`: ExtractRequest ({text}), and `ExtractedField<T>` as a union, either {source:"letter", value} or {source:"missing", value:null, note}, so a missing field can't carry a guessed value. ExtractedOfferValues lists the 14 Offer fields a letter can state, and EXTRACT_FIELD_KEYS, ExtractedFields, and ExtractResult build on it. ExplainRequest (the mode, an ExplainOffer of engine numbers per offer, and the winner ids) and ExplainResult ({summary}). The file also has the AIClient interface (kind, extractOffer, explainStub, optional AbortSignal) and AIError.
- `MockAIClient.ts` and `HttpAIClient.ts` (HttpAIConfig {supabaseUrl, publishableKey}) are placeholders whose methods reject with a directive AIError until their own BACKLOG tasks fill them in. They never fake success.
- `index.ts`: aiConfigFromEnv(env) and getAIClient(env = import.meta.env). It uses VITE_SUPABASE_URL plus VITE_SUPABASE_PUBLISHABLE_KEY, or VITE_SUPABASE_ANON_KEY as a fallback. Values are trimmed and the trailing slash is dropped. The HTTP client is used only when both a URL and a key are present; otherwise the mock is used. 9 tests are in `index.test.ts`.
- Decisions: the factory takes env as a parameter so tests don't depend on stubbing import.meta.env. The missing-field note lives on the field so the UI can show "No salary in this letter. Type it here." verbatim. ExplainRequest carries only engine numbers (CalcResult fields, the plan name, the match cap, and the checklist ids), so the explainer has nothing to compute. The request builder is left to the explainStub task.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 28 files/313 tests, build).
Screens checked: no (no UI change).
Next: MockAIClient.extractOffer, with deterministic parsing of the 3 sample letters.

## 2026-11-21T09:10:00Z | iteration 28
Task: `MockAIClient.extractOffer`, using deterministic parsing that extracts the 3 sample letters exactly into the matching fixture offers. Unknown text returns every field as missing, never invented values. Add tests for all 3 letters.
Result: done
What changed: New `src/lib/ai/letterParser.ts` (pure): parseLetter(text) reads each of the 14 fields with plain patterns (city/state from "City, State", salary, pay periods from "26 paychecks" or "biweekly", match tiers from "X% of the first/up to/next Y%", auto-enroll rate or "not automatic" → 0, immediate/cliff/graded vesting, Roth, health plans by name with premium/deductible/coinsurance/OOP max/employer HSA, the no-election default plan, life basic and supplemental multiples). Anything not found is `missing` with a directive MISSING_NOTES entry ("No salary in this letter. Type it here."). It also has allMissing(), sampleEmployer(), and fieldsToOffer(fields, id), which returns an Offer only when every needed field came from the letter. MockAIClient.extractOffer uses it, re-exported from the AI index. 9 new tests in `MockAIClient.test.ts`; the placeholder test in index.test.ts now covers only the unbuilt methods.
- Decisions: the mock runs the parser only when the text names one of the three sample employers (case-insensitive). Any other text returns every field missing with "The sample reader only reads the three sample letters. Type this in by hand.", so it never fakes success (DESIGN.md). Within a sample letter the parser reads the letter's own numbers, so an edited or trimmed sample letter gives its edited values or honest missing fields. A per-paycheck premium uses its stated yearly figure when the letter gives one ($92.31/paycheck → $2,400, not 2,400.06). Plan ids are "ppo" or "hdhp" by HSA eligibility, matching the fixtures. A single plan is the default plan. customStateRate is always missing for the sample states, with a note saying it's only needed for a state not on the list. If any plan lacks a number, the whole health plans field is missing rather than partly guessed. Empty text and an aborted signal reject with directive AIErrors.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 29 files/324 tests, build).
Screens checked: no (no UI change).
Next: `MockAIClient.explainStub`, a templated 3–4 sentence summary built only from engine numbers.

## 2026-11-21T09:40:00Z | iteration 29
Task: `MockAIClient.explainStub`, a templated 3–4 sentence summary built only from engine numbers. Add a test.
Result: done
What changed: New `src/lib/ai/explainTemplate.ts` (pure):
- buildExplainRequest(inputs, winners, mode) copies the CalcResult numbers for the chosen elections, the plan name, matchCapPct, and the checklist ids into an ExplainRequest. This is the request builder that iteration 27 deferred, and the HTTP client and summary UI will use it too.
- assertExplainRequest throws the directive AIError "Load two offers to get a plain-English summary." unless there are exactly two distinct offers with finite numbers and winner ids that belong to them, with winnerId matching the mode.
- explainTemplate writes four sentences: (1) the winner, its bottom line, and the gap; (2) the winner's net pay, employer match, and expected medical bills on its plan; (3) the average federal rate on the salary against the bracket rate; (4) the flip ("Elect correctly and X comes out ahead instead…" / "With the defaults X looked better, so your elections, not the salaries, decide this choice."), or the elections it assumes.

MockAIClient.explainStub uses it and rejects an aborted signal. The AI index re-exports it. 23 new tests in `explainStub.test.ts`: the builder against runCase, the exact chicago-vs-austin sentences in both modes, all 6 samples × 2 modes (3–4 sentences, and every $ and % figure is one of the request's numbers or the gap), parenthetical names dropped, the "come out even" wording with no flip, rephrasings for a $0 match, $0 medical bills, and 0%, bad requests rejected, and abort. The placeholder test in index.test.ts now covers only HttpAIClient.
- Decisions: the gap is Math.round(winner − loser), the same as the memo line, so the two always agree. The loser's own bottom line is left out because its rounded figure could look $1 off the gap (one-income-family: $75,494 − $68,821 vs a $6,672 gap); the stubs show it anyway. Zero amounts are reworded, never printed as $0. The template lives in lib/ai with its own money formatter and name trimming (same rule as memoName), so lib doesn't import from components.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 30 files/344 tests, build).
Screens checked: no (no UI change). I read all 12 sample summaries in a throwaway test (deleted, not committed).
Next: `HttpAIClient`, which POSTs to the two edge functions with the publishable key header, a 20s timeout, and a directive error.

## 2026-11-21T10:20:00Z | iteration 30
Task: `HttpAIClient`, which POSTs to `<supabaseUrl>/functions/v1/decode-offer` and `/functions/v1/explain-stub` with the publishable key header, and has a 20s timeout and a directive error message.
Result: done
What changed: `src/lib/ai/HttpAIClient.ts` now POSTs JSON to both edge functions with `apikey` and `Authorization: Bearer <publishable key>` headers (Supabase's gateway wants both). It has a 20s timeout (AI_TIMEOUT_MS) through an AbortController that also follows the caller's signal. Every failure is a directive AIError from READER_ERRORS/SUMMARY_ERRORS: timeout, cancelled, network, a failing status, and an unreadable body. On a failing status it shows the function's own `{error}` string when one is present and short (≤240 chars), otherwise the fallback. Bad input (an empty letter, an invalid ExplainRequest via assertExplainRequest) is rejected before any request. fetch and timeoutMs can be injected for tests.
New `src/lib/ai/validate.ts`: validateExtractResult, validateExplainResult, serverErrorMessage. 12 tests are in `HttpAIClient.test.ts`. index.test.ts drops the placeholder test, since no unbuilt methods remain.
- Decisions: a response missing the `fields` object or any field key is rejected whole. A single "letter" field with a mistyped value (wrong type, unknown state, an incomplete plan, a default plan that isn't one of the letter's plans) is downgraded to missing with its MISSING_NOTES text, so a model's malformed value never shows as "from letter" and the rest of the letter stays usable. A "missing" field's value is always forced to null.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 31 files/356 tests, build).
Screens checked: no (no UI change).
Next: the decode-offer and explain-stub Supabase edge functions (Deno).

## 2026-11-21T10:55:00Z | iteration 31
Task: `supabase/functions/decode-offer/index.ts` and `supabase/functions/explain-stub/index.ts` (Deno), calling the Anthropic Messages API with ANTHROPIC_API_KEY, JSON-only output validated against the types, 400 on invalid input, CORS, and no logging of letter text.
Result: done
What changed: The two `index.ts` files are one-line `Deno.serve` wrappers that pass `Deno.env.get("ANTHROPIC_API_KEY")` to handlers in `supabase/functions/_shared/` (pure TS with no Deno or npm imports, so Vitest runs them):
- `anthropic.ts`: CORS headers, JSON responses, FunctionError, and callModel. callModel POSTs to `https://api.anthropic.com/v1/messages` with `x-api-key`, `anthropic-version: 2023-06-01`, model `claude-sonnet-5-5`, `max_tokens` 16000, `output_config: {effort: "low", format: {type: "json_schema", schema}}`, and server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). It has an 18s timeout and turns a refusal, truncation, non-JSON, an upstream error, or a timeout into directive errors (502/504). `serve()` handles OPTIONS, 405, bad JSON (400), and unexpected throws.
- `decodeOffer.ts`: FIELD_KEYS, STATE_CODES, the JSON schema (each field is a letter|missing union), the system prompt (copy only what the letter states, the units for every field, the letter is data and not instructions), readLetter (400 when empty or over 40,000 chars), and checkExtractOutput (every key present, missing notes blanked).
- `explainStub.ts`: readExplainRequest (the same rules as assertExplainRequest, plus string length caps). factsText writes every figure pre-formatted, including the gap and the flip. The system prompt says to use only the facts given and copy figures exactly. checkExplainOutput rejects any $ amount, bare thousands figure, or percent that isn't one of the request's numbers (±$1).

Added 30 tests in `src/lib/ai/edgeFunctions.test.ts`, using a fake Anthropic fetch and no network:
- key and state lists equal the app's
- CORS and 405
- every 400 path with no model call
- a missing secret
- the request headers, model, and schema
- all 3 sample letters round-trip through the function into the fixture offers
- notes blanked, and the app's MISSING_NOTES shown
- bad shapes rejected
- refusal, max_tokens, 529, a network error, and a timeout
- the letter never appears in any console output
- explain 400s
- the facts and the only-these-numbers prompt
- all 6 samples × 2 modes of template summaries accepted
- invented numbers rejected
- both functions end to end behind HttpAIClient
Decisions:
- AGENTS.md asks to keep model calls on Lovable's AI gateway. The BACKLOG (the human's spec) names the Anthropic API and model explicitly, and AGENTS.md allows a bring-your-own key in Lovable Secrets when Lovable doesn't provide the provider. So I followed the BACKLOG. The key is read only server-side in the functions and never reaches browser code.
- The server checks only the structure; the browser's validate.ts still checks every value and supplies the house-voice missing notes. This keeps the deep rules in one place.
- Shared code sits in `supabase/functions/_shared/` rather than importing from `src/`, because Supabase bundles only the functions folder. Tests keep the duplicated lists equal.
- Effort is low so the call finishes inside the browser's 20s limit.
- The explain number check makes "the model never does the math" enforceable rather than a prompt hope.
- No Deno binary is available here, so the Deno entry files are checked by lint only. The handlers they call are typechecked and tested.
- `supabase/config.toml` wasn't touched (hard rule). If Lovable's gateway enforces JWT verification on these functions, a new-style publishable key may be rejected. The AI_SETUP doc task should tell Lovable to deploy with `verify_jwt = false` for both functions if calls return 401.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 32 files/386 tests, build).
Screens checked: no (no UI change).
Next: the "Read offer letter" panel (paste text or drop a .txt file), the review state with "from letter" markers and missing-field underlines, and the sample-reader note.

## 2026-11-21T09:05:00Z | iteration 32
Task: The "Read offer letter" panel (paste text or drop a .txt file), the review state with "from letter" markers and missing-field underlines, and the sample-reader note.
Result: done
What changed: The previous run (loop iteration 31, 01:24) hit the usage limit partway through this task and left it uncommitted. I reviewed that work and finished it instead of starting over.
- New `LetterReader.tsx` (the panel), `letterDraft.ts` (ExtractResult → OfferDraft plus marks, touchMarks, markCounts), and `state/AIClientContext.tsx` (useAIClient defaults to getAIClient(); tests inject a client).
- `offerDraft.ts` now exports tierDrafts/vestingDraft/planDrafts. State, Roth, and vesting can be unchosen, with directive errors.
- `OfferEditor.tsx` renders the marks, the missing notes, and a focused review sentence. `OfferStub.tsx` has a single panel state (read or edit) and returns focus to the button that opened it.
- `scripts/shots.mjs` gains the home-letter and home-letter-review views.
- Fixed one wrong assertion in `LetterReader.test.tsx`: it assumed the first "from letter" marker in the DOM is the salary's, but Employer comes first. It now checks that the salary's own aria-describedby mark reads "from letter", so the test is no weaker. Ran prettier on the new files.
- Decisions: when the reader finds nothing, the panel shows the client's single note (the mock's unknown-letter note) or a generic directive error, and it never opens a blank form. The header keeps the old offer's name until save, because the review is an unsaved draft.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 34 files/404 tests, build). a11y: serious 0, critical 0.
Screens checked: yes. home-letter and home-letter-review at 375 and 1280 match DESIGN.md (carbon values and markers, inbox-tray panel, no overflow). Missing-field underlines are covered by component tests only, since the mock reads the samples fully.
Next: the "Plain-English summary" under the memo line.

## 2026-11-21T11:15:00Z | iteration 33
Task: The "Plain-English summary" under the memo line.
Result: done
What changed: New `PlainSummary.tsx` renders inside MemoLine's section. New `summaryText.ts` holds SUMMARY_COPY and summaryRequest (view + mode → buildExplainRequest, or null unless both offers have results); it is its own file to keep the fast-refresh lint warnings at 6. The request is keyed by its JSON, so only a real change to the numbers makes a summary stale. 10 tests in `PlainSummary.test.tsx` cover: the request equals the engine output for all 6 samples × 2 modes; the mock auto-writes the template text, rewrites it on the elections switch, and shows the sample-writer note; nothing renders without two offers; the error alert; and on an HTTP-like client, the button, progress, abort and clear on an elections change, no abort on the per-paycheck toggle, and retry after an error.
Also added the missing comma in explainTemplate's flip sentence ("With the defaults, Lakeshore Systems looked better"), and updated its test string to match.
Decisions:
- The mock writes automatically because it is free and instant. The HTTP client waits for a button because each summary is a paid model call, and an auto-call on every About-you keystroke would burn the key.
- The auto summary has no aria-live, so screen readers aren't re-read four sentences per keystroke (the memo line is already live). The HTTP result is polite-live.
- The summary stays on the paper under the memo rather than in a panel, because DESIGN.md puts it "under the memo line".
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 35 files/414 tests, build). One full run failed LetterReader's focus assertion, a test that doesn't render MemoLine. It passed in 3 isolated runs and 4 more full runs, so it is flaky under load; I added a deflake task to BACKLOG. a11y: serious 0, critical 0.
Screens checked: yes. home-defaults at 1280 and home-recommended at 375: the heading, summary, and note sit under the memo at prose width, with no overflow. The comma nit was found and fixed.
Next: `docs/AI_SETUP_LOVABLE.md`.

## 2026-11-21T11:25:00Z | iteration 34
Task: `docs/AI_SETUP_LOVABLE.md`: the exact steps and a copy-paste prompt for Lovable to enable Cloud, deploy the two existing functions unchanged, and add the `ANTHROPIC_API_KEY` secret, plus how to confirm it's working.
Result: done
What changed: New `docs/AI_SETUP_LOVABLE.md` with these sections:
- A copy-paste Lovable prompt: enable Cloud, deploy decode-offer, explain-stub, and _shared unchanged, set `verify_jwt = false` for both, expose VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the build, and add nothing else.
- The secret step, the only human step.
- How to confirm in the app: the sample notes disappear, the summary button appears, and a fictional non-sample test letter reads in.
- An optional curl check.
- A troubleshooting table that quotes the real error messages.
- A mock vs real table.
New `src/test/aiSetupDoc.test.ts` (4 tests) checks the doc against the code: the quoted messages match, the function paths, secret name, and env names match, there is no real-looking key, and the mock reader doesn't recognize the test letter.
Decisions:
- `verify_jwt = false` goes in the Lovable prompt (not a hand edit), following iteration 31's note, because new `sb_publishable_` keys aren't JWTs. `supabase/config.toml` doesn't exist in the repo yet, and I didn't create it (hard rule).
- `.gitignore` ignores `.env`. If Lovable writes the Supabase vars only to a committed `.env`, the build could stay on the mock. The prompt asks Lovable to make the vars available to the build, and troubleshooting covers it. I left the ignore in place because it is a Phase 0 rule.
- Lovable menu names ("Cloud → Secrets") can't be checked from here, so the doc gives a fallback: Lovable asks for the secret itself.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 36 files/418 tests, build).
Screens checked: no (no UI change).
Next: the `/method` page per DESIGN.md.

## 2026-11-21T12:40:00Z | iteration 35
Task: `/method` page per DESIGN.md (the rules, the constants table with slide references, and the simplifications list).
Result: done
What changed: New route `src/routes/method.tsx` (its own head/meta, a header with the brand and "Back to the decoder") renders `src/components/method/MethodPage.tsx`. That page has a 40/800 h1, a contents list, then one bordered --stub sheet with nine sections: the bottom line, taxes on your pay, employer money, health plans, recommended elections, life insurance, the checklist order, the 2026 numbers (a bracket table plus a constants table with lecture slides), and the simplifications. `methodContent.ts` builds every number from the engine's constants, so the page can't drift from the math. The decoder header now has a "How the numbers work" link. `DecoderProvider` moved from the index route up to `__root.tsx`, so going to /method and back keeps typed offers. `routeTree.gen.ts` was regenerated by the build, not edited by hand. Tests: 7 new in `MethodPage.test.tsx` (sections, brackets, every constant with its slide, the required simplifications, key formulas, copy rules), plus a /method routing test.
Decisions:
- The header links are passed in from the route as `nav`, so DecoderHeader still renders without a router in its tests.
- Below sm the constants table hides its slide column and repeats the slide under each value. The hidden copy is display:none, so screen readers hear it once. The bracket table drops to 15px below sm. This keeps both tables from scrolling sideways, and it cleared axe's scrollable-region-focusable error from my first pass.
- State tax has no lecture source in FINANCE_SPEC, so its row says "Not from the lectures" rather than inventing a slide.
- I added two simplifications beyond DESIGN's six because they are true of the engine: the match is figured yearly, and expected spending is a single number.
- FINANCE_SPEC says the UI must say plainly that head of household is out of scope. The Method page now does. I added a BACKLOG task to say it in About you too.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 37 files/426 tests, build). a11y: serious 0, critical 0 on /, /method, and /dev/components at 375 and 1280.
Screens checked: yes, method at 375, 768, and 1280, and the home header at 375 and 1280. Fixed in this iteration: missing paragraph spacing, missing list markers, left-aligned bracket amounts (now right-aligned), and the bracket table spilling past the sheet at 375.
Next: the 404 page, page title and meta description, and the SVG favicon fallback.

## 2026-11-21T13:45:00Z | iteration 36
Task: A 404 page in the site's voice, the page title and meta description, and the SVG favicon fallback.
Result: done
What changed: New `src/components/site/SiteNotice.tsx` with `NotFoundNotice` and `LoadErrorNotice`. Each is a single bordered --stub sheet on the guilloché paper: the brand header with a 2px rule, a 28/800 h1, a directive sentence, and an ink primary button plus a stub secondary button. These replace the template's rounded shadcn 404 and error screens in `__root.tsx`.
- The 404 page names the missing path and links to the decoder and /method. The error page has "Try again" (router.invalidate + reset) and "Go to the decoder".
- New `src/lib/siteMeta.ts` holds the title and description. The root and `/` use them in place of the "Offer Decoder" placeholders, and the template's "Lovable" author and twitter:site tags are gone. Added theme-color and og:site_name.
- New `public/favicon.svg`, a notched stub with ink rules and one carbon line in token colors only, is now the only linked icon.
- shots and a11y gain a /no-such-page view. 7 new tests: the notices, their copy, metadata, the favicon colors, and the not-found route match.
Decisions:
- `public/favicon.ico` is the Lovable template's icon, so it is no longer linked. I left the file in place for the images task to replace with the user's generated icon (IMAGE_PROMPTS task: link it, plus icon-512, once they exist).
- The notices set document.title in an effect, because the root head() can't tell a 404 from a real page. SSR still returns HTTP 404.
- Links are plain `<a>`, so the error page works even when the router is broken.
- The headline is 28/800, because 40/800 is reserved for the Method page.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 38 files/433 tests, build). a11y: serious 0, critical 0 on all four routes at 375 and 1280.
Screens checked: yes. not-found at 375 and 1280, plus the favicon rendered at 256px. I fixed one issue: the path broke mid-word at 375 (break-all), so it now uses overflow-wrap:anywhere.
Next: `IMAGE_PROMPTS.md` and the image-slot fallbacks.

## 2026-11-21T14:50:00Z | iteration 37
Task: `IMAGE_PROMPTS.md` at the repo root, with one prompt per slot in DESIGN.md (exact sizes, exact hex colors, the pay-stub/security-paper style, and no text in images except the share card's title). Wire each slot with a fallback.
Result: done
What changed: New `IMAGE_PROMPTS.md` covers:
- a slot table with each fallback
- the six-token palette
- ready-to-paste prompts for the share card (1200×630, only the title "Offer Decoder"), the app icon (512×512), and the tileable paper texture (1024×1024)
- how to make favicon.ico from icon-512 (a converter, or a `magick` command)
- after-adding steps, including the optional VITE_SITE_URL
New `src/lib/siteImages.ts`: a build-time `import.meta.glob` finds which slot files exist in public/, and `shareImageMeta()`, `iconLinks()`, and `paperTextureUrl()` wire each slot or fall back. The root head uses iconLinks(). `/` and `/method` use shareImageMeta() in place of their fixed twitter:card. GuillocheBackground tiles the texture under the waves when it exists (and takes a `textureUrl` prop for tests). Removed the template `public/favicon.ico`. Added VITE_SITE_URL to `.env.example`. 15 new tests in `siteImages.test.ts` cover detection against the disk, every fallback and every present state, the route heads, and the prompt doc (slots, sizes, token-only colors, text only in the share card). Updated SiteNotice.test's icon check to follow iconLinks().
Decisions:
- Detection is a glob, not a hand-flipped flag, so the user only drops files in. A production build with a dummy og-image.png confirmed the glob compiles to `Object.keys({"/public/og-image.png":0})`: no asset copy and no runtime import. The dummy was removed.
- Deleted the template favicon.ico. Once glob-detected, it would have been linked as the site's icon (Lovable's mark). A test now fails if a favicon.ico ever appears without icon-512.png.
- The generated icons replace the SVG rather than sit beside it, because DESIGN calls the SVG the fallback.
- og:image stays off the root route, following iteration 36's rule, so 404 pages don't inherit a preview image.
- The texture renders at 60% over --paper to keep any off-token fiber tones faint. Stubs are opaque --stub, so it never sits behind stub text.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 39 files/448 tests, build). a11y: serious 0, critical 0.
Screens checked: yes, empty at 375. The guilloché renders as before, and there is no visible change without image files (none exist yet).
Next: accessibility pass.

## 2026-11-21T10:11:18Z | iteration 38
Task: Accessibility pass: zero serious axe violations, keyboard order, a visible focus ring, and labels on every input.
Result: done
What changed: `npm run a11y` now covers far more of the page.
- axe runs on the decoder's interactive states, not just first load: recommended on, the life panel with recommended on, About you opened (375), the editor after a failed save, the letter reader, its review state, and the empty page. It still covers /method, /dev/components, and the 404 page.
- New keyboard walks Tab through four states: a sample with recommended on, the life panel, the editor with errors, and the letter review. Each stop must be visible, have a 2px+ outline that no overflow ancestor clips, and have an accessible name. At 375 the walk also flags any stop more than 40px above the one before it.
- The page steps are now shared in `scripts/lib/steps.mjs`, which `shots.mjs` uses too. Its views are unchanged.
- In `OfferStub.tsx`, each stub's "Read offer letter" and "Edit offer"/"Fill in offer" buttons get `aria-describedby` set to that stub's heading, so a screen reader's button list can tell the two pairs apart.
- New `src/test/a11yLabels.test.tsx` renders the whole decoder with the editor (in error), the reader, and the life sliders open at once. It checks that every input, select, textarea, and button has an accessible name, that nothing has a positive tabIndex, and that no id is duplicated. It runs on the empty page too. There is also a new OfferStub test for the descriptions.
Findings: the page already passed everything checked: 0 serious and 0 critical axe violations in all 21 view/width runs, and 0 keyboard problems across 8 walks (21 to 60 stops each). The order runs header link → sample picker → Load sample → Clear offers → Annual/Per paycheck → recommended switch → About you → stub 1 (and its editor fields when open) → stub 2 → checklist tab → checklist items → life sliders and "Use lecture values".
Decisions:
- I kept the button names and added descriptions, rather than renaming them to "Edit offer: Northfield Health". The visible text and every existing selector stay the same, and the sections are already labeled by their headings.
- Repeated health-plan field labels ("Plan name", "Deductible") are fine as they are, because each plan is a fieldset with its own legend.
- The walk's starting point is a temporary element focused at the top of the body. A plain blur() leaves Chrome's tab start where focus was, and my first run missed the header controls because of that.
- `dom-accessibility-api` is only a transitive dependency, so the label test uses jest-dom's `toHaveAccessibleName()` instead of importing it.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 40 files/451 tests, build). a11y: serious 0, critical 0, keyboard problems 0.
Screens checked: yes. I took one-off close-ups of focus on the recommended switch, the Annual segment, the selected checklist tab, a checklist box, and the sample select at 375. The carbon ring is visible and offset outside the carbon-filled controls. A full `npm run shots` run had 0 failures and no overflow warnings, and home-recommended-1280 looks the same as before. No issues found.
Next: responsive pass at 375 and 768.

## 2026-11-21T10:30:56Z | iteration 39
Task: Responsive pass at 375 and 768: no horizontal scroll, and nothing overlapping the notches or the perforation.
Result: done
What changed: New `scripts/responsive.mjs` (`npm run responsive`) checks 18 views at 375, 768, and 1024 px. The views are defaults, recommended, per paycheck, About you open (375 only), the editor with errors, the letter reader and its review, the empty page, every other sample with recommended on, /method, the 404 page, and /dev/components. For each view it checks:
- the page and every inner box: no sideways scroll
- every visible text line and control: not off-screen, not cut off by a clipping ancestor, not on the perforation strip or its notches, and inside its stub's border
- chart labels: inside their figure
It starts with a self-test that plants one of each fault and fails the run if any goes unnoticed (5 of 5 caught).
- `StubShell` and `Perforation` now carry the `data-stub` and `data-perforation` hooks the checker uses.
- The one real problem it found: the health-cost and match charts started their plot at a fixed 62px. "$10,000", "$15,000", "$20,000", and "−$2,000" y labels hung 3–5px past the chart's left edge, at all three widths and on all 6 samples. New `yAxisLeft()` in `chartKit.ts` sizes the margin to the widest label. HealthCostChart settles it in two passes, because a narrower plot can wrap the line labels and so change the ticks.
- MatchChart's marker titles keep 4px of slack at the right edge. "Recommended 5%" was 1px past the figure at 1024.
- New tests cover yAxisLeft, and a chart test checks that Northfield's "−$2,000" y label clears the left edge.
Decisions:
- Added 1024 to the widths, because that is where the stubs first sit side by side with the least room.
- Labels on an overflow-visible SVG are checked against their figure rather than the SVG box. Spilling past the SVG is fine as long as they stay in the figure.
- I didn't add the responsive check to `verify`, because it needs a production build and a browser. It sits alongside `shots` and `a11y`.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 40 files/452 tests, build). responsive: 0 problems in all 52 view/width runs. a11y: serious 0, critical 0, keyboard problems 0.
Screens checked: yes. shots had 0 failures and no overflow warnings. Close-ups: the health chart at 375 (y labels now inside), the match chart at 768, the Harbor Capital stub at 375 with recommended on (struck and new amounts fit, right edge clean), and the stacked perforation at 375 (notches clear, no text touching). No other issues found.
Next: deflake the LetterReader "reads a pasted sample letter" focus test.

## 2026-11-21T10:52:00Z | iteration 40
Task: Deflake `src/components/decoder/LetterReader.test.tsx` "reads a pasted sample letter into the review state".
Result: done
What changed: In `OfferEditor.tsx`, the review state's focus on its opening sentence ("Check the N fields marked…") now runs in `useLayoutEffect` instead of `useEffect`. The test is unchanged, and its synchronous `toHaveFocus` check stays as written.
Cause: the reader's result arrives asynchronously, outside `act`. React committed the form, and `findByLabelText("Yearly salary")` could resolve before the scheduler flushed the passive effect that moves focus, so under load the check sometimes ran first. A layout effect runs in the same synchronous commit as the DOM change, before any MutationObserver callback or polling tick, so the form is never on screen without focus. For users, this also removes a frame where the form showed before focus jumped.
Decisions:
- I fixed the component rather than wrapping the check in `waitFor`. A `waitFor` would hide the gap instead of closing it, and the backlog offered either fix.
- The editor's other effect (focus on the first invalid field after a failed save) and the stub's return-focus effect stay passive. Both are triggered by clicks, which Testing Library wraps in `act`, so their effects always flush before the next assertion.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 40 files/452 tests, build). The full suite then passed 5 more times in a row with 0 failures.
Stress: with 3 full suites running at once, LetterReader passed every time. Two other heavy render tests (a11yLabels "labels every control…" and OfferStub "shows every default amount…", ~1.8s each alone) hit vitest's 5000ms timeout. That is load, not a race. I added a backlog task to give them a per-test timeout.
Screens checked: no. Focus now lands one paint earlier, with no visual change. a11y's keyboard walk of the letter review state covers this focus path.
Next: the per-test timeout task, then README.md.

## 2026-11-21T10:45:20Z | iteration 41
Task: `README.md`: what it is, the lecture-to-feature mapping, how to run and test it, what is mocked, and how to connect AI.
Result: done
What changed: Replaced the Lovable template README.md. It now has:
- what the product does and what's on `/` and `/method`
- the six samples, each with what it shows (fact-checked against expected.json: the two flips are chicago-vs-austin and university-staff, and high-earner-family hits the 401(k) limit)
- a lecture-to-feature table, with each 4B/7A/7B rule and slide mapped to the stub line, panel, or checklist id that uses it
- how it's built, how to run it, and the verify/test/shots/a11y/responsive commands
- what is mocked, connecting the AI (points to docs/AI_SETUP_LOVABLE.md), the simplifications, and a repository map

New `src/test/readme.test.ts` keeps it honest, the way aiSetupDoc.test.ts does for the AI doc. Every repo path and relative link it names must exist (gitignored harness/shots/ is skipped), and every `npm run` script it names must be in package.json. It must name the env vars, the secret, MODEL, and all six sample titles exactly, and hold no real-looking key.
Decisions:
- I kept the Lovable project link. AGENTS.md says the repo syncs to Lovable, so the link is useful to the human.
- The README says Lovable uses bun and npm works locally, but not to commit package-lock.json. This matches iteration 1's decision.
- I didn't claim that About you mentions head of household. That's still an open backlog task, so the README lists it only as a simplification.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/457 tests, build).
Screens checked: no. This is docs only, with no UI change.
Next: the head-of-household note in About you.

## 2026-11-21T11:05:00Z | iteration 42
Task: Say plainly in About you that head of household isn't supported, with a 13px ink-soft note under the Filing select linking to `/method#simplifications`.
Result: done
What changed: `AboutYou.tsx`'s `Field`/`SelectField` take an optional `note`, shown under the control in 13px ink-soft (max 14rem) and wired as the select's `aria-describedby`. Filing's note reads "Head of household isn't supported. What the site leaves out". The link comes in through a new `simplificationsLink` prop. `src/routes/index.tsx` passes a TanStack `<Link to="/method" hash="simplifications">`, and without the prop it falls back to a plain `<a href="/method#simplifications">`. The shared href, text, and link class are in the new `src/components/decoder/simplificationsLink.ts`. Two new tests in `AboutYou.test.tsx` cover the options (single and mfj only), the accessible description, the fallback href, and an injected link.
Decisions:
- The route passes the link in, the same way `DecoderHeader` takes `nav`, so AboutYou stays router-free and the existing tests that render it without a router keep working. A client-side Link matters here because the store sits in `__root.tsx`. A plain anchor would reload the page and drop the user's edits.
- The constants are in their own module, so react-refresh's only-export-components lint adds no new warning.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/459 tests, build). a11y: serious 0, critical 0, keyboard problems 0. responsive: 0 problems.
Screens checked: yes. Close-ups of About you at 1280, at 768, and with the disclosure open at 375. The note sits under Filing, wraps cleanly, and overlaps nothing. At 1280 it adds about 40px to the first row, and the row was already wrapping to two lines before. In the browser: clicking the link goes to /method#simplifications and scrolls to the section (it's last on the page, so it stops at the page bottom), and Back keeps a changed Filing value. No issues found.
Next: per-test timeouts for the two heaviest render tests.

## 2026-11-21T11:20:00Z | iteration 43
Task: Give the two heaviest render tests headroom with a per-test timeout, without changing what they assert.
Result: done
What changed: `src/test/a11yLabels.test.tsx` "labels every control with the editor, the letter reader, and the life panel open" and `src/components/decoder/OfferStub.test.tsx` "shows every default amount from expected.json on both stubs" now pass `{ timeout: HEAVY_RENDER_TIMEOUT_MS }` (15000ms), with a short comment explaining why. The assertions are unchanged; Prettier only re-indented the bodies.
Decisions:
- I used Vitest 4's options-object form `it(name, { timeout }, fn)`, not the trailing number argument. It reads the same and is the form Vitest 4 recommends.
- The timeout is per test, not a global `testTimeout`, so a real slowdown anywhere else still fails fast.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/459 tests, build). Stress: 3 full suites run at once all passed, 459/459 each.
Screens checked: no. This is a test-only change.
Next: the backlog is empty, so next comes critique round 1 (fresh shots, a11y, and rubric scores).

## 2026-11-21T11:40:00Z | iteration 44
Task: Critique round 1. Every backlog task was checked off and none were blocked.
Result: done
What changed: Took fresh shots (0 failed) and ran a11y and responsive. Scored the rubric and added two chart tasks to BACKLOG under "Critique round 1". No product code changed.
Scores (0–2):
1. Reads as a pay stub at 1280 and 375: 2. Header rule, square bordered stubs, notched perforation, boxed net pay and bottom line. Stubs stack at 375 with a horizontal perforation.
2. Banned items absent: 2. No shadows, gradients, rounding, all-caps, arrows, emoji, monospace, or decorative icons in any shot.
3. Right edge and tabular figures: 2. Struck and new amounts share one right edge, and at 375 the new amount wraps under the struck one, still right-aligned.
4. Memo most prominent after the stubs: 2. It's 28/800 with room around it on the check-style underline.
5. Correction legible with recommended on: 2. Red strike plus carbon new amount on every changed line and on both totals.
6. Charts follow the rules: 1. Labels are direct and there are no legends, but two labels collide with lines (chicago-vs-austin at 1280): MatchChart's "Employer match per year" is crossed by the default-% marker, and HealthCostChart's spending-dot labels ("$3,200", "$3,000") sit on their own plan line.
7. AA, focus, axe: 2. a11y: serious 0, critical 0, keyboard problems 0 across 4 walks.
8. No sideways scroll, nothing on notches or perforation: 2. responsive: 0 problems in every view at 375/768/1024.
9. Copy rules: 2. Sentence case, buttons say what they do, no filler. The checklist and summary read naturally.
10. Empty and error states: 2. Empty stubs keep their labels with the direction sentence, the memo gives direction, the editor and reader errors are directive, and there's a 404 page.
Decisions:
- At 375 the controls wrap into four rows, not the two DESIGN.md mentions. Sample select + Load sample + Clear offers + the toggle + the switch can't fit in two rows at 375 without shrinking text below the scale. Each row is clean, so I left it and didn't add a task.
- The 16rem sample select cuts off the selected title at 1280 ("Same job, two cities: the def"). Iteration 22 narrowed it to keep the controls on one row, and the titles are fixture text the README test checks, so I didn't add a task. The open list shows full titles.
- No blocked tasks to retry.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/459 tests, build).
Screens checked: yes. Looked at home defaults/recommended/life at 1280, recommended and empty at 375, letter review at 768, method at 375, plus full-resolution crops of the health and match charts. Issues: the two chart label collisions above.
Next: the MatchChart label task from critique round 1.

## 2026-11-21T12:10:00Z | iteration 45
Task: Rubric 6. In `MatchChart.tsx`, keep the "Employer match per year" label clear of the marker lines, and test it.
Result: done
What changed: The new `src/components/why/matchLabel.ts` has `placeLineLabel(markerXs, x0, x1)`. It puts the label in the plot's top band (which the match line never reaches, since the y axis runs to at least 1.4 times the whole match), in the first gap that holds it, at least 4px from every marker line. It tries left of every marker first, then just past each marker, and one line before two ("Employer match" / "per year"). If no gap holds it, it returns null and `MatchChart` gives the label a 16px row of its own above the marker titles, where no marker line reaches. The label renders as tspans with `data-line-label`. In `MatchVestingPanel.test.tsx`, a pure test covers the placement cases, and a rendered test covers every chart of every sample at 300, 420, 560, and 700px (ResizeObserver stubbed). The label must contain no marker x, or else sit above where every marker line starts.
Decisions:
- I added the own-row fallback because at 300px Lakeshore (markers at 4% and 11%) leaves a gap of about 103px, and even "Employer match" needs about 112px. A third, shorter line break would run into the flat line at 70% height.
- The helpers are in their own module, so react-refresh's only-export-components lint adds no new warning.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/464 tests, build). a11y: serious 0, critical 0, keyboard problems 0.
Screens checked: yes. `npm run shots` (0 failed), plus element crops of every match chart for chicago-vs-austin, university-staff, and new-grad-roth at 1280, 768, and 375. At 1280 and 768 the label sits just past the default marker on one line, or on two lines at the left (university-staff Lakeshore). At 375 it's on two lines between the markers, or in its own row above the titles. No marker crosses it anywhere. Found an older issue: at 375 the red "left on the table" label crosses the recommended marker line (added as a backlog task).
Next: the HealthCostChart dot-label task from critique round 1.


## 2026-11-21T12:45:00Z | iteration 46
Task: Rubric 6. In `HealthCostChart.tsx`, keep each cost label beside its spending dot off its own plan line, clear of the other labels, and test it.
Result: done
What changed: The new `src/components/why/healthValueLabels.ts` has `placeValueLabels(dots, { xs, plot, avoid })`. Cost never falls as spending rises, so a label above-left or below-right of its dot can never touch its own line. Above-right and below-left are safe too once the label clears the line at its far corner. It tries above-left, below-right, above-right, then below-left, each at 3 distances 16px apart, and scores every spot: outside the plot 8, overlapping a line label or an earlier cost 4, crossed by another plan's line 2, another line between the label and its own line 2, plus 0.5 per step away. Dots are placed from the top down. `HealthCostChart` drops the old valueYs/valuesLeft logic and its local `Box`/`overlaps`, and tags each cost with `data-value-label`. `HealthCostsPanel.test.tsx` adds a pure placement test, plus a rendered test for every chart of every sample at 300/420/560/700px (ResizeObserver stubbed). The rendered test checks that no cost's estimated box touches its own polyline (±1px) and that no two costs overlap.
Decisions:
- The value box is cap height plus a margin (11px up, 2px down, 8.5px a figure), not the 16px text box. With the taller box, a 1px estimate overlap with the line labels pushed chicago-vs-austin's costs 30–40px from their dots at 375.
- The "other line between label and own line" penalty stops a cost from landing on the far side of the other plan's line, which happened in plan-crossover at 375 ("$6,450" under the PPO line).
- Known and left alone: new-grad-roth offer 2 at 375 has both dots about 17px apart in the chart's bottom-left corner, with no room left of the marker or below. "$800" goes above-right of its steep line and "$2,000" below-right of its dot, so the two read in reverse order. Each still sits next to its own line in its line's color, and neither crosses a line. I didn't add a task.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/469 tests, build). a11y: serious 0, critical 0, keyboard problems 0. responsive: 0 problems.
Screens checked: yes. `npm run shots` (0 failed), plus element crops of all 12 health charts at 1280 and 375. chicago-vs-austin's "$3,200" now sits above-left of the dashed PPO 500 line, and Lakeshore's "$3,000" sits below-right of its line. No cost crosses its own line in any crop. Issues: only the new-grad-roth ordering above.
Next: the MatchChart "left on the table" label task from critique round 1.

## 2026-11-21T13:20:00Z | iteration 47
Task: Rubric 6. In `MatchChart.tsx`, keep the red "$X left on the table" label clear of the marker lines, with a two-line fallback, and test it at 300/420/560/700px.
Result: done
What changed: `src/components/why/matchLabel.ts` adds `placeGapLabel` (plus `gapRows`, `anchoredBox`, `segmentHitsBox`). It tries left of the default dot halfway up the bracket, then above the flat line just past each marker from the default on, then the right edge. Each spot is tried with one line, then two ("$X left" / "on the table"), then three. Below the flat line past a marker is the last resort. A spot counts only if it stays inside the plot, stays at least MARKER_CLEARANCE from every marker x, misses the line label, and isn't cut by any match-line segment. `MatchChart` now lays out in a `layout(ownRow)` closure. When the in-plot line label leaves the red label no spot, it moves the line label to its own row above the titles and lays out again. The red label renders as tspans with `data-gap-label`. If nothing fits, the bracket is drawn without a label. That doesn't happen in any sample, and the test fails if it does. `MatchVestingPanel.test.tsx` adds pure placement and clipping tests, plus a rendered sweep of every sample at 300/420/560/700px. The sweep checks that a label exists, no marker x falls inside its box ± clearance, and no match-line segment crosses it.
Decisions:
- I added the line label's own-row fallback because at 300px chicago-vs-austin Northfield and at 420px high-earner-family, the only gap between the markers sits under the in-plot line label. Keeping the red label beside its bracket matters more than keeping the line label in the plot. Iteration 45 already uses the own row for the line label.
- I added a three-line fallback ("$3,800" / "left on" / "the table") because at 300px university-staff Midway leaves about 87px between the markers, and two lines need 96px plus clearance.
- The match-line check is new. It keeps the label left of the dot from touching the rising line when the bracket is short.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/475 tests, build). a11y: serious 0, critical 0, keyboard problems 0.
Screens checked: yes. `npm run shots` (0 failed), plus 2x element crops of every chart with a gap (chicago-vs-austin, university-staff, new-grad-roth ×2, high-earner-family) at 375, 768, and 1280. At 375 the label sits on two or three lines between the markers above the flat line, or left of the dot, and no line crosses it. At 768 and 1280 it's on one line past the default marker, as before. Found an older issue: at 375 new-grad-roth offer 2's 8% marker line runs through the lower title "Default 5%" (added as a backlog task).
Next: the MatchChart marker-title crossing task from iteration 47.

## 2026-11-21T13:50:00Z | iteration 48
Task: Rubric 6. In `MatchChart.tsx`, keep a marker line out of the other marker's two-row title (new-grad-roth offer 2 at 375), and test it at 300/420/560/700px.
Result: done
What changed: `titleAt` now takes an optional forced side. The old `crossesLowerTitle` check is gone. When titles need two rows, `MatchChart` now tries each marker on the upper row with the lower title on its usual side, then again with the lower title flipped to the other side of its marker. A flipped title only counts if it stays inside [x0, W - 4]. It takes the first layout where the upper marker's line stays 8px clear of the lower title. The order keeps every layout that was already clean unchanged. For new-grad-roth offer 2 at 375, "Default 5%" is now end-anchored left of its marker, under "Recommended 8%". `MatchVestingPanel.test.tsx` adds a rendered sweep of every sample at 300/420/560/700px, checking that no marker line's vertical span passes through another marker's title box (±4px). It fails on the old component ("new-grad-roth at 300px: recommended line at 242.8 crosses the default title").
Decisions:
- If no layout clears, the chart keeps the first one, which is the old behavior. No sample hits that case, and the test would catch one if it did.
- `npm run verify` lint also scans `harness/shots/crops/crop.mjs`, an ignored scratch script from iteration 47 that wasn't prettier-formatted. I ran `eslint --fix` on it and pointed it at every match chart. It isn't committed.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/479 tests, build). a11y: serious 0, critical 0, keyboard problems 0.
Screens checked: yes. `npm run shots` (0 failed), plus 2x element crops of every match chart for chicago-vs-austin, university-staff, new-grad-roth, and high-earner-family at 375, 768, and 1280. At 375 new-grad-roth offer 2 reads "Default 5%" to the left of its line, with the 8% line clear of it. university-staff Midway and new-grad-roth offer 1 are unchanged and clean. 768 and 1280 are unchanged. Issues: none.
Next: the backlog is empty again, so next comes critique round 2.

## 2026-11-21T14:20:00Z | iteration 49
Task: Critique round 2. Every backlog task was checked off and none were blocked.
Result: done
What changed: Took fresh shots (0 failed) and ran a11y and responsive. Scored the rubric and added one chart task to BACKLOG under "Critique round 2". No product code changed.
Scores (0–2):
1. Reads as a pay stub at 1280 and 375: 2. Header rule, square bordered stubs, notched perforation (horizontal at 375), boxed net pay and bottom line.
2. Banned items absent: 2. No shadows, gradients, rounding, all-caps, arrows, emoji, monospace, or decorative icons in any shot.
3. Right edge and tabular figures: 2. Struck and new amounts share one right edge. At 375 the new amount wraps under the struck one, still right-aligned.
4. Memo most prominent after the stubs: 2. 28/800 on the check-style underline, with room around it.
5. Correction legible with recommended on: 2. Red strike plus the carbon new amount on every changed line and on both totals.
6. Charts follow the rules: 1. Direct labels, no legends, and round 1's collisions are gone at every width. One collision is left: at 375, chicago-vs-austin Northfield's health chart puts the blue "$1,600" cost label on the solid $0 line. `placeValueLabels` doesn't treat the zero line as something to avoid.
7. AA, focus, axe: 2. a11y: serious 0, critical 0, keyboard problems 0.
8. No sideways scroll, nothing on notches or perforation: 2. responsive: 0 problems, 0 views failed at 375/768/1024.
9. Copy rules: 2. Sentence case, buttons say what they do, no filler. Checklist, summary, and method read naturally.
10. Empty and error states: 2. Empty stubs keep their labels with the direction sentence, the memo and each Why panel give direction, the editor errors are directive, and there's a 404 page.
Decisions:
- At 375 Lakeshore's match chart puts "$5,600" at the default dot and the blue "$5,600" at the recommended dot almost side by side. Each label is next to its own dot, in its marker's color, and crosses no line, so I didn't add a task.
- At 375 the Northfield health chart's y axis runs from −$5,000 to $15,000 (step 5,000), because `ticksFor` grows the top to make room for the two-line labels. The lines fill only the lower third or so. It's readable, and the zero-line fix may change the layout, so I didn't add a separate task. Look again in round 3.
- Earlier decisions stand: controls wrap into four rows at 375, and the sample select cuts off the selected title at 1280.
- No blocked tasks to retry.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/479 tests, build).
Screens checked: yes. Looked at home recommended at 1280/768/375 (the 375 one in 1400px slices), empty at 375, life at 1280, method at 768, plus full-resolution crops of the health, match, and life charts at 1280 and 2x zooms of the 375 health chart. Issues: the zero-line collision above.
Next: the HealthCostChart zero-line task from critique round 2.

## 2026-11-21T14:55:00Z | iteration 50
Task: Rubric 6. In `HealthCostChart.tsx`, keep the cost labels off the solid $0 line (chicago-vs-austin Northfield "$1,600" at 375), and test it at 300/420/560/700px.
Result: done
What changed: When `yLo < 0`, `HealthCostChart` now passes the $0 line to `placeValueLabels` as an extra `avoid` box, `[x0, y(0) - 1, x1, y(0) + 1]`, so touching it counts as a clash (weight 4), the same as touching a line label. The $0 line is tagged `data-zero-line`. The rendered sweep in `HealthCostsPanel.test.tsx` now also checks that no cost box touches the $0 line (±1px). The sweep fails on the old chart at 300px and passes with the fix.
Decisions:
- I didn't change `healthValueLabels.ts`. The existing `avoid` input already covers this, so the placement rules stay the same.
- At 375 Northfield's "$1,600" now sits below-right of its dot, one step down and just under the $0 line. It stays next to its own dot, in blue, and no line crosses it. Round 2 also flagged the −$5,000 to $15,000 axis at 375. I left it alone, and round 3 should look at it again.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/479 tests, build). a11y: serious 0, critical 0, keyboard problems 0.
Screens checked: yes. `npm run shots` (0 failed), plus 2x element crops of every health chart for chicago-vs-austin, university-staff, new-grad-roth, high-earner-family, and plan-crossover at 375, 768, and 1280. I used the ignored scratch `harness/shots/crops/crop.mjs`, pointed at `[data-value-label]`. Northfield at 375 is fixed. Every other chart, and 1280, is unchanged. Issues: none new.
Next: the backlog is empty, so next comes critique round 3.

## 2026-11-21T15:25:00Z | iteration 51
Task: Critique round 3. Every backlog task was checked off and none were blocked.
Result: done
What changed: Took fresh shots (0 failed) and ran a11y and responsive. Took 2x element crops of every chart (`svg[role=img]`) in all 5 chart samples at 375, 768, and 1280, using the ignored scratch `harness/shots/crops/cropall.mjs`. Scored the rubric and added one TaxChart task under "Critique round 3". No product code changed.
Scores (0–2):
1. Reads as a pay stub at 1280 and 375: 2. Unchanged since round 2: header rule, square bordered stubs, notched perforation (horizontal at 375), boxed net pay and bottom line.
2. Banned items absent: 2. No shadows, gradients, rounding, all-caps, arrows, emoji, monospace, or decorative icons.
3. Right edge and tabular figures: 2. Struck and new amounts share one right edge at 1280, and wrap right-aligned at 375.
4. Memo most prominent after the stubs: 2.
5. Correction legible with recommended on: 2. Every changed line and both totals are struck in red, with the carbon new amount beside or under them.
6. Charts follow the rules: 1. The health and match charts are clean in every sample at every width. The tax chart crops show collisions at 375 that earlier rounds missed, because they never cropped the tax chart. The dashed average line runs through "12%" (chicago-vs-austin, plan-crossover). The marker line runs through "22%" (university-staff). In high-earner-family offer 2, "Average 21.3% of your pay" sits on the 22% step.
7. AA, focus, axe: 2. a11y: serious 0, critical 0, keyboard problems 0.
8. No sideways scroll, nothing on notches or perforation: 2. responsive: 0 problems, 0 views failed.
9. Copy rules: 2.
10. Empty and error states: 2. Empty stubs keep their labels and the direction sentence.
Decisions:
- Round 2 asked to look again at Northfield's health chart at 375. Its y axis still runs from −$5,000 to $15,000, because `ticksFor` grows the top for the stacked two-line labels and the 4-tick step jumps to 5,000. The lines use the lower ~40% of the plot, but every value is written on the chart and nothing collides, so it follows the chart rules. I didn't add a task. A possible later refinement: let the tick count rise when the step would jump.
- At 375 the match charts with equal dollars (Lakeshore, high-earner-family offer 1, university-staff offer 2, plan-crossover offer 1) set the two value labels side by side. Each one is next to its own dot and in its own color. That stands, as in round 2.
- I didn't re-crop the life, method, and 404 screens beyond the full-page shots, because no code they render has changed since round 2.
- No blocked tasks to retry.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/479 tests, build).
Screens checked: yes. Looked at home recommended at 1280 (4 slices) and 375, home defaults at 768, empty at 375, plus contact sheets of every chart crop at 375. Issues: the tax chart collisions above.
Next: the TaxChart label collision task from critique round 3.

## 2026-11-21T15:55:00Z | iteration 52
Task: Rubric 6. In `TaxChart.tsx`, keep the rate and average labels off the average line, the marker, and the staircase at 375, and add a rendered sweep in `TaxPanel.test.tsx`.
Result: done
What changed: `TaxChart` now keeps a list of obstacles: every staircase step and riser (±1.5px), the marker (±4px) and its title, and the average line (±1.5px). Each rate label tries its whole step, then the part left of the marker, then the part right of it. On each part it tries its usual spot, then just above the average line. A non-yours label with no clear spot is left off. The average label tries one line right of the marker (level with the line's end, or just under your step when that's close), then the short text, then two lines ("Average" / "21.3%") right of the marker, then the long and short text above or below the line's left end. Every spot must clear all the obstacles. The two-line spot renders as two `<text>` elements. The new sweep in `TaxPanel.test.tsx` covers every sample, both election modes, and 300/420/560/700px. It checks that no rate or average label box touches a step, a riser, the marker, or the average line, and that your own rate label is always drawn. On the old chart it failed in 90+ places (the marker through your own rate in most samples, at every width, plus the ones round 3 found). It passes now.
Decisions:
- The task asked for the left part only when the marker splits your step. I also allow the right (dashed) part, because at 375 "24%" doesn't fit left of the marker in chicago-vs-austin, and your own rate must always be written. It stays carbon on your own step.
- Low-bracket labels that the average line crossed (for example "10%" in university-staff and plan-crossover offer 2 at 768) now sit just above the average line, centered on their step, up to ~17px higher than usual. The dashed line passes between the label and its step, but the line has its own label, so I kept them rather than dropping them.
- I moved the marker title calculation above label placement so the title counts as an obstacle. Its output is unchanged.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/483 tests, build). a11y: serious 0, critical 0, keyboard problems 0.
Screens checked: yes. `npm run shots` (0 failed), plus 2x crops of every tax chart for all 6 samples at 375, 768, and 1280, using the ignored scratch `harness/shots/crops/croptax.mjs` and contact sheets. Every chart at every width is clear. High-earner-family offer 2 now reads "Average 21.3%" right of the marker, under the 24% step. Issues: none new.
Next: the backlog is empty, so next comes critique round 4.

## 2026-11-21T16:25:00Z | iteration 53
Task: Critique round 4. Every backlog task was checked off and none were blocked.
Result: done
What changed: Took fresh shots (0 failed) and ran a11y and responsive. Took fresh 2x element crops of every chart in all 5 chart samples at 375, 768, and 1280, using the ignored scratch `harness/shots/crops/cropall.mjs`, then built contact sheets (375 per sample, plus a 1280 tax sheet). Scored the rubric and added one health-chart task under "Critique round 4". No product code changed.
Scores (0–2):
1. Reads as a pay stub at 1280 and 375: 2. Header rule, square bordered stubs, notched perforation (horizontal at 375), and boxed net pay and bottom line.
2. Banned items absent: 2.
3. Right edge and tabular figures: 2.
4. Memo most prominent after the stubs: 2.
5. Correction legible with recommended on: 2.
6. Charts follow the rules: 1. Round 3's tax collisions are gone at every width: rate labels clear the average line, the marker, and the staircase, and "Average X%" sits right of the marker. The match and life charts are clean. One new collision is left: at 375, in new-grad-roth offer 2's health chart, the steep ink HSA Plan 3200 line runs through the "$" of the blue "$2,000" cost label (seen in a 2x zoom). The rendered sweep only checks each label against its own line, so it misses this.
7. AA, focus, axe: 2. a11y: serious 0, critical 0, keyboard problems 0.
8. No sideways scroll, nothing on notches or perforation: 2. responsive: 0 problems, 0 views failed.
9. Copy rules: 2.
10. Empty and error states: 2. Unchanged since round 3, and no code they render has changed.
Decisions:
- In university-staff at 375 and 1280, the average line (11.6%, 11.2%) runs just under the 12% step, so the dashed and solid lines nearly touch. That comes from the data, not from a label, and the average has its own label, so I didn't add a task.
- At 1280 some own-rate labels read "22%" or "24%" without "marginal" (university-staff, high-earner-family), because the longer text doesn't fit the step. They are still carbon, and the conclusion sentence names the marginal rate, so this stands.
- At 375 in new-grad-roth offer 1, the $500 spending marker sits about 6px right of the y axis. That is honest to the data, so it stands.
- No blocked tasks to retry.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/483 tests, build).
Screens checked: yes. Looked at home recommended at 1280 (2 slices) and at 375, contact sheets of every chart crop at 375 for all 5 chart samples, a 1280 tax sheet, and a 2x zoom of the new-grad-roth offer 2 health chart. Issues: the health cost label collision above.
Next: the health chart cost-label task from critique round 4.

## 2026-11-21T16:50:00Z | iteration 54
Task: Rubric 6. In `healthValueLabels.ts` (`placeValueLabels`), keep each cost label off other plans' lines (new-grad-roth offer 2 at 375: the ink HSA Plan 3200 line ran through the blue "$2,000"), and extend the `HealthCostsPanel.test.tsx` sweep to check every plan's polyline.
Result: done
What changed: The sweep in `HealthCostsPanel.test.tsx` now checks every value label against every plan's polyline, not just its own (every sample at 300/420/560/700px). Before the fix it failed for new-grad-roth "$2,000" on the hdhp line at 300 and 700px. In `healthValueLabels.ts`, `lineCrosses` now pads the label box by 1.5px (the drawn stroke is up to 2.5px wide). A crossing now weighs 6, above a clash (4), so a crossed spot never beats a clear one that is only farther away. The sweep passes.
Decisions:
- I didn't switch to sampling the line. A plan line's px y never grows as x rises, so over the box's width it takes every y from lineY(right) to lineY(left). The edge-span test is exact for that kind of line. The miss came from the touch margin (the box had no padding, while the drawn stroke and the test allow ~1px) and from the low weight. I updated the doc comment to say so.
- In new-grad-roth offer 2 at 375, "$800" still sits above "$2,000", about 4 steps above its dot. Every spot nearer its dot is outside the plot, under the x axis, or on the blue line. The ink-above-blue order matches the lines' order to the right, and each label is in its own plan's color, so it stands.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/483 tests, build).
Screens checked: yes. `npm run shots` (0 failed), plus fresh 2x crops of every chart (ignored scratch `harness/shots/crops/cropall.mjs`). Looked at both new-grad-roth health charts at 375 and a contact sheet of the other 4 samples' health charts at 375. "$2,000" now sits above-right of its dot, clear of the ink line. Issues: none new.
Next: the backlog is empty, so next comes critique round 5.

## 2026-11-21T17:20:00Z | iteration 55
Task: Critique round 5. Every backlog task was checked off and none were blocked.
Result: done
What changed: Took fresh shots (0 failed) and ran a11y and responsive. Took fresh 2x element crops of every chart in all 5 chart samples at 375, 768, and 1280 (ignored scratch `harness/shots/crops/cropall.mjs`). Built contact sheets with a new ignored scratch, `harness/shots/crops/sheet.mjs` (per sample at 375, 768 health and match, 1280 tax). Measured the real rate-label widths with a new ignored scratch, `harness/shots/crops/measure.mjs`. Added one tax-chart task under "Critique round 5". No product code changed.
Scores (0–2):
1. Reads as a pay stub at 1280 and 375: 2.
2. Banned items absent: 2.
3. Right edge and tabular figures: 2.
4. Memo most prominent after the stubs: 2.
5. Correction legible with recommended on: 2.
6. Charts follow the rules: 1. Round 4's health fix holds: in new-grad-roth offer 2, "$2,000" now sits clear of the ink line at 375 and 768. The match and life charts are clean at every width, and the tax charts are clean at 1280. At 375, a 4x zoom shows the lower-step "12%" label end touching the 22% step's riser. Its halo cuts a notch in the riser (chicago-vs-austin and high-earner-family, both offers). Cause: TaxChart sizes "12%" as 24px (3 × CHAR_PX), but it renders 30.2px wide (getComputedTextLength), plus 2px of halo on each side. So the sweep's boxes are ~4px short at each end.
7. AA, focus, axe: 2. a11y: serious 0, critical 0, keyboard problems 0.
8. No sideways scroll, nothing on notches or perforation: 2. responsive: 0 problems, 0 views failed.
9. Copy rules: 2.
10. Empty and error states: 2. No code they render has changed since round 3.
Decisions:
- I scoped the width fix to TaxChart. The health and match charts' labels are mostly "$" and digits, and the crops show no touches there. Changing the shared `textBox` would shift every chart's layout for no visible gain.
- In new-grad-roth at 375, the "$0" spending marker and the Default 0% marker sit on the y axis. That is honest to the data, so it stands (as in round 4).
- No blocked tasks to retry.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/483 tests, build). ESLint lints the ignored scratch scripts, so I ran `eslint --fix` on the two new ones.
Screens checked: yes. Looked at contact sheets of every chart crop at 375 for all 5 chart samples, the 768 health and match sheets, the 1280 tax sheet, 4x zooms of the "12%" labels, and the top of home recommended at 1280. Issues: the tax label width above.
Next: the TaxChart rate-label width task from critique round 5.

## 2026-11-21T17:45:00Z | iteration 56
Task: Rubric 6. Size TaxChart rate labels by their real 600-weight width plus halo (helper in `chartKit.ts`, TaxChart only), use it in the `TaxPanel.test.tsx` sweep, and unit-check that "12%" is at least 30px.
Result: done
What changed: `chartKit.ts` gets `haloTextWidth` and `haloTextBox`. The per-glyph widths come from browser measurements: tabular digits 9.1px, "%" 12, space 3.1, letters about 7 ("12%" = 30.2px), plus the 2px `HALO_PAD` on each side. TaxChart's `centered` uses them. With honest widths, own-rate labels lost their spot in 3 tight cases at 300px (high-earner-family rec offer 1, university-staff offer 1, plan-crossover rec offer 2). So each span now gets a free window: 2px pad at the marker (the box already holds the halo), 1.5px before the riser up to the next step, 1.5px at the y axis, and none at the step's left end (that riser runs down, under the label). The label is centered in the window, then pushed to either end of it. The sweep sizes rate labels with `haloTextBox`, and a new unit test checks widths for every rate (≥ 30px) and "22% marginal" (≥ 87.6px).
Decisions:
- The helper's suggested 8.5px digits were too small: tabular digits measured 9.1px, so I used 9.2. Measured with the ignored scratch `harness/shots/crops/measure2.mjs`.
- The average label and the marker title still use `CHAR_PX`. For those mixed-letter strings it overestimates ("Average 21.3% of your pay" is 200 estimated, 167 real), so they are safe. Switching them would move layouts with no visible gain.
- At 375, the narrow lower "12%" step in chicago-vs-austin and high-earner-family no longer fits, so that label is left off, per the chart's existing rule (the y axis gives the rate). That is better than the halo notching the riser.
Verify: pass (typecheck, lint 0 errors/6 pre-existing warnings, 41 files/484 tests, build). a11y: serious 0, critical 0, keyboard problems 0.
Screens checked: yes. `npm run shots` (0 failed), plus fresh 2x crops of every tax chart (`croptax.mjs`), contact sheets at 375 and 1280, and a zoom of the plan-crossover and university-staff charts at 375. In university-staff, "22%" sits between the marker and the 24% riser, touching neither. No label touches a line. Issues: none new.
Next: the backlog is empty, so next comes critique round 6 (the last allowed).
