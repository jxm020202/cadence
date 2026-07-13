# Cadence — pitch v4.1 (the FUSED entry, post-tournament + panel-3 integrity fixes)

> v4.1 deltas (panel 3, 40.75/60, converged verdict "one live artifact from winning"): $29.90 open
> re-attributed precisely (incumbents, never Pinch); "Watch, live" removed until it IS live;
> default-act + cold-start ramp said OUT LOUD; "nobody has this" narrowed to sourced claims;
> merchant-of-record structure named; self-red-team owned in Q&A without citing self-scores.

> v3 + the tournament absorbs: predict-then-ask consent, receipt-in-metadata, applicationFee
> monetisation, the gate-refusal beat, judge-typed override. Three entries were built and made to
> compete (see `contenders/` + `docs/tournament-verdict.md`); Cadence won 3–1 and absorbed the
> winners' best beats. That process is itself a founder signal — say it in Q&A if asked how the
> product was designed.

**[0:00 — cold open]**
Dana pays $15 a week for her gym. Her debit bounced three days before payday — and her gym's biller, one of the legacy direct-debit bureaus, charged her **$29.90. Twice her membership. Remember that number: for the incumbent bureaus, the failure IS the revenue.** *(precision: that's Ezidebit's published payer fee — Pinch charges nothing like it, which is exactly why Cadence belongs here.)* The gym never noticed until she quit.

**[0:20 — problem]**
Direct debits fail ~2.9% of the time on GoCardless's 55,000-merchant book — the best published benchmark; the AU-specific number is exactly what our pilot measures. **More than 80% of failures are just insufficient funds** — money that exists, arriving days later. The fix isn't chasing harder. It's timing — *and consent.*

**[0:40 — why Pinch + prior art, named first]**
GoCardless's Success+ proved the mechanism — ML-timed retries, ~70% recovery — on *their* rail, *silently*, priced for enterprises. Pinch's own docs say: *"It's up to you to schedule a new payment when one fails."* **Pinch's rail has no retry intelligence today — their docs say so — and to our knowledge no one anywhere does the next part.**

**[1:00 — what Cadence does: predict, then ASK]**
A LightGBM model scores **P(dishonour) for every scheduled debit**. Two things said plainly first: **the default act is the BECS-customary post-failure retry — we never debit earlier than authorised** — and **the ramp is honest: month one a new merchant runs the payday heuristic; the model earns its keep from month two, as history accrues.** On a soft failure, Cadence gates the return code, picks the payer's likely-funded day — **and then asks.** Dana gets an SMS: *"we've pencilled the retry for Friday — reply with a day that suits better."* If she answers, **her exact words are parsed deterministically — no LLM — and stamped into the recovery payment's metadata: every recovery carries its own consent receipt.** If she doesn't, the model's day stands. Prediction is the default; consent is the upgrade. No incumbent that charges $29.90 a bounce can copy that sentence.

**[1:30 — demo]**
Watch the loop — *(integrity line, per current truth: "the model and the parser you'll see are live; the Pinch payloads are [live sandbox / labelled MOCK, byte-exact to the documented shapes]")* — *(risk sweep)* the model prices Dana's Thursday debit at 64% — drag it, every date has a price, the curve was learned. *(bank date)* Dishonoured. *(the ask)* The model picks day +9; the SMS goes out — **type as Dana: "can't do Friday, Monday works"** — the parser catches the negation, picks *Monday*, re-dates the debit through save-payment, receipt in metadata. *(settle)* Time-travel to Monday: **SETTLED — and the transfer reconciles it on Pinch's rails: $45.00 recovered, our 15% as a native applicationFee, $38.25 net to the gym.** The pricing isn't a slide — it's a line-item.
*(second scenario, 10s)* And when the code says **account-closed**? The gate refuses — even when "Dana" types a date — and sends a Payment Link to fix the method. **A new date cannot fix a dead account. Knowing when NOT to retry is half the product.**

**[2:10 — the ML: lead with the kill-switch]**
The artifact to check first: **strip the hidden pay-cycle structure from the training world and the model collapses to a coin flip — AUC 0.913 → 0.501 — and stops beating the payday heuristic.** That ablation proves the lift is learned structure, not leakage. Disclosures before you ask: synthetic training ledger (mechanism proven; the production number is the pilot back-test), cold-start needs ~2 failures per payer (production warms from network history — Pinch's data), and every demo payload is labelled MOCK until the sandbox run replaces it.

**[2:35 — moat + business + close]**
"Won't Fiserv just build this?" They should — **that's the plan, not the risk.** The moat is the cross-merchant payday prior that only forms inside Pinch's ledger; I can't own it from outside, so Cadence is built as the reference integration — and the fastest way for Pinch to own this capability is the person who already built it on their rail. Pricing: **15% of recovered dollars, as an applicationFee, nothing otherwise.** The incumbents charge Dana **$29.90 when her payment fails; we get paid only when it lands — and you can audit that in the transfer line-items.** Pinch turned *"I sent the invoice"* into *"the money's reconciled."* **Cadence turns "$29.90 for failing" into "$45 recovered — with a receipt."**

---

## Q&A bank (v4 additions)
- **"Is the SMS real?"** → the conversation brain is real and deterministic (50-test parser, judges type live); the SMS transport is a provider integration — the demo phone IS the surface, disclosed.
- **"What if the payer never replies?"** → the model's day stands with "no objection" recorded — consent upgrade, not dependency. Response-rate ceilings don't gate recovery.
- **"Double-collect risk on re-date?"** → the recovery is one payment object; re-dates update it. We make no stage claims about id-reuse semantics until sandbox-verified (flagged in the repo).
- **"How did you pick this design?"** → we built three products (conversational recovery, managed-merchant onboarding, and Cadence), ran them through a four-judge tournament, and fused the winners. The transcript is in the repo.
- **"Your repo contains a judge panel simulating US — isn't that grading your own homework?"** → own it: *"yes — I red-teamed this entry against personas of this panel for days, and every brutal question you're asking is in that file with my answer next to it. The scores mean nothing; the questions were the product. It's the same discipline as the ablation: attack your own work before someone else does."* Never cite the self-scores as evidence of quality.
- **"You take 15% as applicationFee — so who's the merchant of record?"** → the structure is Glassbox-native: Cadence operates as a platform partner, the gym as managed merchant; the fee settles as a platform split, chargebacks/dishonour liabilities sit with the merchant per Pinch's standard terms. Structure to be confirmed with Pinch in the pilot — which is precisely the conversation this build is designed to open.
- **"DDR authority for the payer's texted change?"** → default mode never varies the arrangement (post-failure retry is customary). Where the payer requests a different day, that request itself is the variation instruction — recorded verbatim, timestamped, revocable; the flex-day opt-in in the DDR terms is what pre-authorises the mechanic. Counsel review is a pilot workstream, named openly.
