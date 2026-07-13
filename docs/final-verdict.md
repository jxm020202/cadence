# FINAL VERDICT — stick with Cadence (adversarially confirmed)

> Output of the kill-Cadence / beat-Cadence / verify-mechanics red-team. Decision: **BUILD CADENCE.**
> Alternatives scored: Cadence ~102/120 · "Second Ask" (conversational recovery agent) 88 · "Onboard" (managed-merchant AI) 84 · "Chase" (Xero collections copilot) 80 · "Horizon" (forecast+capital) 74 · "Bridge" (PayTo migration) 58.
> No rival beats the judge double-lock + ML-edge + verified-whitespace combination.

## The five binding changes the red team forced

1. **COMPLIANCE INVERSION (the big one).** Standard BECS DDR service agreements require written notice (14–30 days) for merchant-initiated changes; debiting *earlier* than authorised is unauthorised-debit territory. So: the shipped **default act = payday-timed retry AFTER a dishonour** (customary — the exact Success+ analog). **Pre-due-date re-timing never debits earlier than authorised and ships only behind an explicit payer "flex-day" opt-in** in the DDR terms, with per-move SMS notice + one-tap opt-out. Compliance slide framed as a feature: *"consent is the product."*
2. **NAME SUCCESS+ FIRST.** Breeze (ex-GoCardless ANZ GM) will name it from the judging chair otherwise — GoCardless even has a fitness case study (Lifestyle Fitness, 71.6% recovery). Our slide names Success+ (~70% recovery, available on BECS AUD), then positions Cadence as **predict-and-prevent with consent, on Pinch's rail**, quoting Pinch's own docs — *"It's up to you to schedule a new payment when one fails"* — as the whitespace proof. Claim narrowly: **"Fiserv has this for cards (Commerce Hub Auth Optimization, US); nobody has it for AU BECS."** Kill the unverifiable EFM 15%→3% stat; sourced figures only.
3. **DEMO HONESTY ARCHITECTURE.** Dishonour forcing lives in the payment **description** (per-payment knob: payment A carries `#insufficient-funds`, retry B is clean), never the payer first name (that would fail B too). The forced failure is **disclosed on the demo slide** — Cull wrote this sandbox and reads the repo. Day-0 Time-Travel spike is a hard gate with three pre-agreed fallbacks: (a) realtime payments instant red→green (documented; labeled "sandbox-compressed timeline"), (b) pre-run the real scheduled sequence a day early + replay genuine captured events, (c) payload-exact local replay harness with live create/re-time calls. Pre-record the fallback video the first day the live run is green.
4. **SELF-INDICTING ML.** Disclose the synthetic ledger before Cull asks. Generator includes **adversarial confounders** (gig income, shared accounts, fee-induced churn). The **payday+2 heuristic is the published baseline** LightGBM must beat. PDP-by-pay-cycle is the credibility artifact. Cold-start story: *"production trains on Pinch-network dishonour-code + retry-outcome history and merchant billing anchors — Pinch never sees payer bank data."*
5. **RE-AIM THE TAGLINE + WIDEN THE WEDGE.** *"We don't profit from failure"* targets **Ezidebit's $29.90 payer fee + $9.90 merchant fee and Debitsuccess's $14.95** — never Pinch's $5 fee (don't lob a grenade at the host). Gyms = the 60-second-video **story**; the claimed wedge = **"any Pinch merchant running weekly consumer debits"**, childcare gap fees named as the truer long-term beachhead. Add the on-screen **payer SMS beat** ("Your gym payment moved to Fri 26th — your payday") — one Twilio-sandbox call that steals the only dimension a rival won.

## Demo-mechanics verification (docs-only) — GREEN with one day-0 spike
- **Time-Travel header confirmed verbatim** (`Time-Travel: <ISO8601>Z`, "treat this request as though it arrived at this time") — but docs define it request-scoped; marketing promises full-process simulation ("simulate the entire payments process at any date in the future"). **Whether a time-travelled GET/List-Events shows a scheduled payment processed is the one unverified link.** Neither the Postman collection nor the .NET SDK implements the header (verified by grep) — it's exercised only by Pinch's own Dev Portal.
- **Dishonour forcing confirmed verbatim** (per-payment via description; 7-code table; insufficient-funds retry:Yes, blocked-by-bank retry:No).
- **Re-timing is a first-class documented operation**: save-payment updates when an ID is supplied; "Scheduled payments can be updated or deleted before they are processed." *The intervention uses Pinch's own designed-for mutation path* — strong pitch line.
- **Event payloads published** (bank-results with `Dishonour {Type, Reason}`, scheduled-process, transfer) → the demo UI can be built payload-exact **before keys arrive**.
- ⚠️ **Unverified:** whether **subscription-generated** payment occurrences are mutable (real gym plans are subscriptions) — check day 1.

## Day-0 spike (first hour with sandbox keys)
POST /payments {transactionDate: today, description "…#insufficient-funds"} → GET payment + List Events with `Time-Travel: +3 days` → does state flip? Also verify save-payment re-timing on a scheduled payment + subscription-occurrence mutability. Rehearse the realtime fallback regardless.

## Build order (hackathon-live)
1. Day-0 spike (needs sandbox keys — **user must create the Pinch developer account**).
2. Days 1–2: the compliant loop end-to-end — bank-results → payday-timed retry via save-payment — live on sandbox. One payer, one re-timed debit, one recovered $15, reproducible. Capture genuine payloads for the replay fallback.
3. Days 3–5: synthetic ledger generator (hidden pay-cycles + confounders) → LightGBM vs payday+2 → PDP plot. Wire scores into the loop.
4. Days 6–8: demo UI payload-exact (buildable now), red→green recovered-dollar view, flex-day opt-in toggle, SMS beat.
5. Day 9: choreography + rehearsal; pre-record fallback video.
6. Days 10+: 60s video, deck (Success+ slide, compliance slide, self-indicting ML slide), repo polish for a code-reading judge.
**Cut from build (slideware only):** childcare, Cadence Capital, Glassbox portfolio, agentOS, dashboards, auth, multi-merchant.

## The room answer to "isn't this just Success+?"
> "Success+ is the proof, not the competitor — it recovers ~70% of failures *after* the fee has already landed, on GoCardless's rail. Cadence predicts the dishonour before it happens and, with the payer's opt-in, moves the debit to their payday on Pinch's rail — where the docs still tell merchants *'it's up to you to schedule a new payment when one fails.'*"

## Residual risks (watch-list)
- Time-Travel scheduled-processing behaviour is folklore until spiked (fallbacks preserve the moment but compress onto card rails).
- Flex-day opt-in is a design answer, not legal clearance — the safe floor is that the DEFAULT mode is unambiguously customary.
- Subscription-occurrence mutability unverified.
- Synthetic-data circularity can be disclosed + confounded, not eliminated.
- Demo-night fatigue: expect multiple AI-retry pitches (the sandbox prescribes the idea) — differentiation rests on the **actuator** + demo craft.
- Solo scope survives exactly one undocumented-sandbox surprise; scope discipline is load-bearing.
