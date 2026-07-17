# Info-session intel (Ben Cull, in his own words) — the highest-signal source we have

> From the 51-min Pinch info-session replay (full transcript: `info-session-transcript.txt`).
> Speakers: Ben Cull (Pinch co-founder + judge), Laurien "Lau" Duits (Pinch community), Cameron
> (Pinch implementation manager), Kez (The Founders Union). This is the judge telling us what wins.

## ⚠️ CORRECTION: there are FIVE judges, not two
1. **Paul Allen** — co-founder, Pinch
2. **Ben Cull** — co-founder, Pinch (the technical one; on this call)
3. **Carolyn Breeze** — CEO, Scalare Partners (ex-GoCardless ANZ)
4. **Julian [surname TBC]** — **VP of SMB Merchant Products, APAC, at FISERV** (transcript says "Pfizer" = mis-caption of *Fiserv*). A Fiserv commercial exec judging directly.
5. **Tim Lee** — founder of **Fidestra AI** (an AI founder)

Our judge panels only modelled Cull + Breeze. Add Paul Allen, a **Fiserv SMB-merchant-products VP**, and an **AI founder** — three new lenses (Fiserv-commercial-fit and AI-credibility now matter directly).

## What Ben Cull explicitly said wins (verbatim themes)
- **Novelty is PRIMARY.** *"It centers around the innovation and novelty of what you're creating… if you can surprise us."* A "to-do app that pays per to-do" = not it.
- **Two halves: novelty + a real business model.** *"What innovation are you bringing to the world, and is this a strong business model… could you stand up a business off the back of this?"* Framing he endorsed: **"Shark Tank with more help."**
- **The novelty must live in the PAYMENT / revenue model — not a cool app with payments bolted on.** Repeated hard: *"how do you make the payments portion of your application into something special, rather than just… slapping payments on it."* And: *"if the novel idea and payments feel quite disjointed, that's probably not going to help you… the novelness interlaced with a really slick utilization of payments — that's where something works."* His example: **Netflix-by-the-second** (the *business model* is the novelty; a payment fires right after).
- **Code quality is NOT scored.** *"We are not trying to judge you on your output… it's not necessarily how good is the code."* Code is only ever requested to **verify authenticity / that you didn't cheat** — IP stays 100% yours.
- **Minimum bar:** *"at the end of the process is a transaction"* — you must **process a transaction through Pinch**. Anything goes as long as that's true.
- Product quality / customer experience matter, but **second** to novelty + business case (that's what the polish week is for).
- **AI/vibe-coding is explicitly encouraged** — *"if you want to vibe code the whole thing, vibe code the whole thing."*

## The official evaluation questions (read out; in the participant guide)
1. Creative / original approach to solving a problem?
2. Addresses a genuine customer or business need?
3. Functional, reliable, technically well-implemented?
4. Intuitive, accessible, easy to use?
5. Potential to deliver real-world value / impact?
6. **Integrates the Pinch API in a meaningful way that actually enhances the solution.**

## ⚠️ Eligibility + prior-work rule (could disqualify a $50k win — read carefully)
- **Only Australian residents are eligible to win.**
- The build is meant to happen **in the hackathon window (25–26 July build weekend + 27–31 polish).** Familiarising with the API docs *now* is explicitly encouraged, but: *"don't start it yet unless you already started — but then tell us exactly what and how before you start."*
- **If you have pre-existing work, you MUST disclose your starting state at kickoff** (a short video/snapshot). *"What you get done during the hackathon has greater weight."* Non-disclosure of pre-built work = **elimination** (*"if you do not disclose that, and we'll find out… that's just not fair"*).
- Blessed case: an **existing business adding a payments component** during the window.
→ **Implication for Cadence:** we've built a lot ahead of the official start. Treat all of it as **disclosed prior art / R&D + familiarisation**, and make the **hackathon-window work** the substantive, weighted build (final integration, the live-sandbox recovery, polish). Be transparent at kickoff. This is an integrity + eligibility must-do, not optional.

## Format & submission mechanics (authoritative)
- **Reg closes 22 Jul.** Team-formation session 23 Jul. **Launch night 24 Jul, Sydney (Luma invite), 5–8pm, kickoff 7pm.** Participant guide sent **24 Jul 12pm**.
- **48h build 25–26 Jul.** **First submission due 26 Jul 7pm (+1h grace to 8pm):** a **60-second pitch video → uploaded to YouTube → URL into a HubSpot form**, plus minimum requirements. Round 1 is **pass/fail** (did you submit a 60s video? does it use the Pinch API? → pass) — unlimited qualifiers.
- **Polish 27–31 Jul** (improve, don't pivot). **Final due 31 Jul before midnight:** **2–3 min video** with a real demo + what you built / what's innovative / what problem / what you hope to achieve.
- Judging **1–2 Aug**. **6 finalists announced 3 Aug.** Finalists get **a week of Founders Union pitch mentoring**.
- **Demo & Pitch Night 10 Aug, Sydney, "The Collider", 5–9pm — LIVE pitch, LIVE winner decision.** $50k cash winner; **$25k fee-free processing** runner-up.
- ~99 participants at session time (in teams). Contact: **growth@getpinch.com.au**.

## Net implications for Cadence
1. **Reframe the pitch so the PAYMENT mechanic is the novelty** (re-timing the debit / consent-scheduled collection *is* the innovation), not "an ML model that calls a payments API." Cadence fits — but say it Ben's way.
2. **Lead with novelty + business model** ("Shark Tank with more help"), not engineering. Our ledger/idempotency depth is for the *audition/authenticity*, not the *score*.
3. **We must actually process a transaction through Pinch** — raises the stakes on the day-0 settlement gap; at minimum create real payments live (done), ideally get one to actually process (open item with Pinch/Dev Portal).
4. **Model all 5 judges** in the panel — especially the **Fiserv SMB VP** (commercial APAC fit) and the **AI founder** (real-ML credibility).
5. **Disclosure plan** for pre-built work is mandatory before kickoff.
