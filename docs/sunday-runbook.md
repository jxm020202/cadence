# Sunday runbook — record + submit in ~45 min

> Hard deadline: **Sun 26 Jul, 6:00 PM Perth** (8pm AEST). Target: **submitted by 5:00 PM Perth** (1h buffer).
> Everything below is pre-staged so Sunday is: record → upload → paste → submit.

## Timeline (Perth time)
- **… → 3:00 PM** — cycle freely. Hard stop: home by 3:00.
- **3:00–3:15** — I'll have the server running in LIVE mode + demo rehearsed; you skim this script once.
- **3:15–4:00** — record the 60s video (screen capture + voiceover; 2–3 takes is plenty).
- **4:00–4:30** — upload to YouTube as **Unlisted** (NOT Private), paste link into the form, submit.
- **By 5:00 PM** — **submitted.** Rest of the day free.

## The 60-second script — PURE SILENT (canonical; reusable as the final's demo cut)
Every number verified against `ml/outputs/metrics.json`. No typing, no "when suits", no consent SMS.
> *(0–10s — title / face)* Every fortnight, millions of Australian direct debits bounce — and most aren't people who can't pay; they're short for a few days, right before payday. The old billers retry blind, add a thirty-dollar fee, and ping the member "payment failed" — which is how you lose members who never meant to leave.
> *(10–30s — demo.html, LIVE badge, drag the risk sweep, Auto-play → red DISHONOURED)* Our model — a hundred-and-twelve-thousand debits, point-nine-one AUC on held-out payers — flags this one as likely to bounce before payday. It bounces. And Cadence **silently re-times the retry to her payday**: no message, no fee — a re-presentation on her existing mandate, so it just runs.
> *(30–48s — API pane: real `pmt_` id, applicationFee 675, then SETTLED $45)* One honest line: every call here is a live Pinch sandbox call; only the bank settlement is simulated. Payday, it clears — **$45 recovered on Pinch's own rails**, our 15% as a native applicationFee: **volume Pinch keeps instead of losing**. She never knew it failed, so she stays.
> *(48–60s — /merchant.html, the risk-ranked book)* Zero members contacted, **eight points over the payday heuristic** on held-out data. Recover quietly, keep the member, grow the rail — that's Cadence.

**Compliance one-liner (Q&A only):** "silent" = no collections outreach, no negotiation, no fee — a re-presentation under the existing mandate; standard DDR notice for any out-of-window date change is retained, not bypassed. The account-closed / hardship edge (gate refuses → one-way update link) is the ONLY time we contact the member — hold it for Q&A as "knowing when NOT to retry".

**Evidence to have open:** `/proof.html` (the model teardown — ablation collapse, recovery ladder, calibration) for any judge who wants to see the ML is real, not a wrapper.

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
