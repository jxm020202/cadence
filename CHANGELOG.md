# Changelog

An honest build record. Prior work is disclosed (see `docs/disclosure-email.md`); the solution
being judged was built during the official 48-hour window (opened Fri 24 Jul, 7:00pm AEST).

## 🏗️ Build weekend — in the window (Fri 24 Jul 7pm AEST →)

### Sat 25 Jul
- `feat(merchant)`: **cash-flow forecast** — projected collection this run *with vs without* Cadence ($359 blind → $442, +$83), mapped to real model P(collect).
- `test`: **consent-parser coverage** — 10 cases incl. the hero negation path (`"cant do friday, monday works"` → Monday), payday/opt-out/hardship/split/gibberish. 23/23 green.

### Fri 24 Jul (window open)
- **LiveDriver** — the demo runs against the REAL Pinch sandbox (`PINCH_MODE=live`): real payer/source/payment ids, a real recovery payment with `applicationFee` + consent receipt. Only the un-triggerable dishonour/settle transition stays labelled SIMULATED.
- **Merchant-facing view** (`/merchant.html`) — this fortnight's debit run, risk-ranked by the live model, recovered-$ projected.
- **End-to-end webhook loop test** — proves `bank-results → hard-code gate → LightGBM → recovery` runs.
- **Deploy-prep** — Dockerfile for Railway/Render/Fly (no autonomous deploy; hosting is the owner's step).
- **Submission-grade repo** — README quickstart + judge tour, `GET / → /demo.html`.
- Submission operating plan + prior-work disclosure (form + email, before the window).

## 🔬 Before the window — disclosed prior work / research

### Tue 14 Jul
- **Day-0 sandbox spike** — verified the whole Pinch API with real test keys; proved Time-Travel does **not** settle scheduled BECS payments on demand (the honest basis for the SIMULATED label).
- **Money spine** — append-only payment state log, double-entry ledger, idempotency, three-way reconciliation (the senior-payments-engineer signal).

### Mon 13 Jul
- **Cadence ML core** — synthetic AU BECS ledger (hidden pay-cycles + confounders), LightGBM P(dishonour) + retry-timing engine. AUC 0.913; recovery 46% vs payday-heuristic 38%; anti-leak ablation (0.913 → 0.501).
- **Fused Cadence** — predict-then-ask consent layer (deterministic parser, no LLM); a 4-model tournament + 5-judge mock panels (unanimous FINALIST 46.4/60).

### Fri 17 Jul
- Launch dossier (launch-viability research), info-session intel (Ben Cull's own words), pitch v3–v6.

## Verify
`npm test` (23 passing) · `npm run typecheck` · `cd ml && uv run scripts/run_experiment.py` (reproduces the ML table).
