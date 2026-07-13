# Cadence — pitch v2 (post–panel-1)

> Changes from v1 (panel round 1, 36/60, "finalist-conditional"): the demo line is now HONEST
> (no claim of live API calls until the sandbox run exists); added the commercial math,
> degradation/cold-start/data-access answers; model is now literally in the loop (day +N on
> screen IS the booster's output). Everything else unchanged — the strategy scored 7+.

**[0:00 — cold open]** *(unchanged from v1)*
Dana pays $15 a week for her gym, by direct debit. Last Tuesday it bounced — her balance dipped three days before payday. The biller charged her **$29.90 — twice her membership** — and the gym never noticed until she quit. Nobody chose any of this. The debit just landed on the wrong day.

**[0:20 — problem]** *(unchanged)* ~2.9% of AU direct debits fail; >80% are just insufficient funds — money that exists, arriving days later. Gyms: 30–40% churn, a big slice involuntary. Late/failed payments: $1.1B/yr.

**[0:45 — why Pinch + name Success+ first]** *(unchanged)* Success+ proves the mechanism (~70% recovery) — on GoCardless's rail, priced for enterprises, *after* the fee has landed. On Pinch the docs say: *"It's up to you to schedule a new payment when one fails."* Fiserv's decline ML is cards-only, US. **Nobody has this for AU BECS.**

**[1:10 — what Cadence does]** *(unchanged — gate + consent inversion)*

**[1:40 — the demo, HONEST version]**
Here's Dana. Her $45 debit — the model scores it, live, right now: **64% dishonour risk**. It fails: insufficient funds. Cadence gates the code — retryable — then **the trained model scores all fourteen candidate days and picks day +9, her likely-funded day**. That number on screen is the LightGBM output, not a script. The recovery goes through Pinch's own save-payment endpoint — and when the funded day arrives: **settled, $45 recovered**.
*[IF LIVE RUN EXISTS BY RECORDING]:* "Every call you just saw hit the Pinch sandbox — here are the raw payloads."
*[IF NOT — fallback line, disclosed]:* "The payloads you see are byte-exact to Pinch's documented events; the model and the decision loop are running live, and the sandbox wiring is the day-one task with API keys — the code path is one and the same."

**[2:05 — the ML, honestly]** *(tightened)*
Disclosed synthetic ledger, calibrated to published failure benchmarks. The model **rediscovers each payer's hidden pay-cycle from timing alone** and beats a payday-heuristic baseline **46% to 38%** recovery on held-out payers, ablation-checked against leakage. Three honest limits, before you ask: **(1) degradation** — gig-income and shared-account payers are in the generator, but the real curve needs a back-test on a real BECS ledger — that's the pilot we're proposing; **(2) cold start** — a new payer needs ~2 failures before the cycle estimate exists; production warm-starts from network-wide dishonour history and merchant billing anchors; **(3) data access** — that network history is *Pinch's* data, which is exactly why this belongs inside Pinch rather than bolted on from outside.

**[2:30 — business + close]**
The math: Pinch's book is ~2,000–4,000 merchants; the wedge is any merchant running weekly consumer debits. A 1,000-member studio bills ~$520k/yr; at published failure rates with our recovery delta, Cadence returns **$5–15k/yr per site**, and we take **15% of recovered dollars only** — ~$1–2k ACV/site, $0 if we recover nothing. **We don't profit from failure** — unlike the incumbents charging members $15–30 a bounce. Beachhead fitness; then childcare gap fees (direct debit is legally mandated); the same risk engine scales to Glassbox portfolio risk and embedded capital. Pinch turned *"I sent the invoice"* into *"the money's reconciled."* **Cadence turns "the debit bounced" into "the debit landed on the right day."**

---

## Q&A bank (updated with panel round-1 answers)
- **"Was that demo live?"** → the decision loop and model: yes, always (the day+N on screen is the booster). The Pinch payloads: [live once keys exist / byte-exact documented shapes until then — stated on the slide]. Never claim more than what ran.
- **"Subscriptions?"** → real gyms run Plans/Subscriptions; occurrence mutability is a day-one TEST-mode check, and we report the answer either way. If occurrences can't be re-timed, the loop schedules the recovery as a standalone payment — same authority, same outcome.
- **"Your 46% is your own generator's knob"** → correct — which is why we also ship the ablation (no structure → no lift) and why the number we stand behind is the *mechanism*, not the effect size. The effect size comes from the pilot back-test.
- **"Why won't Pinch just build this?"** → they should — that's the point of a reference build. The moat isn't the model, it's the network payday prior — which is Pinch's data. This is an inside-the-tent product; that's the conversation we want.
- **"What does the merchant actually configure?"** → nothing. Default = post-failure payday-timed retry (BECS-customary). Flex-day (pre-due-date moves) is per-payer opt-in with SMS + one-tap out.
