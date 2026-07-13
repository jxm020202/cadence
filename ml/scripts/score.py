"""Score a payer's debit + candidate retry days with the trained model.

The bridge between the ML core and the TS loop: the server shells out to
  uv run scripts/score.py
and pipes a JSON request on stdin:
  {"amount": 45.0, "day": 226, "n_prior": 12, "n_prior_nsf": 2,
   "nsf_days": [198, 212], "schedule_period": 14, "schedule_dom": -1,
   "mandate_age": 180, "days_since_last_nsf": 14}
Response on stdout:
  {"p_dishonour": 0.42, "best_retry_day": 14, "retry_scores": {...}}

Trains once and caches the booster at ml/model/cadence.txt (committed), so the
scoring call is fast and the model in the demo IS the model in the eval.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import lightgbm as lgb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from cadence_ml.features import FEATURES, estimate_cycle, _payday_feats  # noqa: E402

MODEL_PATH = ROOT / "model" / "cadence.txt"
RETRY_HORIZON = 14


def train_and_cache() -> lgb.Booster:
    from cadence_ml.generator import GeneratorConfig, generate
    from cadence_ml.features import build_features
    from cadence_ml.evaluate import LGB_PARAMS

    ledger = generate(GeneratorConfig(n_payers=4000))
    feat = build_features(ledger)
    X = feat[FEATURES].astype(float)
    y = feat["label"].values
    model = lgb.LGBMClassifier(random_state=7, **LGB_PARAMS)
    model.fit(X, y)
    MODEL_PATH.parent.mkdir(exist_ok=True)
    model.booster_.save_model(str(MODEL_PATH))
    return model.booster_


def load() -> lgb.Booster:
    if MODEL_PATH.exists():
        return lgb.Booster(model_file=str(MODEL_PATH))
    return train_and_cache()


def features_for(req: dict, day: int, extra_nsf: int = 0) -> dict:
    nsf_days = list(req.get("nsf_days", []))
    period, phase, conf = estimate_cycle(nsf_days)
    to_pd, since_pd = _payday_feats(day, period, phase)
    n_prior = req["n_prior"] + extra_nsf
    n_prior_nsf = req["n_prior_nsf"] + extra_nsf
    return {
        "amount": req["amount"],
        "log_amount": float(np.log(req["amount"])),
        "amount_over_payer_mean": req.get("amount_over_payer_mean", 1.0),
        "schedule_period": req.get("schedule_period", 14),
        "schedule_dom": req.get("schedule_dom", -1),
        "day_of_week": day % 7,
        "day_of_month": day % 30,
        "mandate_age": req.get("mandate_age", 0) + (day - req["day"]),
        "n_prior": n_prior,
        "n_prior_nsf": n_prior_nsf,
        "prior_nsf_rate": n_prior_nsf / max(n_prior, 1),
        "days_since_last_nsf": (day - req["day"]) if extra_nsf else req.get("days_since_last_nsf", -1),
        "est_period": period,
        "est_conf": conf,
        "days_to_est_payday": to_pd,
        "days_since_est_payday": since_pd,
    }


def main():
    req = json.loads(sys.stdin.read())
    booster = load()

    def predict(f: dict) -> float:
        row = pd.DataFrame([f])[FEATURES].astype(float)
        return float(booster.predict(row)[0])

    p_now = predict(features_for(req, req["day"]))

    # retry scores: model applied at each candidate day AFTER the failure
    # (history now includes the failure itself)
    req_after = dict(req)
    req_after["nsf_days"] = list(req.get("nsf_days", [])) + [req["day"]]
    retry = {d: 1.0 - predict(features_for(req_after, req["day"] + d, extra_nsf=1))
             for d in range(1, RETRY_HORIZON + 1)}
    best = max(retry, key=retry.get)

    print(json.dumps({
        "p_dishonour": round(p_now, 4),
        "best_retry_day": best,
        "retry_scores": {str(k): round(v, 4) for k, v in retry.items()},
    }))


if __name__ == "__main__":
    main()
