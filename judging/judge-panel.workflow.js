export const meta = {
  name: 'cadence-judge-panel',
  description: 'Mock Demo-Night judging: 4 judges on 4 different models (haiku/sonnet/opus/fable), personas rotated per round, score the current Cadence pitch against the real criteria; a chair synthesizes verdict + ranked fixes',
  phases: [
    { title: 'Judge', detail: '4 judges, one per model, personas rotated by round' },
    { title: 'Chair', detail: 'aggregate scores, rank the fixes' },
  ],
}

// args: { round: number, pitchFile: string }
const round = (args && args.round) || 1
const pitchFile = (args && args.pitchFile) || '/Users/davidberos/pinch-hackathon/pitch/pitch-v1.md'
const REPO = '/Users/davidberos/pinch-hackathon'

const COMPETITION = `
COMPETITION: "Pinch Me! I Want 50K" — Pinch Payments (Fiserv-owned since Apr 2025) x The Founders Union (Scalare Partners, ASX:SCP). $50,000 single cash prize. Two-stage: 60s video + working PoC (Jul 26); 2-3 min pitch video + full demo + API-integration walkthrough + GitHub (Jul 31); live Demo Night Aug 10. ~95 registrants. Judging criteria: Innovation, Technical Execution, User Experience, Commercial Potential, Problem Solving, Effective Use of Pinch Technology. The hackathon's true purpose: API adoption + a reference integration Pinch can show ISVs + talent/dealflow scouting ("outstanding teams may be invited to explore ongoing opportunities").
PINCH: Australian accounting-native payments (BECS direct debit 1%+30c capped $5 + cards), Xero-native two-way sync, ~2,000-4,000 merchants, sold via bookkeepers. API: payers/payment-sources/payments(+realtime)/plans/subscriptions/payment-links/webhooks/managed-merchants; sandbox has Time-Travel header + #dishonour-code forcing. Docs state "It's up to you to schedule a new payment when one fails" (no retry engine — confirmed whitespace). Glassbox = PayFac-as-a-Service (what Fiserv paid ~US$365m for).
THE ENTRY BEING JUDGED: "Cadence" — read the pitch and repo evidence yourself.
`

const PERSONAS = [
  {
    key: 'cull',
    text: `You are BEN CULL, Pinch's technical co-founder (engineer-first, ex-.NET solution architect, wrote this sandbox, reads GitHub repos during judging). Your philosophy: "adapt a proven model, improve one part — don't invent a category." You despise AI theatre and hand-waving; you reward inspectable models, honest caveats, and correct use of YOUR API (you know exactly what save-payment, Time-Travel and #dishonour-codes do). You ask the questions only the platform author could ask.`,
  },
  {
    key: 'breeze',
    text: `You are CAROLYN BREEZE, CEO of Scalare Partners, 20+ year payments operator: Braintree AU Country Manager, PayPal, GM who scaled GoCardless ANZ (you personally sold Success+, the ML retry product), CCO at Zepto. You judge commercial viability: who pays, unit economics, channel, moat, founder credibility. You know AU direct-debit compliance (DDR service agreements, notice periods) cold and you WILL ask about consent. You've seen every failed-payment pitch; derivative claims annoy you unless the wedge is genuinely different.`,
  },
  {
    key: 'mentor',
    text: `You are a FOUNDERS UNION lead mentor and Scalare investment principal. You judge fundability: is this a startup or a feature, can this solo founder execute, does the roadmap survive contact with reality, would Scalare put money in or acquire it. You care about the story arc of the pitch itself — does it land in 3 minutes, is there one number the room remembers.`,
  },
  {
    key: 'rival',
    text: `You are the sharpest RIVAL TEAM LEAD in the room on Demo Night, watching this pitch to find its weaknesses for the Q&A. You attack demo theatrics (what was actually live vs staged), differentiation ("three other teams built AI retry tonight"), and any number that smells unsourced. You are technical enough to spot a faked demo and commercial enough to spot a fake TAM. Score honestly — if it would beat you, say so.`,
  },
]

const MODELS = ['haiku', 'sonnet', 'opus', 'fable']

const JUDGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    judge: { type: 'string' },
    model_notes: { type: 'string', description: 'one line: what you focused on' },
    scores: { type: 'object', additionalProperties: false, properties: {
      innovation: { type: 'number' }, technical_execution: { type: 'number' },
      user_experience: { type: 'number' }, commercial_potential: { type: 'number' },
      problem_solving: { type: 'number' }, effective_use_of_pinch: { type: 'number' },
    }, required: ['innovation','technical_execution','user_experience','commercial_potential','problem_solving','effective_use_of_pinch'] },
    // THE TWO-PART WIN — scored separately from the official criteria:
    meta_scores: { type: 'object', additionalProperties: false, properties: {
      product_spectacle: { type: 'number', description: '1-10: would the room audibly react? is there a gasp beat?' },
      founder_signal: { type: 'number', description: '1-10: does the entry prove a UNIQUE ability — would you personally hire/back this founder after 3 minutes? Is the ML craft visible and un-fakeable, or could any dev have shipped this?' },
      pitch_craft: { type: 'number', description: '1-10: the pitch AS DELIVERED — narrative arc, pacing, one memorable number, a "why me" beat, Q&A readiness' },
    }, required: ['product_spectacle','founder_signal','pitch_craft'] },
    total: { type: 'number' },
    verdict: { type: 'string', enum: ['clear-winner','finalist','middle-of-pack','weak'] },
    brutal_questions: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    biggest_fix: { type: 'string' },
    what_flips_to_win: { type: 'string' },
  },
  required: ['judge','model_notes','scores','meta_scores','total','verdict','brutal_questions','biggest_fix','what_flips_to_win'],
}

phase('Judge')
log(`Round ${round}: personas rotated by ${round % 4}`)
const judges = await parallel(MODELS.map((model, i) => () => {
  const persona = PERSONAS[(i + round) % 4]
  return agent(
    `${persona.text}

${COMPETITION}

Read the pitch: Read the file ${pitchFile}
Then inspect the evidence like a judge would: Read ${REPO}/README.md and, if you want more, ${REPO}/docs/final-verdict.md and ${REPO}/ml/outputs/metrics.json (ML results) — spot-check claims against what's actually in the repo.

Score the entry 1-10 on each of the six REAL criteria, AND the three meta dimensions (the founder is explicitly playing a two-part game: a spectacular product that proves a UNIQUE personal ability — this entry doubles as a hiring audition — and pitch delivery as its own craft):
- product_spectacle: would the room audibly react? is there a gasp beat, or just competence?
- founder_signal: after 3 minutes, would YOU hire or back this specific person? Is the ML/engineering craft visible and un-fakeable, or could any competent dev have shipped it?
- pitch_craft: the script as delivered — arc, pacing, ONE number the room remembers, a "why me" beat, Q&A readiness.
Give a verdict, your 3 most brutal Q&A questions, the single biggest fix, and what would flip this to a clear win FOR YOU specifically. Judge the pitch AS DELIVERED — do not fill gaps charitably. Be the persona, not a generic reviewer.`,
    { label: `judge:${persona.key}@${model}`, phase: 'Judge', model, schema: JUDGE_SCHEMA }
  )
}))

phase('Chair')
const chair = await agent(
  `You are the judging chair aggregating a 4-judge panel for the Pinch hackathon. Panel results:
${JSON.stringify(judges.filter(Boolean))}

Produce: consensus scores per criterion (mean), total, the panel verdict, the TOP 5 fixes ranked by (impact on winning x how many judges raised it), the 5 hardest Q&A questions deduplicated, and a one-paragraph coaching note to the founder on what to change before the next round. In the coaching note, address the TWO-PART GAME separately: (a) product spectacle + founder signal (is the unique ability visible?), (b) pitch craft as its own skill.`,
  { label: 'chair:synthesis', phase: 'Chair', schema: {
    type: 'object', additionalProperties: false,
    properties: {
      consensus_scores: { type: 'object', additionalProperties: false, properties: {
        innovation: { type: 'number' }, technical_execution: { type: 'number' },
        user_experience: { type: 'number' }, commercial_potential: { type: 'number' },
        problem_solving: { type: 'number' }, effective_use_of_pinch: { type: 'number' },
      }, required: ['innovation','technical_execution','user_experience','commercial_potential','problem_solving','effective_use_of_pinch'] },
      total: { type: 'number' },
      panel_verdict: { type: 'string' },
      top_fixes: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      hardest_questions: { type: 'array', items: { type: 'string' }, maxItems: 5 },
      coaching_note: { type: 'string' },
    },
    required: ['consensus_scores','total','panel_verdict','top_fixes','hardest_questions','coaching_note'],
  } }
)

return { round, judges: judges.filter(Boolean), chair }
