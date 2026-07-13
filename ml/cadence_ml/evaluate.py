"""Evaluation harness: payer-level GroupKFold, the four metrics, the retry
baselines the model must beat, and the recovered-$ accounting.

Baselines (stated up front, same harness):
  B0  global base rate            — calibration floor
  B1  naive next-day retry        — current-practice strawman
  B2  payday+2 heuristic          — a genuinely good rule using the SAME
                                    estimator the model gets; beating only B1
                                    proves nothing, the model must beat B2
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import GroupKFold
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss

from .features import FEATURES, retry_candidate_features

RETRY_HORIZON = 14
LGB_PARAMS = dict(
    objective="binary",
    n_estimators=400,
    learning_rate=0.05,
    num_leaves=63,
    min_child_samples=40,
    subsample=0.9,
    colsample_bytree=0.9,
    reg_lambda=1.0,
    verbose=-1,
)


def crossval(feat: pd.DataFrame, ledger: pd.DataFrame, n_splits: int = 5, seed: int = 7):
    """Payer-level GroupKFold. Returns (oof_predictions, retry_results, models)."""
    X = feat[FEATURES].astype(float)
    y = feat["label"].values
    groups = feat["payer_id"].values

    oof = np.full(len(feat), np.nan)
    retry_rows = []
    models = []

    gkf = GroupKFold(n_splits=n_splits)
    for fold, (tr, te) in enumerate(gkf.split(X, y, groups)):
        model = lgb.LGBMClassifier(random_state=seed + fold, **LGB_PARAMS)
        model.fit(X.iloc[tr], y[tr])
        oof[te] = model.predict_proba(X.iloc[te])[:, 1]
        models.append(model)

        # retry-timing task on this fold's test NSFs
        te_feat = feat.iloc[te]
        nsf = te_feat[te_feat.label == 1]
        for _, row in nsf.iterrows():
            src = ledger.loc[row._row_index]
            if f"retry_ok_1" not in src or pd.isna(src.get("retry_ok_1")):
                continue
            retry_ok = np.array([bool(src[f"retry_ok_{d}"]) for d in range(1, RETRY_HORIZON + 1)])

            # B1: next day
            b1_day = 1
            # B2: payday+2 using the same estimator the model gets
            if row.est_period > 0:
                b2_day = int(row.days_to_est_payday + 2)
                b2_day = min(max(b2_day, 1), RETRY_HORIZON)
            else:
                b2_day = 2
            # model: argmax of P(settle) over candidate days
            cand = pd.DataFrame([retry_candidate_features(row, d) for d in range(1, RETRY_HORIZON + 1)])
            p_fail = model.predict_proba(cand[FEATURES].astype(float))[:, 1]
            m_day = int(np.argmin(p_fail)) + 1

            retry_rows.append({
                "payer_id": row.payer_id,
                "amount": row.amount,
                "est_conf": row.est_conf,
                "b1_ok": bool(retry_ok[b1_day - 1]),
                "b2_ok": bool(retry_ok[b2_day - 1]),
                "model_ok": bool(retry_ok[m_day - 1]),
                "b2_day": b2_day,
                "model_day": m_day,
                "oracle_ok": bool(retry_ok.any()),
            })

    return oof, pd.DataFrame(retry_rows), models


def risk_metrics(feat: pd.DataFrame, oof: np.ndarray) -> dict:
    y = feat["label"].values
    m = ~np.isnan(oof)
    y, p = y[m], oof[m]
    bins = np.linspace(0, 1, 11)
    idx = np.clip(np.digitize(p, bins) - 1, 0, 9)
    calib = [
        {"bin_mid": float((bins[b] + bins[b + 1]) / 2),
         "pred_mean": float(p[idx == b].mean()) if (idx == b).any() else None,
         "obs_rate": float(y[idx == b].mean()) if (idx == b).any() else None,
         "n": int((idx == b).sum())}
        for b in range(10)
    ]
    return {
        "n": int(len(y)),
        "base_rate": float(y.mean()),
        "roc_auc": float(roc_auc_score(y, p)),
        "pr_auc": float(average_precision_score(y, p)),
        "brier": float(brier_score_loss(y, p)),
        "calibration": calib,
    }


def retry_metrics(retry: pd.DataFrame) -> dict:
    if retry.empty:
        return {"n_nsf": 0}
    rec = lambda col: {
        "recovery_rate": float(retry[col].mean()),
        "recovered_aud": float(retry.loc[retry[col], "amount"].sum()),
    }
    return {
        "n_nsf": int(len(retry)),
        "total_at_risk_aud": float(retry.amount.sum()),
        "oracle_ceiling": rec("oracle_ok"),
        "B1_next_day": rec("b1_ok"),
        "B2_payday_plus_2": rec("b2_ok"),
        "model": rec("model_ok"),
        "model_beats_b2": bool(retry.model_ok.mean() > retry.b2_ok.mean()),
    }
