# The board: Fiserv, the judges, and why this hackathon exists

> Research-backed landscape so the build is aimed at the real targets, not a generic demo.

## Fiserv (the acquirer) — a growth-pressured giant buying its way into APAC
- **Scale:** ~US$21B revenue (2025), ~38k staff, ~6M+ merchant locations, thousands of banks/credit-unions. Two ~50/50 segments: **Merchant Solutions** (Clover, Carat) + **Financial Solutions** (core banking).
- **But under real pressure:** market cap fell from a ~$100B+ peak to ~$28–29B through 2025 after repeated guidance cuts; **2026 guidance is weak (1–3% organic growth).** They *need* to prove growth — so they **buy growth + distribution**.
- **Clover is the growth engine** and it **launched in Australia on 31 Mar 2025** — then Fiserv **acquired Pinch + Glassbox ~9 days later (9 Apr 2025).** Pinch is Fiserv's **APAC ISV / embedded-payments beachhead** to feed Clover.
- **Named strategic lanes (2026):** Clover international, **Value-Added Services** (fraud, **capital-as-a-service**, disbursements), **embedded finance** (also bought Payfare 2025), stablecoin (FIUSD), and **AI**.
- **agentOS** — Fiserv's headline AI bet: *"the operating system for agentic AI in banking"* — a **governed layer to run AI agents** across core/payments. This is their newest surface, and they're courting third-party agents.
- **Already monetise SMB cash-flow:** **Clover Capital** (merchant cash advance) and **Cashflow Central** (SMB AR/AP, via Melio). This *pre-validates* a "cash advance on the forward ledger" direction.

**Implication:** the strategically-loved build helps Pinch/Clover **win APAC SMBs**, turns **payment data into a value-added service**, and can be framed as a **governed agent** (agentOS) and/or **embedded working capital** (Clover Capital template).

## The judges — an almost unfair double-lock in our favour
- **Ben Cull** (Pinch co-founder). **Engineer-first, deeply technical** (ex-SSW solution architect, Pluralsight author) — he **reads code and architecture**. Ethos: **"adapt a proven model, improve one part; don't invent a category."** He rewards a **real, inspectable, calibrated model** and **candour**; he'll spot a hand-wave or AI theatre instantly.
- **Carolyn Breeze** (CEO, Scalare Partners). 20+ yr payments operator: Braintree AU Country Manager → PayPal → **led GoCardless ANZ** → Zepto CCO. **She personally scaled GoCardless "Success+"** — the exact ML failed-payment-retry product our build adapts. She judges on **commercial viability, unit economics, and reducing operator waste** ("circular startup" thesis).

**Why this is the tailwind:** our thesis (ML retry/timing on direct debit = "Success+ for Pinch") is a product **Breeze has lived and scaled**, delivered in the **"adapt-a-proven-model-improve-one-part"** pattern **Cull preaches**. *Neither judge needs educating* — both have lived this problem. No other concept double-locks the panel like this.

## The Founders Union / Scalare — the after-prize is real
- **The Founders Union (TFU)** is the startup-ecosystem platform of **Scalare Partners (ASX: SCP)**, a listed tech investment/advisory firm run by Breeze. TFU handpicks startups; Scalare invests in/acquires a few per year.
- The hackathon is an **API-adoption + talent + dealflow funnel.** "Outstanding teams may be invited to explore ongoing opportunities" = a genuine **recruitment / investment / acquisition** pipeline — into **Pinch/Fiserv AND potentially Scalare**. This is the equal-terms audition leverage.

## The hackathon setup (what actually wins)
- **Format:** in-person hubs Sydney/Melbourne/Brisbane (Tank Stream Labs) + remote AU-wide; **technical mentors from Pinch, commercial mentors from TFU.** Two-stage: **60s video + working PoC by Jul 26**, then **2–3 min pitch + full demo + API-integration walkthrough + public GitHub by Jul 31**; **Demo Night Aug 10**.
- **Judging math:** 6 criteria, but the two **differentiators are Commercial Potential + Effective Use of Pinch Technology.** They effectively want a **reference integration they can show future ISVs** — so the **Pinch API must be the value engine (impossible on Stripe), commercially credible, board-ready.**

## Verdict (validated + sharpened)
**Cadence — the self-healing forward ledger — survives every filter and the Fiserv/judge lens makes it *more* clearly right.** Sharpen it from *forecasting* (a passive dashboard) to **predict-and-ACT**: the model **re-times an at-risk debit through the Pinch API** and, under **time-travel**, the outcome **visibly changes** (red → green, revenue recovered on stage in ~90s). That action-through-the-rail is what makes the API undeniable and separates us from a chart.

**Roadmap acts (name, don't fully build):**
- **Act 1 (the demo / standalone product):** Cadence self-healing forward ledger — recover involuntary churn; priced on recovered revenue / per active mandate.
- **Act 2 (Fiserv embedded-finance seam):** **Cadence Capital** — instant advance underwritten on the *predicted* forward ledger = the **Clover Capital template for APAC via Pinch**.
- **Act 3 (platform scale):** **Glassbox Sentinel** — portfolio dishonour/settlement-shortfall risk across a PayFac's whole book.
- **Packaging for Fiserv's newest surface:** deliver the action loop as a **governed, human-in-the-loop, audited agent → drops into agentOS.**

**The audition line:** this is exactly the ML intelligence layer Pinch/Fiserv **confirmed they don't have** (failed debits handled by static rules), built by someone who ships **calibrated ML on payment rails** — an equal-terms hire, not a contestant.
