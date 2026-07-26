/**
 * Demo engine: FUSED Cadence — predict-then-ask.
 *
 * Two scenarios, one loop:
 *  - 'nsf' (default): model prices the debit → dishonour → model picks the
 *    funded day + consent SMS → payer can CONFIRM or OVERRIDE by typing →
 *    receipt stamped into metadata, Cadence's 15% as applicationFee →
 *    time-travel settle with the split reconciled in transfer line-items.
 *  - 'closed': account-closed → the GATE refuses to retry — even when the
 *    payer offers a date — and sends a Payment Link to fix the method.
 *
 * Honesty contract: payloads are labelled MOCK until sandbox keys land; the
 * model (SCORE) and the parser (PARSE) calls are REAL — same code path as the
 * live webhook loop (planRecovery / applyPayerReply).
 */

import {
  planRecovery, applyPayerReply, CADENCE_FEE_RATE,
  type PayerContext, type RecoveryPlan, type ConsentOutcome,
} from '../loop.js';

export interface ApiCall {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  response?: unknown;
  mock: boolean;
}

export interface ChatMsg { from: 'cadence' | 'payer'; text: string }

export interface DemoState {
  live: boolean;            // true => real sandbox calls; false => payload-exact mock
  scenario: 'nsf' | 'closed';
  step: number;
  stepName: string;
  narration: string;
  payer: { id: string; name: string; plan: string };
  payments: Array<{
    id: string; amount: number; date: string;
    status: 'scheduled' | 'processing' | 'dishonoured' | 'settled' | 'refused';
    risk?: number; note?: string;
  }>;
  chat: ChatMsg[];
  canReply: boolean;
  feeSplit?: { recovered: number; cadenceFee: number; netToMerchant: number };
  recoveredAud: number;
  calls: ApiCall[];
  done: boolean;
}

const PAYER_ID = 'pyr_demo_dana_01';
const PAY_A = 'pmt_demo_a_thu14';
const PAY_B = 'pmt_demo_b_recovery';
const THU_14 = '2026-08-14';

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

const feeCents = Math.round(DANA_CONTEXT.amount * 100 * CADENCE_FEE_RATE);

export class MockDriver {
  private scenario: 'nsf' | 'closed' = 'nsf';
  private step = 0;
  private plan: RecoveryPlan | null = null;
  private consent: ConsentOutcome | null = null;
  private chat: ChatMsg[] = [];
  private extraCalls: ApiCall[] = [];

  async warm(): Promise<void> {
    if (!this.plan) this.plan = await planRecovery('insufficient-funds', DANA_CONTEXT);
  }

  async state(): Promise<DemoState> { return this.render(); }

  async reset(scenario?: string): Promise<DemoState> {
    this.scenario = scenario === 'closed' ? 'closed' : 'nsf';
    this.step = 0;
    this.consent = null;
    this.chat = [];
    this.extraCalls = [];
    return this.render();
  }

  async advance(): Promise<DemoState> {
    if (this.step < 3) this.step += 1;
    await this.warm();
    if (this.step === 2 && this.scenario === 'closed') {
      this.chat = [{ from: 'cadence', text: 'Your account came back closed, so we won\'t re-debit it. Here\'s a secure link to set up a new payment method: pinch.link/dana-update' }];
    }
    // nsf default is SILENT — no message; the retry is re-timed to payday automatically.
    return this.render();
  }

  /** The judge-typed moment: the payer's reply drives the SAME applyPayerReply
   * the live loop uses; overrides re-date the recovery via save-payment. */
  async reply(text: string): Promise<DemoState> {
    if (this.step < 2 || !this.plan) return this.render();
    await this.warm();
    const gatePlan: RecoveryPlan = this.scenario === 'closed'
      ? { ...this.plan, gate: 'never-retry', dishonourType: 'account-closed' }
      : this.plan;
    const modelDate = new Date(this.dateAfterFail(this.plan.bestRetryDay ?? 2));
    // anchor the parser's "now" to the demo's failure date, not the real clock
    const outcome = applyPayerReply(gatePlan, text, modelDate, new Date(THU_14));
    this.consent = outcome;
    this.chat.push({ from: 'payer', text });
    if (outcome.reply) this.chat.push({ from: 'cadence', text: outcome.reply });

    // PARSE is REAL (deterministic parser, same code path as live)
    this.extraCalls = [{
      method: 'PARSE', path: 'src/consent/parser.ts (deterministic — no LLM)', mock: false,
      body: { text }, response: outcome.parse,
    }];
    if (outcome.action === 'overridden' && outcome.retryDate) {
      this.extraCalls.push({
        method: 'POST', path: '/payments', mock: true,
        body: {
          id: PAY_B, payerId: PAYER_ID, amount: 4500, transactionDate: outcome.retryDate,
          description: 'Gym membership (recovery)',
          metadata: outcome.receipt,
          applicationFee: feeCents,
        },
        response: { id: PAY_B, status: 'scheduled', transactionDate: outcome.retryDate },
      });
    } else if (outcome.action === 'refused-hard-code') {
      this.extraCalls.push({
        method: 'GATE', path: 'src/loop.ts HARD_CODES (account-closed)', mock: false,
        body: { offered: text }, response: { ruling: 'never-retry', reason: 'a new date cannot fix a dead account' },
      });
    }
    return this.render();
  }

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
        gate: this.scenario === 'closed' ? 'never-retry (account-closed)' : this.plan.gate,
        p_dishonour: this.plan.pDishonour,
        best_retry_day: this.plan.bestRetryDay, retry_scores: this.plan.retryScores,
      },
    };
  }

  private render(): DemoState {
    const s = this.step;
    const closed = this.scenario === 'closed';
    const retryDay = this.plan?.bestRetryDay ?? 14;
    const retryDate = this.consent?.retryDate ?? this.dateAfterFail(retryDay);
    const risk = this.plan?.pDishonour ?? 0.42;
    const dishonourType = closed ? 'account-closed' : 'insufficient-funds';

    const base: DemoState = {
      live: false,
      scenario: this.scenario,
      step: s,
      stepName: ['setup', 'bank-date', closed ? 'gate-refusal' : 'consent', closed ? 'method-fixed' : 'payday'][s],
      narration: '',
      payer: { id: PAYER_ID, name: 'Dana', plan: 'Gym membership — $45.00 fortnightly (BECS direct debit)' },
      payments: [],
      chat: this.chat,
      canReply: false, // silent default — recovery re-times automatically, no member typing
      recoveredAud: 0,
      calls: [],
      done: s >= 3,
    };

    const createCalls: ApiCall[] = [
      { method: 'POST', path: '/payers', mock: true, body: { firstName: 'Dana', emailAddress: 'dana@example.com' }, response: { id: PAYER_ID } },
      { method: 'POST', path: '/payment-sources', mock: true, body: { payerId: PAYER_ID, sourceType: 'bank-account', bankAccountBsb: '012-001', bankAccountNumber: '987654321' }, response: { id: 'src_demo_dana_bank' } },
      { method: 'POST', path: '/payments', mock: true, body: { payerId: PAYER_ID, amount: 4500, transactionDate: THU_14, description: `Gym membership #${dishonourType}` }, response: { id: PAY_A, status: 'scheduled' } },
    ];

    if (s === 0) {
      const pct = Math.round(risk * 100);
      base.narration = `Dana’s $45 debit is scheduled for Thursday the 14th. Cadence scores it: ${pct}% dishonour risk — it lands days before her likely payday. (Drag the debit below: every date has a price.)`;
      base.payments = [{ id: PAY_A, amount: 45, date: THU_14, status: 'scheduled', risk, note: this.plan?.modelUsed ? 'model-scored' : 'scoring…' }];
      const mc = this.modelCall();
      base.calls = mc ? [...createCalls, mc] : createCalls;
      return base;
    }

    if (s === 1) {
      base.narration = closed
        ? 'The bank run comes back: DISHONOURED — account closed. This is a HARD code: the payer’s bank said no, permanently.'
        : 'The bank run comes back: DISHONOURED — insufficient funds. $45 at risk, and with an incumbent biller Dana would now owe a $29.90 failure fee.';
      base.payments = [{ id: PAY_A, amount: 45, date: THU_14, status: 'dishonoured', risk, note: `${dishonourType} — ${closed ? 'terminal' : 'Refer to Drawer'}` }];
      base.calls = [{
        method: 'GET', path: `/payments/${PAY_A}`, mock: true,
        headers: { 'Time-Travel': `${THU_14}T20:00:00Z` },
        response: {
          Id: 'evt_demo_bankresults_1', Type: 'bank-results', EventDate: `${THU_14}T19:45:00Z`,
          Metadata: { SuccessCount: 11, DishonourCount: 1, DishonourAmount: 4500 },
          Data: [{ PaymentId: PAY_A, Status: 'dishonoured', Dishonour: { Type: dishonourType, Reason: closed ? 'Account Closed' : 'Refer to Drawer' } }],
        },
      }];
      return base;
    }

    if (s === 2) {
      if (closed) {
        base.narration = 'The gate rules: NEVER retry a dead account — no date can fix it. Cadence sends a secure Payment Link to update the method instead. (Try typing “try friday” — watch it refuse.)';
        base.payments = [{ id: PAY_A, amount: 45, date: THU_14, status: 'refused', note: 'hard code — retry forbidden by gate' }];
        base.calls = [
          this.modelCall()!,
          { method: 'POST', path: '/payment-links', mock: true, body: { payerId: PAYER_ID, amount: 4500, description: 'Update payment method', returnUrl: 'https://gym.example/thanks' }, response: { id: 'plk_demo_1', url: 'https://pay.getpinch.com.au/plk_demo_1' } },
          ...this.extraCalls,
        ];
        return base;
      }
      const settleP = this.plan?.retryScores?.[String(retryDay)];
      base.narration = `Insufficient funds — but Dana has money on payday. Cadence silently re-times the retry to day +${retryDay} (her likely payday). No message, no fee — she never knows it failed.`;
      base.payments = [
        { id: PAY_A, amount: 45, date: THU_14, status: 'dishonoured', note: 'insufficient-funds — short for a few days' },
        { id: PAY_B, amount: 45, date: retryDate, status: 'scheduled',
          risk: settleP != null ? 1 - settleP : undefined,
          note: `silently re-timed to payday (day +${retryDay})` },
      ];
      base.calls = [
        this.modelCall()!,
        { method: 'POST', path: '/payments', mock: true,
          body: { payerId: PAYER_ID, amount: 4500, transactionDate: this.dateAfterFail(retryDay), description: 'Gym membership (recovery)', metadata: `silent re-time to payday (day+${retryDay})`, applicationFee: feeCents },
          response: { id: PAY_B, status: 'scheduled' } },
      ];
      return base;
    }

    // step 3
    if (closed) {
      base.narration = 'Dana updates her card through the Payment Link — the NEXT cycle collects cleanly. Knowing when NOT to retry is half the product.';
      base.payments = [
        { id: PAY_A, amount: 45, date: THU_14, status: 'refused', note: 'hard code — never retried' },
        { id: 'pmt_demo_next_cycle', amount: 45, date: this.dateAfterFail(14), status: 'scheduled', note: 'next cycle — new payment method' },
      ];
      base.calls = this.extraCalls;
      return base;
    }
    const settleTT = `${retryDate}T09:00:00Z`;
    const recovered = 45;
    const fee = feeCents / 100;
    base.narration = 'Payday arrives — the retry clears. SETTLED: $45 recovered, and Dana never hit a “payment failed” moment, so she stays. The transfer reconciles on Pinch’s rails: $45.00 recovered, Cadence’s 15% ($6.75) as applicationFee, net to the gym. We earn only because it landed.';
    base.payments = [
      { id: PAY_A, amount: 45, date: THU_14, status: 'dishonoured', note: 'insufficient-funds' },
      { id: PAY_B, amount: 45, date: retryDate, status: 'settled', note: `recovered silently on payday (day +${retryDay})` },
    ];
    base.feeSplit = { recovered, cadenceFee: fee, netToMerchant: recovered - fee };
    base.recoveredAud = recovered;
    base.calls = [
      { method: 'GET', path: `/payments/${PAY_B}`, mock: true, headers: { 'Time-Travel': settleTT },
        response: { id: PAY_B, status: 'settled', amount: 4500, transactionDate: retryDate, metadata: `silent re-time to payday (day+${retryDay})` } },
      { method: 'GET', path: '/events?type=transfer', mock: true, headers: { 'Time-Travel': settleTT },
        response: {
          Id: 'evt_demo_transfer_1', Type: 'transfer', EventDate: settleTT,
          Data: { TransferId: 'tra_demo_1', LineItems: [
            { PaymentId: PAY_B, Type: 'Settlement', Amount: 4500 },
            { PaymentId: PAY_B, Type: 'ApplicationFee', Amount: -feeCents },
          ], NetAmount: 4500 - feeCents },
        } },
    ];
    return base;
  }
}

export const demo = new MockDriver();
