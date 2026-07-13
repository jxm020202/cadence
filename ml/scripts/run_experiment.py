"""Run the full Cadence ML experiment: generate → calibrate → train → evaluate
→ plots, then the ablation (interactions OFF — the model must NOT beat B2
there; if it does, the harness leaks).

Usage:  uv run scripts/run_experiment.py [--fast]
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cadence_ml.generator import GeneratorConfig, generate, calibration_report
from cadence_ml.features import build_features
from cadence_ml.evaluate import crossval, risk_metrics, retry_metrics
from cadence_ml.plots import calibration_plot, recovery_plot, payday_pdp

OUT = Path(__file__).resolve().parents[1] / "outputs"
OUT.mkdir(exist_ok=True)


def run(cfg: GeneratorConfig, tag: str) -> dict:
    t0 = time.time()
    ledger = generate(cfg)
    calib = calibration_report(ledger)
    print(f"[{tag}] ledger: {calib}")

    feat = build_features(ledger)
    oof, retry, models = crossval(feat, ledger)
    rm = risk_metrics(feat, oof)
    tm = retry_metrics(retry)
    print(f"[{tag}] risk: AUC {rm['roc_auc']:.3f}  PR-AUC {rm['pr_auc']:.3f} "
          f"(base {rm['base_rate']:.3f})  Brier {rm['brier']:.4f}")
    if tm.get("n_nsf"):
        print(f"[{tag}] retry ({tm['n_nsf']} NSFs, A${tm['total_at_risk_aud']:,.0f} at risk):")
        for k in ("B1_next_day", "B2_payday_plus_2", "model", "oracle_ceiling"):
            print(f"    {k:18s} {tm[k]['recovery_rate']*100:5.1f}%  A${tm[k]['recovered_aud']:,.0f}")
        print(f"    model beats B2: {tm['model_beats_b2']}")

    if tag == "main":
        calibration_plot(rm, str(OUT / "calibration.png"))
        recovery_plot(tm, str(OUT / "recovery.png"))
        payday_pdp(models, feat, str(OUT / "payday_pdp.png"))

    return {"tag": tag, "calibration_report": calib, "risk": {k: v for k, v in rm.items() if k != "calibration"},
            "retry": tm, "runtime_s": round(time.time() - t0, 1)}


if __name__ == "__main__":
    fast = "--fast" in sys.argv
    n = 1200 if fast else 4000

    results = {}
    results["main"] = run(GeneratorConfig(n_payers=n, interactions=True), "main")
    results["ablation_no_interactions"] = run(
        GeneratorConfig(n_payers=n, interactions=False), "ablation")

    ab = results["ablation_no_interactions"]["retry"]
    if ab.get("n_nsf"):
        leak = ab["model_beats_b2"] and (
            ab["model"]["recovery_rate"] - ab["B2_payday_plus_2"]["recovery_rate"] > 0.02)
        results["harness_leak_check"] = {
            "model_beats_b2_in_random_world": ab["model_beats_b2"],
            "material_leak_detected": bool(leak),
        }
        print(f"[ablation] material leak detected: {leak}")

    (OUT / "metrics.json").write_text(json.dumps(results, indent=2))
    print(f"\nwrote {OUT / 'metrics.json'}")
