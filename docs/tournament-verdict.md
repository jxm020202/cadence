# Tournament verdict — Cadence wins; ship FUSED Cadence

> Three real entries competed (all built & verified): **Cadence** (incumbent) vs **Second Ask**
> (consent-conversation recovery, `contenders/second-ask/`, 50/50 parser tests) vs **Onboard**
> (managed-merchant onboarding + applicationFee, `contenders/onboard/`, real ABN mod-89 checksum).
> Panel: 4 judges × 4 models, personas rotated. Full transcripts in the workflow output.

## Result
**Cadence — 3 of 4 first-place votes** (Borda 6–4–2; official totals 192/191/186; **founder-signal 36 vs 22 vs 21** — the decisive axis). The rival-lead judge alone ranked Second Ask first (stage theatre).

The judges' unanimous meta-finding: *"these aren't three products — they're one product and its two best missing beats."*

## The FUSED Cadence (the final entry)
The LightGBM predicts the funded day → **a consent SMS asks the payer to confirm or override** → their exact words are **stamped into the recovery payment's `metadata` as an auditable consent receipt** → Cadence's 15%-of-recovered take ships as a **native `applicationFee`**, reconciled to the cent in the transfer line-items.

### Absorb list (ranked by impact/effort)
1. **Predict-then-ask consent layer** (Second Ask) — named by all 4 judges. Kills the blind-retry/DDR consent risk (Breeze's one commercial reservation) AND the ask-only response-rate ceiling (model day = default; the ask = consent upgrade). Parser already exists (`contenders/second-ask/parser.ts`, 50 tests). ~1 day.
2. **applicationFee monetisation** (Onboard) — pricing becomes a Pinch API primitive, verifiable live; lifts the weakest criterion (Effective Use of Pinch 7→8+).
3. **Judge-typed interactive override** — "can't do friday, monday works" → negation-aware parse overrides the model's day in a payload-exact POST /payments. Best theatre in the tournament, deterministic code.
4. **On-stage gate refusal** — account-closed: agent refuses a retry *even when offered a date*, sends a Payment Link to fix the method. Zero new logic, pure demo scripting; payments-literacy beat.
5. **Live falsification beat** — judge flips a model input / clicks any candidate day, watches p_dishonour re-derive server-side (Onboard's checksum pattern applied to the model).
6. **Feature-provenance panel** — "day +9 chosen because of these exact features" beside the score.

### Cut (verdict-mandated)
- Onboard & Second Ask as standalone entries (concepts remain in `contenders/` as evidence of range).
- **Any claim resting on unverified save-payment id-reuse semantics** — especially "can never double-collect" — until sandbox-verified.
- Hardship/split branch as a live beat (roadmap answer only).
- Platform-consent-moat scale narrative (stay on Cadence's arc + the $29.90 number).

## Chair's rationale (verbatim core)
*"Cadence wins decisively because it is the only entry that serves both of your stated goals at once: a verified ML hiring audition (metrics.json matches the README to the decimal, the ablation kills the lift, the demo runs the same planRecovery() path as the live webhook) plus a panel-tested pitch — an axis both rivals concede in their own self-assessments. Do not ship it alone: spend the ~1 day of fusion work on the ranked absorb list."*
