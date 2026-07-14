# Cadence architecture — the money spine

> This is the walk-through order for a payments engineer (Cull) or a systems-design interview.
> Principle: **you cannot reconcile what you have overwritten.** Everything money-touching is
> append-only, balanced, idempotent, and reconciled. Code: `src/ledger.ts`, `src/idempotency.ts`,
> `src/recon.ts`; proof: `src/money.test.ts` (9/9). Run `npm test`.

## 1. The loop (`src/loop.ts`)
`bank-results` webhook → verify HMAC on the raw body (`src/webhook.ts`) → gate the dishonour code
(hard codes never retry) → LightGBM picks the funded day → **guarded act** → ledger record.

## 2. Append-only state log (`PaymentStateLog`)
Every lifecycle transition (`scheduled → dishonoured → rescheduled → settled`) is a new immutable
row. `current(paymentId)` is a fold to the last row — nothing is updated in place, so the full
history of a payment is always recoverable for dispute/audit. *Why it matters:* BECS has no positive
confirmation and dishonours arrive over 1–3 days; an overwriting store loses the evidence you need.

## 3. Double-entry ledger (`Ledger`)
Cash movements post as **balanced** sets of entries (Σ debits = Σ credits) across `bank_clearing`,
`merchant_payable`, `cadence_revenue`. `post()` **throws on an unbalanced posting** rather than
corrupt the books; reversals are *compensating* postings, never deletions; `trialBalanceOk()` is the
invariant. Settlement of $45 with our 15% fee posts DR clearing 4500 / CR merchant 3825 / CR
revenue 675 — the applicationFee split, auditable to the cent.

## 4. Idempotency (`IdempotencyStore`) — the double-collect answer
Bank-results delivery is **at-least-once** — Pinch can re-send the same event. The recovery act runs
inside `idempotency.run('recover', paymentId, body, …)`:
- same key + same payload → **replay** the stored response, the debit does **not** run again;
- same key + different payload → **409 conflict** (a caller bug; refuse, don't double-act);
- in-flight → back-off.

This is the concrete, testable answer to the panel's recurring *"what if a payer gets debited
twice?"* — pairing at-least-once delivery with idempotent writes, the standard money-systems pattern.

## 5. Three-way reconciliation (`reconcile`)
Compares **internal** (`PaymentStateLog`) vs **processor** (Pinch API states) vs **settlement**
(transfer line-items) and returns explicit discrepancies: state mismatch, settled-not-in-ledger,
ledger-settled-not-in-file, missing-at-processor. Silence is not proof — the control returns what
disagrees. The demo can inject a mismatch and show it caught.

## What's still mock vs real
The ledger/idempotency/recon/ML/parser are **real and tested**. The Pinch calls are payload-exact
**MOCK** until sandbox keys land (`PINCH_MODE=live` swaps the driver). The honesty contract is in the
demo UI: every payload is labelled, and the day-0 spike flips mock→live with captured payloads.
