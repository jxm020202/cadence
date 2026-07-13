# Cadence — pitch v3 (post–panel-2)

> Changes from v2 (panel 2: unanimous finalist 40/60; founder_signal 8.25 = highest; weakest = spectacle 6.25, commercial 6.0):
> ML story now LEADS with the ablation collapse (the un-fakeable artifact) instead of the synthetic 46%;
> cold-start conditioning disclosed before Cull asks; the Fiserv-clones-this moat answer; Breeze's
> five proof items as an explicit checklist; $29.90 drilled as THE number, opening and closing.

**[0:00 — cold open]**
Dana pays $15 a week for her gym. Her debit bounced three days before payday — and the biller charged her **$29.90. Twice her membership. Remember that number: for the incumbents, the failure IS the revenue.** The gym never noticed until she quit.

**[0:20 — problem]**
Direct debits fail ~2.9% of the time on GoCardless's 55,000-merchant book — the best published benchmark; the AU-specific number is exactly what our pilot measures. **More than 80% of failures are just insufficient funds** — money that exists, arriving days later. For gyms that compounds into 30–40% churn, much of it involuntary. The fix isn't chasing harder. It's timing.

**[0:45 — why Pinch + prior art, named first]**
GoCardless's Success+ proved the mechanism — ML-timed retries, ~70% recovery — on *their* rail, priced for enterprises, *after* the fee has landed. Pinch's own docs say: *"It's up to you to schedule a new payment when one fails."* Fiserv's decline ML is cards-only, US. **The AU bank-debit rail that Australian SMBs actually collect on has nothing. That's the gap.**

**[1:05 — what Cadence does]**
A LightGBM model scores **P(dishonour) for every scheduled debit**. On a soft failure, Cadence gates the return code — account-closed and mandate-cancelled are *never* retried — then picks the payer's likely-funded day and schedules the recovery **through Pinch's own save-payment endpoint**. Consent by design: the default is the BECS-customary post-failure retry; pre-due-date moves are opt-in with an SMS and one-tap out.

**[1:30 — demo]**
Dana, live: the model prices her Thursday debit at **64% risk** — *(drag the debit across the calendar; the curve re-scores in real time — collapsing to 25% the day after payday, spiking to 74% at the next trough)* — **every date has a price, and this curve was learned, not configured.** Run to the bank date: dishonoured. Cadence scores all fourteen candidate days and picks day +9 — that number on screen is the booster's output, not a script. Time-travel forward: **settled. $45 recovered.** Same rails, same authority, better timing. *(demo-integrity line per current truth: live payloads if keys landed, else "payloads are byte-exact to Pinch's documented shapes, labelled MOCK; the model and decision loop are live.")*

**[2:00 — the ML: lead with the kill-switch, then the caveats]**
Here's the artifact I'd ask you to check first: **when we strip the hidden pay-cycle structure out of the training world, the model's AUC collapses from 0.913 to 0.501 — a coin flip — and it stops beating the payday heuristic.** That ablation is the proof the lift is learned structure, not leakage — you can't fake it. Three disclosures before you ask: the training ledger is **synthetic** (calibrated to published benchmarks — the mechanism is proven, the production number needs a real back-test: that's the pilot); the pay-cycle estimate needs **~2 prior failures per payer** (cold-start warms from network dishonour history — which is Pinch's data, more on that in a second); and the recovery deltas are conditioned on that history existing.

**[2:25 — moat, or: "won't Fiserv just build this?"]**
They should — **and that's the plan, not the risk.** The model is commodity; the moat is the **cross-merchant payday prior** that only forms inside Pinch's ledger — a payer who bounces at merchant A predicts risk at merchant B. I can't own that data from outside, and neither can GoCardless. So Cadence is built as the **reference integration**: the fastest path for Pinch/Fiserv to own this capability is the person who already built it on their rail. *(the audition line, delivered with a smile)*

**[2:40 — business + close]**
Pricing: **15% of recovered dollars, nothing otherwise.** A 1,000-member studio recovers $5–15k/yr → $1–2k ACV, zero if we recover nothing. The incumbents charge the member **$29.90 when a payment fails; we charge only when it lands.** Beachhead fitness; childcare gap fees next — direct debit is legally mandated there; the same engine scales to Glassbox portfolio risk. Pinch turned *"I sent the invoice"* into *"the money's reconciled."* **Cadence turns "$29.90 for failing" into "$45 recovered."**

---

## Breeze's five proofs (the flip-to-win checklist — status tracked honestly)
1. ☐ **Live sandbox recovery** — real payer id, raw payloads on screen (GATED: sandbox keys)
2. ☐ **Subscription-occurrence mutability verified** in TEST mode, answer reported either way (GATED: keys)
3. ☑ **Pricing disclosed** — 15% of recovered, unit economics on the slide
4. ☑ **Failure-mode walkthrough** — Time-Travel fallbacks (a/b/c) pre-agreed and rehearsed
5. ☑ **Production shipping signal** — webhook HMAC on raw body, cents, pinch-version pinned, hard-code gate: the five details nobody else gets right

## Q&A bank (v3 additions)
- **"Cold start?"** → disclosed in the pitch: ~2 failures per payer for the cycle estimate; production warms from network history + merchant billing anchors; day-one merchants get the risk-score without the timing head until history accrues.
- **"What if the real back-test says 20%, not 46%?"** → then the product is a 20%-recovery product priced at 15% of recovered — the model's economics never depend on the synthetic number being right; that's why we price on outcomes.
- **"Why is Dana's history exactly 2 NSFs?"** → because that's the minimum the estimator needs — it's the honest boundary case, not a cherry-pick; the demo shows the model working at the edge of its stated conditions.
