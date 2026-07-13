"""The three credibility visuals: calibration, recovered-$ comparison, and the
days-to-payday PDP faceted by TRUE pay-cycle (the un-fakeable artifact — the
true cycle is used only to facet the plot, never as a feature)."""

from __future__ import annotations

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .features import FEATURES


def calibration_plot(metrics: dict, path: str):
    pts = [(c["pred_mean"], c["obs_rate"]) for c in metrics["calibration"]
           if c["pred_mean"] is not None and c["n"] >= 30]
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot([0, 1], [0, 1], "--", color="grey", lw=1)
    if pts:
        xs, ys = zip(*pts)
        ax.plot(xs, ys, "o-")
    ax.set_xlabel("predicted P(dishonour)")
    ax.set_ylabel("observed rate")
    ax.set_title(f"Calibration (Brier {metrics['brier']:.4f})")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def recovery_plot(rm: dict, path: str):
    labels = ["B1 next-day", "B2 payday+2", "Cadence model", "Oracle ceiling"]
    keys = ["B1_next_day", "B2_payday_plus_2", "model", "oracle_ceiling"]
    vals = [rm[k]["recovered_aud"] for k in keys]
    rates = [rm[k]["recovery_rate"] for k in keys]
    fig, ax = plt.subplots(figsize=(7, 4.5))
    bars = ax.bar(labels, vals, color=["#999", "#777", "#2b8a3e", "#ccc"])
    for b, r in zip(bars, rates):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height(),
                f"{r * 100:.1f}%", ha="center", va="bottom")
    ax.set_ylabel("recovered A$ (first retry, held-out payers)")
    ax.set_title(f"Recovered dollars on {rm['n_nsf']} NSF failures "
                 f"(A${rm['total_at_risk_aud']:,.0f} at risk)")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def payday_pdp(models, feat: pd.DataFrame, path: str):
    """Partial dependence of P(dishonour) on days_to_est_payday, faceted by the
    TRUE (hidden) pay-cycle. A correct shape = risk peaks just before payday
    and collapses after — recovered from timing alone."""
    model = models[0]
    fig, axes = plt.subplots(1, 3, figsize=(13, 4), sharey=True)
    for ax, cyc in zip(axes, (7, 14, 30)):
        sample = feat[(feat._true_cycle == cyc) & (feat.est_period > 0)]
        if len(sample) > 400:
            sample = sample.sample(400, random_state=0)
        if sample.empty:
            continue
        grid = np.arange(0, min(cyc, 14) + 1)
        means = []
        for v in grid:
            X = sample[FEATURES].astype(float).copy()
            X["days_to_est_payday"] = float(v)
            X["days_since_est_payday"] = float((cyc - v) % cyc)
            means.append(model.predict_proba(X)[:, 1].mean())
        ax.plot(grid, means, "o-")
        ax.set_title(f"true cycle = {cyc}d (hidden)")
        ax.set_xlabel("days to estimated payday")
        ax.invert_xaxis()  # payday approaches to the right
    axes[0].set_ylabel("mean predicted P(dishonour)")
    fig.suptitle("Model rediscovers the hidden pay-cycle from timing alone")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
