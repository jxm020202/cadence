# 60-second demo video — shot list + voiceover (round-1 submission)

> Goal: prove a working prototype that uses the Pinch API, in 60s. Record with the app in
> **`PINCH_MODE=live`** so real `pyr_`/`pmt_` IDs + a real `applicationFee` are on screen — that's the
> whole credibility play. Screen-record + talk over it; no fancy editing needed. Target ~145 wpm.
>
> Setup before recording: `cp .env` keys in · `PINCH_MODE=live npm start` · open `localhost:3000/demo.html`.

| t | On screen (what you click) | Voiceover |
|---|---|---|
| 0–8s | demo.html, badge shows **"LIVE — real Pinch sandbox"**. | "Every fortnight, millions of Australian direct debits bounce — and the legacy billers charge the customer a $29.90 fee. Cadence stops that." |
| 8–18s | Point at the risk sweep / the 64% score. | "This is a real Pinch sandbox payer. My model scores every scheduled debit — this one's 64% likely to dishonour, because it lands days before payday." |
| 18–30s | Click **Run to bank date** → red DISHONOURED. | "It fails — insufficient funds. Instead of a blind retry, Cadence **silently re-times the retry to her payday** — no message, no fee — a re-presentation on her existing mandate, so it just runs." |
| 30–42s | Hands-free: **▶ Auto-play** drives bounce → silent re-time → settle. No typing. | "She's never contacted. The model — 112,890 debits, 0.91 AUC on held-out payers — just moved the debit to the day she gets paid." |
| 42–54s | Point at the API pane: real `POST /payments`, real `pmt_` id, `applicationFee: 675`. | "That just created a real recovery payment on Pinch — $45 of BECS volume Pinch keeps instead of losing, with our 15% riding as a native applicationFee. We only earn when the payment actually lands." |
| 54–60s | Cut to `/merchant.html` (the risk-ranked run). | "Predict, silently re-time, keep the member — the failed-payment brain Pinch's own docs say merchants need. That's Cadence." |

## The honesty line (say it — it's the credibility move)
Somewhere around 42s, one clause: *"everything you're seeing is a live sandbox call — the only thing the sandbox won't do on demand is settle the debit, so that tick is simulated, and the proof scripts are in the repo."* (Ben Cull reads repos; this line is why he trusts the rest.)

## Practical
- One take is fine; if you fluff a line, keep going and re-record just that segment.
- Upload to YouTube **unlisted** (NOT private — the form rejects private), paste link in the form.
- Keep it **≤60s** — the form checkbox asks you to confirm 60 seconds.
- If the live sandbox is slow/asleep mid-record, the mock mode (`npm start` without PINCH_MODE) looks identical and is the safe fallback — but say "payload-exact mock" if you use it.
