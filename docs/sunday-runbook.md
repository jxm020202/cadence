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

## Shot list (what to click while you talk)
1. **0–8s** — your face or a title card: the problem line.
2. **8–40s** — screen-record `http://localhost:3000` (demo): show the risk %, click "run to bank date" (red dishonour), **type** `cant do friday, monday works` in the phone box → recovery payment appears with a **real `pmt_` id + `applicationFee`** (point at the LIVE badge + the API pane).
3. **40–52s** — `http://localhost:3000/merchant.html`: the risk-ranked debit run + recovered-$ cards.
4. **52–60s** — close line to camera.

**Easiest recording path — zero fumbling:** run `PINCH_MODE=live npm start`, open http://localhost:3000,
hit the **▶ Auto-play** button, and narrate the script while it drives itself (dishonour → typed
consent → recovered $ → transfer split, ~13s). No clicking or typing to trip on. Then flip to
`/merchant.html` for the last beat. (Live mode shows the green **LIVE — real Pinch sandbox** badge + real ids.)

## First-submission form answers (form: getpinch.com.au/hackathon-first-submission)
- **Team name:** `Cadence`
- **Team members:** `1` (solo — confirmed fine; T&C 2.1 "open to individuals and teams")
- **Email:** your registered Devpost email
- **YouTube link:** the Unlisted video URL
- **Any work before Build Weekend?** **Yes** (matches your disclosure form + email)
- **Checkboxes:** ☑ 60s video ☑ working prototype ☑ demonstrates Pinch tech ☑ team details

## YouTube setting that matters
Upload as **Unlisted** — the form requires "not Private". Unlisted = anyone with the link can watch, not searchable. Do **not** pick Private (the judges won't be able to open it → disqualified).
