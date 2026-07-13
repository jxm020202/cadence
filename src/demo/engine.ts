/**
 * Demo engine: the "Dana" red→green recovered-dollar story as a step machine.
 *
 * Two drivers share one interface:
 *  - MockDriver (default): replays PAYLOAD-EXACT shapes from the documented
 *    Pinch event catalogue (docs/events.md, payment-statuses.md). Used until
 *    sandbox keys exist and on stage as the rehearsed fallback.
 *  - LiveDriver (PINCH_MODE=live): the same steps as real sandbox calls with
 *    the Time-Travel header. Wired in the day-0 spike.
 *
 * Honesty contract (shown in the UI): in mock mode every payload is labelled
 * MOCK; in live mode the raw request/response pairs are shown untouched.
 */

export interface ApiCall {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  response?: unknown;
  mock: boolean;
}

export interface DemoState {
  step: number;
  stepName: string;
  narration: string;
  payer: { id: string; name: string; plan: string };
  payments: Array<{
    id: string;
    amount: number;
    date: string;
    status: 'scheduled' | 'processing' | 'dishonoured' | 'settled';
    risk?: number;
    note?: string;
  }>;
  smsSent?: string;
  recoveredAud: number;
  calls: ApiCall[];
  done: boolean;
}

import { planRecovery, type PayerContext, type RecoveryPlan } from '../loop.js';

const PAYER_ID = 'pyr_demo_dana_01';
const PAY_A = 'pmt_demo_a_thu14';
const PAY_B = 'pmt_demo_b_fri28';

// dates are relative-labelled for the stage; live driver uses real ISO dates
const THU_14 = '2026-08-14';
const FRI_28 = '2026-08-28';

// Dana's billing context — the SAME shape the live webhook loop consumes.
// Two prior NSFs 14 days apart, both at the same pay-cycle phase as today's
// failure: enough history for the estimator to lock her fortnight.
export const DANA_CONTEXT: PayerContext = {
  payerId: PAYER_ID,
  amount: 45,
  day: 226,
  n_prior: 12,
  n_prior_nsf: 2,
  nsf_days: [198, 212],
  schedule_period: 14,
  schedule_dom: -1,
  mandate_age: 180,
  days_since_last_nsf: 14,
  amount_over_payer_mean: 1.0,
};

export class MockDriver {
  private step = 0;
  private plan: RecoveryPlan | null = null; // real model output, cached

  /** Warm the model bridge at server boot so the first click never stalls. */
  async warm(): Promise<void> {
    if (!this.plan) this.plan = await planRecovery('insufficient-funds', DANA_CONTEXT);
  }

  async state(): Promise<DemoState> {
    return this.render();
  }

  async reset(): Promise<DemoState> {
    this.step = 0;
    return this.render();
  }

  async advance(): Promise<DemoState> {
    if (this.step < 3) this.step += 1;
    if (this.step >= 2 && !this.plan) {
      // THE SAME CODE PATH as the live webhook: gate → LightGBM → plan.
      this.plan = await planRecovery('insufficient-funds', DANA_CONTEXT);
    }
    return this.render();
  }

  /** ISO date `d` model-days after the failed debit (day index 226 == THU_14). */
  private dateAfterFail(d: number): string {
    const base = new Date(THU_14);
    base.setDate(base.getDate() + d);
    return base.toISOString().slice(0, 10);
  }

  private modelCall(): ApiCall | null {
    if (!this.plan) return null;
    return {
      method: 'SCORE', path: 'ml/scripts/score.py → LightGBM (model/cadence.txt)',
      mock: !this.plan.modelUsed,
      body: DANA_CONTEXT,
      response: {
        gate: this.plan.gate, p_dishonour: this.plan.pDishonour,
        best_retry_day: this.plan.bestRetryDay, retry_scores: this.plan.retryScores,
      },
    };
  }

  private render(): DemoState {
    const s = this.step;
    const retryDay = this.plan?.bestRetryDay ?? 14;
    const retryDate = this.dateAfterFail(retryDay);
    const risk = this.plan?.pDishonour ?? 0.42;
    const base: DemoState = {
      step: s,
      stepName: ['setup', 'bank-date', 'retime', 'payday'][s],
      narration: '',
      payer: { id: PAYER_ID, name: 'Dana', plan: 'Gym membership — $45.00 fortnightly (BECS direct debit)' },
      payments: [],
      recoveredAud: 0,
      calls: [],
      done: s >= 3,
    };

    // Step 0: objects created, model scores the scheduled debit
    const createCalls: ApiCall[] = [
      {
        method: 'POST', path: '/payers', mock: true,
        body: { firstName: 'Dana', emailAddress: 'dana@example.com' },
        response: { id: PAYER_ID, firstName: 'Dana' },
      },
      {
        method: 'POST', path: '/payment-sources', mock: true,
        body: { payerId: PAYER_ID, sourceType: 'bank-account', bankAccountBsb: '012-001', bankAccountNumber: '987654321' },
        response: { id: 'src_demo_dana_bank' },
      },
      {
        method: 'POST', path: '/payments', mock: true,
        body: { payerId: PAYER_ID, amount: 4500, transactionDate: THU_14, description: 'Gym membership #insufficient-funds' },
        response: { id: PAY_A, status: 'scheduled', amount: 4500, transactionDate: THU_14 },
      },
    ];

    if (s === 0) {
      const pct = Math.round(risk * 100);
      base.narration = `Dana’s $45 debit is scheduled for Thursday the 14th. Cadence scores it: ${pct}% dishonour risk — it lands days before her likely payday.`;
      base.payments = [{ id: PAY_A, amount: 45, date: THU_14, status: 'scheduled', risk,
        note: this.plan?.modelUsed ? 'model-scored' : 'scoring…' }];
      const mc = this.modelCall();
      base.calls = mc ? [...createCalls, mc] : createCalls;
      return base;
    }

    // Step 1: time-travel to the bank date — A dishonours (payload-exact bank-results)
    const bankResults: ApiCall = {
      method: 'GET', path: `/payments/${PAY_A}`, mock: true,
      headers: { 'Time-Travel': `${THU_14}T20:00:00Z` },
      response: {
        Id: 'evt_demo_bankresults_1', Type: 'bank-results', EventDate: `${THU_14}T19:45:00Z`,
        Metadata: { SuccessCount: 11, DishonourCount: 1, DishonourAmount: 4500 },
        Data: [{ PaymentId: PAY_A, Status: 'dishonoured', Dishonour: { Type: 'insufficient-funds', Reason: 'Refer to Drawer' } }],
      },
    };
    if (s === 1) {
      base.narration = 'The bank run comes back: DISHONOURED — insufficient funds. $45 at risk, and with an incumbent biller Dana would now owe a $29.90 failure fee.';
      base.payments = [{ id: PAY_A, amount: 45, date: THU_14, status: 'dishonoured', risk, note: 'insufficient-funds — Refer to Drawer' }];
      base.calls = [bankResults];
      return base;
    }

    // Step 2: Cadence acts — the SAME planRecovery() the live webhook runs:
    // hard-code gate → LightGBM scores all 14 candidate days → best day →
    // recovery scheduled through Pinch's own save-payment path.
    const retime: ApiCall = {
      method: 'POST', path: '/payments', mock: true,
      body: { payerId: PAYER_ID, amount: 4500, transactionDate: retryDate, description: 'Gym membership (recovery)' },
      response: { id: PAY_B, status: 'scheduled', amount: 4500, transactionDate: retryDate },
    };
    if (s === 2) {
      const settleP = this.plan?.retryScores?.[String(retryDay)];
      base.narration = `Cadence gates the code (insufficient-funds → retryable), scores all 14 candidate days with the trained model, and picks day +${retryDay} — Dana’s likely-funded day. The recovery goes through Pinch’s own save-payment endpoint. Dana gets an SMS. The only thing that changed is the date.`;
      base.payments = [
        { id: PAY_A, amount: 45, date: THU_14, status: 'dishonoured', note: 'insufficient-funds' },
        { id: PAY_B, amount: 45, date: retryDate, status: 'scheduled',
          risk: settleP != null ? 1 - settleP : undefined, note: `model-timed: day +${retryDay}` },
      ];
      base.smsSent = `Hi Dana — your $45 gym payment bounced; no fee from us. We’ve moved it to ${retryDate}. Reply STOP to opt out.`;
      const mc = this.modelCall();
      base.calls = mc ? [mc, retime] : [retime];
      return base;
    }

    // Step 3: time-travel past the model's chosen day — B settles, transfer fires
    const settleTT = `${this.dateAfterFail(retryDay + 1)}T09:00:00Z`;
    const settle: ApiCall[] = [
      {
        method: 'GET', path: `/payments/${PAY_B}`, mock: true,
        headers: { 'Time-Travel': settleTT },
        response: { id: PAY_B, status: 'settled', amount: 4500, transactionDate: retryDate },
      },
      {
        method: 'GET', path: '/events?type=transfer', mock: true,
        headers: { 'Time-Travel': settleTT },
        response: {
          Id: 'evt_demo_transfer_1', Type: 'transfer', EventDate: settleTT,
          Data: { TransferId: 'tra_demo_1', LineItems: [{ PaymentId: PAY_B, Type: 'Settlement', Amount: 4500 }] },
        },
      },
    ];
    base.narration = 'The funded day arrives. The recovery debit clears — SETTLED — and the transfer lands in the gym’s account. $45 recovered. Same rails, same authority, better timing.';
    base.payments = [
      { id: PAY_A, amount: 45, date: THU_14, status: 'dishonoured', note: 'insufficient-funds' },
      { id: PAY_B, amount: 45, date: retryDate, status: 'settled', note: `recovered on model-timed day +${retryDay}` },
    ];
    base.recoveredAud = 45;
    base.calls = settle;
    return base;
  }
}

export const demo = new MockDriver();
