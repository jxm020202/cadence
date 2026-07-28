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
import { classify, human, iso, rollForward } from './consent/parser.js';
import { IdempotencyStore } from './idempotency.js';
import { PaymentStateLog } from './ledger.js';

// Cadence's take, as a NATIVE Pinch primitive: applicationFee on the recovery
// payment, reconciled in the transfer line-items. 15% of recovered dollars.
export const CADENCE_FEE_RATE = 0.15;

// Process-wide guards. Bank-results webhooks are at-least-once, so the recovery
// act is wrapped in the idempotency store: a re-delivered event never debits
// the payer twice. Every lifecycle transition lands in the append-only log.
export const idempotency = new IdempotencyStore();
export const stateLog = new PaymentStateLog();

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
  consentAsk?: string;     // the SMS: model's day as default, reply to override
}

/** Outcome of the payer's reply to the consent ask (predict-then-ask). */
export interface ConsentOutcome {
  action: 'confirmed' | 'overridden' | 'refused-hard-code' | 'opt-out' | 'hardship' | 'clarify';
  parse: { intent: string; quote: string; label?: string };
  retryDate?: string;      // ISO date the recovery will run (model's or payer's)
  receipt?: string;        // goes into the payment's metadata — the audit object
  reply?: string;          // what Cadence texts back
}

/** Apply the payer's reply. Model day = the default; the ask is a consent
 * upgrade, never a dependency. Hard-coded gate wins over ANY reply: a new
 * date cannot fix a dead account. */
export function applyPayerReply(
  plan: RecoveryPlan,
  replyText: string,
  modelDate: Date,
  now: Date = new Date(),
): ConsentOutcome {
  const intent = classify(replyText, now);
  const quote = replyText.trim();

  if (plan.gate === 'never-retry') {
    return {
      action: 'refused-hard-code',
      parse: { intent: intent.type, quote },
      reply: `We can't re-debit this account (${plan.dishonourType}) — even on a new date. Here's a secure link to update your payment method instead.`,
    };
  }
  if (intent.type === 'optout') {
    return { action: 'opt-out', parse: { intent: intent.type, quote }, reply: 'Done — no further debits. Your gym will be in touch.' };
  }
  if (intent.type === 'hardship' || intent.type === 'pause') {
    return { action: 'hardship', parse: { intent: intent.type, quote }, reply: 'No debit scheduled. We can split or pause — reply SPLIT or PAUSE, or we\'ll check in next week.' };
  }
  if (intent.type === 'date') {
    const rolled = rollForward(intent.date);
    return {
      action: 'overridden',
      parse: { intent: intent.type, quote, label: intent.label },
      retryDate: iso(rolled.date),
      receipt: `payer-chose: "${quote}" -> ${iso(rolled.date)}${rolled.rolled ? ' (rolled off weekend)' : ''}`,
      reply: `Locked in — ${human(rolled.date)}. Reply CHANGE any time.`,
    };
  }
  if (intent.type === 'confirm' || intent.type === 'payday_no_date') {
    return {
      action: 'confirmed',
      parse: { intent: intent.type, quote },
      retryDate: iso(modelDate),
      receipt: `payer-confirmed model day: "${quote}" -> ${iso(modelDate)}`,
      reply: `Great — ${human(modelDate)} it is. Reply CHANGE any time.`,
    };
  }
  return { action: 'clarify', parse: { intent: intent.type, quote }, reply: 'Just tell me a day that suits — like "Friday" or "the 28th".' };
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
      consentAsk: consentAskText(ctx.amount, result.best_retry_day),
    };
  } catch (e) {
    console.warn(`[loop] model bridge failed (${e}); static fallback`);
    return { gate: 'retry', dishonourType, bestRetryDay: 2, modelUsed: false, consentAsk: consentAskText(ctx.amount, 2) };
  }
}

function consentAskText(amount: number, day: number): string {
  return `Hi — your $${amount.toFixed(2)} payment bounced; no fee from us. We've pencilled the retry for +${day} days (near your usual payday). Reply with a day that suits better, OK to confirm, or STOP to opt out.`;
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

    stateLog.append({ ts: new Date().toISOString(), paymentId, payerId: ctx.payerId ?? '?',
      state: 'dishonoured', reason: dishonourType, amountCents: Math.round(ctx.amount * 100) });
    const plan = await planRecovery(dishonourType, ctx);
    const result: { paymentId: string; plan: RecoveryPlan; actedWith?: unknown; idempotent?: string } = { paymentId, plan };

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
        // silent re-time (re-presentation under the existing mandate) + Cadence's
        // cut as a native fee, both reconciled/auditable on Pinch's own rails
        metadata: `silent re-time to payday (model day+${plan.bestRetryDay}); re-presentation under existing mandate — no member contact`,
        applicationFee: Math.round(ctx.amount * 100 * CADENCE_FEE_RATE),
      };
      result.actedWith = body;
      stateLog.append({ ts: new Date().toISOString(), paymentId, payerId: ctx.payerId,
        state: 'rescheduled', reason: `model day+${plan.bestRetryDay}`, amountCents: body.amount });
      // THE ACT, guarded: a NEW model-timed recovery via save-payment (create),
      // wrapped so an at-least-once re-delivery of this bank-results event can
      // never fire a second debit. Same payload → replay; different → 409.
      const { replayed } = await idempotency.run(
        'recover', paymentId, body, () => Pinch.savePayment(body), new Date().toISOString(),
      );
      result.idempotent = replayed ? 'replayed' : 'acted';
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
