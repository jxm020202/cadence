# Prior-work disclosure — form answers + email to Pinch

> Both must go out **before 7:00 pm AEST Fri 24 July** (build-weekend start).
> Rule (Participant Guide → Using Existing Work): *"the core functionality, features and solution
> being judged must be developed during the official 48-hour Build Weekend… If your project includes
> any work completed before the hackathon begins, you must disclose this to the organisers before the
> Build Weekend starts… Transparency won't disadvantage your team, but teams that fail to disclose
> existing work may be disqualified."*
> **Official disclosure form:** https://5g7rh.share.hsforms.com/28nSAlWfFTBeiDG3Pnmj_YA

---

## 1. Disclosure form — what to write

**What existing work are you bringing in?**

> Exploratory work I did on the Pinch sandbox before the hackathon, while learning the API:
> 1. **Integration spine** — OAuth token auth, payers, payment sources, scheduled payments, webhook
>    signature verification (HMAC-SHA256 over the raw body), CaptureJS checkout page.
> 2. **An ML model** — a LightGBM classifier trained on a *synthetic* BECS ledger I generated, which
>    predicts the probability that a scheduled direct debit will dishonour, plus an evaluation harness
>    comparing retry-timing strategies against a heuristic baseline.
> 3. **A deterministic text parser** for interpreting a payer's SMS reply (dates/negation), no LLM.
> 4. **A demo interface** showing the flow, and research/architecture notes.
>
> 5. **A Pinch API client** (OAuth, payers, payment sources, payments, webhook signature verification,
>    CaptureJS), and supporting primitives — an append-only payment state log, idempotency keys, and a
>    reconciliation helper. *(Don't omit this — "significant pieces of business logic" is an explicit
>    disclosure example in the rules.)*
>
> None of it has processed a real payment; it all runs against the test environment. I'm treating all
> of the above as prior art and will build the solution I submit during the official build window —
> happy to be directed on what I should park or rebuild. I'm fine providing full repository access
> including commit history/timestamps for verification at any point.

### Form Q2 — "What will be built during the 48-hour Build Weekend?"

> **The working product — none of it is connected end to end yet.**
>
> Concretely, during the window I'll build:
>
> 1. **The live recovery loop against the Pinch sandbox** — a deployed webhook endpoint registered with
>    Pinch, receiving real `bank-results` events → dishonour-code gate → the model scores the candidate
>    dates → the recovery payment created through the Pinch API with the consent receipt in its
>    metadata. Today these are isolated pieces that have never run end to end; the demo is driven by
>    mocked payloads.
> 2. **The payer consent flow as an actual flow** — a real message going out, the reply captured and
>    applied to the scheduled payment. The parser exists standalone but has never been connected to a
>    payment.
> 3. **The merchant-facing product** — a view of upcoming at-risk debits, recovered amounts, and the
>    consent/audit trail per payment. None of this exists today; there's only a scripted demo page.
> 4. **Replacing the mocked demo with the real integration**, so what's on screen are real
>    payer/source/payment IDs from the sandbox rather than replayed payloads.
> 5. The 60-second video and the submission itself.
>
> The model, parser, API client and ledger primitives go in as pre-built components. The solution being
> judged gets built during the window — happy for that to be verified against commit history.

**Why it's accurate (verified 24 Jul):** there is no live driver in the repo — every demo call is
`mock: true`; the webhook→gate→model→recovery loop has never run end-to-end against the sandbox; there
is no merchant-facing surface (only `public/demo.html`, a scripted stage); no SMS provider is wired.

---

## 2. The email to Laurien

**To:** laurien@getpinch.com.au
**Subject:** Prior-work disclosure before tonight's kick-off — Shivam Sharma

Hi Laurien,

Sorry I couldn't make the info session live — I've watched the full recording since, and I've just been through the Participant Guide.

Writing ahead of the 7pm start to disclose that I've done work on my idea before the build weekend, per the "Using Existing Work" rules. I'm submitting the disclosure form as well; this email is so it's on the record in your inbox too.

**What exists as of tonight:** a working integration against the Pinch sandbox (OAuth, payers, payment sources, scheduled payments, webhook signature verification, CaptureJS); a LightGBM model trained on a *synthetic* BECS ledger that predicts whether a scheduled direct debit will dishonour, with an evaluation harness; a small deterministic parser for reading a payer's SMS reply; and a demo interface plus research notes. Nothing has touched a live payment — it's all test environment.

**Two honest reasons it exists.** The smaller one: I wanted to actually learn the API rather than just read about it, and I got further than I meant to. The bigger one: I work at WeMoney, where I'm in transaction and payments data most days — failed recurring payments is a problem I already look at. So when I read in your docs that *"it's up to you to schedule a new payment when one fails,"* I was going to go poke at that regardless of the hackathon.

**One thing that may be useful to your team either way:** while testing I couldn't get the `Time-Travel` header to advance a *scheduled* BECS payment through processing in the sandbox — I tried it on GET and on POST, with past-dated transaction dates and with re-saves, and the payment stays `scheduled` (the processed-payments list stays empty, and no `bank-results` event fires). It may well be something I'm doing wrong, but I suspect other teams will hit the same wall this weekend, so I'm happy to send the exact scripts to whoever's running mentor support.

I'll build what I submit during the official window, and I'm genuinely happy to be told to park any of the above and start clean — just let me know what you consider fair. And I'm completely fine sharing my full GitHub history, commit timestamps and all, if and when it's needed.

Thanks, and looking forward to tonight.

Shivam Sharma
