# Submission operating plan — the thing that actually wins or loses

> The build is not the risk. **Missing a form is.** Incomplete/late = auto-eliminated, same as anyone.
> This doc is the checklist so that never happens.

## ⚠️ THE PERTH TIMEZONE TRAP (internalise this)
Deadlines are **AEST** (Sydney/Brisbane, UTC+10). You're in **Perth, AWST (UTC+8) — 2 hours behind.**

| Milestone | Official (AEST) | **Your time (AWST / Perth)** |
|---|---|---|
| Hackathon starts | Fri 24 Jul 7:00 PM | **Fri 24 Jul 5:00 PM** |
| **1st Submission deadline** | **Sun 26 Jul 8:00 PM** | **🔴 Sun 26 Jul 6:00 PM** |
| Final Submission deadline | Fri 31 Jul 11:59 PM | **Fri 31 Jul 9:59 PM** |
| Demo & Pitch Night | Mon 10 Aug 5–9 PM | Mon 10 Aug 3–7 PM |

**Set a phone alarm for Sun 5:00 PM Perth** ("submit or die"). If you're cycling Sunday and think "8pm, heaps of time," you lose it at 6pm your time. This is the single most likely way to blow the whole thing.

## Where submissions actually go (RESOLVED)
Registration is on Devpost, but **submissions are HubSpot forms** (per the Participant Guide — these are canonical, with hard "incomplete = eliminated" language). Devpost's project gallery is optional visibility, not the required channel.
- **1st Submission form:** https://5g7rh.share.hsforms.com/2ADjEmSSlTZ2iLL4-pAItUg  *(already live)*
- **Final Submission form:** https://share.hsforms.com/2EBBQ_zYMT9qfO52ULunbLw5g7rh
- **Prior-work disclosure form:** https://5g7rh.share.hsforms.com/28nSAlWfFTBeiDG3Pnmj_YA  *(before build start)*
- *(Optional) create a Devpost project for gallery visibility — confirm in `#hackathon-help-2026` whether it's needed; the guide does not require it.)*

## 1st Submission form — EXACT fields (pre-filled answers)
1. **Team name:** `Cadence` (solo team — confirm they allow team-of-1; the guide says teams of 2–4 *recommended*, not required)
2. **How many team members:** `1`
3. **Email:** the address you registered on Devpost with (shivamsharma17723@gmail.com?) — must match
4. **YouTube link to 60-sec demo (NOT private):** ← the one genuinely new artifact; your voice/screen
5. **"Any work completed before the official Build Weekend?":** **Yes** (consistent with the disclosure form + your email — three places must all say Yes)
6. **Confirm checkboxes:** ☑ 60s video ☑ working prototype/PoC ☑ demonstrates Pinch tech ☑ team details

## Final Submission form — fields (Fri 31)
Team name & members · contact email · **YouTube 2–3 min pitch (not private)** · brief solution description · how you used the Pinch API · GitHub repo (only if requested — private is fine).

## ARE WE SUBMITTABLE? → **Yes, comfortably.** The risk is 100% logistical.
- ✅ **Working prototype demonstrating Pinch tech** — already exists (real sandbox integration: live payer/source/payment IDs; the demo). This is the hard requirement and it's done.
- ✅ **Team details** — trivial.
- ⛔ **60-sec video** — the ONLY missing round-1 artifact, and it's yours (voice + screen capture). ~30 min to record.
- ⛔ **Paste + submit the form before Sun 6 PM Perth** — yours.

**Golden takeaway:** we cannot end up with "nothing to submit." Every failure mode is you not recording the video or not clicking submit in time. So the plan optimises for *those two things*, not for code.

## What I can build during the window (upgrades the PoC, not required to be submittable)
LiveDriver (real IDs on screen) → the webhook→gate→model→recovery loop running end-to-end against the sandbox → a merchant-facing view. All disclosed as "built in the window." Nice-to-have polish on an already-submittable base.
