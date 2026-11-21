# Offer Decoder

Offer Decoder compares two job offers after taxes and benefits. It then tells a new hire exactly what to elect on day one.

Salary alone doesn't decide which offer is worth more. Taxes, the health plan, the 401(k) match, and vesting all change the answer, and so do the elections you make in your first week. Defaults often leave money on the table. The site lays each offer out as a pay stub printed on security paper. When you turn on **Use recommended elections**, it strikes through every amount that changes and writes the new amount beside it.

This is a final project for a personal finance course (Pascal Noel, Personal Finance). Every rule and constant comes from three lectures: Taxes (4B), Insurance (7A), and Retirement (7B).

The project was built with [Lovable](https://lovable.dev/projects/1924fbbb-4710-479b-be90-b55f8a3775fc), and commits to `main` sync back to the Lovable editor.

## What's on the site

- **`/`, the decoder** (the whole product on one page):
  - **The header row:**
    - a sample picker with six cases
    - an Annual / Per paycheck toggle
    - the "Use recommended elections" switch
  - **About you:** filing status, spouse's wages, coverage tier, expected medical spending, emergency fund, high-interest debt, dependents, age, and savings.
  - **Two stubs:** every line from gross pay to net pay, the employer's 401(k) match and HSA deposit, expected medical bills, and "Your yearly bottom line".
    - Each stub can be edited by hand, or filled from a real offer letter: paste its text, or drop the letter as a PDF, Word (.docx), or .txt file.
  - **The memo line:** which offer wins and by how much. When electing correctly flips the winner, it says that too. A plain-English summary sits under it.
  - **The checklist:** what to elect at each employer, in the order of the lecture's funds hierarchy.
  - **Why these elections:** four panels with hand-built SVG charts:
    - health plan costs
    - the match and vesting
    - life insurance (shown only when someone depends on your income)
    - marginal vs average tax
- **`/method`:** every rule in plain language, the 2026 constants with the lecture slide each came from, and what the site simplifies or leaves out.

### Compare your own offers

1. On a stub, choose **Upload offer letter**.
2. Paste the letter, or drop or choose its file (PDF, Word .docx, or .txt). The text is pulled out in your browser, and the file itself is never uploaded.
3. Choose **Upload offer letter**. The reader fills in what the letter states and marks each of those fields "from letter". Anything the letter leaves out is underlined in red, with a note saying what to type in. It never guesses.
4. Check the fields, fill in the gaps, and choose **Save offer**. Then do the same on the other stub.
5. Fill in **About you**, then turn on **Use recommended elections** to see what to elect.

Tips:

- Many letters leave out the health plan details (premium, deductible, coinsurance, out-of-pocket maximum) and put them in a separate benefits summary. Paste that summary into the same box, under the letter.
- Scanned PDFs have no text to read, so paste the text or type the offer in. The same goes for password-protected PDFs and old Word `.doc` files.
- You can also skip the reader and choose **Fill in offer** (or **Edit offer**) to type everything yourself.

### The six samples

| Sample                                                       | Offers                                                    | What it shows                                                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Same job, two cities: the default trap                       | Northfield Health (Chicago) vs Lakeshore Systems (Austin) | Austin wins on the defaults. Elect correctly and Chicago wins.                                                                   |
| New grad with credit card debt                               | Cascade Robotics vs Prairie Analytics                     | Not ready to save past the match, so take the match and pay down debt first. Roth at a 12% bracket.                              |
| Married, two kids, high income                               | Harbor Capital vs Evergreen Cloud                         | Joint filing, family HSA, the 401(k) limit, and life insurance.                                                                  |
| Two Chicago offers: the university staff default             | Midway University vs Lakeview Hospital                    | The second flip: Midway's default contribution gets only half of its generous match, so Lakeview wins until you elect correctly. |
| When the low-deductible plan is not dominated                | Brightline Software vs Music Row Media                    | The health plan curves cross, so expected spending decides.                                                                      |
| One income, spouse at home, one kid: how much life insurance | Summit Logistics vs Riverbend Credit Union                | Term life coverage through work first, then a top-up on your own.                                                                |

## Lecture-to-feature mapping

| Lecture                    | Rule                                                                                                                    | Where it shows up                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 4B Taxes, slide 7          | 2026 federal brackets, single and joint                                                                                 | Federal income tax on each stub; the marginal vs average tax panel                                         |
| 4B, slide 17               | Standard deduction                                                                                                      | Taxable income rows in the tax panel                                                                       |
| 4B, slide 6                | Social Security 6.2% to the wage base; Medicare 1.45% plus 0.9% above the threshold                                     | Social Security and Medicare lines                                                                         |
| Not from the lectures      | 2026 state income tax for all 50 states and DC (Tax Foundation); Illinois keeps the lecture's flat 4.95%                | The state income tax line on each stub (`src/lib/engine/stateTax.ts`)                                      |
| 4B                         | Section 125: premiums and HSA payroll dollars avoid income and payroll tax; a traditional 401(k) avoids income tax only | Every tax line; the gap between the default and recommended stubs                                          |
| 4B                         | Marginal method: a job's tax is what it adds to the household's bill                                                    | Federal tax on a joint return with spouse's wages; the tax panel's last row                                |
| 4B, slide 20               | Over-withholding is an interest-free loan to the government                                                             | The `check-w4` checklist item                                                                              |
| 4B slide 47, 7A slide 36   | HSA limits: $4,400 self, $8,750 family, employer deposit included                                                       | The HSA election and the `open-hsa` item                                                                   |
| 7A Insurance, slides 36–37 | Plan cost = premium + out-of-pocket − employer HSA; dominated plans                                                     | The health plan costs chart; the "Dominated plan" stamp; `switch-health-plan` and `default-plan-dominated` |
| 7A, slide 21               | With no emergency fund, choose on worst-case cost                                                                       | The plan recommendation when "Emergency fund" is No                                                        |
| 7A, slides 27–28           | Human capital (5% growth, 10% discount, to 67); fraction to insure at γ = 3 with a 20% work and 100% individual markup  | The life insurance panel and its sliders; the `life-insurance` item                                        |
| 7A, slides 24–26           | Term, not whole life; don't let a policy lapse                                                                          | Life insurance checklist wording                                                                           |
| 7B Retirement, slide 43    | Funds hierarchy: full match, then debt and buffer, then save more                                                       | The recommended elections and the checklist order                                                          |
| 7B, slides 24, 49          | Save 15% of pay, employee plus employer                                                                                 | The recommended 401(k) %                                                                                   |
| 7B, slide 33               | 401(k) employee limit $24,500                                                                                           | The contribution cap                                                                                       |
| 7B, slide 40               | Roth if the federal marginal rate is 12% or less                                                                        | `choose-roth` / `choose-traditional`                                                                       |
| 7B, slide 7                | 15% tax rate in retirement                                                                                              | "Savings in your name, after future tax" and the bottom line                                               |
| 7B                         | Match tiers and vesting schedules                                                                                       | The match chart, "Match not claimed" stamp, vesting timeline, and `note-vesting-date`                      |

The full rules are in [`harness/FINANCE_SPEC.md`](harness/FINANCE_SPEC.md), and the site explains them on `/method`.

## How it's built

- **Framework:** TanStack Start (React 19, file-based routes in `src/routes/`) on Vite, with Tailwind. The visual direction and its rules are in [`harness/DESIGN.md`](harness/DESIGN.md).
- **Engine:** `src/lib/engine/` is pure TypeScript with no React. It covers taxes, health plans, retirement, life insurance, recommended elections, and the checklist ids. `runCase()` in `src/lib/engine/index.ts` runs a whole comparison. Components only format what the engine returns.
- **Test oracle:** `harness/reference/engine.py` implements the spec and generated `harness/fixtures/expected.json`. The TypeScript engine must match every field of all 6 cases (12 offers) to within $1, and a `lecture-checks` test reproduces numbers printed on the slides.
- **State:** one reducer in `src/state/` holds the profile, both offers, the election mode, and the chosen sample.
- **AI:** `src/lib/ai/` has an `AIClient` interface, with a mock client and an HTTP client. `supabase/functions/` holds two Lovable Cloud edge functions, `decode-offer` (reads a letter) and `explain-stub` (writes the summary). They call `anthropic/claude-sonnet-5` through the Lovable AI Gateway (`@lovable.dev/ai-gateway`). The model only copies values from letters and words numbers the engine already computed, and every answer is checked against a schema twice, in the function and in the browser.
- **Letter files:** `src/lib/letterFile.ts` turns PDF (pdf.js) and Word .docx (mammoth) files into text in the browser. Both libraries load only when a file is dropped, so they stay out of the page bundle.

## Run it locally

You need Node.js 20 or newer. Lovable uses bun (`bun.lock`). Locally, npm works too, but don't commit a `package-lock.json`.

```sh
npm install
npm run dev
```

Then open the address Vite prints. Without Cloud env vars, the AI features run on the mock (see below). To use the real reader locally, copy `.env.example` to `.env.local` and fill in the project's `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Lovable (**Cloud → Settings**). Neither is a secret.

### Test and check

| Command              | What it does                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run verify`     | Typecheck, lint, unit tests, and a production build. It must pass before every commit.                |
| `npm test`           | Unit and component tests (Vitest with jsdom), including the fixture and lecture checks                |
| `npm run shots`      | Builds, serves the build, and saves screenshots at 375, 768, and 1280 px into `harness/shots/latest/` |
| `npm run a11y`       | Runs axe on the main views and states, plus a keyboard walk. Prints serious and critical counts.      |
| `npm run responsive` | Checks for sideways scroll, clipped text, and text over the perforation at 375, 768, and 1024 px      |

`shots`, `a11y`, and `responsive` need Playwright's Chromium once: `npx playwright install chromium`.

## What is mocked

All the money math runs in the engine, in the browser, on every path. Only the two AI features have a mock.

| Feature                   | Without Lovable Cloud (mock)                                                                                                                                              | With Lovable AI connected (the published site)                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Upload offer letter**   | A deterministic sample reader reads the three sample letters (`src/data/letters/`) exactly. On any other text it says it reads only the samples. It never invents values. | Reads any pasted letter, or a dropped .txt, PDF, or Word file, with `anthropic/claude-sonnet-5` through the Lovable AI Gateway. It copies only the values the letter states and marks the rest missing. |
| **Plain-English summary** | A fixed template words the engine's numbers.                                                                                                                              | The model writes it from the same numbers. Any figure that isn't on the stubs is rejected.                                                                                                              |

The browser picks the client in `src/lib/ai/index.ts`. It uses the HTTP client when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) are in the build, and the mock otherwise. See `.env.example` for the names, which are placeholders only.

The site uses no image files. It draws an SVG favicon and the guilloché background in code. [`IMAGE_PROMPTS.md`](IMAGE_PROMPTS.md) has prompts in case you ever want a share card or app icon. Drop the file into `public/` and rebuild.

## Connect the AI

It's already connected. Both edge functions call the Lovable AI Gateway with `LOVABLE_API_KEY`, which Lovable creates and manages, and usage comes out of the workspace's Lovable AI credits. There's no separate AI key to add. [`docs/AI_SETUP_LOVABLE.md`](docs/AI_SETUP_LOVABLE.md) covers:

- how the functions and gateway are set up
- how to confirm it works
- troubleshooting, including running out of credits

The key is read only inside the edge functions and never reaches the browser. Don't put it in the repo or in `.env` files. Each letter read and each summary uses a little of the workspace's credits. When they run out, both features say so, and the rest of the site keeps working.

## Simplifications

These are also listed on `/method`:

- Head of household isn't supported. The lectures don't give its standard deduction.
- State tax uses each state's 2026 brackets, standard deduction, exemptions, and exemption credits for all 50 states and DC, from the Tax Foundation's [2026 table](https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/), including the phase-outs its footnotes spell out. Like federal tax, a joint return counts what the job adds to the household's state bill. It leaves out local and city taxes (NYC, Maryland counties), dependents and other state credits, New York and Connecticut recapture at high incomes, and state payroll taxes such as California's 1.3% SDI. Illinois keeps the lecture's flat 4.95% of wages. For a job outside the 50 states and DC, choose "Somewhere else (flat rate)" and type a rate.
- The HSA catch-up and the imputed income on group life coverage are ignored.
- Retirement savings are taxed at an assumed 15% rate later.

## Repository map

| Path                                  | What's there                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `src/lib/engine/`                     | The finance engine and its tests                                              |
| `src/lib/ai/`                         | AI client interface, mock, HTTP client, and validation                        |
| `src/lib/letterFile.ts`               | PDF, Word, and .txt letter files to text, in the browser                      |
| `src/components/decoder/`             | Header, About you, stubs, editor, letter reader, memo, summary, checklist     |
| `src/components/why/`                 | The four "Why these elections" panels and their SVG charts                    |
| `src/components/stub/`                | Pay-stub primitives: stub shell, perforation, amounts, stamp, guilloché       |
| `src/components/method/`              | The Method page                                                               |
| `src/data/`                           | Sample cases and letters, copied byte for byte from `harness/fixtures/`       |
| `supabase/functions/`                 | The `decode-offer` and `explain-stub` edge functions (Lovable AI Gateway)     |
| `src/integrations/`, `src/generated/` | Lovable Cloud and gateway code that Lovable generates. Don't edit it by hand. |
| `docs/`                               | `AI_SETUP_LOVABLE.md`: how the AI is connected, checks, and troubleshooting   |
| `scripts/`                            | Screenshot, accessibility, and responsive checks                              |
| `harness/`                            | The spec, design rules, fixtures, and the overnight build log                 |
