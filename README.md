# Cadence

**ML dishonour prediction + payday-timed recovery on the Pinch Payments API** — built for the
[Pinch Me! I Want 50K](https://pinch-me-i-want-50k.devpost.com/) hackathon.

Pinch's own docs say *"It's up to you to schedule a new payment when one fails."* Cadence is that
missing brain: a LightGBM model predicts P(dishonour) per scheduled BECS debit and — after a soft
failure — picks the payer's likely-funded day and re-schedules the debit **through the Pinch API**
(save-payment, Pinch's own designed-for mutation path). Default mode is the BECS-customary
post-dishonour retry; pre-due-date re-timing only ships behind explicit payer opt-in.

## Run it in 30 seconds
```bash
npm install
cp .env.example .env      # add your Pinch TEST keys (app_test_/sk_test_/pk_test_)
npm start                 # http://localhost:3000  → the recovery demo
# PINCH_MODE=live npm start   # same demo, but driven by REAL sandbox calls (real pyr_/pmt_ ids)
```
**A judge's 60-second tour:**
- **`/` → the recovery demo** — predict → dishonour → Cadence **silently re-times the retry to payday** (a re-presentation under the existing mandate, no member contact) → a **real recovery payment** with a real `applicationFee`. The API pane shows every call; the badge shows **LIVE** vs mock. (Consent is reserved for the account-closed / hardship edge case.)
- **`/merchant.html`** — the gym operator's retention cockpit: this fortnight's debit run **risk-ranked by the live model**, silent saves, projected recovered $.
- **`/proof.html`** — the model teardown: 0.913 held-out AUC, the ablation that collapses to 0.50 when the signal is deleted (no leak), the recovery ladder, and calibration — the evidence it's a real trained model, not a prompt.
- **What's real vs simulated (honesty contract):** payer, source, payment, recovery + `applicationFee` are **real sandbox calls**. The only thing labelled **SIMULATED** is the dishonour→settle *transition* — the sandbox batch won't process a scheduled BECS debit on demand (proven in `scripts/spike*.ts`; processed-list stays 0). We label it rather than fake it.
- **Tests:** `npm test` — incl. the end-to-end `bank-results → gate → LightGBM → recovery` loop and the webhook signature verify. ML: `cd ml && uv run scripts/run_experiment.py`.

## ML results (disclosed-synthetic AU BECS ledger, held-out payers)
| Retry strategy | Recovery rate | Recovered A$ (of $551k at risk) |
|---|---|---|
| Naive next-day | 14.5% | $66k |
| Payday+2 heuristic (same estimator) | 38.0% | $177k |
| **Cadence model** | **46.0%** | **$235k** |
| Oracle ceiling | 84.0% | $454k |

Risk model AUC 0.913 / PR-AUC 0.464 (base 0.030), Brier 0.0198. **Anti-leak ablation:** with the
generator's interactions switched off the model scores AUC 0.501 and does *not* beat the heuristic —
the lift is structural, not leakage. The pay-cycle is a hidden latent the model must reconstruct
from timing (see `ml/outputs/payday_pdp.png`). Calibrated to published direct-debit benchmarks
(~2.9% dishonour rate, >80% insufficient-funds, amount-banded rates) — labelled as UK GoCardless
benchmark figures pending a real-ledger back-test. Synthetic proves the **method and harness**;
the production number requires a back-test on a real BECS ledger.

```bash
cd ml && uv sync && uv run scripts/run_experiment.py   # --fast for a quick pass
```

## The Pinch API spine
What's wired up (all verified against the live docs — see [`docs/pinch-api-reference.md`](docs/pinch-api-reference.md)):

- **OAuth token auth** with in-memory caching (`src/pinch.ts`)
- **Realtime card charge** driven by client-side **CaptureJs** tokenisation (`public/checkout.html`) — no PCI scope
- **Payment Links** (hosted checkout you can send by SMS/email)
- **Webhook receiver** with correct **HMAC-SHA256 signature verification** (`src/webhook.ts`)
- Thin Express API so a browser demo can drive it (`src/server.ts`)

## Run it

```bash
cp .env.example .env      # then fill in your Pinch sandbox keys
npm install
npm run dev               # http://localhost:3000  (checkout demo at /checkout.html)
```

### Get sandbox keys
1. Sign up / log in at <https://web.getpinch.com.au> and switch to **TEST** mode.
2. **API Keys** → create an Application → copy the **Application Id** + **Secret** into `.env`.
3. Copy the **pk_test_…** publishable key into `.env` and into `public/checkout.html`.
4. (For webhooks) create a webhook pointing at your tunnel URL (`…/webhooks/pinch`); copy the returned secret into `PINCH_WEBHOOK_SECRET`. Use `ngrok`/`cloudflared` to expose localhost.

### Try the flow
- `GET /api/health` → confirms auth + connectivity.
- Open `/checkout.html`, hit **Pay** → CaptureJs tokenises the card, server charges via `/payments/realtime`.
- `POST /api/payment-links {amount, description}` → returns a hosted checkout URL.
- Point a Pinch webhook at `/webhooks/pinch` → watch verified events log.

## Next
Pick the build (see the concept shortlist in chat). The spine already covers charge + links + webhooks;
recurring (`Plan`/`Subscription`) and marketplace splits (`applicationFee`) are one helper away in `src/pinch.ts`.
