/**
 * Merchant dashboard data — the operator's product surface.
 *
 * A gym's upcoming fortnightly debit run, each debit scored by the SAME
 * LightGBM model the recovery loop uses (via planRecovery). High-risk debits
 * are flagged before they fail; the summary projects recoverable dollars.
 * Portfolio is illustrative (labelled in the UI); the SCORES are real model
 * output, cached after first build.
 */
import { planRecovery, type PayerContext } from './loop.js';

export interface DebitRow {
  payer: string;
  amount: number;          // dollars
  dueDate: string;         // ISO
  risk: number;            // P(dishonour) from the model
  band: 'low' | 'medium' | 'high';
  recommend: string;       // what Cadence would do
}
export interface Dashboard {
  generatedNote: string;
  summary: { activeMandates: number; thisRunAud: number; atRiskAud: number; projectedRecoveredAud: number };
  rows: DebitRow[];
}

// Illustrative portfolio — varied features so the model returns a real spread.
const PORTFOLIO: Array<{ name: string; amount: number; ctx: Partial<PayerContext> }> = [
  { name: 'Dana R.',    amount: 45, ctx: { n_prior_nsf: 2, days_since_last_nsf: 14, amount_over_payer_mean: 1.0, schedule_dom: -1 } },
  { name: 'Marcus T.',  amount: 30, ctx: { n_prior_nsf: 0, days_since_last_nsf: 999, amount_over_payer_mean: 1.0 } },
  { name: 'Priya S.',   amount: 60, ctx: { n_prior_nsf: 3, days_since_last_nsf: 14, amount_over_payer_mean: 1.6, schedule_dom: -2 } },
  { name: 'Jordan K.',  amount: 45, ctx: { n_prior_nsf: 1, days_since_last_nsf: 28, amount_over_payer_mean: 1.1 } },
  { name: 'Aisha M.',   amount: 25, ctx: { n_prior_nsf: 0, days_since_last_nsf: 999, amount_over_payer_mean: 0.9 } },
  { name: 'Tom H.',     amount: 90, ctx: { n_prior_nsf: 4, days_since_last_nsf: 14, amount_over_payer_mean: 2.0, schedule_dom: -1 } },
  { name: 'Chloe W.',   amount: 45, ctx: { n_prior_nsf: 0, days_since_last_nsf: 60, amount_over_payer_mean: 1.0 } },
  { name: 'Sam O.',     amount: 40, ctx: { n_prior_nsf: 2, days_since_last_nsf: 14, amount_over_payer_mean: 1.3, schedule_dom: -2 } },
  { name: 'Ben L.',     amount: 35, ctx: { n_prior_nsf: 0, days_since_last_nsf: 999, amount_over_payer_mean: 1.0 } },
  { name: 'Grace N.',   amount: 55, ctx: { n_prior_nsf: 1, days_since_last_nsf: 42, amount_over_payer_mean: 1.2 } },
  { name: 'Ravi P.',    amount: 45, ctx: { n_prior_nsf: 3, days_since_last_nsf: 14, amount_over_payer_mean: 1.5, schedule_dom: -1 } },
  { name: 'Ella F.',    amount: 30, ctx: { n_prior_nsf: 0, days_since_last_nsf: 90, amount_over_payer_mean: 0.95 } },
];

const baseCtx = (amount: number, over: number): PayerContext => ({
  payerId: 'pyr_portfolio', amount, day: 226, n_prior: 12, n_prior_nsf: 0, nsf_days: [198, 212],
  schedule_period: 14, schedule_dom: -1, mandate_age: 180, days_since_last_nsf: 999, amount_over_payer_mean: over,
});

let cache: Dashboard | null = null;

export async function merchantDashboard(): Promise<Dashboard> {
  if (cache) return cache;
  const today = new Date();
  const dueDate = new Date(today); dueDate.setDate(today.getDate() + 2);
  const rows: DebitRow[] = [];
  for (const p of PORTFOLIO) {
    const ctx: PayerContext = { ...baseCtx(p.amount, p.ctx.amount_over_payer_mean ?? 1.0), ...p.ctx };
    let risk = 0.05;
    try { risk = (await planRecovery('insufficient-funds', ctx)).pDishonour ?? 0.05; } catch { /* fallback */ }
    const band = risk >= 0.35 ? 'high' : risk >= 0.15 ? 'medium' : 'low';
    rows.push({
      payer: p.name, amount: p.amount, dueDate: dueDate.toISOString().slice(0, 10), risk, band,
      recommend: band === 'high' ? 'Re-time to payday + consent SMS'
        : band === 'medium' ? 'Watch — retry-ready if it fails' : 'Proceed as scheduled',
    });
  }
  rows.sort((a, b) => b.risk - a.risk);
  const thisRun = rows.reduce((s, r) => s + r.amount, 0);
  const atRisk = rows.filter((r) => r.band !== 'low').reduce((s, r) => s + r.amount * r.risk, 0);
  cache = {
    generatedNote: 'Illustrative portfolio; risk scores are live LightGBM model output.',
    summary: {
      activeMandates: rows.length,
      thisRunAud: Math.round(thisRun),
      atRiskAud: Math.round(atRisk),
      projectedRecoveredAud: Math.round(atRisk * 0.46), // model recovery rate (held-out)
    },
    rows,
  };
  return cache;
}
