"""Synthetic AU BECS direct-debit ledger generator.

DISCLOSED SYNTHETIC. This generator exists to prove the METHOD and the HARNESS,
never the real-world effect size (that requires a back-test on a real BECS
ledger). Calibration targets are published figures, labelled as the UK
GoCardless benchmark pending an AU back-test:
  - overall dishonour rate  ~2.9%
  - insufficient-funds share of failures  >80%
  - amount-banded rates  ~2.6-3.0% (<$250) vs ~4.1-5.0% (>$250)

Design principle (the anti-circularity requirement): the payer's pay-cycle is a
HIDDEN latent. It is never emitted as a feature. Labels emerge mechanistically
from a balance random-walk crossed with debit amount and timing, so a model
can only beat a payday-heuristic baseline by reconstructing the hidden cycle
from observable history AND exploiting interactions the heuristic cannot see
(amount-vs-capacity, tenure, dishonour history, phase drift).

Adversarial confounders (so the world isn't a clean lookup):
  - gig-income payers: irregular pay intervals and amounts (no stable payday)
  - shared accounts: a second income stream on its own cycle
  - buffer keepers: top up their balance when low (timing barely matters)
  - expense shocks: random large outflows
  - fee-induced churn: dishonour fees raise the hazard of mandate cancellation
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

HARD_CODES = ("account-closed", "payment-stopped")  # never retryable
SOFT_CODE = "insufficient-funds"

# Merchant debit schedules: (period_days, calendar_day_mode)
#   calendar_day_mode: None = rolling from signup; int = fixed day of month
SCHEDULES = [
    (7, None),
    (14, None),
    (28, None),
    (30, 1),   # 1st of month
    (30, 15),  # 15th of month
]


@dataclass
class GeneratorConfig:
    n_payers: int = 4000
    horizon_days: int = 540
    seed: int = 7

    # payer latents
    p_cycle: tuple = (0.35, 0.45, 0.20)  # weekly / fortnightly / monthly
    p_gig: float = 0.10
    p_shared: float = 0.15
    p_buffer: float = 0.20

    # money scale (weekly-equivalent income, AUD)
    income_weekly_mu: float = np.log(1350.0)
    income_weekly_sigma: float = 0.45
    spend_frac_mu: float = 0.88    # mean daily spend as fraction of daily income
    spend_frac_sigma: float = 0.07  # payer heterogeneity: the top tail is the risky subpopulation
    spend_noise_sigma: float = 0.55
    start_balance_frac: float = 0.85  # of one pay packet

    p_expense_shock_daily: float = 0.008
    expense_shock_mu: float = np.log(320.0)
    expense_shock_sigma: float = 0.6

    # debit amounts (gym-like)
    amount_lo: float = 12.0
    amount_hi: float = 130.0
    p_high_amount: float = 0.12   # a slice of payers on >$250 plans (family/annual)
    high_amount_lo: float = 260.0
    high_amount_hi: float = 520.0

    # terminal hazards (per debit)
    p_account_closed: float = 0.0006
    p_payment_stopped: float = 0.0009
    p_cancel_base: float = 0.0012          # voluntary churn hazard per debit
    p_cancel_per_recent_nsf: float = 0.035  # fee-induced churn: extra hazard per recent NSF

    dishonour_fee: float = 15.0  # incumbent-biller style payer-side fee

    # ABLATION SWITCH: when False, failures are amount- and timing-independent
    # coin flips at the base rate. A model must NOT beat payday+2 in this world;
    # if it does, the harness is leaking.
    interactions: bool = True
    ablation_base_rate: float = 0.029

    retry_horizon_days: int = 14


@dataclass
class PayerLatent:
    payer_id: int
    cycle_days: int          # 7 / 14 / 30 (30 => paid on fixed day of month)
    pay_anchor: int          # day offset of first payday (or day-of-month)
    income_per_cycle: float
    daily_spend: float
    is_gig: bool
    is_shared: bool
    is_buffer: bool
    shared_cycle: int = 14
    shared_anchor: int = 0
    shared_income: float = 0.0
    schedule: tuple = (14, None)
    amount: float = 40.0
    signup_day: int = 0
    balance: float = 0.0
    cancelled: bool = False
    recent_nsf: int = 0
    history: list = field(default_factory=list)


def _paydays(latent: PayerLatent, day: int, rng: np.random.Generator) -> float:
    """Income arriving on `day` (0 if none)."""
    inc = 0.0
    if latent.is_gig:
        # irregular: geometric-ish arrival, variable packet
        if rng.random() < 1.0 / 9.0:
            inc += latent.income_per_cycle * rng.lognormal(0.0, 0.5) * (9.0 / latent.cycle_days)
    else:
        if latent.cycle_days == 30:
            if (day % 30) == (latent.pay_anchor % 30):
                inc += latent.income_per_cycle
        elif (day - latent.pay_anchor) % latent.cycle_days == 0:
            inc += latent.income_per_cycle
    if latent.is_shared:
        if (day - latent.shared_anchor) % latent.shared_cycle == 0:
            inc += latent.shared_income
    return inc


def _debit_due(latent: PayerLatent, day: int) -> bool:
    period, dom = latent.schedule
    if dom is not None:
        return (day % 30) == (dom % 30) and day >= latent.signup_day
    return day >= latent.signup_day and (day - latent.signup_day) % period == 0


def generate(cfg: GeneratorConfig) -> pd.DataFrame:
    """Simulate the ledger. Returns one row per debit ATTEMPT with the true
    outcome, plus counterfactual retry-success flags for days 1..retry_horizon
    after a soft failure (computed on the no-retry balance path)."""
    rng = np.random.default_rng(cfg.seed)
    payers: list[PayerLatent] = []

    for pid in range(cfg.n_payers):
        cycle = int(rng.choice([7, 14, 30], p=cfg.p_cycle))
        income_weekly = float(rng.lognormal(cfg.income_weekly_mu, cfg.income_weekly_sigma))
        high = rng.random() < cfg.p_high_amount
        if high:
            # family/annual plans correlate with income; without this the >$250
            # band fails at ~15% instead of the published ~4-5%
            income_weekly *= float(rng.uniform(1.7, 2.6))
        income_per_cycle = income_weekly * (cycle / 7.0)
        spend_frac = float(np.clip(rng.normal(cfg.spend_frac_mu, cfg.spend_frac_sigma), 0.70, 1.08))
        daily_spend = income_weekly / 7.0 * spend_frac
        is_shared = rng.random() < cfg.p_shared
        amount = float(rng.uniform(cfg.high_amount_lo, cfg.high_amount_hi)) if high else float(
            rng.uniform(cfg.amount_lo, cfg.amount_hi))
        lat = PayerLatent(
            payer_id=pid,
            cycle_days=cycle,
            pay_anchor=int(rng.integers(0, cycle)),
            income_per_cycle=income_per_cycle,
            daily_spend=daily_spend,
            is_gig=rng.random() < cfg.p_gig,
            is_shared=is_shared,
            is_buffer=rng.random() < cfg.p_buffer,
            shared_cycle=int(rng.choice([7, 14, 30])),
            shared_anchor=int(rng.integers(0, 14)),
            shared_income=income_weekly * 0.6 * (rng.random() * 0.8 + 0.4) if is_shared else 0.0,
            schedule=SCHEDULES[int(rng.integers(0, len(SCHEDULES)))],
            amount=amount,
            signup_day=int(rng.integers(0, 45)),
            balance=income_per_cycle * cfg.start_balance_frac,
        )
        payers.append(lat)

    rows = []
    for lat in payers:
        # simulate the daily balance path once; record it so retry
        # counterfactuals use the same no-retry path
        bal = lat.balance
        path = np.zeros(cfg.horizon_days)
        for day in range(cfg.horizon_days):
            bal += _paydays(lat, day, rng)
            # mean-correct lognormal: E[spend] == daily_spend (raw lognormal(log x, s)
            # would inflate mean spend by e^{s^2/2} ~ +16% and bankrupt everyone)
            sigma = cfg.spend_noise_sigma
            spend = rng.lognormal(np.log(max(lat.daily_spend, 1.0)) - sigma * sigma / 2.0, sigma)
            bal -= spend
            if cfg.interactions and rng.random() < cfg.p_expense_shock_daily:
                bal -= rng.lognormal(cfg.expense_shock_mu, cfg.expense_shock_sigma)
            if lat.is_buffer and bal < lat.amount * 1.5:
                # buffer keepers top up from savings most of the time
                if rng.random() < 0.8:
                    bal += lat.income_per_cycle * 0.3
            bal = max(bal, -500.0)  # small overdraft floor
            path[day] = bal

        # walk the debit schedule over the same path
        n_prior = 0
        n_prior_nsf = 0
        last_nsf_day = None
        recent_nsf = 0
        cancelled = False
        for day in range(cfg.horizon_days - cfg.retry_horizon_days - 1):
            if cancelled or not _debit_due(lat, day):
                continue

            # terminal hazards
            r = rng.random()
            if r < cfg.p_account_closed:
                outcome, code = "dishonoured", "account-closed"
                cancelled = True
            elif r < cfg.p_account_closed + cfg.p_payment_stopped:
                outcome, code = "dishonoured", "payment-stopped"
                cancelled = True
            else:
                cancel_hazard = cfg.p_cancel_base + cfg.p_cancel_per_recent_nsf * recent_nsf
                if rng.random() < cancel_hazard:
                    outcome, code = "cancelled", None
                    cancelled = True
                elif cfg.interactions:
                    ok = path[day] >= lat.amount
                    outcome = "settled" if ok else "dishonoured"
                    code = None if ok else SOFT_CODE
                else:
                    ok = rng.random() >= cfg.ablation_base_rate
                    outcome = "settled" if ok else "dishonoured"
                    code = None if ok else SOFT_CODE

            row = {
                "payer_id": lat.payer_id,
                "day": day,
                "amount": round(lat.amount, 2),
                "outcome": outcome,
                "code": code,
                "n_prior": n_prior,
                "n_prior_nsf": n_prior_nsf,
                "days_since_last_nsf": (day - last_nsf_day) if last_nsf_day is not None else -1,
                "mandate_age": day - lat.signup_day,
                "schedule_period": lat.schedule[0],
                "schedule_dom": -1 if lat.schedule[1] is None else lat.schedule[1],
                # latents: for plot faceting + generator audits ONLY (never features)
                "_true_cycle": lat.cycle_days if not lat.is_gig else 0,
                "_true_anchor": lat.pay_anchor,
                "_is_gig": lat.is_gig,
                "_is_buffer": lat.is_buffer,
            }

            # counterfactual retry outcomes for soft failures
            if code == SOFT_CODE:
                for d in range(1, cfg.retry_horizon_days + 1):
                    # payer also owes the dishonour fee in the fee-churn world;
                    # a retry on day+d succeeds iff the no-retry balance covers it
                    row[f"retry_ok_{d}"] = bool(path[day + d] >= lat.amount)
            rows.append(row)

            if outcome == "settled":
                path[day:] -= lat.amount  # debit leaves the balance path
                n_prior += 1
                recent_nsf = max(0, recent_nsf - 1)
            elif code == SOFT_CODE:
                path[day:] -= cfg.dishonour_fee  # incumbent-style payer fee
                n_prior += 1
                n_prior_nsf += 1
                last_nsf_day = day
                recent_nsf += 1

    df = pd.DataFrame(rows)
    return df


def calibration_report(df: pd.DataFrame) -> dict:
    debits = df[df.outcome.isin(["settled", "dishonoured"])]
    fails = debits[debits.outcome == "dishonoured"]
    lo = debits[debits.amount <= 250]
    hi = debits[debits.amount > 250]
    return {
        "n_debits": int(len(debits)),
        "overall_dishonour_rate": float(len(fails) / max(len(debits), 1)),
        "nsf_share_of_failures": float((fails.code == SOFT_CODE).mean()) if len(fails) else 0.0,
        "rate_amount_le_250": float((lo.outcome == "dishonoured").mean()) if len(lo) else 0.0,
        "rate_amount_gt_250": float((hi.outcome == "dishonoured").mean()) if len(hi) else 0.0,
        "n_payers": int(df.payer_id.nunique()),
    }
