# Pinch: the wedge, and where our ML actually wins

> Research-backed (positioning + competitor-ML + whitespace check + adversarial Pinch-founder critique).
> One-line thesis: **Pinch's edge is cheap recurring BANK direct debit — which fails a lot, and they handle
> failures with dumb static rules. Our edge is a real ML model that predicts and re-times those failures.
> Those two edges fit together.**

## Why Pinch exists (the "why", in the founders' words)
- Founded ~2017 by **Ben Cull + Paul Allen** (ex-engineers at a direct-debit firm, "Easy Debit"). Sketched on napkins in a UK pub. Philosophy (Cull): *"We weren't inventing a brand-new category — we were adapting a proven model for the Australian market."*
- **The wound:** SMB cash flow. **>50% of invoices to Australian small businesses are paid late**; businesses without overdue payments grow ~3× faster. Tagline: *"Because Invoices Don't Pay Themselves."*
- **The wedge:** direct-debit-first recurring collection, **embedded in accounting software (Xero/MYOB/QuickBooks)**, distributed **through accountants/bookkeepers**. Highest-rated payments app on the Xero store.
- **Up-stack:** later built **Glassbox = "PayFac-as-a-Service"** for software platforms (ISVs). This platform/payment-data layer is where the defensibility sits — and is **what Fiserv bought (Apr 2025)** to expand APAC + Clover.

## What separates it (and where the ML leverage hides)
- **BECS direct debit economics:** ~**1% + 30c capped at $5** vs cards ~1.95%+ uncapped. Cheaper for recurring collection → that's the moat vs Stripe/card-first players.
- **The catch that creates our opening:** direct debit **dishonours** (insufficient funds, etc.) and settles slowly (1–3 business days; dishonour notice 3–5). Failed debits = lost revenue + **involuntary churn** (up to ~40% of subscription churn industry-wide).
- **Tailwind:** the **RBA card-surcharge ban (from ~Oct 2026)** makes cheap-but-flaky bank debit more strategically valuable to protect — right when this hackathon runs.

## The whitespace (confirmed)
Pinch's failed-payment handling **today is purely rule-based**: the merchant sets a **fixed retry frequency + count**, a **static "retryable vs fatal dishonour" table**, and a **manual re-process button**. **No prediction. No dynamic timing. No churn scoring.** (Note: `pinch.ai` is an unrelated US company — Pinch Payments' own AI footprint is ~nil.) This is a clean gap.

## The proven benchmark (so this isn't speculative)
- **GoCardless "Success+"** — the closest analog — is a gradient-boosted model on 9 years of direct-debit data that predicts the **optimal retry day** for insufficient-funds failures. Claims: **recovers up to ~70%** of failed payments, **cuts failures ~29%** vs manual retry, 20k+ businesses.
- Stripe Smart Retries / Slicker / Gr4vy report **70–85% recovery**. **Scheduling a debit a few days after payday is the single biggest lever.**

## The build we're greenlighting: "Success+ for Pinch" (real ML, honest scope)
One **LightGBM/XGBoost classifier** that scores **P(dishonour)** for a debit, reused two ways:
1. **Pre-submission risk flag** — warn / re-time before burning a $5–$35 dishonour fee.
2. **Payday-aware optimal retry date** — argmax over candidate dates after a soft failure (the Success+ move).

**Non-negotiables that signal payments literacy to the judges:**
- **Hard return-code gate:** only retry **soft/NSF** codes; **never** retry hard codes (account-closed, mandate-cancelled). The restraint is the credibility signal.
- **Every metric in recovered A$ and days-to-cash**, against a stated naive-retry baseline. Hero demo = one before/after screen: a debit at ~40% risk → re-timed → <10% → *a payment naive same-day retry would have lost, collected live* (driven through the Pinch API + Time-Travel).

### Features (all derivable from Pinch's data model)
`amount`, `amount vs payer's mean`, `day-of-month`, `days-to-inferred-payday`, `payer tenure / mandate age`, `prior return-code counts`, `source type`, subscription context.

## The honesty caveats (bake these into the pitch — they win trust)
- **No production ledger in the sandbox** → we train on **disclosed synthetic data**, calibrated to published AU dishonour rates (~2–6%) and GoCardless failure-cause splits. Synthetic proves the **mechanism**, not the actual uplift number. Say this out loud.
- **The real moat is production-only:** Pinch's **cross-merchant payday/return-code history** (a payer who dishonours at merchant A predicts risk at merchant B — a genuine network effect). We pitch it as the moat, not the deliverable.
- **Cold-start** (brand-new payers, no history) is genuinely weak; don't oversell it.

## Cut list (scope discipline)
LLM-in-the-loop • deep nets / TabTransformers • standalone cash-flow forecast • instalment credit-risk • optimal first-debit-date • human outreach layer • multi-rail (PayTo/cards). GBM on synthetic tabular is the right scope — Stripe and GoCardless both started with exactly XGBoost.

## The sharper framing (same engine, more defensible, flatters Fiserv/Glassbox)
Don't ship a bare retry widget (GoCardless already owns "smart retry"). Wrap the **same model** as an **accounting-embedded, cash-flow-aware debit orchestrator**: because Pinch sees **both the Xero invoice side AND the debit history**, it can tell the SMB —
> *"$4,200 of Thursday's debits are high-risk; shift 3 to the 16th to collect $3,900 you'd otherwise lose."*

That lives in the bookkeeper/Xero channel where Pinch is defensible, and the same risk score generalises to **Glassbox merchant-lifecycle risk scoring** — the exact data layer Fiserv paid for.

## DECISION (framing) — chosen deliberately, grounded in the API + the company
**Build the cash-flow-aware orchestrator, not the bare retry engine.** Same ML core; different skin and story.
Working name: **Cadence** — *"Pinch gets you paid on time. Cadence makes sure the debit actually lands."*

Why this is what's most valuable **to Pinch/Fiserv** (not just to us):
1. **Fights on Pinch's real moat — the accounting channel.** The orchestrator uses the Xero/invoice view GoCardless can't see; a bare retry widget competes on GoCardless's own turf (price/scale) and loses.
2. **It's a platform capability, not a merchant feature.** The same risk score generalises to **Glassbox merchant-lifecycle/portfolio risk scoring** — the payment-data layer Fiserv actually acquired and is scaling across APAC. Feature < platform to the acquirer.
3. **Serves their literal mission** — *"get paid on time, every time"* is a **timing** promise; predict-and-re-time is that sentence. "Recover failures" is narrower and reactive.
4. **Judge psychology.** Cull's ethos ("adapt a proven model, don't invent a category") rewards ROI on an existing workflow; Breeze rewards moat + TAM. The orchestrator has both and **dodges the "GoCardless already does this" ceiling** that kills the bare engine.
5. **No demo cost.** We keep the bare engine's visceral beat *inside* the orchestrator — one re-timed debit collected live, dollar counter — so we get the strategic frame AND the money-shot.

The bare "Success+ for Pinch" line survives only as the **one-sentence elevator description**.

## Demo script (the win is the demo)
**Hero 60s (first submission, Jul 26):** a merchant's Thursday debit run fires same-day; several bounce (NSF) via Time-Travel → Cadence re-times one high-risk debit to the payer's payday → Time-Travel forward → it **clears**; live **A$ recovered** counter ticks up. One beat, one number.

**Full 2–3 min (final, Jul 31):**
1. **Wound** — 20 debits, naive same-day run, 6 bounce: lost A$, $5 dishonour fees, churn risk (Time-Travel shows the bounces).
2. **Model** — Cadence scores P(dishonour) per debit; highlights the 6 (amount spike vs payer mean, landing 3 days *before* payday).
3. **The move** — re-time 3 to each payer's payday; **flag 1 as hard-fail (mandate cancelled → do NOT retry, prompt card update)** ← the payments-literacy beat; retry 2 on the model-optimal day.
4. **Payoff** — Time-Travel forward: re-timed debits clear. Counter: **A$ recovered vs naive, days-faster-to-cash, dishonour-fees avoided**, and **beats a smart payday+2 heuristic by W%** (proves it's a model, not a rule).
5. **Moat + platform** — "On Pinch's real ledger this compounds via cross-merchant payday priors GoCardless can't see through the accounting channel — and the same score is Glassbox merchant risk scoring, the layer Fiserv is scaling."
6. **Honesty** — synthetic, calibrated to published AU dishonour rates; mechanism proven; true uplift is production-only.

## Pitch → rubric map
Innovation (ML on a rail no one applies it to in AU) · Technical execution (real GBM + honest hold-out eval) · UX (one screen, dollars) · Commercial potential (recovery% × AU DD volume + churn saved + Glassbox upsell) · Problem solving (soft-vs-hard code gate, payday timing) · Effective use of Pinch tech (payments API + Time-Travel + webhooks + accounting context).

## Risk register (design around these)
- **Synthetic credibility** → calibrate to AU dishonour rates + GoCardless failure-cause splits; disclose openly; show a partial-dependence plot on *days-to-payday* proving the model learned the real mechanism.
- **"A rule dressed as ML"** → the model must beat a *smart* heuristic (payday+2), not just naive same-day; show feature interactions.
- **Payday inference** → in production it's a sub-model over debit history/open-banking; in the demo it's a disclosed latent. Say so.
- **Scope creep** → one model, one screen. Everything on the cut list stays cut.

## Build plan (hackathon window) — HELD until go-ahead
1. **Synthetic AU direct-debit ledger** — per-payer latent pay-cycle (weekly/fortnightly/monthly) + balance random-walk + amount dynamics → NSF label + minority hard codes. Disclosed synthetic, rate-calibrated.
2. **Train the GBM** — P(dishonour); hold out payers; report AUC/PR + lift/recovery curve + the days-to-payday PDP.
3. **Wire to the Pinch spine** — score sandbox debits; on soft failure pick the retry date and fire via the API + **Time-Travel** to show weeks of recovery in 60s.
4. **One before/after screen** — live A$ recovered vs naive AND vs payday+2 heuristic.
5. **Pitch** — the arc above.
