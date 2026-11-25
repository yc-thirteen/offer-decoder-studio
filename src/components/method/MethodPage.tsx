/**
 * The Method page (harness/DESIGN.md "/method"): every rule in FINANCE_SPEC.md in plain
 * language, the 2026 constants with the lecture slide each came from, and an honest list of
 * what the site simplifies. Set like the fine print on the back of a stub, at 17px with real
 * headings, on a --stub sheet so the guilloché never sits behind the text.
 */
import type { ReactNode } from "react";
import {
  HSA_LIMIT,
  LIFE,
  LIMIT_401K,
  RETIREMENT_TAX_RATE,
  ROTH_MAX_MARGINAL,
  SS_WAGE_CAP,
  TARGET_SAVINGS_RATE,
} from "@/lib/engine";
import { formatMoney } from "@/components/stub/format";
import {
  CONSTANT_ROWS,
  LECTURES,
  SIMPLIFICATIONS,
  ILLINOIS_RATE,
  ZERO_TAX_STATES,
  bracketRows,
  formatRate,
  listJoin,
} from "./methodContent";

const SECTIONS = [
  { id: "bottom-line", title: "Your yearly bottom line" },
  { id: "pay", title: "Taxes on your pay" },
  { id: "employer-money", title: "Money the employer adds" },
  { id: "health", title: "Choosing a health plan" },
  { id: "elections", title: "The recommended elections" },
  { id: "monthly-plan", title: "Your monthly plan" },
  { id: "life", title: "Life insurance" },
  { id: "checklist", title: "The day-one checklist" },
  { id: "constants", title: "The 2026 numbers and where they come from" },
  { id: "simplifications", title: "What the site simplifies or leaves out" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section
      aria-labelledby={id}
      className="border-t border-ink pt-6 pb-3 first:border-t-0 first:pt-0"
    >
      <h2 id={id} className="mt-0 mb-3 scroll-mt-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A formula on its own line, set in the body face (monospace is banned). */
function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 max-w-prose border-l-2 border-ink pl-4 font-semibold">{children}</div>
  );
}

const cell = "border-b border-ink py-2 pr-4 align-top last:pr-0";
const headCell = "border-b-2 border-ink py-2 pr-4 align-bottom font-semibold last:pr-0";

export function MethodPage() {
  const ret = formatRate(RETIREMENT_TAX_RATE);
  const keep = formatRate(1 - RETIREMENT_TAX_RATE);
  const roth = formatRate(ROTH_MAX_MARGINAL);
  const target = formatRate(TARGET_SAVINGS_RATE);

  return (
    <>
      <h1 className="mt-8 mb-3">How the numbers work</h1>
      <p className="mt-0">
        Offer Decoder figures each offer the way a pay stub would, then adds what the employer puts
        in your name and subtracts the medical bills you expect. The tax and benefit rules follow
        three course lectures: {listJoin(LECTURES.map((l) => `${l.name} (${l.code})`))}. Slide
        numbers are listed in the table of 2026 numbers below.
      </p>

      <nav aria-labelledby="method-contents" className="mt-6 mb-8">
        <h2 id="method-contents" className="mt-0 mb-2 text-base font-semibold">
          On this page
        </h2>
        <ol className="m-0 list-decimal pl-6">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="border border-ink bg-stub p-4 md:p-8 [&_h3]:mt-5 [&_h3]:mb-1 [&_li]:mb-2 [&_ol]:my-3 [&_p]:mt-0 [&_p]:mb-3 [&_ul]:my-3">
        <Section id="bottom-line">
          <p>
            Net pay alone favors the offer that saves the least for you. So each stub ends with one
            estimate that combines take-home cash with retirement and HSA savings:
          </p>
          <Formula>
            Your yearly bottom line = net pay + savings in your name after future tax − expected
            medical bills
          </Formula>
          <p>
            Savings in your name after future tax is your traditional 401(k) plus the employer
            match, times {keep} (using an assumed {ret} tax rate at withdrawal), plus your Roth
            401(k), your HSA contributions, and the employer&apos;s HSA deposit. Roth and HSA
            dollars aren&apos;t taxed again when you spend them as the rules allow.
          </p>
          <p>
            This total is not cash available to spend. It includes savings and assumes you keep the
            full employer match; leaving before vesting can reduce its value.
          </p>
          <p>
            Expected medical bills are what you pay out of pocket under the chosen plan at the
            medical spending you enter in About you.
          </p>
        </Section>

        <Section id="pay">
          <h3>Pre-tax deductions</h3>
          <p>
            Your health premium and any HSA contribution you make through payroll come out before
            every tax: federal income tax, Social Security, Medicare, and state tax. This is the
            section 125 rule.
          </p>
          <p>
            A traditional 401(k) comes out before income tax only. You still pay Social Security and
            Medicare on it. A Roth 401(k) comes out after every tax. Your own 401(k) contributions
            stop at {formatMoney(LIMIT_401K)} a year.
          </p>
          <h3>Federal income tax</h3>
          <Formula>
            Federal wages = salary − traditional 401(k) − health premium − your HSA contribution
          </Formula>
          <p>
            Taxable income is federal wages minus the standard deduction. The tax is figured bracket
            by bracket: each rate applies only to the slice of income inside its bracket. Your
            marginal rate is the rate on your last dollar. Your average rate is the total tax
            divided by your pay, and it is always lower.
          </p>
          <p>
            On a joint return, the job&apos;s tax is what it adds to the household bill: the tax on
            both incomes together minus the tax on your spouse&apos;s wages alone. Neither tax goes
            below zero. This marginal method answers the question you are asking, which is what
            taking this job adds to your taxes.
          </p>
          <h3>Social Security and Medicare</h3>
          <p>
            Both are charged on your salary minus the premium and your HSA contribution. Social
            Security stops at {formatMoney(SS_WAGE_CAP)} of wages. Medicare has no cap, and adds an
            extra charge on household wages above the threshold in the table below; only the part
            your job pushes over the threshold counts against this offer.
          </p>
          <h3>State income tax</h3>
          <p>
            State tax uses each state&apos;s 2026 brackets for your filing status. From your federal
            wages it takes the state&apos;s standard deduction and personal exemption, walks the
            brackets, then subtracts any exemption credit. Where a state shrinks those amounts as
            income rises, the site does too. Pennsylvania also taxes your 401(k) contributions, and
            California and New Jersey tax your HSA contributions. Like federal tax, a joint return
            counts what this job adds to the household&apos;s state tax.
          </p>
          <p>
            Illinois follows the lecture: a flat {formatRate(ILLINOIS_RATE)} of your federal wages.{" "}
            {listJoin(ZERO_TAX_STATES)} have no state income tax on wages. For a job outside the 50
            states and DC, choose &ldquo;Somewhere else&rdquo; and type a flat rate.
          </p>
          <h3>Net pay</h3>
          <Formula>
            Net pay = salary − your 401(k) − health premium − your HSA contribution − federal tax −
            Social Security − Medicare − state tax
          </Formula>
          <p>Per paycheck is net pay divided by the number of paychecks in the year.</p>
        </Section>

        <Section id="employer-money">
          <h3>The 401(k) match</h3>
          <p>
            A match is a set of bands of your pay. &ldquo;100% on the first 3%, then 50% on the next
            2%&rdquo; means the employer adds a dollar for each dollar you put in up to 3% of pay,
            and fifty cents per dollar from 3% to 5%. Past 5% the match stops growing. The match is
            figured on what you actually put in, after the {formatMoney(LIMIT_401K)} limit.
          </p>
          <h3>The employer&apos;s HSA deposit</h3>
          <p>
            The deposit only counts if the plan you choose is HSA-eligible. Choose a different plan
            and it is gone.
          </p>
          <h3>Vesting</h3>
          <p>
            Vesting is when the match becomes yours to keep. Immediate vesting means it is yours
            right away. A cliff means none of it is yours until a set year, then all of it. A graded
            schedule hands you a larger share each year. The stub and the match panel show the share
            you would keep after each of your first six years.
          </p>
        </Section>

        <Section id="health">
          <h3>What a plan costs you</h3>
          <p>
            Out of pocket, you pay every dollar of care until you reach the deductible. After that
            you pay your coinsurance share of each bill, until your payments reach the out-of-pocket
            maximum. After that you pay nothing more that year.
          </p>
          <Formula>
            Plan cost = yearly premium + out-of-pocket at your spending − employer HSA deposit
          </Formula>
          <h3>Dominated plans</h3>
          <p>
            A plan is dominated when another plan costs the same or less at every level of medical
            spending, and less at some level. You should never pick it. The site checks every point
            where a plan&apos;s cost line bends (zero, each deductible, each point where a plan hits
            its out-of-pocket maximum) and one point past the last bend, which is enough because the
            lines are straight in between.
          </p>
          <h3>The recommended plan</h3>
          <p>
            It is never a dominated plan. If you have an emergency fund, it is the plan that costs
            least at your expected spending. If you don&apos;t, it is the plan whose worst case
            (premium plus out-of-pocket maximum, minus the HSA deposit) is lowest, because a high
            deductible needs cash on hand. Ties go to the lower premium.
          </p>
        </Section>

        <Section id="elections">
          <p>
            The recommended elections follow the funds hierarchy from the retirement lecture, in
            this order:
          </p>
          <ol className="list-decimal pl-6">
            <li>Always put in at least enough to get the whole match. It is free money.</li>
            <li>
              If you carry high-interest debt or have no emergency fund, stop there. Pay down the
              debt and build 3–6 months of expenses in cash first, with no HSA contribution yet.
            </li>
            <li>
              Otherwise, aim for {target} of pay saved, yours and the employer&apos;s together: you
              put in the larger of the percent that gets the whole match and {target} minus the most
              the employer matches as a percent of pay, rounded up. Your dollars stop at the{" "}
              {formatMoney(LIMIT_401K)} limit. You also fill the HSA up to its limit (
              {formatMoney(HSA_LIMIT.self)} just you, {formatMoney(HSA_LIMIT.family)} family),
              counting the employer&apos;s deposit.
            </li>
            <li>
              The employer default is a comparison, not a minimum. A suggestion may lower it when
              the savings target or debt and cash-buffer priorities call for it.
            </li>
            <li>
              Pick Roth if the plan offers it and your federal marginal rate is {roth} or less. You
              pay tax at a low rate now instead of a likely higher one later. Otherwise pick
              traditional.
            </li>
          </ol>
        </Section>

        <Section id="monthly-plan">
          <p>
            The monthly budget follows the planning framework in Budgeting and Financial Planning
            (1B, slide 28). Choose Employer defaults, Suggested plan, or My plan. My plan lets you
            change the health plan, 401(k) percentage and tax treatment, and yearly payroll HSA
            contribution. All three use the same tax and matching calculations. The 15% starting
            target is retirement contributions including the employer match; HSA contributions are
            additional.
          </p>
          <Formula>
            Monthly amount remaining = annual take-home pay ÷ 12 − living expenses − minimum debt
            payments − additional cash savings − medical bills reserved from cash
          </Formula>
          <p>
            All three monthly amounts must be entered before affordability is shown. Zero is valid.
            Exclude medical bills and payroll deductions from living expenses: the health premium,
            401(k), and payroll HSA contribution are already deducted from take-home pay. Employer
            contributions are savings, not paycheck income.
          </p>
          <p>
            If you choose to use this year's HSA contributions for eligible medical bills, the
            budget uses at most those contributions and reduces retained HSA savings by the same
            amount. Any remaining medical bills are reserved from cash. Otherwise, the budget
            assumes you pay those bills from cash and retain the HSA contributions.
          </p>
          <p>
            Monthly amounts are annual averages even with 26 paychecks. They do not predict when a
            bill arrives or when HSA deposits become available. The budget covers the selected job,
            not all household income. Spouse wages affect taxes but are not added to the spending
            budget.
          </p>
          <p>
            The suggested plan is a starting point. A monthly shortfall means the entered expenses
            and savings do not fit the estimated income; change the contributions or budget to see
            what fits. The app does not automatically redistribute savings. Contribution estimates
            use basic 2026 limits and assume full-year eligibility with no contributions allocated
            elsewhere. Catch-ups and remaining-year payroll planning are not included.
          </p>
        </Section>

        <Section id="life">
          <p>Life insurance only matters if someone depends on your income.</p>
          <p>
            Your human capital is what your future pay is worth today: your pay until you retire at{" "}
            {LIFE.retirementAge}, growing {formatRate(LIFE.wageGrowth)} a year and discounted at{" "}
            {formatRate(LIFE.discountRate)}. Household wealth is your human capital, plus your
            spouse&apos;s figured the same way, plus your savings.
          </p>
          <Formula>
            Share worth insuring = 1 − (markup ÷ risk aversion) ÷ (human capital ÷ household wealth)
          </Formula>
          <p>
            The markup is how much a policy costs above the expected payout:{" "}
            {formatRate(LIFE.employerMarkup)} through work and {formatRate(LIFE.individualMarkup)}{" "}
            on your own. Risk aversion is {LIFE.riskAversion}, the lecture&apos;s value. The share
            is never below zero.
          </p>
          <p>
            Coverage through work goes up to the share at the work markup, times your human capital:
            the free basic coverage first, then supplemental coverage up to the plan&apos;s maximum.
            A policy on your own only tops up to the smaller share at the{" "}
            {formatRate(LIFE.individualMarkup)} markup, because those dollars cost more. Buy term
            life, not whole life. If you buy a long-term policy, don&apos;t let it lapse.
          </p>
        </Section>

        <Section id="checklist">
          <p>
            The back of the stub lists what to elect on day one, in the funds hierarchy&apos;s
            order: claim the match, pay off high-interest debt, build the emergency fund, choose the
            health plan, fund the HSA, pick Roth or traditional, set up life insurance, fill out
            your W-4, and note your vesting date. Steps that don&apos;t apply to an offer are left
            out. The W-4 step is always there: a big refund is an interest-free loan to the
            government.
          </p>
        </Section>

        <Section id="constants">
          <h3 id="brackets-caption">Federal income tax brackets on taxable income</h3>
          <table
            aria-labelledby="brackets-caption"
            className="w-full max-w-prose text-sm sm:text-base"
          >
            <thead>
              <tr>
                <th scope="col" className={`${headCell} text-left`}>
                  Rate
                </th>
                <th scope="col" className={`${headCell} text-right`}>
                  Single, up to
                </th>
                <th scope="col" className={`${headCell} text-right`}>
                  Married filing jointly, up to
                </th>
              </tr>
            </thead>
            <tbody>
              {bracketRows().map((row) => (
                <tr key={row.rate}>
                  <th scope="row" className={`${cell} text-left font-normal`}>
                    {row.rate}
                  </th>
                  <td className={`${cell} amount`}>{row.single}</td>
                  <td className={`${cell} amount`}>{row.joint}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-ink-soft">Source: Taxes 4B, slide 7.</p>

          <h3 id="constants-caption">Every other number</h3>
          {/* Below sm the slide moves under the value, so the table never scrolls sideways.
              The copy that isn't shown is display:none, so screen readers hear it once. */}
          <table aria-labelledby="constants-caption" className="w-full">
            <thead>
              <tr>
                <th scope="col" className={`${headCell} w-2/5 text-left sm:w-1/4`}>
                  Number
                </th>
                <th scope="col" className={`${headCell} text-left`}>
                  2026 value
                </th>
                <th scope="col" className={`${headCell} hidden text-left sm:table-cell`}>
                  Lecture slide
                </th>
              </tr>
            </thead>
            <tbody>
              {CONSTANT_ROWS.map((row) => (
                <tr key={row.name}>
                  <th scope="row" className={`${cell} text-left font-semibold`}>
                    {row.name}
                  </th>
                  <td className={cell}>
                    {row.value}
                    <span className="mt-1 block text-sm text-ink-soft sm:hidden">{row.source}</span>
                  </td>
                  <td className={`${cell} hidden sm:table-cell`}>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="simplifications">
          <p>The site is a teaching tool, not tax software. It leaves these out on purpose:</p>
          <ul className="list-disc pl-6">
            {SIMPLIFICATIONS.map((s) => (
              <li key={s} className="mb-2">
                {s}
              </li>
            ))}
          </ul>
        </Section>
      </article>
    </>
  );
}
