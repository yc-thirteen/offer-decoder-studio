"""
Reference implementation of harness/FINANCE_SPEC.md.
This is the test oracle. The TypeScript engine in src/lib/engine must match
every number this produces to within $1 (see fixtures/expected.json).
Run:  python3 harness/reference/engine.py   (regenerates fixtures/expected.json)
"""
import json, math, os

# ---- 2026 constants (Lectures 4B, 7A, 7B) ----
BRACKETS = {
    "single": [(12400, .10), (50400, .12), (105700, .22), (201775, .24), (256225, .32), (640600, .35), (float("inf"), .37)],
    "mfj":    [(24800, .10), (100800, .12), (211400, .22), (403550, .24), (512450, .32), (768700, .35), (float("inf"), .37)],
}
STD_DEDUCTION = {"single": 16100, "mfj": 32200}
SS_RATE, SS_WAGE_CAP = 0.062, 184500
MEDICARE_RATE, ADDL_MEDICARE_RATE = 0.0145, 0.009
ADDL_MEDICARE_THRESHOLD = {"single": 200000, "mfj": 250000}
LIMIT_401K = 24500
HSA_LIMIT = {"self": 4400, "family": 8750}
TARGET_SAVINGS_RATE = 0.15
ROTH_MAX_MARGINAL = 0.12
RETIREMENT_TAX_RATE = 0.15   # Lecture 7B slide 7: tau_R = 15%
STATE_RATES = {"IL": 0.0495, "TX": 0, "FL": 0, "WA": 0, "NV": 0, "TN": 0, "SD": 0, "WY": 0, "AK": 0, "NH": 0}
LIFE = {"employerMarkup": 0.20, "individualMarkup": 1.00, "riskAversion": 3,
        "wageGrowth": 0.05, "discountRate": 0.10, "retirementAge": 67}


def r2(x):
    return round(x + 1e-9, 2)


def income_tax(taxable, status):
    tax, lo = 0.0, 0.0
    for hi, rate in BRACKETS[status]:
        if taxable > lo:
            tax += (min(taxable, hi) - lo) * rate
        lo = hi
    return tax


def marginal_rate(taxable, status):
    for hi, rate in BRACKETS[status]:
        if taxable <= hi:
            return rate
    return .37


# ---- health plans (Lecture 7A slides 36-37) ----
def oop(plan, spend):
    if spend <= plan["deductible"]:
        v = spend
    else:
        v = plan["deductible"] + plan["coinsurance"] * (spend - plan["deductible"])
    return min(v, plan["oopMax"])


def employer_hsa(plan):
    return plan["employerHsa"] if plan["hsaEligible"] else 0


def plan_cost(plan, spend):
    """Yearly cost of a plan at a level of total medical spending:
    premium + out-of-pocket - employer HSA deposit."""
    return plan["premium"] + oop(plan, spend) - employer_hsa(plan)


def breakpoints(plans):
    """Cost curves are piecewise linear, so comparing at every kink
    of every plan plus one point past the last kink is exact."""
    pts = {0.0}
    for p in plans:
        pts.add(float(p["deductible"]))
        if p["coinsurance"] > 0:
            pts.add(p["deductible"] + (p["oopMax"] - p["deductible"]) / p["coinsurance"])
    pts.add(max(pts) * 1.5 + 1000)
    return sorted(pts)


def dominated_plan_ids(plans):
    pts = breakpoints(plans)
    out = []
    for a in plans:
        for b in plans:
            if a is b:
                continue
            ca = [plan_cost(a, s) for s in pts]
            cb = [plan_cost(b, s) for s in pts]
            if all(x >= y - 1e-9 for x, y in zip(ca, cb)) and any(x > y + 1e-9 for x, y in zip(ca, cb)):
                out.append(a["id"])
                break
    return out


def worst_case_cost(plan):
    return plan["premium"] + plan["oopMax"] - employer_hsa(plan)


def recommended_plan(plans, spend, has_buffer):
    """Never pick a dominated plan. With a 3-6 month cash buffer, pick the lowest
    cost at expected spending (high deductibles are usually best, 7A slide 37).
    Without a buffer, a high deductible is not safe to carry (7A slide 21), so
    pick the lowest worst-case cost instead."""
    dom = set(dominated_plan_ids(plans))
    cands = [p for p in plans if p["id"] not in dom]
    score = (lambda p: plan_cost(p, spend)) if has_buffer else worst_case_cost
    return min(cands, key=lambda p: (round(score(p), 6), p["premium"]))


# ---- retirement (Lecture 7B) ----
def match_cap_pct(offer):
    return max(t["upToPct"] for t in offer["retirement"]["match"])


def employer_match(offer, employee_dollars):
    """Tiers are cumulative bands: [{rate:1, upToPct:3},{rate:.5, upToPct:5}] means
    100% on the first 3% of pay, 50% on the next 2%."""
    sal = offer["salary"]
    pct = 100 * employee_dollars / sal
    prev, m = 0.0, 0.0
    for t in sorted(offer["retirement"]["match"], key=lambda t: t["upToPct"]):
        band = max(0.0, min(pct, t["upToPct"]) - prev)
        m += t["rate"] * band / 100 * sal
        prev = t["upToPct"]
    return m


def max_match_pct(offer):
    return 100 * employer_match(offer, offer["salary"] * match_cap_pct(offer) / 100) / offer["salary"]


def vested_pct(vesting, years):
    if vesting["type"] == "immediate":
        return 100
    if vesting["type"] == "cliff":
        return 100 if years >= vesting["years"] else 0
    v = 0
    for step in vesting["schedule"]:
        if years >= step["year"]:
            v = step["pct"]
    return v


# ---- core calculation (Lecture 4B) ----
def calculate(offer, profile, elections):
    status = profile["filingStatus"]
    sal = offer["salary"]
    other = profile.get("otherHouseholdWages", 0) if status == "mfj" else 0
    plan = next(p for p in offer["healthPlans"] if p["id"] == elections["planId"])
    k_dollars = min(sal * elections["employeePct"] / 100, LIMIT_401K)
    trad = k_dollars if elections["accountType"] == "traditional" else 0
    hsa_emp = elections["employeeHsa"] if plan["hsaEligible"] else 0
    sec125 = plan["premium"] + hsa_emp                      # pre-tax for income AND payroll tax
    fed_wages = sal - trad - sec125                         # traditional 401(k) is pre-tax for income tax only
    std = STD_DEDUCTION[status]
    fed = income_tax(max(0, fed_wages + other - std), status) - income_tax(max(0, other - std), status)
    fica_wages = sal - sec125
    ss = SS_RATE * min(fica_wages, SS_WAGE_CAP)
    th = ADDL_MEDICARE_THRESHOLD[status]
    medicare = MEDICARE_RATE * fica_wages + ADDL_MEDICARE_RATE * (max(0, fica_wages + other - th) - max(0, other - th))
    state_rate = offer["customStateRate"] if offer["state"] == "OTHER" else STATE_RATES[offer["state"]]
    state = state_rate * fed_wages
    net = sal - k_dollars - plan["premium"] - hsa_emp - fed - ss - medicare - state
    match = employer_match(offer, k_dollars)
    e_hsa = employer_hsa(plan)
    expected_oop = oop(plan, profile["expectedMedicalSpend"])
    savings = k_dollars + match + hsa_emp + e_hsa
    # Traditional 401(k) dollars and the employer match are taxed on withdrawal; Roth and HSA
    # (used for medical bills) are not. Value them after tax so the bottom line is apples to apples.
    savings_after_tax = (trad + match) * (1 - RETIREMENT_TAX_RATE) + (k_dollars - trad) + hsa_emp + e_hsa
    return {
        "planId": plan["id"], "employeePct": elections["employeePct"], "accountType": elections["accountType"],
        "grossPay": r2(sal), "employee401k": r2(k_dollars), "hitsLimit401k": sal * elections["employeePct"] / 100 > LIMIT_401K, "traditional401k": r2(trad), "roth401k": r2(k_dollars - trad),
        "healthPremium": r2(plan["premium"]), "employeeHsa": r2(hsa_emp),
        "federalIncomeTax": r2(fed), "socialSecurity": r2(ss), "medicare": r2(medicare), "stateIncomeTax": r2(state),
        "netPay": r2(net), "netPayPerPaycheck": r2(net / offer["payPeriods"]),
        "employerMatch": r2(match), "employerHsa": r2(e_hsa),
        "savingsInYourName": r2(savings), "savingsAfterFutureTax": r2(savings_after_tax),
        "expectedOutOfPocket": r2(expected_oop),
        "bottomLine": r2(net + savings_after_tax - expected_oop),
        "federalMarginalRate": marginal_rate(max(0, fed_wages + other - std), status),
        "federalAverageRateOnJob": r2(fed / sal * 100),
    }


def default_elections(offer):
    return {"planId": offer["defaultPlanId"], "employeePct": offer["retirement"]["defaultEmployeePct"],
            "accountType": "traditional", "employeeHsa": 0}


def recommend(offer, profile):
    plan = recommended_plan(offer["healthPlans"], profile["expectedMedicalSpend"], profile["hasEmergencyFund"])
    cap = match_cap_pct(offer)
    ready = profile["hasEmergencyFund"] and not profile["hasHighInterestDebt"]  # funds hierarchy, 7B slide 43
    pct = cap
    if ready:
        pct = max(cap, math.ceil(100 * TARGET_SAVINGS_RATE - max_match_pct(offer) - 1e-9))
    pct = max(pct, offer["retirement"]["defaultEmployeePct"])
    hsa = 0
    if plan["hsaEligible"] and ready:
        hsa = max(0, HSA_LIMIT[profile["coverage"]] - employer_hsa(plan))
    probe = calculate(offer, profile, {"planId": plan["id"], "employeePct": pct, "accountType": "traditional", "employeeHsa": hsa})
    roth = offer["retirement"]["rothAvailable"] and probe["federalMarginalRate"] <= ROTH_MAX_MARGINAL
    return {"planId": plan["id"], "employeePct": pct, "accountType": "roth" if roth else "traditional", "employeeHsa": hsa}


# ---- life insurance (Lecture 7A slides 27-28) ----
def human_capital(salary, years, g, r):
    if years <= 0 or salary <= 0:
        return 0.0
    return salary / (r - g) * (1 - ((1 + g) / (1 + r)) ** years)


def life_insurance(offer, profile):
    if not profile.get("hasDependents"):
        return None
    yrs = LIFE["retirementAge"] - profile["age"]
    L = human_capital(offer["salary"], yrs, LIFE["wageGrowth"], LIFE["discountRate"])
    spouse = profile.get("otherHouseholdWages", 0) if profile["filingStatus"] == "mfj" else 0
    W = L + human_capital(spouse, yrs, LIFE["wageGrowth"], LIFE["discountRate"]) + profile.get("currentSavings", 0)

    def frac(m):
        return max(0.0, 1 - (m / LIFE["riskAversion"]) / (L / W))

    fe, fi = frac(LIFE["employerMarkup"]), frac(LIFE["individualMarkup"])
    basic = offer["life"]["basicMultiple"] * offer["salary"]
    rec = fe * L
    supp = min(max(0, rec - basic), offer["life"]["supplementalMaxMultiple"] * offer["salary"])
    # Coverage beyond what work sells costs the individual markup, so only top up to fi * L.
    individual = max(0, fi * L - basic - supp)
    return {"humanCapital": r2(L), "householdWealth": r2(W), "lossShare": r2(L / W),
            "fractionEmployer": r2(fe), "fractionIndividual": r2(fi),
            "recommendedCoverageEmployer": r2(rec), "recommendedCoverageIndividual": r2(fi * L),
            "basicCoverage": r2(basic), "recommendedSupplemental": r2(supp),
            "recommendedIndividualPolicy": r2(individual),
            "totalRecommendedCoverage": r2(basic + supp + individual)}


# ---- checklist: stable ids, the UI writes the words ----
def checklist(offer, profile, d, r, d_calc):
    items = []
    if r["employeePct"] > d["employeePct"]:
        items.append("raise-401k")
    full = employer_match(offer, offer["salary"] * match_cap_pct(offer) / 100)
    if full - d_calc["employerMatch"] > 0.5:
        items.append("unclaimed-match")
    if profile["hasHighInterestDebt"]:
        items.append("pay-high-interest-debt")
    if not profile["hasEmergencyFund"]:
        items.append("build-emergency-fund")
    if r["planId"] != d["planId"]:
        items.append("switch-health-plan")
    if d["planId"] in dominated_plan_ids(offer["healthPlans"]):
        items.append("default-plan-dominated")
    if r["employeeHsa"] > 0:
        items.append("open-hsa")
    items.append("choose-roth" if r["accountType"] == "roth" else "choose-traditional")
    items.append("life-insurance" if life_insurance(offer, profile) else "skip-extra-life-insurance")
    items.append("check-w4")
    if offer["retirement"]["vesting"]["type"] != "immediate":
        items.append("note-vesting-date")
    return items


def run_case(case):
    profile = case["profile"]
    out = {"id": case["id"], "offers": []}
    for offer in case["offers"]:
        d, r = default_elections(offer), recommend(offer, profile)
        dc, rc = calculate(offer, profile, d), calculate(offer, profile, r)
        vest = offer["retirement"]["vesting"]
        out["offers"].append({
            "offerId": offer["id"],
            "dominatedPlanIds": dominated_plan_ids(offer["healthPlans"]),
            "recommendedElections": r, "default": dc, "recommended": rc,
            "matchCapPct": match_cap_pct(offer), "maxMatchPctOfSalary": r2(max_match_pct(offer)),
            "vestedPctByYear": [vested_pct(vest, y) for y in range(0, 7)],
            "planCostCurves": {p["id"]: [[s, r2(plan_cost(p, s))] for s in breakpoints(offer["healthPlans"])]
                               for p in offer["healthPlans"]},
            "lifeInsurance": life_insurance(offer, profile),
            "checklist": checklist(offer, profile, d, r, dc),
        })
    for key in ("default", "recommended"):
        out[f"winnerBy_{key}"] = max(out["offers"], key=lambda o: o[key]["bottomLine"])["offerId"]
    return out


def lecture_checks():
    """Numbers printed on the lecture slides. The engine must reproduce them."""
    L = human_capital(100000, 35, .05, .10)
    W = L + human_capital(50000, 35, .05, .10) + 100000
    return {
        "mfjTaxOn150kTaxable": {"slide": "4B-11", "expected": 22424, "got": r2(income_tax(150000, "mfj"))},
        "mfjAverageRateOn150k": {"slide": "4B-11", "expected": 0.15, "got": round(income_tax(150000, "mfj") / 150000, 2)},
        "mfjTaxAtTopOf22Bracket": {"slide": "4B-8", "expected": 35932, "got": r2(income_tax(211400, "mfj"))},
        "singleTaxOn9525": {"slide": "4B-29", "expected": 952.5, "got": r2(income_tax(9525, "single"))},
        "humanCapital100k35yrs": {"slide": "7A-27", "expected": 1600000, "tolerance": 5000, "got": r2(L)},
        "lifeFractionEmployer": {"slide": "7A-28", "expected": 0.90, "tolerance": 0.01, "got": round(1 - (.2 / 3) / (L / W), 2)},
        "lifeFractionIndividual": {"slide": "7A-28", "expected": 0.48, "tolerance": 0.01, "got": round(1 - (1 / 3) / (L / W), 2)},
    }


if __name__ == "__main__":
    fx = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fixtures")
    cases = json.load(open(os.path.join(fx, "cases.json")))
    json.dump({"generatedBy": "harness/reference/engine.py", "toleranceDollars": 1,
               "cases": [run_case(c) for c in cases["cases"]]},
              open(os.path.join(fx, "expected.json"), "w"), indent=2)
    json.dump(lecture_checks(), open(os.path.join(fx, "lecture-checks.json"), "w"), indent=2)
    print("wrote expected.json and lecture-checks.json")
