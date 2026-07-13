# Cadence — pitch v5 (craft-rebuilt: spoken scripts)

> Rebuilt per docs/domain/pitch-craft.md: ≤400 words for the 3:00 slot, ~270 for the 2:00 slot,
> at ~133wpm rehearsed to 85% of the ceiling. ONE number ($29.90 → $45), ONE gasp beat (the typed
> reply), the ask appended, every integrity parenthetical moved to on-slide labels (visible MOCK
> badge, "source: Ezidebit published fees" footnote). Delivery marks: **[pause]** = 2 beats.

## The 3:00 script (~390 words)

Dana pays fifteen dollars a week for her gym. Last Tuesday her debit bounced — three days before payday — and her gym's billing company charged her **twenty-nine dollars ninety**. **[pause]** Twice her membership. For the legacy billers, the failure *is* the revenue. The gym never noticed. Dana quit.

Direct debits fail around three percent of the time, and more than eighty percent of those are just insufficient funds — money that exists, arriving days later. The rail is blind at debit time and the return code takes days. Chasing harder doesn't fix that. Timing does.

**Cadence predicts which direct debits will fail and moves them to payday — with the payer's consent.** **[pause]** Prediction is the default; consent is the upgrade.

GoCardless proved the mechanism — their ML retries recover about seventy percent of failures, silently, on their rail. Pinch's docs still say: *"it's up to you to schedule a new payment when one fails."* We built that missing piece on Pinch — and added the part nobody has: the ask.

Here's Dana, live. The model prices her Thursday debit at sixty-four percent risk — drag it across the calendar: every date has a price, and this curve was learned, not configured. The bank run comes back: dishonoured. The model gates the code — retryable — picks her likely-funded day, and texts her. Now watch — I'll type her reply: *"can't do Friday, Monday works."* **[the gasp beat — silence while it parses]** It caught the negation. Monday. Her exact words go into the payment's metadata — every recovery carries its own consent receipt. Time-travel to Monday: **settled. Forty-five dollars recovered.** **[pause]** And the transfer reconciles it on Pinch's rails — our fifteen percent rides as an applicationFee line-item. We only get paid because Dana's payment landed.

The honest bits: the model trains on a disclosed synthetic ledger — strip the hidden pay-cycles and it collapses to a coin flip, which is how you know it learned the real thing. Month one, a new merchant runs the payday heuristic; the model earns its keep from month two. Default mode never debits earlier than authorised.

And when the code says account-closed? It refuses — even if you type a date at it. A new date cannot fix a dead account.

**The ask: a ninety-day pilot on one Pinch merchant cohort, measured against the payday heuristic. The repo is public — go read it.** Cadence turns twenty-nine-ninety for failing into forty-five dollars recovered — with a receipt.

## The 2:00 compression (~265 words)

Dana pays fifteen dollars a week for her gym. Her debit bounced three days before payday, and the billing company charged her **twenty-nine dollars ninety** — twice her membership. **[pause]** For the legacy billers, the failure *is* the revenue.

Most failed debits are just insufficient funds — money that exists, arriving days later. **Cadence predicts which direct debits will fail and moves them to payday — with the payer's consent.** Prediction is the default; consent is the upgrade.

GoCardless recovers seventy percent of failures with ML — silently, on their rail. Pinch's docs still say *"it's up to you to schedule a new payment when one fails."* We built the missing piece, plus the part nobody has.

Watch. The model prices Dana's debit at sixty-four percent risk. It fails. The model picks her funded day and texts her — and I'll type her reply live: *"can't do Friday, Monday works."* **[silence]** It caught the negation. Monday. Her words go into the payment's metadata — a consent receipt on every recovery. Time-travel forward: **settled, forty-five dollars recovered**, and our fifteen percent rides the transfer as an applicationFee line-item. We only earn when the payment lands.

Honesty: synthetic training ledger — ablate the pay-cycles and the model collapses to a coin flip; that's the proof it learned the real mechanism. And when a code says account-closed, it refuses to retry — a new date can't fix a dead account.

**The ask: a ninety-day pilot on one Pinch cohort against the payday heuristic. The repo is public.** Twenty-nine-ninety for failing — or forty-five dollars recovered, with a receipt.

## Slide labels (carry the integrity load silently)
- Demo pane: `MOCK — byte-exact to Pinch's documented events` badge (flips to `LIVE SANDBOX` when keys land)
- Fee stat footnote: `source: Ezidebit published payer dishonour fee`
- ML slide: the two-bar ablation image (0.913 → 0.501), caption "strip the structure, lose the signal"
- Benchmark footnote: `failure rates: GoCardless published UK book; AU rate = pilot measurement`

## Q&A judo (delivery shapes — full answers in pitch-v4.md bank)
- **Answer-first**: one sentence + one fact + stop.
- **Steel-man Success+**: "You're asking — hasn't GoCardless already built this, better? Fair. They proved the mechanism at seventy percent…" → whitespace line.
- **Pivot the DDR question**: acknowledge → "the way we've built for it is" → default-act-is-customary.
- **Never bluff**: "I don't know — here's how we find out" beats fabrication with this panel.
- **The encore**: "type anything you like at it" — offered in Q&A, aimed at Cull, never during the pitch.
