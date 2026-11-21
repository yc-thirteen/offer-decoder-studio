# Finance spec

The source of truth for every number on the site. `harness/reference/engine.py` implements this file exactly and generates `fixtures/expected.json`. The TypeScript engine in `src/lib/engine/` must match the fixtures to within $1. If this file and the Python disagree, the Python wins, and you note the discrepancy in PROGRESS.md. Never edit the fixtures by hand; never edit engine.py or this file except to fix a documented bug.

Lecture references: 4B = Taxes, 7A = Insurance, 7B = Retirement (Pascal Noel, Personal Finance).

## Constants (2026)

| Constant | Value | Source |
|---|---|---|
| Federal brackets, single | 10% to 12,400 / 12% to 50,400 / 22% to 105,700 / 24% to 201,775 / 32% to 256,225 / 35% to 640,600 / 37% above | 4B slide 7 |
| Federal brackets, married filing jointly | 10% to 24,800 / 12% to 100,800 / 22% to 211,400 / 24% to 403,550 / 32% to 512,450 / 35% to 768,700 / 37% above | 4B slide 7 |
| Standard deduction | 16,100 single, 32,200 joint | 4B slide 17 |
| Social Security | 6.2% up to 184,500 of wages | 4B slide 6 |
| Medicare | 1.45%, plus 0.9% above 200,000 single / 250,000 joint | 4B slide 6 |
| 401(k) employee limit | 24,500 | 7B slide 33 |
| HSA limit (employee + employer combined) | 4,400 self, 8,750 family | 4B slide 47, 7A slide 36 |
| Retirement savings target | 15% of pay, employee + employer | 7B slides 24, 49 |
| Tax rate in retirement | 15% | 7B slide 7 |
| Roth threshold | Roth if federal marginal rate ≤ 12% | 7B slide 40 |
| Life insurance markup | 20% through employer, 100% individually | 7A slide 28 |
| Risk aversion γ | 3 | 7A slide 27 |
| Human capital | wage growth 5%, discount 10%, retire at 67 | 7A slide 27 (reproduces its $1.6M) |
| State income tax on wages | IL 4.95%; 0% for TX, FL, WA, NV, TN, SD, WY, AK, NH; "Other" = user-entered flat rate | |

Filing statuses supported: single and married filing jointly. Head of household is out of scope for v1 (the lectures don't give its standard deduction). The UI must say so plainly.

## Inputs

**Profile:** filing status; spouse's wages (joint only, already net of their own pre-tax deductions); coverage tier (self or family); expected total medical spending for the year; has a 3–6 month emergency fund (yes/no); has high-interest debt (yes/no); anyone depends on your income (yes/no); age; current savings.

**Offer:** employer, city, state (or OTHER plus a custom rate), salary, pay periods per year. Retirement: match tiers, default employee %, vesting (immediate / cliff N years / graded schedule), Roth available. Health plans: premium per year for your tier, deductible, coinsurance (your share after the deductible), out-of-pocket max, HSA-eligible, employer HSA deposit. The default plan is what you get if you elect nothing. Life: free basic coverage multiple, maximum supplemental multiple.

## Pay calculation (4B)

1. Section 125 deductions are the health premium plus the employee's HSA payroll contribution. They reduce income tax AND payroll tax.
2. A traditional 401(k) reduces income tax only. A Roth 401(k) reduces neither. Employee 401(k) dollars are capped at 24,500.
3. Federal wages = salary − traditional 401(k) − section 125.
4. Federal income tax attributed to this job = tax(federal wages + spouse wages − standard deduction) − tax(spouse wages − standard deduction). Both are floored at 0. This is the marginal method: the job's tax is what it adds to the household bill.
5. Payroll wages = salary − section 125. Social Security = 6.2% × min(payroll wages, 184,500). Medicare = 1.45% × payroll wages + 0.9% × (household wages above the threshold − spouse wages above the threshold).
6. State tax = state rate × federal wages. This simplification ignores state exemptions and credits; the Method page must say so.
7. Net pay = salary − employee 401(k) − premium − employee HSA − federal − Social Security − Medicare − state. Per paycheck = net ÷ pay periods.

## Employer money

- **Match tiers** are cumulative bands of pay. `[{rate:1, upToPct:3}, {rate:0.5, upToPct:5}]` means 100% on the first 3% of pay and 50% on the next 2%. The match is computed on the employee's actual (capped) contribution dollars.
- **Employer HSA deposit** counts only if the chosen plan is HSA-eligible.
- **Vesting:** report the vested % at years 0–6. The fixtures include `vestedPctByYear`.

## Bottom line

`bottomLine = net pay + savings after future tax − expected out-of-pocket medical costs`

Savings after future tax = (traditional 401(k) + employer match) × (1 − 15%) + Roth 401(k) + employee HSA + employer HSA. The UI label is "Your yearly bottom line", with an explanation available on the Method page.

## Health plans (7A slides 36–37)

- Out-of-pocket at spending s: s up to the deductible, then deductible + coinsurance × (s − deductible), capped at the out-of-pocket max.
- Plan cost at s = premium + out-of-pocket(s) − employer HSA deposit.
- **Dominated:** plan A is dominated if some other plan B costs ≤ A at every spending level and < A at some level. The curves are piecewise linear, so check every kink of every plan (0, each deductible, each point where out-of-pocket hits its max), plus one point beyond the last kink.
- **Recommendation:** never a dominated plan. With an emergency fund, pick the lowest cost at expected spending. Without one, pick the lowest worst-case cost (premium + out-of-pocket max − employer HSA), because a high deductible needs a cash cushion (7A slide 21). Ties go to the lower premium.

## Recommended elections (7B slide 43, funds hierarchy)

1. Always contribute at least enough to get the full match.
2. "Ready" means an emergency fund and no high-interest debt. If not ready, stop at the full match, with no HSA contribution, and the checklist says to pay down the debt and build the buffer first.
3. If ready: employee % = max(match cap %, ceil(15 − employer match % at the cap)). Dollars are capped at 24,500, and `hitsLimit401k` is true when the cap binds. HSA employee contribution = tier limit − employer deposit.
4. Never recommend less than the default %.
5. Roth if offered and the federal marginal rate (under traditional elections) is ≤ 12%; otherwise traditional.

## Life insurance (7A slides 27–28), only when someone depends on your income

- L = present value of your pay to age 67 (growing annuity, g 5%, r 10%).
- W = L + the spouse's equivalent + current savings.
- Fraction to insure at markup m = max(0, 1 − (m/γ) ÷ (L/W)).
- Buy work coverage up to fraction(20%) × L: the free basic coverage first, then supplemental up to the plan maximum.
- Any individual policy only tops up to fraction(100%) × L, because those extra dollars cost the 100% markup.
- If nobody depends on you, the checklist says to keep the free coverage and skip buying more.
- Term, not whole life. If you buy a long-term policy, don't let it lapse (7A slides 24–26).

## Checklist ids (stable; the UI writes the words)

`raise-401k`, `unclaimed-match`, `pay-high-interest-debt`, `build-emergency-fund`, `switch-health-plan`, `default-plan-dominated`, `open-hsa`, `choose-roth` / `choose-traditional`, `life-insurance` / `skip-extra-life-insurance`, `check-w4` (always; over-withholding is an interest-free loan, 4B slide 20), `note-vesting-date` (if not immediate).

Order in the UI follows the funds hierarchy: match → debt → buffer → health plan → HSA → account type → life → W-4 → vesting.

## Lecture checks

`fixtures/lecture-checks.json` holds numbers printed on the slides. The TypeScript engine must reproduce them in a test named `lecture-checks`:

- 150,000 taxable joint → 22,424 tax (15% average).
- 211,400 joint → 35,932.
- 9,525 single → 952.50.
- Human capital of 100k over 35 years ≈ 1.6M.
- Life fraction 0.90 through work vs 0.48 individually.
