# Done

The overnight harness finished on 2026-11-21. Critique round 6 scored 2 on all 10 rubric items, so the loop stops here.

## Status against the definition of done

1. **Engine:** `npm run verify` passes: typecheck, lint (0 errors, 6 pre-existing fast-refresh warnings), 41 test files with 484 tests, and the build. `fixtures.test.ts` matches `harness/fixtures/expected.json` within $1 for all 6 cases and all 12 offers, and the lecture checks pass (tax, human capital ≈ $1.6M, life fractions 0.90 / 0.48).
2. **Decoder page:** it has the header and controls, About you, two editable stubs, the struck-to-new correction, the memo line, the back-of-stub checklist, all four "Why these elections" panels (health costs, match and vesting, life insurance, marginal vs average tax), the `/method` page, empty states, and directive error states.
3. **Samples:** all 6 cases load from the picker and show the fixture numbers.
4. **AI features:** the mock client reads the 3 sample letters exactly (tested) and writes the plain-English summary from engine numbers only. `getAIClient()` switches to the HTTP client when the Lovable Cloud env vars are present. The `decode-offer` and `explain-stub` Supabase functions call Anthropic with `ANTHROPIC_API_KEY`.
5. **Images:** `IMAGE_PROMPTS.md` has one prompt per slot. Every slot has a fallback: an SVG favicon and the guilloché background. The share card is optional.
6. **Critique:** round 6 scored 2 on every rubric item, with shots at 375, 768, and 1280 px. axe: serious 0, critical 0, keyboard problems 0. Responsive check: 0 problems.
7. **README:** `README.md` covers the project, the lecture-to-feature mapping, how to run and test it, what is mocked, and how to connect the AI.

## What you need to do next

1. **Turn on the real AI (optional).** Follow `docs/AI_SETUP_LOVABLE.md`. In Lovable, enable Cloud, deploy the two existing functions unchanged, add the `ANTHROPIC_API_KEY` secret, and publish. Until you do, the site uses the mock reader and the template summary, and it says so on the page.
2. **Generate the images (optional).** Paste the prompts in `IMAGE_PROMPTS.md` into an image tool and save the files under `public/` with the names it gives: `og-image.png`, `icon-512.png`, `favicon.ico`, and optionally `paper-texture.png`. The site looks finished without them.
3. **Read it once on a real phone.** The harness checked 375 px in headless Chromium only, not on a physical device or in Safari.

## Known limits (by design, listed on the Method page)

- Single and married filing jointly only. Head of household isn't supported, and About you says so.
- 2026 constants from the course lectures. State tax is a flat rate.
