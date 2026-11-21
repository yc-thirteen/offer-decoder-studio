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
