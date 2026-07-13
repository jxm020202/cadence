# Cadence — pitch v1 (2–3 min script)

**[0:00 — cold open, one human]**
Dana pays $15 a week for her gym, by direct debit. Last Tuesday it bounced — her balance dipped three days before payday. The biller charged her a **$29.90 dishonour fee — twice her membership** — and the gym never noticed until she quit. Nobody chose any of this. The debit just landed on the wrong day.

**[0:20 — the problem, sized]**
Australian direct debits fail about **2.9% of the time**, and more than **80% of those are just insufficient funds** — money that exists, arriving days later. For a gym, that compounds into 30–40% annual churn, a big slice of it *involuntary*. Late and failed payments cost Australian small business over **$1.1B a year**. The fix isn't chasing harder. It's **timing**.

**[0:45 — why Pinch, and the gap (name Success+ first)]**
GoCardless proved the mechanism: their Success+ ML retries a failed debit on the payer's likely-funded day and recovers about **70%** of failures. But that lives on GoCardless's rail, priced for enterprises. On Pinch — the accounting-native rail where Australian service SMBs actually collect — the docs literally say: *“It's up to you to schedule a new payment when one fails.”* Fiserv has decline optimisation **for cards, in the US**. **Nobody has it for AU bank debits.** Pinch has the rail, the invoice ledger, and the retry primitive — everything except the brain.

**[1:10 — what Cadence does]**
Cadence is that brain. A gradient-boosted model scores **P(dishonour) for every scheduled debit**. When a debit soft-fails, Cadence picks the payer's likely-funded day and reschedules it **through Pinch's own save-payment endpoint** — the API's designed-for mutation path. Two guardrails that matter in payments: a **hard return-code gate** (account-closed and mandate-cancelled are never retried — the payer's bank said no), and **consent by design** — the default mode is the BECS-customary post-failure retry; moving a debit *before* its due date only happens for payers who opt in to “flex-day”, with an SMS each time and one-tap opt-out.

**[1:40 — the demo]**
*(red→green)* Here's Dana in the sandbox. Her $45 debit runs Thursday — Cadence scores it red. It dishonours: insufficient funds. Watch: Cadence re-times it to her payday… time-travel forward… **settled. $45 recovered.** Same rails. Same authority. Better timing. Everything you just saw was live Pinch API calls — the only thing we changed was the date.

**[2:05 — the ML, honestly]**
The model trains on a **disclosed synthetic ledger** calibrated to published failure benchmarks — synthetic proves the method, not the production number. What it proves: the model **rediscovers each payer's hidden pay-cycle from timing alone** and beats a smart payday-heuristic baseline **46% to 38% recovery** on held-out payers — with an ablation showing zero lift in a no-signal world, so it's structure, not leakage. In production it trains on what Pinch already holds: network-wide dishonour codes and retry outcomes. Pinch never touches payer bank data.

**[2:30 — the business + close]**
We charge **only on recovered debits**. The incumbents charge the *payer* $15–30 per failure — the failure IS their revenue. We're the opposite side of that trade: **we don't make money unless the member's payment lands.** Beachhead: fitness — then childcare gap fees, where direct debit is legally mandated. And the same risk engine scales up Pinch's stack: portfolio risk for Glassbox, underwriting for embedded capital. Pinch turned *“I sent the invoice”* into *“the money's reconciled.”* **Cadence turns “the debit bounced” into “the debit landed on the right day.”** That's the missing brain on the rail that already has the body.

---

## The room answers (pre-loaded)
- **“Isn't this just Success+?”** → *“Success+ is the proof, not the competitor — it recovers after the fee has landed, on GoCardless's rail. Cadence predicts before the failure and acts on Pinch's rail — where the docs still tell merchants to handle failures themselves.”*
- **“Can you legally move my debit?”** → default mode never does; it retries after failure (customary). Pre-due-date moves are opt-in, notified, revocable — consent is the product.
- **“Synthetic data?”** → disclosed on the slide before you asked; here's the ablation; the production number needs a back-test on a real ledger — that's exactly the pilot we'd run with Pinch.
- **“Why won't Pinch just build this?”** → they should — that's the point. It's whitespace in their own docs, and this is the reference build. (Audition subtext, said with a smile.)
