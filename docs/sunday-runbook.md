# Sunday runbook — record + submit in ~45 min

> Hard deadline: **Sun 26 Jul, 6:00 PM Perth** (8pm AEST). Target: **submitted by 5:00 PM Perth** (1h buffer).
> Everything below is pre-staged so Sunday is: record → upload → paste → submit.

## Timeline (Perth time)
- **… → 3:00 PM** — cycle freely. Hard stop: home by 3:00.
- **3:00–3:15** — I'll have the server running in LIVE mode + demo rehearsed; you skim this script once.
- **3:15–4:00** — record the 60s video (screen capture + voiceover; 2–3 takes is plenty).
- **4:00–4:30** — upload to YouTube as **Unlisted** (NOT Private), paste link into the form, submit.
- **By 5:00 PM** — **submitted.** Rest of the day free.

## The 60-second script (~130 words)
> Every fortnight, millions of Australian gym debits bounce — usually just insufficient funds, days before payday. The incumbent answer is a thirty-dollar fee and a blind retry. Cadence is different.
> *(screen: the demo)* Our model scores each scheduled debit's dishonour risk, live. When one fails, Cadence texts the member and asks when suits — I'll type her reply: "can't do Friday, Monday works." A deterministic parser reads it and schedules the recovery through Pinch's own API — a real payment, real ID, our fee as a Pinch applicationFee, her consent in the metadata.
> *(screen: merchant view)* And the operator's view: this fortnight's run, every debit risk-scored, recovered dollars projected.
> Real model, real Pinch integration, built this weekend. **Cadence — a bounced debit becomes a recovered dollar.**

## The 60-second script (SILENT recovery — the clean story)
> Every fortnight, millions of Australian gym debits bounce — usually just insufficient funds, a few days
> before payday. The member isn't broke; they're short for three days. The old billers retry blindly,
> charge a $30 fee, and ping the member "your payment failed" — which is how gyms lose members who never
> meant to leave.
> *(demo)* Cadence is different. Our model scores every scheduled debit — this one, likely to bounce, lands
> before her payday. It bounces. And Cadence **silently re-times the retry to her payday** — no message, no
> fee. On payday it clears: **$45 recovered, through Pinch's own API**, our 15% as an applicationFee — and
> **she never knew it failed, so she stays.**
> *(merchant view)* Across the whole book: every debit risk-scored, recovered dollars projected.
> Real model, real Pinch integration. **Cadence — recover the payment quietly, and keep the member.**

## Shot list (what's on screen while you talk)
1. **0–10s** — face or title card: the problem line.
2. **10–42s** — `http://localhost:3000`: hit **▶ Auto-play** → risk score → **DISHONOURED** (red) → **silently re-timed to payday** → **SETTLED $45** (point at the LIVE badge, the real `pmt_` id + applicationFee in the API pane).
3. **42–54s** — `http://localhost:3000/merchant.html`: the risk-ranked run + "$359 → $442 with Cadence".
4. **54–60s** — close line.

**Zero fumbling:** run `PINCH_MODE=live npm start`, open http://localhost:3000, hit **▶ Auto-play** and
narrate while it drives itself (bounce → silent re-time → recovered $ → transfer split, ~12s). **No typing.**
Then flip to `/merchant.html` for the last beat. (Green **LIVE — real Pinch sandbox** badge + real ids.)

## First-submission form answers (form: getpinch.com.au/hackathon-first-submission)
- **Team name:** `Cadence`
- **Team members:** `1` (solo — confirmed fine; T&C 2.1 "open to individuals and teams")
- **Email:** your registered Devpost email
- **YouTube link:** the Unlisted video URL
- **Any work before Build Weekend?** **Yes** (matches your disclosure form + email)
- **Checkboxes:** ☑ 60s video ☑ working prototype ☑ demonstrates Pinch tech ☑ team details

## YouTube setting that matters
Upload as **Unlisted** — the form requires "not Private". Unlisted = anyone with the link can watch, not searchable. Do **not** pick Private (the judges won't be able to open it → disqualified).
