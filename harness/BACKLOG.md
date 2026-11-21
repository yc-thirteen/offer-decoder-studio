# Backlog

Do tasks top to bottom. `[ ]` todo, `[x]` done, `[!]` blocked (with reason). One task per iteration.

## Phase 0: foundations
- [x] Inspect the repo and record in PROGRESS.md: framework, router, styling, UI kit, package manager, and existing scripts. Run `npm install` and `npm run build` and record the results. Don't change anything else.
- [x] Add `harness/logs/`, `harness/shots/`, `.env`, and `.env.local` to `.gitignore`. Add `.env.example` with placeholder names only.
- [x] Add Vitest with jsdom and Testing Library. Add scripts: `test` (vitest run), `typecheck` (tsc --noEmit for the app tsconfig), and `verify` (typecheck, lint if a lint script exists, test, build). Add one trivial passing test.
- [x] Add Playwright (chromium only) and `scripts/shots.mjs`, which builds, starts `vite preview`, and captures the screenshots listed in HARNESS.md into `harness/shots/latest/`, overwriting each run. Add the `shots` npm script. Add `scripts/a11y.mjs` with @axe-core/playwright, which prints the serious and critical violation counts, and the `a11y` script.
- [ ] Copy `harness/fixtures/cases.json` to `src/data/sampleCases.json`, the letters to `src/data/letters/`, and add a test asserting the copies are byte-identical to the originals.

## Phase 1: engine (`src/lib/engine/`, pure TypeScript, no React)
- [ ] `types.ts` (Profile, Offer, HealthPlan, MatchTier, Vesting, Elections, CalcResult, LifeResult, CaseResult) and `constants.ts`, both taken exactly from FINANCE_SPEC.md.
- [ ] `tax.ts` (income tax, marginal rate, payroll taxes, state) plus the `lecture-checks` test using `harness/fixtures/lecture-checks.json`.
- [ ] `health.ts` (out-of-pocket, plan cost, breakpoints, dominated plans, worst case, recommended plan) with unit tests.
- [ ] `retirement.ts` (match tiers, match cap, max match %, vesting) with unit tests, including the 7B example where 6% in gets 9% total.
- [ ] `calculate.ts` (the full pay calculation and bottom line) and `recommend.ts` (recommended elections).
- [ ] `life.ts` (human capital and coverage) and `checklist.ts` (ordered ids).
- [ ] `runCase()` in `index.ts`, plus `fixtures.test.ts` comparing every field of every case to `harness/fixtures/expected.json` (within $1, ids exact, booleans exact). This must pass before any UI task.

## Phase 2: design system
- [ ] Tokens in `src/index.css` and `tailwind.config.ts`, Public Sans loading, tabular numbers, and base element styles. Neutralize the default shadcn look for anything used (no shadows, no rounding, token colors only).
- [ ] Components in `src/components/stub/`: `GuillocheBackground`, `Perforation` (vertical and horizontal), `StubShell` (with notches), `LineItem`, `Amount` (static, struck, and new states with the 180ms correction and reduced-motion support, plus an accessible label like "was $4,500, now $9,000"), and `Stamp`. Add a `/dev/components` route showing every state. Check it with screenshots.

## Phase 3: decoder page
- [ ] App state (profile, two offers, elections mode, annual or per-paycheck, chosen sample) in one store, using React context or useReducer. The engine runs from state, and components only format.
- [ ] Header and controls row (sample picker with all 6 cases, the Annual/Per paycheck toggle, and the recommended switch).
- [ ] About you block (all profile fields; spouse's wages only when filing jointly; a disclosure on mobile).
- [ ] The two stubs bound to engine output, with every line item, note, stamp, and both modes. Check them against the fixture numbers for chicago-vs-austin in a component test.
- [ ] Memo line (the winner sentence, plus the flip sentence when the default and recommended winners differ).
- [ ] Back-of-stub checklist with the offer tabs and all copy from DESIGN.md, with dynamic values and zero amounts omitted.
- [ ] Edit offer mode: inline fields in `--carbon`, add and remove health plans and match tiers, choose the vesting type, and validation with directive error messages. "Save offer" leads to "Offer saved".
- [ ] Empty state (blank stubs with direction) and a "Clear offers" control.

## Phase 4: why these elections
- [ ] Health plan costs chart (SVG, from the engine's breakpoints, dominated plans dashed red, recommended in carbon, an expected-spending marker, direct labels).
- [ ] Match and vesting chart, plus the vesting timeline for years 0–6.
- [ ] Life insurance panel, shown only with dependents (risk aversion and markup sliders that recompute live).
- [ ] Marginal vs average tax panel.

## Phase 5: AI features (mock first)
- [ ] `src/lib/ai/`: `types.ts` (ExtractRequest, ExtractResult with per-field `source: "letter" | "missing"`, and ExplainRequest/ExplainResult), an `AIClient` interface, and a `getAIClient()` factory. The factory returns the HTTP client when the env vars for the Lovable Cloud (Supabase) URL and publishable key are present (check `VITE_SUPABASE_URL`, plus `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`), and the mock otherwise.
- [ ] `MockAIClient.extractOffer`, using deterministic parsing that extracts the 3 sample letters exactly into the matching fixture offers. Unknown text returns every field as missing, never invented values. Add tests for all 3 letters.
- [ ] `MockAIClient.explainStub`, a templated 3–4 sentence summary built only from engine numbers. Add a test.
- [ ] `HttpAIClient`, which POSTs to `<supabaseUrl>/functions/v1/decode-offer` and `/functions/v1/explain-stub` with the publishable key header, and has a 20s timeout and a directive error message.
- [ ] `supabase/functions/decode-offer/index.ts` and `supabase/functions/explain-stub/index.ts` (Deno). They read `Deno.env.get("ANTHROPIC_API_KEY")`, call `https://api.anthropic.com/v1/messages` (model `claude-sonnet-5-5`, `anthropic-version: 2023-06-01`), and ask for JSON only that matches the types. Validate the output, return 400 on invalid input, and handle CORS. Never log the letter text. The explain function must instruct the model to use only the numbers provided.
- [ ] The "Read offer letter" panel (paste text or drop a .txt file), the review state with "from letter" markers and missing-field underlines, and the sample-reader note.
- [ ] The "Plain-English summary" under the memo line.
- [ ] `docs/AI_SETUP_LOVABLE.md`: the exact steps and a copy-paste prompt for Lovable to enable Cloud, deploy the two existing functions unchanged, and add the `ANTHROPIC_API_KEY` secret, plus how to confirm it's working.

## Phase 6: content and finish
- [ ] `/method` page per DESIGN.md (the rules, the constants table with slide references, and the simplifications list).
- [ ] A 404 page in the site's voice, the page title and meta description, and the SVG favicon fallback.
- [ ] `IMAGE_PROMPTS.md` at the repo root, with one prompt per slot in DESIGN.md (exact sizes, exact hex colors, the pay-stub/security-paper style, and no text in images except the share card's title). Wire each slot with a fallback.
- [ ] Accessibility pass: zero serious axe violations, keyboard order, a visible focus ring, and labels on every input.
- [ ] Responsive pass at 375 and 768: no horizontal scroll, and nothing overlapping the notches or the perforation.
- [ ] `README.md`: what it is, the lecture-to-feature mapping, how to run and test it, what is mocked, and how to connect AI.

## Critique rounds
(The harness adds tasks here; see Self-improvement in HARNESS.md.)
