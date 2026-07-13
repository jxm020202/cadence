# Cadence — beachhead, why-Pinch, demo, competitors, ML

> Deep pass. Order of depth: vertical (heavy) → demo → competitive → ML, with the "why Pinch / who they replaced" lens underneath.

## WHY PINCH — what they solved, replaced, and pitched (the spine a judge nods at)
**Pinch closed the gap Xero left open:** a service business could *invoice* but had no automated, self-reconciling way to *collect* — so it chased invoices and reconciled bank statements by hand. Pinch fused a payments engine to invoice-sync and became **accounting-native direct debit — the payment AND the reconciliation, back into the ledger, in one motion.**
> One sentence: *"Pinch turned 'I sent the invoice' into 'the money's in the bank and reconciled' — automatically."* Its moat was never the rail; it was **living inside the books.**

**Who/what they displaced (competitor analysis):**
- **Manual bank direct debit + spreadsheet chasing** — the real enemy. Homepage: *"Because Invoices Don't Pay Themselves… without chasing clients or wrangling spreadsheets."* Testimonial: *"Every Pinch line on our statements represents a lot of manual work we're just not doing anymore."*
- **Ezidebit** (the incumbent AU bureau) — Pinch attacks it on **monthly minimum fees** (Ezidebit up to $75/mo vs Pinch none) and **"no native accounting sync"** vs Pinch's two-way Xero sync. Real switch quote: *"Forced to change by a sudden minimum monthly fee 4× what I'd been paying, I found Pinch."*
- **Stripe** — Pinch concedes Stripe is cheaper on headline cards but **reframes**: Stripe is *transaction-focused / individual businesses*; Pinch is *accounting-led / invoice + recurring collection* with DD, batch, instalments, payment plans, and free two-way Xero/MYOB/QuickBooks sync + **human AU support**.
- **GoCardless** — positions as *"the #1 alternative to GoCardless,"* core attack: *"unlike GoCardless, Pinch supports BOTH direct debit AND cards from one platform"* + deeper accounting sync + local support + a migration path.
- **Pricing as a weapon:** BECS **1% + 30c capped at $5**, no setup/monthly/minimums, surcharging allowed — "pay-as-you-go, cancel anytime" vs incumbents' monthly minimums.

**Pitch evolution:** SMB *"get paid on time"* (accountant/bookkeeper + Xero-app-store led) → **Glassbox: "Australia's pioneering PayFac-as-a-Service"** (sell the rails/compliance/onboarding to ISVs). Classic move from selling the product to selling the rails underneath.

**Exit validates it:** Fiserv paid **~US$365m** (incl. earn-out) for the ~2,000-merchant book **and especially Glassbox**; Cull said the offer was *"double what we thought the business was worth."* The **infrastructure**, not the SMB app, commanded the premium.

**How Cadence extends the spine:** Pinch already holds the three assets every recovery vendor lacks — **the BECS rail, the invoice/ledger context, and the accounting workflow** — yet its own failed-payment handling is a **static, user-set re-attempt rule** (retry in N days, M times). It has the ledger that knows when the payer gets paid and does nothing with it. **Cadence is the missing brain on the one platform that already has the body.** (Cull's "improve one part": the proven model is accounting-native collection; the one part we improve is **timing**.)

## THREAD 1 (heavy) — the beachhead vertical: GYMS / FITNESS
**Chosen: gyms & fitness studios (AU).** Runner-up / slide-2 expansion: **childcare & OSHC gap fees.**

**Why gyms win the beachhead:**
- **Worst failure economics of any vertical** — discretionary **fortnightly** debits on tight budgets; punitive dishonour fees (a documented **$15 fee on a $15/week plan**); **30–40% annual churn, up to ~40% of it involuntary** (loyal members who never chose to leave, often don't notice the draft stopped).
- **A published, citable ROI proof in the exact vertical:** **EFM Health Clubs (60+ clubs, ~7,500 members): decline rate cut ~15% → 3%**, admin 22 hrs/mo → 2 (via incumbent Ezypay). *This is the outcome Cadence sells — already real, judge-verifiable.*
- **Market:** ~6,500 AU gyms/fitness centres, ~$3.7bn industry. Fitness is *the* archetypal recurring-DD market (Ezypay was literally founded out of a gym in 1996).
- **Commercial case (per 1,000-member studio):** ~$520k/yr billed → ~15% naive decline = ~$78k/yr fails → lifting 15%→3% recovers **~$62k/yr**, plus involuntary-churn members retained at ~18-mo LTV. **ACV ~$3–6k/site/yr, success-priced.**
- **Channel:** franchise HQs (F45, Anytime, Jetts, EFM) = many sites per deal; fitness software (Mindbody, Clubware, Hapana, GymMaster); DD bureaus themselves — one integration reaches thousands of sites.

**Why childcare is the expansion, not the beachhead:** direct debit for CCS **gap fees is legally mandated** (Family Assistance Law; extends to FDC/IHC Jan 2026) — removing the biggest GTM objection and giving structural lock-in via the concentrated CCMS channel (Xplor/Xap/Kidsoft). But mandate + session-cycle complexity + enterprise sales make it **too heavy to WIN in 10 days.** Name it slide 2 as where the same engine becomes **compliance-grade, locked-in revenue**. *(Myth-buster for the room: **NDIS is NOT a DD beachhead** — headline funds are agency-paid via myplace, not debited from participants.)*

## THREAD 2 — demo mechanics: the time-travel recovered dollar
Hero beat = **one debit fails before payday → Cadence re-times it → time-travel forward → it settles**, real money-movement on the Pinch sandbox.

**API spine (verified calls):** `S0` POST `auth.getpinch.com.au/connect/token` (bearer; `pinch-version` on every call) → `S1` POST `/payers` (create "Dana") → `S2` POST `/payment-sources` (test bank BSB 012-001 / acct 987654321) → `S3` POST `/payments` A: $45, `transactionDate` pre-payday, **`#insufficient-funds` in description** (documented sandbox tag that forces a real dishonour) → `S4` GET A with header `Time-Travel:<bank-window>Z` → **DISHONOURED (red)** → `S5` POST `/payments` B: same payer/source/amount, `transactionDate=payday`, clean description (Cadence's *only* edit is the date) → `S6` GET B with `Time-Travel:<payday+1>Z` → **SETTLED (green)**, `transfer` event fires, recovered counter rolls $0→$45.

**60s cut:** split screen (Dana's timeline + $0 counter) → "run to bank date" → red DISHONOURED, "$45 at risk" → "Cadence re-times to payday" (card animates 14th→28th) → "time-travel to payday+1" → green SETTLED, counter → $45. Tag: *"One debit. Re-timed to payday. $45 recovered — same rails, better timing."*

**Honest on stage — API-driven vs our layer:** real = payer/source/payment objects & ids, the dishonour (forced via tag but returned by the sandbox bank-result pipeline), the Time-Travel clock, B honouring → transfer → settlement, all event payloads. Our layer = the timeline UI + red/amber/green chips + the $-recovered counter (Pinch has no "recovered" concept). **No money-movement is faked** — candour is a feature with Cull.

## THREAD 4 — competitive / pricing / whitespace
- **GoCardless Success+**: ML retry on the payer's likely-funded day; recovers ~70% of failures; **priced as a % uplift on recovered volume**; enterprise, ledger-blind, bank-only.
- **Stripe Revenue Recovery / Smart Retries**: **~0.7–0.75% of recovered revenue**; card-first, payment-silo.
- **Recurly / Churn Buster / Butter / Gravy / Chargebee**: dunning/retry layers, mostly card + subscription-silo, flat or %-of-recovered.
- **AU incumbents (Ezidebit / Ezypay / Debitsuccess)**: "recovery" = **rules-based dunning that profits from the ~$10–15 dishonour fee** — misaligned with the merchant.

**Cadence differentiation (one paragraph):** the analogs prove the thesis (retry on the funded day recovers ~70%) but are **payment-silo and ledger-blind**, and either **tax all healthy volume** (Stripe/Chargebee 0.7–0.75%) or take an **opaque enterprise rev-share** (Success+) that only pencils above ~$10M ARR. The AU install base Cadence targets **isn't even on them** — it's on legacy BECS bureaus whose "recovery" is dumb dunning that *profits from the dishonour fee*. Cadence fuses the two halves the market keeps apart — **the ledger that forecasts cash but never acts, and the rail that reacts but is ledger-blind** — predicting the funded date from invoice history + payday signal, representing on that date, and framing the result as **forward cash flow to the owner** ("$X clears Tuesday") not a recovery % to a payments team. Ships **Pinch-native** as the brain on Pinch's static re-attempt rule, and prices as a wedge: **no tax on healthy volume, no ARR floor, and — the line for Breeze — we don't make money when a payment fails; we're paid only when a debit that would have bounced actually settles.** Aligned interests, waste removed.

## THREAD 3 — ML credibility (what Cull will inspect)
- **Synthetic AU BECS ledger as a per-payer latent simulator**: hidden **pay-cycle** (weekly/fortnightly/monthly) + **daily balance random-walk** + **terminal-code hazard**; labels *emerge* from a balance-vs-amount check crossed with days-to-payday. **Pay-cycle is never a feature — the model must reconstruct it from timing** (a lookup can't). Calibrate to published figures (**~2.9% overall dishonour, >80% insufficient-funds, ~15% mandate-cancelled**), asserted in tests.
- **Baselines to beat (same harness):** B0 base-rate (2.9%, calibration floor); B1 naive same-day retry (strawman); **B2 "payday+2" heuristic — a genuinely good rule. Beating only B1 proves nothing; the model must beat B2** on recovered-$ and wasted-retry count.
- **Metrics (4):** PR-AUC (honest on ~3% minority), calibration/Brier, **recovered-A$ lift curve** (the money chart), wasted-retry rate.
- **Credibility visual:** **partial-dependence of settlement-prob vs days-to-payday, faceted by pay-cycle** — must show dip-before / jump-after, with the jump on a *different* offset per cycle. Because days-to-payday is inferred, a clean shape proves the model recovered the hidden cycle from timing alone — **falsifiable, un-fakeable.**
- **Ablation:** turn interactions OFF → model then *can't* beat payday+2 → proves the lift is structural, not overfit.
- **Split discipline:** GroupKFold **by payer** (never by row) — the exact thing Cull looks for.
- **Honest claim:** synthetic validates the **method, harness, and that the money-lever exists** if AU payers behave like published figures; **the real number needs a back-test on real BECS data** — said out loud.

## OPEN QUESTIONS / RISKS (resolve before/at build)
1. **⚠️ DAY-ONE SPIKE (gating):** does advancing `Time-Travel` on a GET actually flip a scheduled BECS payment pending→dishonoured→settled, or is a scheduled-process/webhook tick required? The `#insufficient-funds` tag and `Time-Travel` header are both confirmed, but the **read-triggers-transition** behaviour is not. Build a ~20-line spike (token→payer→source→payment A→time-travel GET) and confirm before committing the UI.
2. Can **A (dishonour at T0) and B (settle at payday+1)** be sequenced under distinct time-travel timestamps in one clean run on the same payer/source, without the payday+1 jump re-triggering A? If fiddly, script deterministically.
3. **Numbers honesty:** the 2.9% / 80% / 15% figures are **GoCardless's UK book, not AU-specific** — label "UK benchmark, pending AU back-test"; don't assert as AU fact in a payments-savvy room.
4. **Rail realism in the generator:** failures return in 1–2 business days; files exchange ~6×/weekday with afternoon cutoffs; processors cap auto-retries ~2 in 30 days. Cadence's edge is choosing *when* to represent within those limits, not infinite retries.
5. **Positioning tightrope:** lead the demo **additive** ("we lift Ezidebit/Ezypay recovery" — safe, Pinch-native), close with the **"this belongs inside Pinch"** ask; don't muddle them.
6. **Scope:** pre-compute the re-time date (a pre-trained model scoring the demo payer is enough); don't let model plumbing eat demo-polish budget. Show live-training story as the PDP + lift curve, not run on stage.

## Decision
**Build Cadence for gyms/fitness; win on the time-travel recovered-dollar demo; position as an additive re-timing layer on Pinch's rails that supplies the per-payer timing intelligence Pinch's static rule lacks; differentiate on ledger-embedded + success-priced ("we don't profit from failure"); name childcare gap fees as the locked-in expansion.** Spike the two time-travel mechanics on day one before building UI.
