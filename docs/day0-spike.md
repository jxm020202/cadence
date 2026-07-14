# Day-0 sandbox spike — findings

> Ran against the REAL Pinch test sandbox (merchant "Shivam", `mch_zqAMae5gJEkUoW`) with the
> development keys in `.env`. Scripts: `scripts/spike.ts`, `spike2.ts`, `spike3.ts` (read `.env`,
> no secrets committed). This is the verification every judge named as the flip-to-win — done.

## What WORKS (real, verified, real IDs)
| Call | Result |
|---|---|
| `POST auth.getpinch.com.au/connect/token` | 200, Bearer token (3600s) |
| `GET /health/auth` | 200 — `{environment:"Test", merchant:"Shivam"}` |
| `POST /payers` | 201 — real `pyr_…` |
| `POST /payers/{id}/sources` (bank, BSB 012-001 / 987654321) | 200 — real `src_…`, tokenised |
| `POST /payments` (amount cents, transactionDate, description) | 201 — real `pmt_…`, `status:"scheduled"`, `totalFee:85`, `estimatedTransferDate` |
| `GET /events` | 200 — real `payment-created` / `payer-created` events |

**The integration is real.** The demo's creation steps (payer → source → dishonoured debit →
model-timed recovery payment, with `applicationFee` + `metadata` receipt) can all be genuine API
calls showing real IDs on screen. This alone answers most of the "it's all mock" critique.

## What does NOT work: forcing settlement via Time-Travel (the busted folklore)
The plan was "Time-Travel forward → the debit dishonours/settles." **It does not.** Tested exhaustively:

| Hypothesis | Result |
|---|---|
| `Time-Travel` header on a **GET** of a scheduled payment (dated future) | stays `scheduled` |
| `Time-Travel` on the **POST** that creates the payment | stays `scheduled` |
| transactionDate in the **past** + Time-Travel forward | stays `scheduled` |
| Re-save (`POST` with `id`) under Time-Travel | stays `scheduled` |
| Past-dated (-2 to -3d) payment, polled 90s | stays `scheduled`; `GET /payments/processed` → **totalItems 0** |
| `/events` under Time-Travel | only `payment-created` — no `bank-results` / `transfer` / `scheduled-process` |

**Conclusion:** on this sandbox merchant, scheduled BECS payments are processed by an internal batch
that the API/Time-Travel header does **not** trigger on demand. Likely causes (to confirm with Pinch
or the Dev Portal): (a) the source came back `isAuthorised:false` — a DDR mandate may need authorising
before debits run; (b) a fresh dev merchant may need activation; (c) the batch runs on a real cadence
and Time-Travel only re-dates the request, it doesn't run the processor. The docs literally say
*"the best way to try out Time Travel is to use the Dev Portal"* — implying a portal-side control the
public API doesn't expose.

## Demo decision (honest hybrid)
- **Real, live, on screen:** token, payer, source, the dishonoured debit, the model-timed recovery
  payment (real `pmt_` id, real `applicationFee`, consent receipt in `metadata`), events. Flip these
  from `mock:true` → `mock:false`.
- **Honestly labelled as simulated:** the dishonour→settle *transition*, because the sandbox won't
  drive it on demand. Show the real created payment, then the payload-exact `bank-results` / `transfer`
  event we expect, labelled `SIMULATED — sandbox batch not caller-triggerable (see docs/day0-spike.md)`.

## Why this is a founder-signal WIN, not a loss
The pitch research said *a founder who names their own hardest question disarms it.* On stage:
> *"You'll ask if this is live. Payer, source, debit, recovery — all real, here are the IDs. The one
> thing I can't do is force the sandbox's BECS batch to settle on demand — I spiked that on day zero,
> it's a Dev-Portal control, not an API one. So the settlement event is labelled simulated. I'd rather
> show you exactly where the sandbox ends than fake past it."*

That is the opposite of AI theatre — it's the candour Cull rewards, backed by three spike scripts he
can run himself. **Open item for Shivam:** in the Pinch Dev Portal, look for a Time-Travel / "process
payments" control, or ask Pinch how to trigger sandbox settlement (and whether the source needs an
authorised agreement first). If found, the settlement step flips from simulated to live too.
