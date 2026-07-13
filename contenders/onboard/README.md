# ONBOARD — become a payments platform in minutes

**Contender 2** for "Pinch Me! I Want 50K". Built on **Pinch Managed Merchants** (the PayFac
surface): a SaaS platform pastes a sub-merchant's email, and Onboard drafts the full
`POST /managed-merchants` payload, walks the KYC document checklist, flips the merchant live,
and immediately shows the money — a payment collected on the sub-merchant's behalf with an
`applicationFee` (the platform's cut), reconciled to the cent in the transfer line-items.

## The concept

Every vertical-SaaS company (gym software, tradie invoicing, dance-school CRMs) eventually
realises payments is where the margin lives — and then loses months to onboarding forms, KYC
back-and-forth and payout plumbing. Pinch already solved the hard part: Managed Merchants +
one field, `applicationFee`. Onboard is the missing front door: **the onboarding form is a
paste box**.

One screen, four beats on a progress rail:

1. **Draft** — a deterministic drafting brain (`brain.ts`, no LLM) regex-extracts every field
   the create-managed-merchant call needs, with per-field **provenance** (the exact snippet of
   the paste each value came from), and validates the ABN with the real ATO checksum
   (subtract 1 from the first digit, weights `10,1,3,5,7,9,11,13,15,17,19`, weighted sum must
   divide by 89). Invalid ABN → the application is blocked *before* it burns a KYC review.
   Spectacle micro-beat: click any digit on the checksum strip and watch the math fail live,
   server-side, on every flip.
2. **KYC docs** — the checklist is generated from the detected entity type (Pty Ltd → ASIC
   extract + ID + bank statement; sole trader / trust differ); each doc is one payload-exact
   `POST /documents`.
3. **Live** — the managed merchant goes `active` under the platform's own credentials.
4. **First $** — `POST /payments/realtime` with `amount: 22000, applicationFee: 550` and the
   `transfer` event whose line-items reconcile the split: settlement $220.00, applicationFee
   −$5.50 (the platform's earnings), processing −$0.88, net to merchant $213.62.

## Why it wins

- **Effective use of Pinch tech**: it is built *on* Pinch's most differentiated surface —
  Managed Merchants — and its demo climax is literally one field of the Pinch API
  (`applicationFee`) plus transfer line-item reconciliation. Nothing here works without Pinch.
- **Commercial potential** (Carolyn): "every vertical SaaS becomes a payments company" is the
  GoCardless/Success+ playbook one level up — Pinch earns on every sub-merchant transaction
  that Onboard creates, so it grows Pinch's book, not just one merchant's.
- **Technical execution** (Ben): the drafting brain is deterministic and unit-testable — same
  paste, same payload — with provenance for every field and a real ATO mod-89 checksum you can
  falsify live on stage. No LLM, no black box, no network dependency in the brain.
- **Adapt a proven model, improve one part**: Stripe Connect onboarding is the proven model;
  the improved part is the front door (paste → draft → checklist) for the AU/ABN world.

## How to run

```bash
# deps resolve from the repo root (already installed there): express, tsx, typescript
cd contenders/onboard
npm start            # ONBOARD on http://localhost:3230
npm run typecheck    # tsc --noEmit
```

Open http://localhost:3230 and drive the rail with the primary button. The engine is also
curl-able:

```bash
curl -s localhost:3230/api/onboard/state                     # current step
curl -s -X POST localhost:3230/api/onboard/draft \
  -H 'Content-Type: application/json' -d '{"blob":"…business email…"}'
curl -s -X POST localhost:3230/api/onboard/step              # advance the rail
curl -s -X POST localhost:3230/api/onboard/abn \
  -H 'Content-Type: application/json' -d '{"abn":"71234567007"}'   # live checksum
curl -s -X POST localhost:3230/api/onboard/reset
```

The demo ABN `71 234 567 007` is synthetic and passes the real checksum (weighted sum
445 = 89 × 5). The settlement account in the sample paste is Pinch's documented test bank
(BSB `012-001`, account `987654321`).

## The honesty contract (same as the Cadence stage)

Every pane in the right-hand column is a payload-exact request/response. Panes labelled
**MOCK** replay documented Pinch shapes and have not been executed against the sandbox; panes
labelled **REAL** (the drafting brain, every ABN digit-flip) run live server code on every
click. `GET /api/health` does a real authenticated sandbox check through the shared client
(`src/pinch.ts`) once `PINCH_APP_ID`/`PINCH_SECRET` are in the environment.

## Honest limits

- **Pinch calls are mocked.** No sandbox keys were available at build time, so
  `POST /managed-merchants`, `POST /documents`, the realtime payment and the transfer event
  are payload-exact mocks labelled MOCK in the UI. The wiring to go live is one step: the
  server already imports the repo's real client (`src/pinch.ts`).
- **Managed-merchant field names are drafted from the docs, not pinned against the sandbox
  schema.** The reference (docs/pinch-api-reference.md) confirms the endpoints and the
  `applicationFee` mechanic; exact body field names for `/managed-merchants` and `/documents`
  need one sandbox round-trip to pin.
- **KYC verification is simulated** ("verification passes" is a demo beat). Real Managed
  Merchants approval is a Pinch-side review with real turnaround time.
- **The brain is regex-based.** It handles email-shaped pastes well (quoted trading names,
  Pty Ltd/trust/sole-trader detection, AU addresses, BSB/account, mobile numbers) but it is
  not a general information extractor. That's a feature for auditability — and the obvious
  place an ML upgrade slots in later.
- Amounts and fee numbers in the money beat ($220.00 / $5.50 / $0.88) are illustrative.

## Files

- `brain.ts` — deterministic drafting brain: parse + provenance, ATO ABN checksum, payload
  drafter, entity-aware KYC checklist. Pure functions.
- `engine.ts` — the 4-beat step machine (mirrors `src/demo/engine.ts`'s pattern and reuses its
  `ApiCall` type).
- `server.ts` — express mini-server on **port 3230**; reuses `src/pinch.ts` for the real
  sandbox health check.
- `public/index.html` — the stage: progress rail, paste box, provenance table, interactive
  checksum strip, KYC checklist, split bar, payload-exact API pane. Shares the repo's visual
  language (dark stage, chips, MOCK labels).
