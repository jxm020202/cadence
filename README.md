# pinch-hackathon

Working **spine** for the [Pinch Me! I Want 50K](https://pinch-me-i-want-50k.devpost.com/) hackathon —
the concept-agnostic plumbing every build needs, so we can bolt an idea on top instead of fighting auth.

What's wired up (all verified against the live docs — see [`docs/pinch-api-reference.md`](docs/pinch-api-reference.md)):

- **OAuth token auth** with in-memory caching (`src/pinch.ts`)
- **Realtime card charge** driven by client-side **CaptureJs** tokenisation (`public/checkout.html`) — no PCI scope
- **Payment Links** (hosted checkout you can send by SMS/email)
- **Webhook receiver** with correct **HMAC-SHA256 signature verification** (`src/webhook.ts`)
- Thin Express API so a browser demo can drive it (`src/server.ts`)

## Run it

```bash
cp .env.example .env      # then fill in your Pinch sandbox keys
npm install
npm run dev               # http://localhost:3000  (checkout demo at /checkout.html)
```

### Get sandbox keys
1. Sign up / log in at <https://web.getpinch.com.au> and switch to **TEST** mode.
2. **API Keys** → create an Application → copy the **Application Id** + **Secret** into `.env`.
3. Copy the **pk_test_…** publishable key into `.env` and into `public/checkout.html`.
4. (For webhooks) create a webhook pointing at your tunnel URL (`…/webhooks/pinch`); copy the returned secret into `PINCH_WEBHOOK_SECRET`. Use `ngrok`/`cloudflared` to expose localhost.

### Try the flow
- `GET /api/health` → confirms auth + connectivity.
- Open `/checkout.html`, hit **Pay** → CaptureJs tokenises the card, server charges via `/payments/realtime`.
- `POST /api/payment-links {amount, description}` → returns a hosted checkout URL.
- Point a Pinch webhook at `/webhooks/pinch` → watch verified events log.

## Next
Pick the build (see the concept shortlist in chat). The spine already covers charge + links + webhooks;
recurring (`Plan`/`Subscription`) and marketplace splits (`applicationFee`) are one helper away in `src/pinch.ts`.
