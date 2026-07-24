# Deploying Cadence (personal account only)

> ⛔ **NEVER deploy to Vercel or any WeMoney resource.** The Vercel connection wired to this
> machine is the **WeMoney corporate team** — off-limits. And Cadence is a persistent Node server
> that spawns a Python LightGBM scorer, which Vercel's serverless model doesn't fit anyway.
> Use a container host on **your personal account**: Railway (easiest), Render, or Fly.io.

Hosting is **not required for the round-1 submission** (a local screen-recording of the working
prototype is compliant). This is a polish / finalist-stage nice-to-have.

## Railway (recommended — ~3 min, personal signup)
1. railway.app → sign in with your **personal** GitHub (`jxm020202`), not WeMoney SSO.
2. **New Project → Deploy from GitHub repo → `jxm020202/cadence`.** Railway detects the `Dockerfile`.
3. **Variables** (Settings → Variables) — paste the TEST keys (never live):
   ```
   PINCH_ENV=test
   PINCH_APP_ID=app_test_…
   PINCH_SECRET=sk_test_…
   PINCH_PUBLISHABLE_KEY=pk_test_…
   PINCH_VERSION=2020.1
   PINCH_MODE=live        # optional — drives the demo against the real sandbox
   ```
4. Deploy → Railway gives a public URL. The demo is at `/demo.html`, merchant view at `/merchant.html`.
5. (Only if wiring live webhooks) register that URL + `/webhooks/pinch` as a Pinch webhook and set
   `PINCH_WEBHOOK_SECRET` from the response.

## Render (alternative)
New → Web Service → connect `jxm020202/cadence` → Docker runtime → add the same env vars → Create.

## The one-liner for me
Once you've connected a personal host, tell me the platform and I'll drive the deploy/config from
here — no restructuring needed, the `Dockerfile` runs the whole stack (Node + uv + LightGBM) as-is.
