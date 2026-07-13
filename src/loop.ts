/**
 * THE LOOP — Cadence's actuator. One code path shared by:
 *   - the live webhook route (/webhooks/pinch): bank-results event → recovery
 *   - the demo engine (step 2): same planRecovery(), same model, same gate
 *
 * bank-results → HARD-CODE GATE → LightGBM score (ml/scripts/score.py, the
 * exact booster from the eval) → savePayment re-time through the Pinch API.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pinch } from './pinch.js';

const ML_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ml');

// Never retry these: the payer's bank said no. Retrying is the compliance
// failure mode — the gate is the payments-literacy signal.
export const HARD_CODES = new Set(['account-closed', 'payment-stopped', 'blocked-by-bank', 'invalid-account']);

export interface PayerContext {
  payerId?: string;        // Pinch payer id — REQUIRED for the live act
  amount: number;          // dollars
  day: number;             // simulation/business day index of the failed debit
  n_prior: number;
  n_prior_nsf: number;
  nsf_days: number[];      // history of past NSF day-indices (incl. today's)
  schedule_period: number;
  schedule_dom: number;
  mandate_age: number;
  days_since_last_nsf: number;
  amount_over_payer_mean: number;
}

export interface RecoveryPlan {
  gate: 'retry' | 'never-retry';
  dishonourType: string;
  pDishonour?: number;
  bestRetryDay?: number;
  retryScores?: Record<string, number>;
  modelUsed: boolean;      // false => model unavailable, static fallback used
}

/** Score via the trained booster. Falls back to a static payday+2-style plan
 * if the Python bridge is unavailable (flagged, never silent). */
export async function planRecovery(dishonourType: string, ctx: PayerContext): Promise<RecoveryPlan> {
  if (HARD_CODES.has(dishonourType)) {
    return { gate: 'never-retry', dishonourType, modelUsed: false };
  }
  try {
    const result = await scorePy(ctx);
    return {
      gate: 'retry',
      dishonourType,
      pDishonour: result.p_dishonour,
      bestRetryDay: result.best_retry_day,
      retryScores: result.retry_scores,
      modelUsed: true,
    };
  } catch (e) {
    console.warn(`[loop] model bridge failed (${e}); static fallback`);
    return { gate: 'retry', dishonourType, bestRetryDay: 2, modelUsed: false };
  }
}

/** Risk at every candidate date around the scheduled debit — the
 * "drag the debit" demo beat. Returns offset(-7..+14) → P(dishonour). */
export async function sweepRisk(ctx: PayerContext): Promise<Record<string, number>> {
  const res = await scorePy({ ...ctx, sweep: true } as PayerContext & { sweep: true });
  return (res as { p_by_offset?: Record<string, number> }).p_by_offset ?? {};
}

function scorePy(ctx: PayerContext): Promise<{
  p_dishonour: number; best_retry_day: number; retry_scores: Record<string, number>;
}> {
  return new Promise((resolve, reject) => {
    const proc = spawn('uv', ['run', 'scripts/score.py'], { cwd: ML_DIR });
    let out = '', err = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`score.py exit ${code}: ${err.slice(-200)}`));
      try { resolve(JSON.parse(out.trim().split('\n').at(-1)!)); }
      catch (e) { reject(e); }
    });
    proc.stdin.write(JSON.stringify(ctx));
    proc.stdin.end();
  });
}

/** Live path: consume a Pinch bank-results event, plan, and ACT via the API.
 * `dayOfDate` maps ISO dates onto the model's day-index space. */
export async function handleBankResults(
  event: any,
  lookupContext: (paymentId: string) => PayerContext | undefined,
  opts: { act: boolean } = { act: true },
): Promise<Array<{ paymentId: string; plan: RecoveryPlan; actedWith?: unknown }>> {
  const data = event.Data ?? event.data ?? [];
  const results = [];
  for (const item of Array.isArray(data) ? data : [data]) {
    const paymentId = item.PaymentId ?? item.paymentId;
    const status = (item.Status ?? item.status ?? '').toLowerCase();
    if (status !== 'dishonoured') continue;
    const dishonourType = item.Dishonour?.Type ?? item.dishonour?.type ?? 'unknown';
    const ctx = lookupContext(paymentId);
    if (!ctx) { console.warn(`[loop] no context for ${paymentId}`); continue; }

    const plan = await planRecovery(dishonourType, ctx);
    const result: { paymentId: string; plan: RecoveryPlan; actedWith?: unknown } = { paymentId, plan };

    if (plan.gate === 'retry' && plan.bestRetryDay != null && opts.act) {
      if (!ctx.payerId) {
        // A live act without a payer id would 400 — refuse loudly, never guess.
        console.error(`[loop] cannot act on ${paymentId}: context has no payerId`);
        results.push(result);
        continue;
      }
      const retryDate = addDays(new Date(), plan.bestRetryDay);
      const body = {
        payerId: ctx.payerId,
        amount: Math.round(ctx.amount * 100),
        transactionDate: retryDate.toISOString().slice(0, 10),
        description: 'Cadence recovery (model-timed)',
      };
      result.actedWith = body;
      // THE ACT: a NEW model-timed recovery payment via save-payment (create).
      // Deliberate design: we never mutate the dishonoured payment's record —
      // it stays in history as the failure; the recovery is its own object.
      await Pinch.savePayment(body);
    }
    results.push(result);
  }
  return results;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
