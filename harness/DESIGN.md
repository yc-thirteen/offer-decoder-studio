# Design decisions: Offer Decoder

Decided direction: **a pay stub printed on security paper.** The site is the paperwork itself. These decisions are locked. The harness may refine details and append notes at the bottom, but must not change the direction, the tokens, or the banned list.

## Who and why

- **Audience:** someone holding two job offers, often a new grad, during offer season or open enrollment.
- **Primary job:** show which offer is actually worth more after taxes and benefits, then list exactly what to elect on day one.
- **The story every sample tells:** the defaults hide money. In two samples, the losing offer becomes the winner once you elect correctly.

## Tokens

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#E4ECE1` | page background (pale check-paper green) |
| `--stub` | `#F6F8F4` | stub and panel surfaces |
| `--ink` | `#1E3A2B` | all text, rules, borders, chart lines |
| `--ink-soft` | `#4F6B5B` | secondary text, axis labels (passes AA on `--stub`) |
| `--carbon` | `#2B4C9B` | anything that reflects the user's elections or typed input; focus ring |
| `--correction` | `#B3261E` | strike-throughs, dominated plans, money left on the table |

- Use no colors outside these tokens: no grey shadows, no tinted near-black, no gradients.
- Define them as CSS variables in `src/index.css`, mapped in `tailwind.config.ts`.
- The site is light-only, like a paper document. Don't add a dark theme.

## Type

- One family: **Public Sans** (the US government's typeface, which suits official paperwork), weights 400, 600, 800.
- `font-variant-numeric: tabular-nums` on every number. Amounts are right-aligned.
- Scale (px): 13, 15, 17, 21, 28, 40.
  - Body is 17/1.5.
  - Stub line items are 17.
  - Net pay and the bottom line are 28/800.
  - The brand in the header is 21/800.
  - The single page headline (Method page only) is 40/800.
- Sentence case everywhere. No all-caps labels and no letter-spaced eyebrow labels.
- Don't emphasize one word in a headline with color or italics.
- Line length under 75 characters for prose.

## Signature elements (the only decoration allowed)

1. **Guilloché background:**
   - An inline SVG of fine overlapping sine waves (the anti-forgery print on checks), drawn in `--ink` at 5% opacity and tiled on `--paper`.
   - Generated in code, not an image.
   - It must never sit behind body text inside a stub.
2. **Stub shape:**
   - Square corners, a 1px `--ink` border, no shadow.
   - Semicircular notches (12px radius) cut into the top and bottom edges where the perforation meets the stub.
3. **Perforation:**
   - A vertical column of 4px holes every 10px between the two stubs, showing `--paper` through.
   - Horizontal on mobile.
4. **The correction:**
   - When "Use recommended elections" turns on, each changed amount gets a 2px `--correction` line drawn through it left to right (180ms), and the new amount appears to its right in `--carbon`.
   - Totals do the same.
   - Reversing the switch reverses it. With `prefers-reduced-motion`, swap instantly with no animation.
   - This is the one memorable motion. **No other animation on the site.** No entrance animations, no hover lift, no scroll effects.
5. **The stamp:**
   - A rotated (−4°) rectangular mark with a 2px `--correction` border and 600-weight text, slightly transparent (85%) like ink.
   - Used only for "Dominated plan" and "Match not claimed".
   - At most two stamps visible per stub.

## Layout

The content column is a max of 1120px, centered on the page. Inside it, everything is left-aligned; never center body text.

### `/` the decoder (the whole product on one page)

```
 Offer Decoder                                   Pay period: your first year
 Load a sample [Chicago vs Austin ▾]   [Annual | Per paycheck]   Use recommended elections [ ]
 ───────────────────────────────────────────────────────────────────────────────
 About you   Filing [Single ▾]  Spouse's wages [—]  Coverage [Just me ▾]
             Medical spending this year [$2,000]  Emergency fund [Yes]  High-interest debt [No]
             Someone depends on my income [No]
┌────────────────────────────────┐ ◖ ┌────────────────────────────────┐
│ Northfield Health   Offer 1 of 2│ ┊ │ Lakeshore Systems  Offer 2 of 2│
│ Chicago, IL         Edit offer  │ ┊ │ Austin, TX          Edit offer │
│ Gross pay              150,000  │ ┊ │ Gross pay             140,000  │
│ 401(k), traditional 3%   4,500  │ ┊ │ …                              │
│ Health plan: PPO 500     2,400 [DOMINATED stamp]                     │
│ …                               │ ┊ │                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ ┊ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Net pay              101,647    │ ┊ │ Net pay               101,470  │
│ Employer adds (not in your pay) │ ┊ │                                │
│ Your yearly bottom line 106,585 │ ┊ │ Your yearly bottom line 109,790│
└────────────────────────────────┘ ◗ └────────────────────────────────┘
 Memo: With the defaults, Lakeshore looks $3,205 better. Elect correctly and
       Northfield is worth $1,894 more a year.
 ───────────────────────────────────────────────────────────────────────────────
 Back of the stub: what to elect on day one     [Northfield | Lakeshore]
 [ ] Raise your 401(k) from 3% to 12% …
 ───────────────────────────────────────────────────────────────────────────────
 Why these elections   (panels: health plan costs, the match and vesting,
                        life insurance, marginal vs average tax)
```

**Header:** set like the employer block on a real stub: brand on the left, "Pay period: your first year" on the right, with a 2px `--ink` rule beneath.

**About you:** set like the employee information block on a stub, as one compact row of labeled fields. Labels go above the fields, in 13px `--ink-soft`.

**Stub line items, in order:**
1. Gross pay
2. 401(k) (traditional or Roth, with the %)
3. Health plan premium (with the plan name)
4. HSA contribution
5. Federal income tax
6. Social Security
7. Medicare
8. State income tax (zero-tax states read "Texas has no state income tax")
9. A heavy 2px rule
10. **Net pay**, boxed
11. A lighter section, "Employer adds (not in your pay)": 401(k) match, HSA deposit
12. "Expected medical bills" (subtracted)
13. **Your yearly bottom line**, boxed, 800 weight

Notes sit under the row they explain, in 15px `--ink-soft`:
- vesting ("Match vests after 3 years. Leave sooner and you forfeit it.")
- "Capped at the $24,500 limit"
- "Federal marginal rate 24%, average 15.4%"

**Memo line:** set like the memo line of a check: the word "Memo:" followed by text sitting on a 1px underline.
- Always one sentence about who wins with the current elections.
- When the winner flips between default and recommended, add the second sentence.
- This is the punchline of the site; give it room.

**Back of the stub:** the day-one checklist for the offer you choose with the tab control. Real checkboxes, with state kept in memory. Copy is below.

**Why these elections:** four panels on `--stub`, each opening with one plain sentence that states the conclusion before the chart:
- **Health plan costs:** total yearly cost against medical spending, one line per plan.
  - Dominated plans are a dashed `--correction` line; the recommended plan is a solid `--carbon` line.
  - Label lines directly; no legend box.
  - A vertical marker shows your expected spending.
- **The match and vesting:**
  - Employer dollars against your contribution %, with a bend at each tier.
  - A marker at the default % and at the recommended %.
  - Below it, a vesting timeline for years 0–6.
- **Life insurance:** only shown if someone depends on your income.
  - Your human capital, the coverage fraction through work vs on your own, and the dollar recommendation.
  - Sliders for risk aversion (1–6) and markup, so the lecture formula is explorable.
- **Marginal vs average tax:** a stepped bar of the brackets with your income marked, and both rates written out. It directly debunks "a raise pushes all my income into a higher bracket."

Charts are hand-built SVG:
- 1.5px `--ink` axes at 60%, dotted gridlines at 20%, 13px tabular labels.
- No chart library styling, no tooltips that hide information. Values are written on the chart.

### `/method` how the numbers work

- A plain-language explanation of every rule in `FINANCE_SPEC.md`.
- A table of 2026 constants with the lecture slide each came from.
- A list of what the site simplifies or leaves out, written honestly:
  - no head of household
  - state tax as a flat rate on wages, without exemptions or credits
  - no local tax
  - HSA catch-up ignored
  - group life imputed income ignored
  - 15% retirement tax rate assumed
- Set like the fine print on the back of a pay stub, but readable: 17px with real headings.

### Empty and error states

- **No offer on a stub:** the stub shows its line labels with blank amounts and one sentence: "Load a sample or read an offer letter to fill this stub."
- **Letter reader can't find a field:** it leaves that field blank with a red underline and says what is missing, e.g. "No salary in this letter. Type it here."
- Errors state the problem and the fix. They don't apologize.

### Mobile (375px)

- Stubs stack with a horizontal perforation between them.
- Controls wrap into two rows.
- About you collapses behind a "Change your details" disclosure.
- Amounts stay right-aligned, and nothing scrolls sideways.

## AI elements (mock first, real later)

1. **Read an offer letter:**
   - A button on each stub. It opens a panel set like an inbox tray: paste letter text, or drop a .txt file.
   - The reader fills the stub. Every field it filled shows in `--carbon` with a small "from letter" marker until you confirm it.
   - Missing fields are underlined in `--correction`.
   - The button says exactly what it does: "Read offer letter".
2. **Explain my stub:**
   - Writes a 3–4 sentence memo in plain English from the computed numbers. The model never does the math; it only explains numbers the engine produced.
   - Shown under the memo line, labeled "Plain-English summary".

Without an API key, both run on the mock client. The mock reader handles the three sample letters in `harness/fixtures/letters/`. The mock explainer uses a template.

A small note in the panel says "Sample reader: works on the three sample letters until an API key is connected." Never fake success on other text.

## Copy

- Plain, active voice, from the new hire's point of view. Sentence case.
- No marketing taglines, exclamation points, "unlock", "supercharge", "seamless", or "empower".
- Buttons say what happens: "Load sample", "Edit offer", "Read offer letter", "Save offer".
- An action keeps its name through the flow: "Save offer" leads to "Offer saved".
- Numbers use $ with thousands separators and no cents, except per-paycheck amounts, which show cents.

### Checklist copy (id → words; values come from the engine)

| id | Text |
|---|---|
| raise-401k | Raise your 401(k) from {default}% to {recommended}% of pay. |
| unclaimed-match | At {default}% you'd leave ${unclaimed} of free match on the table each year. |
| pay-high-interest-debt | Pay off high-interest debt next. Beyond the match, it beats any investment. |
| build-emergency-fund | Build 3–6 months of expenses in cash before saving more for retirement. |
| switch-health-plan | Choose {plan} instead of the default {defaultPlan}. |
| default-plan-dominated | The default {defaultPlan} costs more than {plan} at every level of medical spending. |
| open-hsa | Open the HSA and contribute ${hsa} a year through payroll. With the employer's ${employerHsa} you reach the ${limit} limit, and payroll contributions skip Social Security and Medicare tax. |
| choose-roth | Pick Roth. Your federal bracket is {rate}%, likely lower than it will be later. |
| choose-traditional | Pick traditional. At a {rate}% federal bracket, deducting now is worth more. |
| life-insurance | Get ${total} of term life coverage: keep the free ${basic}, add ${supplemental} through work, and buy ${individual} on your own only if needed. Term, not whole life. |
| skip-extra-life-insurance | No one depends on your income, so keep the free coverage and skip buying more. |
| check-w4 | Fill out your W-4 so you don't over-withhold. A big refund is an interest-free loan to the government. |
| note-vesting-date | Put your vesting date in your calendar: {vestingText}. |

Omit any amount that comes out as $0, and rephrase the sentence so it still reads naturally.

## Banned (any of these is a failed critique round)

- Box shadows, gradients, glassmorphism, blurred blobs.
- Rounded cards, and the shadcn default look (Inter, slate greys, rounded-md everywhere, purple accents).
- All-caps or letter-spaced eyebrow labels, and middle-dot separators ("A · B").
- "→" appended to buttons or links.
- Monospace type anywhere.
- Emoji.
- Icons used as decoration. A checkbox, a caret, and a close × are fine.
- A hero with one big number, a small label, and a gradient.
- Fade or slide entrances, or hover lift on anything.
- Placeholder lorem ipsum, or fake testimonials.
- Any color outside the tokens.

## Critique rubric (the harness scores each screenshot set 0–2 per item)

1. Reads as a pay stub at a glance, at 1280px and at 375px.
2. Every banned item is absent.
3. Amounts align in a clean right edge, with tabular figures.
4. The memo line is the most prominent sentence on the page after the stubs.
5. The correction interaction is visible and legible in a recommended-on screenshot.
6. Charts follow the chart rules, with direct labels and no legend boxes.
7. Contrast passes AA, the focus ring is visible, and axe reports zero serious violations.
8. No horizontal scroll at 375px, and no text overlapping notches or the perforation.
9. Copy follows the copy rules, with no filler sentences.
10. Empty and error states exist and give direction.

A critique round passes when every item scores 2.

## Images (the user generates these; the site must look finished without them)

| Slot | File | Size | Fallback |
|---|---|---|---|
| Social share card | `public/og-image.png` | 1200×630 | none needed for the site to work |
| Favicon / app icon | `public/icon-512.png`, plus `public/favicon.ico` | 512×512 | an SVG favicon generated in code |
| Paper fiber texture (optional) | `public/paper-texture.png` | 1024×1024, tileable | the guilloché SVG alone |

The harness writes `IMAGE_PROMPTS.md` at the repo root, with one ready-to-paste prompt per slot that names these exact colors.

## Harness notes (append below; don't edit above)
- 2026-11-21 (iteration 14): The 12px notches are drawn by `<Perforation />` at both ends of its 24px stub-colored strip, so they stay centered where the perforation meets the stubs: top and bottom when side by side, left and right when stacked. `StubShell` is the square, bordered stub. Rules inside a stub's `<dl>` use `LineItem`'s `rule` prop (an `<hr>` in a `<dl>` fails axe). The paper color is on `html` only, so the fixed guilloché layer shows through a transparent body.
- 2026-11-21 (iteration 18): The stub adds one row the layout sketch omits, "Savings in your name, after future tax" (the engine's savingsAfterFutureTax), between the employer adds and expected medical bills. Without it, net pay + match − medical bills does not add up to the bottom line, because your own 401(k) and HSA also count. Zero-tax states read "Texas has no state income tax"; taxed states read "Illinois income tax". HSA rows appear only when either set of elections has HSA dollars. Stubs stack below lg (1024px).
- 2026-11-21 (iteration 19): Memo wording. Defaults: "With the defaults, {winner} looks $X better a year." Recommended: "With the recommended elections, {winner} is worth $Y more a year." On a flip, the other mode's sentence follows; in default mode it reads "Elect correctly and {winner} is worth $Y more a year." Memo amounts are always yearly (offers can have different pay periods). Employer names drop a trailing parenthetical ("Midway University (staff plan)" → "Midway University"). A gap that rounds to $0 reads "the two offers come out even", and is never treated as a flip. With fewer than two working offers, the memo gives direction instead.
- 2026-11-21 (iteration 20): Checklist rephrasings for $0 and edge values. A 0% default reads "Start your 401(k) at {recommended}% of pay." With no employer HSA deposit, open-hsa reads "That reaches the {limit} limit". Life insurance lists only its nonzero parts ("keep the free $X and add $Y through work"); with nothing through work it reads "Buy ${total} of term life coverage on your own." The Roth/traditional rate is the bracket the engine compared (the recommended elections with traditional dollars). The "costs more than" plan in default-plan-dominated is one the engine's dominance test confirms. The checklist sits under the memo on a bordered --stub panel; tabs are named by employer, and ticked items turn carbon.
- 2026-11-21 (iteration 21): Edit offer mode replaces the stub's lines with inline fields, in the same stub, in four sections (The job, 401(k), Health plans, Life insurance). Labels sit above fields at 13px ink-soft, and typed values are carbon. Rates the engine keeps as 0–1 (match rate, coinsurance, a custom state rate) are typed as percents, and an untouched field saves the exact loaded value, so the 4/3 match never rounds. Errors appear only after a "Save offer" attempt. They sit under the field in correction red with a 2px correction underline, a summary ("Fix the N fields marked in red, then save the offer.") appears above the buttons, and focus moves to the first bad field. After a save, the header reads "Offer saved" beside "Edit offer" until the offer changes again. An empty stub gets "Fill in offer", which opens a blank form. Loading a sample closes an open editor without saving. The last health plan can't be removed.
- 2026-11-21 (iteration 22): An empty stub keeps its shape: the direction sentence in ink, then the line labels in ink-soft (Gross pay, 401(k), Health plan, Federal income tax, Social Security, Medicare, State income tax, Net pay boxed, Employer adds with 401(k) match and Expected medical bills, then the boxed bottom line) with a 1px ink-soft blank line where each amount would go. The blanks are hidden from screen readers. "Clear offers" is a secondary button (stub background, ink border) that sits right after "Load sample" in the controls row. It empties both stubs and forgets the sample but keeps the profile, and it stays enabled so focus never drops. The sample select narrows to 16rem from lg so the whole controls row still fits on one line at 1280.
- 2026-11-21 (iteration 23): "Why these elections" sits under the checklist: an h2, then one bordered --stub panel per topic. Health plan costs shows one chart per offer, side by side from lg and stacked below. Each chart opens with the conclusion sentence for that offer ("Choose {plan}: at your expected $X of medical spending it costs $Y a year, $Z less than the default {plan}[, which costs more at every level of spending]."). With no emergency fund it compares worst cases, and with one plan it states that plan's cost and its ceiling. Lines run from $0 to a nice round spending level past the last bend. Each line is labeled at its right end with the plan name, "recommended" or "dominated" in words (only when there is a choice), and "at most $X". The labels sit just above their own line end, or stack in the empty band above the highest line end when they would cross a line. They break onto two lines when they don't fit the plot width. A dot and the dollar cost mark each line at your expected spending. Charts are drawn at the container's real pixel width, so labels stay 13px on a phone.
- 2026-11-21 (iteration 24): "The match and vesting" sits under Health plan costs, one figure per offer (side by side from lg). Each opens with the match conclusion ("Put in at least {cap}% to get the whole match: at the default {d}% the employer adds $X a year, at {cap}% it adds $Y, so the default leaves $Z on the table." or "The default {d}% already gets the whole match, $Y a year; the match stops growing at {cap}% of pay."), plus "The recommended {r}% saves more of your own pay past that." when the recommendation goes past the cap. The match line is ink, with a dot at each bend, labeled "Employer match per year" at the top left; x is "Your contribution, % of pay". Markers: the default in ink, the recommended in carbon (one "Default and recommended" marker when equal), titled above the plot (two rows when the titles would collide), with the engine's match dollars by each dot. When the default stops short of the whole match, a dashed correction bracket runs from the default dot up to the whole-match level, labeled "$Z left on the table". Below it, a vesting sentence read off vestedPctByYear, then the timeline: seven framed columns (years 0–6) filled in ink to the vested %, with the % written above (0% in correction red).
- 2026-11-21 (iteration 25): "Life insurance" sits under the match panel and renders nothing unless someone depends on your income. Two sliders shared by both offers come first: risk aversion (1 to 6, step 0.5, lecture value 3) and the markup on coverage through work (0 to 100%, step 5, lecture value 20%); the on-your-own markup stays at the lecture's 100%. They are a 2px ink rule with a square carbon handle, with the value in carbon. "Use lecture values" resets them; when they differ, a note says the checklist still uses the lecture values. For each offer: the coverage sentence in the checklist's words, then the reason (human capital to 67, its share of household wealth, both fractions), then a chart of the share to insure (y) against the markup (x, 0 to 150%), an ink line from the formula with a carbon dot at the work markup and an ink dot at 100%, labeled "Through work: X%" and "On your own: Y%". Under it, rows for human capital, worth insuring through work and on your own, free basic, add through work, buy on your own, then a 2px rule and "Term life coverage to get" in 600 weight. These rows show $0 (they are a breakdown, not checklist copy). A basic-only result reads "Keep the free $X of term life coverage through work and skip buying more."; nothing worth buying reads "At these settings, life insurance costs more than it protects, so buy none."
- 2026-11-21 (iteration 26): "Marginal vs average tax" is the last panel, under Life insurance, with one figure per offer (side by side from lg). It follows the elections on the stubs, and its footnote names them. Each figure opens with the conclusion ("Only the part of your taxable income above {floor} is taxed at {marginal}. Everything below it keeps the lower rates, so the federal tax on this job is $X, an average of {avg} of your pay."; "your household's" on a joint return with spouse's wages; separate sentences for income all in the lowest bracket and for pay under the standard deduction), then "A raise is taxed only on the new dollars: another $1,000 of pay adds about $Y of federal tax, and the rest of your income keeps its rates." The chart is the filing status's brackets as a staircase of rates (y on a 10-point grid, x taxable income from $0 into the brackets past yours, compact "$100k" ticks under 480px). The part of the staircase that taxes your income is a solid 2px ink line over ink hatching (security-paper engraving, not a fill color). Past your income the staircase is dashed, which is where a raise lands. Your taxable income is a carbon marker, titled above the plot. Each step's rate is written on it where it fits, with yours in carbon ("24% marginal"). The average rate is a dashed ink line from the axis to the marker, labeled just past the marker. Under the chart, rows from wages to taxable income (wages after pre-tax deductions, spouse's wages, minus the standard deduction), then the tax in each bracket ("22% on $50,400 to $105,700"). On a joint return with spouse's wages, the household tax minus the tax on the spouse's wages alone follows (the marginal method). A 2px rule, then "Federal income tax on this job", which equals the stub's line.
- 2026-11-21 (iteration 32): Each stub's header has "Read offer letter" beside "Edit offer" (or "Fill in offer"); both step aside while a panel is open. The reader panel sits inside the stub like an inbox tray (ink border, 2px top rule): a letter textarea that accepts a dropped .txt, a "Choose File" input, three sample-letter buttons that paste a sample, then "Read offer letter" and "Cancel". On the mock client it shows the sample-reader note. Empty, too-long (over 40,000 characters), non-.txt, and unreadable text get a directive red error, and no form opens. A successful read opens the editor in its review state: the values are carbon, every filled field has a small carbon "from letter" marker beside its label (it goes when the field is edited or the offer is saved), and the fields the letter left out are blank with a 2px correction underline and the reader's note. A review sentence sits above the form and takes focus ("Check the N fields marked "from letter", then save the offer.", plus the red-underline clause when something is missing). Unknown state, Roth, and vesting stay unchosen until you pick them. The stub header keeps the old offer's name until you save.
- 2026-11-21 (iteration 33): "Plain-English summary" sits inside the memo section, under the memo line: a 15px 600-weight heading, then the 17px summary on the paper, at prose width. It appears only when both offers have results, and it follows the current elections (the per-paycheck toggle doesn't change it, since its amounts are yearly). On the mock client the template rewrites it on every change, and a 15px ink-soft note follows: "Sample writer: a fixed template words the engine's numbers until an API key is connected." On the HTTP client each summary is a paid model call, so it waits for "Write plain-English summary" (a secondary button). It shows "Writing the summary…" while waiting, and any change to the offers, profile, or elections clears the summary and cancels a call in flight. Errors are the client's directive red message, and the button stays so you can ask again.
- 2026-11-21 (iteration 37): Image slots are wired in `src/lib/siteImages.ts` by a build-time glob over `public/`, which compiles to the file names only, so dropping a file in and rebuilding is all it takes. og-image.png adds og:image (plus size, alt, and a summary_large_image card) to `/` and `/method` only, never the root, so the 404 page doesn't inherit it. It is absolute when VITE_SITE_URL is set. favicon.ico and/or icon-512.png replace the code-drawn SVG favicon (icon-512 is also the apple-touch-icon). paper-texture.png tiles at 512px, 60% opacity, under the guilloché waves. The Lovable template's favicon.ico was removed, so it can't pass for the site's icon.
- 2026-11-21 (iteration 39): Rubric item 8 is checked by `npm run responsive` (375, 768, and 1024 px, the narrowest side-by-side width). It finds stubs and the perforation by the `data-stub` and `data-perforation` attributes on `StubShell` and `Perforation`, so keep those. Chart y axes start at `yAxisLeft()` from `chartKit.ts`, which sizes the left margin to the widest tick label (at least 62px), so labels like "$10,000" and "−$2,000" never hang past the chart's left edge.
