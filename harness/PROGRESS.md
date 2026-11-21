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
