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
