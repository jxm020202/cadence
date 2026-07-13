# Second Ask — the debit that asks first

**Contender 1 for "Pinch Me! I Want 50K".** A post-dishonour *conversational* recovery agent on
the Pinch API. When a BECS debit dishonours (`bank-results` webhook), the incumbent playbook is a
$29.90 failure fee and a blind retry three days later — usually into the same empty account.
Second Ask does neither. It texts the payer, asks **when suits**, parses the answer
deterministically, and schedules the recovery debit on the payer's **own stated day** via Pinch's
own `POST /payments`. The payer's exact words travel with the payment as a consent receipt in
`metadata`.

> Cadence (the sibling contender) **predicts** the funded day with a model.
> Second Ask **asks** — consent *is* the mechanism. Same rails, same authority, but the payer
> picked the date, so the retry is expected, welcome, and near-certain to clear.

## Why it wins (judge map)

- **Innovation** — dunning today is fees + silent retries. Nobody treats the dishonour as the
  *opening of a conversation*. The consent receipt (payer's words stamped into `metadata`) turns
  "recovery" into an auditable agreement — a genuinely new object on the payment rails.
- **Effective use of Pinch tech** — the whole loop is Pinch primitives: `bank-results` webhook
  (HMAC-verified) → dishonour-code gate → `POST /payments` with `transactionDate` = the payer's
  day → sandbox `#code` forcing + `Time-Travel` for the on-stage settle → `POST /payment-links`
  for the dead-account branch.
- **Problem solving** — the hard-code gate encodes real collections judgment: `invalid-account` /
  `blocked-by-bank` **never** produce a retry ask (a new date can't fix a dead account); the agent
  refuses even if the payer offers a day, and sends a payment-method update link instead.
- **Technical execution** — deterministic parser (zero LLM, zero network, $0/message, 50-assertion
  test suite), replace-not-add re-dating semantics (a "monday works" after scheduling can never
  double-collect), weekend roll to the next banking day, hardship → split into two half-payments.
- **UX / demo** — a phone you *type into* live on stage, and every keystroke drives payload-exact
  Pinch API calls in the right pane.
- **Commercial** — merchants keep revenue they were writing off, with zero complaint risk because
  every retry is payer-initiated. Priced per recovered dollar, it sells itself; for Pinch it's a
  platform feature competitors (fee-charging dunning) structurally can't copy.

## Run it

```bash
cd contenders/second-ask
npm start          # http://localhost:3220  (uses the repo root's tsx — run npm install at the root once)
npm test           # 50 deterministic parser assertions
npm run typecheck  # strict tsc
```

No dependencies of its own and no network needed: the demo runs fully offline in mock mode with
payload-exact API calls labelled `MOCK` (the repo's honesty contract). With sandbox keys in the
root `.env` and `PINCH_MODE=live`, the recovery `POST /payments` routes through the real client
(`../../src/pinch.ts`) and its raw response is shown unlabelled.

## Demo script (~90 seconds)

1. **"Debit bounces — insufficient funds"** — payer/source/payment created, the sandbox `#code`
   trick forces the dishonour, the `bank-results` event lands, the GATE opens a conversation, and
   Sam's phone buzzes: *no fee, no drama — when suits you?*
2. Type **"I get paid Friday"** — the PARSE call shows the deterministic read
   (`date=Friday, payday=true`), then `POST /payments` appears with `transactionDate` = Friday and
   Sam's own words in `metadata`. The ledger shows SCHEDULED · *payer-chose: "I get paid Friday"*.
3. (Optional flexes) — **"can't pay this week"** → hardship path, no debit; **"can I split it?"**
   → two $22.50 payments a fortnight apart; **"tuesday instead"** → re-dates the *same* payment ids.
4. **"Time-travel to the chosen day"** — the recovery settles, the transfer fires, the counter
   rolls to **$45.00 recovered — one question asked, zero fees, zero blind retries.**
5. Reset → **"Debit bounces — account closed"** — the gate refuses to ask for a retry, sends a
   Payment Link to fix the method, and *keeps refusing* even when you type "try Friday".

## Architecture

```
public/index.html   the stage: phone (left) + ledger & payload-exact API pane (right)
server.ts           zero-dep node:http server (port 3220) + real /webhooks/pinch route
agent.ts            state machine: gate -> conversation -> POST /payments -> settle
parser.ts           deterministic intent + AU date parser (no LLM, pure functions)
parser.test.ts      50 assertions against a fixed calendar (Mon 2026-07-13)
```

Reused from the repo (not duplicated): `src/pinch.ts` (OAuth + API client, live mode),
`src/webhook.ts` (`pinch-signature` HMAC-SHA256 verification on the webhook route), and the
Cadence stage's visual language + `mock:true` honesty contract from `public/demo.html`.

## Honest limits

- **Mock-first**: sandbox keys weren't present at build time, so all calls except the live-mode
  recovery `POST /payments` replay documented payload shapes (labelled MOCK in the UI). Payloads
  follow `docs/pinch-api-reference.md`, not a recorded sandbox response.
- **No real SMS**: the phone is the demo surface. Production would wire an SMS provider (or
  Pinch's own comms) — the agent's contract (text in → state + API calls out) already matches that.
- **Re-date/cancel semantics assumed**: re-dating reuses the payment `id` through save-payment's
  create-or-update convention — not yet verified against the sandbox. Opt-out after scheduling
  flags the payment for merchant follow-up rather than auto-cancelling it.
- **Parser scope**: it nails the realistic replies (days, dates, payday, splits, hardship,
  negation like "can't do friday, monday works") but it is honest regex — a truly free-form
  sentence gets a graceful clarifying question, and two strikes offers the full option menu.
  Public holidays aren't in the weekend-roll table.
- **Single in-memory session**: one payer, one conversation, resets on restart — a demo stage,
  not a multi-tenant service.
