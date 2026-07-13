"""History-only feature engineering + the payday estimator.

The estimator only sees what a real system would see: the payer's past debit
dates and outcomes. It never touches the generator's latents. Cold start is
real and disclosed: with <2 past NSFs there is no cycle estimate and the
payday features are missing (-1) — exactly the production cold-start story
(production would warm-start from network history / billing anchors).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

CANDIDATE_PERIODS = (7, 14, 30)

FEATURES = [
    "amount", "log_amount", "amount_over_payer_mean",
    "schedule_period", "schedule_dom",
    "day_of_week", "day_of_month",
    "mandate_age", "n_prior", "n_prior_nsf", "prior_nsf_rate",
    "days_since_last_nsf",
    "est_period", "est_conf", "days_to_est_payday", "days_since_est_payday",
]


def estimate_cycle(nsf_days: list[int]) -> tuple[int, float, float]:
    """Estimate (period, payday_phase, confidence) from past NSF dates.

    NSFs cluster in the low-balance trough just BEFORE payday, so the
    estimated payday phase is the circular mean of NSF phases plus a small
    offset. Confidence is the circular resultant length. Needs >=2 NSFs.
    """
    if len(nsf_days) < 2:
        return 0, -1.0, 0.0
    best = (0, -1.0, 0.0)
    for period in CANDIDATE_PERIODS:
        ang = 2 * np.pi * (np.array(nsf_days) % period) / period
        c, s = np.cos(ang).mean(), np.sin(ang).mean()
        conf = float(np.hypot(c, s))
        trough = (np.arctan2(s, c) / (2 * np.pi) * period) % period
        payday_phase = (trough + 2.0) % period  # payday ~2 days after trough
        if conf > best[2]:
            best = (period, float(payday_phase), conf)
    return best


def _payday_feats(day: int, period: int, phase: float) -> tuple[float, float]:
    """(days_to_next_est_payday, days_since_last_est_payday)."""
    if period == 0:
        return -1.0, -1.0
    pos = day % period
    to_next = (phase - pos) % period
    since = (pos - phase) % period
    return float(to_next), float(since)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """One row per scheduled debit (settled/dishonoured-soft only), with
    features computed strictly from history before that debit."""
    out = []
    for pid, g in df.sort_values("day").groupby("payer_id"):
        nsf_days: list[int] = []
        amounts: list[float] = []
        for _, r in g.iterrows():
            if r.outcome not in ("settled", "dishonoured"):
                continue
            if r.code in ("account-closed", "payment-stopped"):
                continue  # hard codes are gated out of the model's world
            period, phase, conf = estimate_cycle(nsf_days)
            to_pd, since_pd = _payday_feats(int(r.day), period, phase)
            out.append({
                "payer_id": pid,
                "day": int(r.day),
                "amount": r.amount,
                "log_amount": np.log(r.amount),
                "amount_over_payer_mean": r.amount / np.mean(amounts) if amounts else 1.0,
                "schedule_period": r.schedule_period,
                "schedule_dom": r.schedule_dom,
                "day_of_week": int(r.day) % 7,
                "day_of_month": int(r.day) % 30,
                "mandate_age": r.mandate_age,
                "n_prior": r.n_prior,
                "n_prior_nsf": r.n_prior_nsf,
                "prior_nsf_rate": r.n_prior_nsf / max(r.n_prior, 1),
                "days_since_last_nsf": r.days_since_last_nsf,
                "est_period": period,
                "est_conf": conf,
                "days_to_est_payday": to_pd,
                "days_since_est_payday": since_pd,
                "label": 1 if r.outcome == "dishonoured" else 0,
                "_true_cycle": r._true_cycle,
                "_row_index": r.name,
            })
            amounts.append(r.amount)
            if r.outcome == "dishonoured":
                nsf_days.append(int(r.day))
    return pd.DataFrame(out)


def retry_candidate_features(base_row: pd.Series, d: int) -> dict:
    """Features for scoring a retry d days after the failed debit at
    base_row.day. History features reflect the just-observed failure."""
    day = int(base_row.day) + d
    period, phase = int(base_row.est_period), base_row.days_to_est_payday
    # recompute payday distances at the candidate date using the SAME estimate
    if period == 0:
        to_pd, since_pd = -1.0, -1.0
    else:
        # reconstruct phase from the base row's (day, days_to_est_payday)
        est_phase = (int(base_row.day) % period + base_row.days_to_est_payday) % period
        to_pd, since_pd = _payday_feats(day, period, est_phase)
    f = {k: base_row[k] for k in FEATURES}
    f.update({
        "day_of_week": day % 7,
        "day_of_month": day % 30,
        "mandate_age": base_row.mandate_age + d,
        "n_prior": base_row.n_prior + 1,
        "n_prior_nsf": base_row.n_prior_nsf + 1,
        "prior_nsf_rate": (base_row.n_prior_nsf + 1) / max(base_row.n_prior + 1, 1),
        "days_since_last_nsf": d,
        "days_to_est_payday": to_pd,
        "days_since_est_payday": since_pd,
    })
    return f
