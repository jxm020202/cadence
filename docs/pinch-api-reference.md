# Pinch Payments API — build-ready reference

> Verified first-hand against `docs.getpinch.com.au` (July 2026). Amounts are always in **cents**.
> Machine-readable index of every page + OpenAPI: <https://docs.getpinch.com.au/llms.txt>

## The mental model (object graph)

```
Merchant (you)                      authenticated via Application Id + Secret
  └─ Payer            a customer you collect from
       ├─ Source      a payment method: "bank-account" (BSB+acct) or "credit-card" (tokenised)
       ├─ Agreement   Direct Debit Request (DDR) authority — required for BECS
       └─ Payment     a request to collect money (realtime now, or scheduled)
            └─ Attempt   one execution of a payment (retries = multiple attempts)
  Plan          a billing template (free periods, fixed + recurring amounts)
   └─ Subscription   binds a Plan to a Payer, generates Payments automatically
  Transfer      settlement of collected funds into your bank (batches payments)
  Refund        money returned to a payer (full or partial)
  Event/Webhook significant actions pushed to your server in real time
```

## Auth — OAuth client credentials

```
POST https://auth.getpinch.com.au/connect/token
Authorization: Basic base64(APP_ID:SECRET)      # or MerchantId:SecretKey
Content-Type: application/x-www-form-urlencoded  # MUST be form-data, not JSON

grant_type=client_credentials&scope=api1
```
→ `{ "access_token": "...", "expires_in": 3600, "token_type": "Bearer" }`

Then on every API call: `Authorization: Bearer <access_token>` + `pinch-version: 2020.1`.

- **Test base:** `https://api.getpinch.com.au/test`
- **Live base:** `https://api.getpinch.com.au/live`
- Get keys: Pinch Portal → API Keys → create Application (<https://web.getpinch.com.au/api-keys>).

## Client-side card capture (CaptureJs) — keeps you out of PCI scope

```html
<script src="https://cdn.getpinch.com.au/capturejs/pinch.capture.v2.js"
  integrity="sha384-hglYFSKC4AMA/rAQOGB3OiA8u5ri5F4qNMGgw4I+fggDSlTmPyREcj1J+VGnkAX8"
  crossorigin="anonymous"></script>
```
```js
const capture = Pinch.Capture({ publishableKey: "pk_test_..." });
const { token } = await capture.createToken({ sourceType: "credit-card", cardNumber, expiryMonth, expiryYear, cvc, cardHolderName });
// also: sourceType: "bank-account" -> { bankAccountName, bankAccountRouting, bankAccountNumber }
```
Send `token` to your server → use it as `token` on a realtime payment or to save a Source.

## Endpoints that matter (full list in llms.txt)

| Area | Method + path | Notes |
|---|---|---|
| Health | `GET /health` | sanity check |
| Payers | `POST /payers` (save), `GET /payers`, `GET /payers/{id}`, `DELETE …` | create-or-update customer |
| Payment sources | `POST` create source, tokenise, delete | attach card/bank to payer |
| **Realtime charge** | `POST /payments/realtime` | see fields below — the core "collect now" |
| Scheduled payments | save-payment, list scheduled/processed | future-dated collections |
| **Payment Links** | `POST /payment-links` | hosted checkout URL to send by SMS/email/chat |
| Plans | `POST /plans` (save), get/list/delete, calculate-plan-payments | recurring template |
| Subscriptions | `POST /subscriptions`, get/list, cancel | bind plan↔payer |
| Refunds | `POST` create-a-refund, get/list, check-nonce | full/partial |
| Transfers | `GET` get/list, list-line-items | settlement to your bank |
| Fees | calculate-fees, get-fees | surcharging support |
| **Webhooks** | `POST /webhooks` (create/update), get/list/delete | returns signing secret |
| Events | get-event, list-all-events | replay/audit event history |
| **Managed merchants** | create/list managed-merchant, update-merchant, upload-document | PayFac: onboard sub-merchants, split via `applicationFee` |

### Realtime payment body (`POST /payments/realtime`)
Required: `amount` (cents). Then either a new source (`token` from CaptureJs, or `email`/`fullName`/`mobileNumber`) or an existing `payerId`/`sourceId`.
Optional: `description` (≤1000 chars, payer-visible), `nonce` (array, dedupe), `metadata` (free text state), `applicationFee` (cents, managed merchants), `surcharge` (array of source types).
Response 201: `{ id, attemptId, amount, currency:"AUD", status, totalFee, applicationFee, transactionDate, estimatedTransferDate, payer, attempts[], dishonour? }`.

### Payment Links
`POST /payment-links` with `returnUrl` → payer lands on a Pinch-hosted checkout, then is redirected to `returnUrl?paymentLinkId=…&paymentId=…`. Track completion via webhooks (`transfer`, `bank-results`, `scheduled-process`).

## Webhooks — signature verification (verified vs Pinch.SDK WebhookClient.cs)

Payload: `{ "Id":"evt_…", "Type":"…", "EventDate":"…", "Metadata":{}, "Data":{} }` (PascalCase default; camelCase available).

Header `pinch-signature: t=<unix>,v2=<hex>`
```
signed   = `${t}.${rawRequestBody}`
expected = HMAC_SHA256(webhookSecret, signed) as lowercase hex
verify   = timingSafeEqual(expected, v2) && |now - t| <= tolerance (~5 min)
```
Use the **raw** body bytes — re-serialising JSON breaks the signature. (Implemented in `src/webhook.ts`.)

## Sandbox superpowers
- Sandbox mirrors production; test cards/bank accounts available.
- **Time travel:** fast-forward the sandbox clock to simulate recurring billing cycles and bank settlement (BECS takes days in real life) — lets a demo show a full subscription lifecycle in minutes.
- Tooling: official **.NET SDK** (NuGet `Pinch.SDK`), **Postman** collection, **Zapier / n8n / viaSocket** connectors, and a **"Build on Pinch with AI"** guide + `llms.txt` for LLM-assisted integration.

## Differentiators worth building on (vs Stripe et al.)
- **BECS direct debit** with proper DDR agreements + dishonour codes — cheap recurring collection, very AU.
- **Xero invoice automation** guide → the "invoices that pay themselves" narrative is native.
- **Managed merchants (PayFac)** → marketplace/platform splits via `applicationFee`.
- **Payment Links + metadata + webhooks** → build a full collection flow with almost no UI.

---

## Testing recipes (verified) — these make the demo)

### Time-Travel: fast-forward the sandbox clock
Send `Time-Travel: 2026-08-01T00:00:00Z` (ISO-8601 **UTC, Z suffix**) on a request and Pinch processes it "as at" that moment. Per-request — send it on each call you want dated. This is the demo superpower: create a Plan + Subscription, then loop Time-Travel across N billing dates to show **months of recurring charges + dunning + settlement live in 60 seconds**. (In `src/pinch.ts`: `Pinch.request('POST','/payments', body, { timeTravel })` or `Pinch.savePayment(body, { timeTravel })`.)

### Force outcomes deterministically
- **Dishonour a direct debit:** put a code prefixed with `#` in the payment **description** or the payer **first name**. Valid: `#insufficient-funds`, `#temporary-problem`, `#blocked-by-bank`, `#invalid-card`, `#invalid-account`, `#unsupported-card`, `#technical-error`. ⚠️ a stray `#` in a real description will silently force a failure.
- **Test card:** `4242 4242 4242 4242`, any future expiry/CVC. **Test bank:** BSB `012-001`, acct `987654321`.
- Settlement (BECS) is genuinely multi-day in real life — Time-Travel past `estimatedTransferDate` is the *only* way to test it fast.

### Environment & versioning gotchas
- Auth host (`auth.getpinch.com.au/connect/token`) is **separate** from the API host and is the same for test/live. Test vs live = the **URL path segment** (`/test` vs `/live`) + matching key set (`mch_test_*`/`sk_test_*` vs live).
- There is **no merchant-id header** — the merchant is whoever the token belongs to. For platforms, operate on **Managed Merchants** sub-accounts.
- Always pin `pinch-version: 2020.1`; omitting it means "latest" and risks breaking changes. Deprecated: v2017.2, v2019.1.

## Event types (for webhooks / Events API)
`payment-created`, `realtime-payment`, `scheduled-process`, `bank-results`, `transfer`, `refund-created`, `refund-updated`, `subscription-created`, `subscription-cancelled`, `subscription-complete`. Envelope: `{ Id, Type, EventDate, Metadata, Data }` (PascalCase default; camelCase available). Same events are also pollable via `GET /events` — handy when you don't have a public webhook URL in a demo.

## Recurring billing shape (Plans & Subscriptions)
- **Plan** (`pln_…`, create `POST /plans`) = reusable template: any number of fixed point-in-time payments **plus at most one recurring payment**; amounts as fixed cents or a percentage of a subscription total. **Immutable once a subscription attaches** — version them; deleting a plan cancels attached subscriptions + future payments.
- **Subscription** (`sub_…`, create `POST /subscriptions`) = binds `planId` + `payerId` (+ `sourceId`, `startDate`, and `totalAmount` only if the plan uses percentage amounts). Generates the dated Payment schedule; fires `subscription-*` + `payment-created` events.

## Managed Merchants (PayFac) — platform economics in ~2 fields
- `POST /managed-merchants` creates a sub-merchant you fully control under your own credentials; `POST /documents` uploads KYC docs; `PUT /merchants` updates.
- Collect on a sub-merchant's behalf, then take your cut with **`applicationFee` (cents)** on the payment. Reconcile your platform earnings from transfer line-items. "We became a payments platform in a weekend and make money on every transaction" is a strong judge narrative.
