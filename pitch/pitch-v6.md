# Cadence — pitch v6 (launch-dossier integration)

> v5 → v6 deltas: market math CORRECTED before a judge corrects it (4–8% electronic failure, not 15%;
> incumbent bar = auto-rebill >50%); the consent-SMS-as-LEGAL-INSTRUMENT beat (the dossier's gem);
> success-only pricing as the structurally-uncopyable wedge; the close becomes THREE SPECIFIC ASKS
> to Pinch (Demo Night = first commercial meeting, not "judge my project"); launch-readiness spoken
> as a 90-day plan with a named kill-metric. Personal-position guardrail in Q&A (never "I'll quit",
> never "I'd never run it").

## The 3:00 script (~400 words)

Dana pays fifteen dollars a week for her gym. Last Tuesday her debit bounced — three days before payday — and her gym's legacy biller charged her **twenty-nine dollars ninety**. **[pause]** Twice her membership. For the incumbent billers, the failure *is* the revenue. The gym never noticed. Dana quit.

Even well-run, electronically-billed businesses see four to eight percent of direct debits fail — and more than eighty percent of those are just insufficient funds. Money that exists, arriving days later. The incumbents' answer is a blind auto-rebill and a fee. Ours is different.

**Cadence predicts which direct debits will fail and moves them to the payer's funded day — with their consent.** **[pause]** Prediction is the default; consent is the upgrade.

And here's the part that isn't UX — it's law: under direct-debit rules, a *unilateral* date change needs fourteen days' written notice. A **payer-agreed** change takes effect immediately. **Dana's reply IS the legal instrument.** Her exact words are stamped into the payment's metadata — every recovery carries its own consent receipt, which is also the dispute defence.

Watch. *(risk sweep)* The model prices Dana's Thursday debit at sixty-four percent — drag it; every date has a price, and this curve was learned. *(bank date)* Dishonoured. *(the ask)* The model picks her funded day and texts her — I'll type her reply: *"can't do Friday, Monday works."* **[silence]** Caught the negation. Monday. *(settle)* **Settled. Forty-five dollars recovered** — and the transfer reconciles it on Pinch's rails: our fifteen percent rides as an applicationFee line-item. **We only earn when the payment lands. The incumbents earn when it fails — which is exactly why they can't copy this.**

The ML, honestly: trained on a disclosed synthetic ledger; strip the hidden pay-cycles and it collapses to a coin flip — that ablation is how you know it learned the real mechanism. The production number comes from a pilot with a named kill-metric: **ten points of attributable uplift over the merchant's existing auto-rebill**, measured on real ledger data against a payday heuristic. If it clears, this is a business; if it doesn't, you got a free diagnostic. Either way you learn the truth.

So three asks, all cheap, all revenue-positive for Pinch: **one — DDRSA template language covering re-presentation and payer-agreed re-timing. Two — dishonour-data access for the pilot baseline. Three — a partner-program slot.** Every dollar Cadence recovers earns Pinch its processing fee on volume it currently loses — and closes the one gap GoCardless ships against you.

**Twenty-nine-ninety for failing — or forty-five dollars recovered, with a receipt.** The repo is public. Let's run the pilot.

## The 2:00 compression (~270 words)

Dana pays fifteen dollars a week for her gym. Her debit bounced three days before payday, and the legacy biller charged her **twenty-nine dollars ninety** — twice her membership. **[pause]** For the incumbents, the failure *is* the revenue.

Even electronically-billed businesses see four to eight percent of debits fail; most are just insufficient funds — money that exists, arriving days later. **Cadence predicts which debits will fail and moves them to the payer's funded day — with their consent.** And consent isn't UX — it's law: a unilateral date change needs fourteen days' notice; a **payer-agreed** one is immediate. **Dana's reply is the legal instrument**, stamped into the payment's metadata as a consent receipt.

Watch: the model prices her debit at sixty-four percent risk. It fails. It picks her funded day and texts her — I'll type her reply live: *"can't do Friday, Monday works."* **[silence]** Caught the negation. Monday. **Settled — forty-five dollars recovered**, our fifteen percent riding the transfer as an applicationFee. **We earn only when the payment lands; the incumbents earn when it fails — that's why they can't copy this.**

Honest ML: synthetic ledger, and the ablation is the proof — strip the pay-cycle structure and it collapses to a coin flip. The real number comes from a pilot with a named kill-metric: **ten points of attributable uplift over existing auto-rebill.**

Three asks: **DDRSA language for payer-agreed re-timing, dishonour-data access for the baseline, a partner slot.** Every recovered dollar earns Pinch processing on volume it loses today.

**Twenty-nine-ninety for failing — or forty-five recovered, with a receipt. Let's run the pilot.**

## Q&A bank (v6 additions — full bank in v4/v5)
- **"Will you quit your job to run this?"** → *"I'm employed and I like my job. What I'm committed to is the pilot and the mechanism — and I'd explore the right structure with Pinch to take it further: partnership, licensing, or building it inside. The 'ongoing opportunities' line in your own rules is the conversation I'm here for."* (Never claim founding intent; never disclaim it either.)
- **"Isn't 15% expensive vs GoCardless at ~1%?"** → *"Success+ is enterprise bundling on their own rail. For an SMB, the comparator is the $29.90 fee their member eats today, the 11–15% Forrester puts on manual recovery, and the churn of a member who quits. 15% of a save the merchant otherwise loses, zero on everything else — and only on attributable saves."*
- **"Ezypay already auto-rebills >50%."** → *"Right — that's the bar, and it's in our kill-metric: ten points attributable uplift OVER the incumbent outcome, or this is a feature, not a product. Blind rebill can't choose the funded day, can't get consent, and charges the payer a fee when it misses."*
- **"What about PayTo making this obsolete?"** → *"PayTo agreement value is ~0.1% of BECS direct-debit volume and the 2030 end-date was formally removed in December — the realistic world is a decade of dual rail. And when PayTo does arrive, funded-day intelligence gets MORE valuable: real-time debits fail in real time."*
- **"Sender ID / SMS compliance?"** → *"Registered sender ID before the first pilot message — the ACMA register went hard-live 1 July; unregistered IDs show as 'Unverified'. Messages stay strictly factual under the Spam Act's designated-commercial carve-out. And the December automated-decision-disclosure rule covers exactly this model — the privacy policy ships with it named."*
