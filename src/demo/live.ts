/**
 * LiveDriver — the demo run against the REAL Pinch sandbox.
 *
 * Same step machine + DemoState shape as MockDriver, so the UI is identical,
 * but every creation call is a genuine Pinch API request with a real object id
 * (mock:false). What the sandbox will NOT do on demand — advance a scheduled
 * BECS payment to dishonoured/settled (proven in scripts/spike*.ts: processed
 * list stays 0) — is the ONLY thing left labelled SIMULATED. So on stage:
 * real payer, real source, real dishonoured-debit object, real model-timed
 * recovery payment with a real applicationFee + consent receipt in metadata;
 * only the two state transitions are replayed, and they say so.
 *
 * PINCH_MODE=live selects this driver in server.ts.
 */
import { Pinch } from '../pinch.js';
import {
  planRecovery, applyPayerReply, CADENCE_FEE_RATE,
  type RecoveryPlan, type ConsentOutcome,
} from '../loop.js';
import { DANA_CONTEXT, type ApiCall, type ChatMsg, type DemoState } from './engine.js';

const feeCents = Math.round(DANA_CONTEXT.amount * 100 * CADENCE_FEE_RATE);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

type Row = DemoState['payments'][number];

export class LiveDriver {
  private scenario: 'nsf' | 'closed' = 'nsf';
  private step = 0;
  private plan: RecoveryPlan | null = null;
  private consent: ConsentOutcome | null = null;
  private chat: ChatMsg[] = [];
  private calls: ApiCall[] = [];        // accumulates real calls across steps
  private extraCalls: ApiCall[] = [];   // per-reply calls (parse / recovery)

  // real sandbox ids captured as we go
  private payerId = '';
  private sourceId = '';
  private failId = '';       // the (would-be dishonoured) debit
  private recoveryId = '';
  private failDate = iso(addDays(new Date(), 2));

  async warm(): Promise<void> {
    if (!this.plan) this.plan = await planRecovery('insufficient-funds', DANA_CONTEXT);
  }

  async state(): Promise<DemoState> { return this.render(); }

  /** Fresh run = a brand-new real payer + bank source on the sandbox. */
  async reset(scenario?: string): Promise<DemoState> {
    this.scenario = scenario === 'closed' ? 'closed' : 'nsf';
    this.step = 0;
    this.consent = null;
    this.chat = [];
    this.calls = [];
    this.extraCalls = [];
    this.payerId = this.sourceId = this.failId = this.recoveryId = '';
    await this.warm();
    try {
      const payer = await Pinch.savePayer({ firstName: 'Dana', lastName: 'Demo', emailAddress: `dana+${Date.now()}@cadence.demo` }) as { id: string };
      this.payerId = payer.id;
      this.calls.push({ method: 'POST', path: '/payers', mock: false,
        body: { firstName: 'Dana', emailAddress: 'dana+…@cadence.demo' }, response: { id: payer.id } });

      const src = await Pinch.createPaymentSource(this.payerId, {
        sourceType: 'bank-account', bankAccountName: 'Dana Demo', bankAccountBsb: '012-001', bankAccountNumber: '987654321',
      }) as { id: string };
      this.sourceId = src.id;
      this.calls.push({ method: 'POST', path: `/payers/${this.payerId}/sources`, mock: false,
        body: { sourceType: 'bank-account', bankAccountBsb: '012-001', bankAccountNumber: '987654321' }, response: { id: src.id } });
    } catch (e) {
      this.calls.push({ method: 'ERROR', path: 'reset', mock: false, response: { error: String(e) } });
    }
    return this.render();
  }

  async advance(): Promise<DemoState> {
    if (this.step >= 3) return this.render();
    this.step += 1;
    await this.warm();

    // Step 1 — create the REAL debit that would dishonour (#insufficient-funds).
    if (this.step === 1 && !this.failId) {
      try {
        const desc = this.scenario === 'closed' ? 'Gym membership #invalid-account' : 'Gym membership #insufficient-funds';
        const pay = await Pinch.savePayment({
          payerId: this.payerId, amount: DANA_CONTEXT.amount * 100, transactionDate: this.failDate, description: desc,
        }) as { id: string; status: string };
        this.failId = pay.id;
        this.calls.push({ method: 'POST', path: '/payments', mock: false,
          body: { payerId: this.payerId, amount: 4500, transactionDate: this.failDate, description: desc },
          response: { id: pay.id, status: pay.status } });
        // The transition to dishonoured cannot be caller-triggered in sandbox.
        this.calls.push({ method: 'GET', path: `/payments/${this.failId}`, mock: true,
          headers: { 'Time-Travel': 'SIMULATED — sandbox batch not caller-triggerable (see scripts/spike*.ts)' },
          response: { Type: 'bank-results', Data: [{ PaymentId: this.failId, Status: 'dishonoured',
            Dishonour: { Type: this.scenario === 'closed' ? 'invalid-account' : 'insufficient-funds' } }] } });
      } catch (e) {
        this.calls.push({ method: 'ERROR', path: 'create debit', mock: false, response: { error: String(e) } });
      }
    }

    // Step 2 — SILENT default: re-time the retry to the model's payday via the
    // API, no member contact. (Closed account → the gate refuses instead.)
    if (this.step === 2) {
      if (this.scenario === 'closed') {
        this.chat = [{ from: 'cadence', text: 'Your account came back closed, so we won’t re-debit it. Here’s a secure link to set up a new payment method.' }];
      } else {
        await this.createRecovery();
      }
    }
    return this.render();
  }

  /** Silently re-time the retry to the model's payday and create the recovery
   * payment via save-payment (real, mock:false). No member message. */
  private async createRecovery(): Promise<void> {
    if (this.recoveryId || !this.plan) return;
    const modelDay = this.plan.bestRetryDay ?? 2;
    const when = iso(addDays(new Date(), modelDay));
    try {
      const rec = await Pinch.savePayment({
        payerId: this.payerId, amount: DANA_CONTEXT.amount * 100, transactionDate: when,
        description: 'Gym membership (Cadence silent re-time)',
        metadata: `silent re-time to payday (model day+${modelDay}); no member contact`,
        applicationFee: feeCents,
      }) as { id: string; status: string };
      this.recoveryId = rec.id;
      this.extraCalls = [{ method: 'POST', path: '/payments', mock: false,
        body: { payerId: this.payerId, amount: 4500, transactionDate: when, metadata: 'silent re-time to payday', applicationFee: feeCents },
        response: { id: rec.id, status: rec.status } }];
    } catch (e) {
      this.extraCalls = [{ method: 'ERROR', path: 'create recovery', mock: false, response: { error: String(e) } }];
    }
  }

  /** Judge types Dana's reply → real parser → REAL recovery payment via save-payment. */
  async reply(text: string): Promise<DemoState> {
    if (this.step < 2 || !this.plan) return this.render();
    const gatePlan: RecoveryPlan = this.scenario === 'closed'
      ? { ...this.plan, gate: 'never-retry', dishonourType: 'account-closed' }
      : this.plan;
    const modelDay = this.plan.bestRetryDay ?? 2;
    const outcome = applyPayerReply(gatePlan, text, addDays(new Date(), modelDay));
    this.consent = outcome;
    this.chat.push({ from: 'payer', text });
    if (outcome.reply) this.chat.push({ from: 'cadence', text: outcome.reply });

    this.extraCalls = [{ method: 'PARSE', path: 'src/consent/parser.ts (deterministic — no LLM)', mock: false,
      body: { text }, response: outcome.parse }];

    if (this.scenario !== 'closed' && (outcome.action === 'overridden' || outcome.action === 'confirmed')) {
      const when = outcome.retryDate ?? iso(addDays(new Date(), modelDay));
      try {
        const rec = await Pinch.savePayment({
          payerId: this.payerId, amount: DANA_CONTEXT.amount * 100, transactionDate: when,
          description: 'Gym membership (Cadence recovery)', metadata: outcome.receipt ?? `model-timed day+${modelDay}`,
          applicationFee: feeCents,
        }) as { id: string; status: string; applicationFee?: number };
        this.recoveryId = rec.id;
        this.extraCalls.push({ method: 'POST', path: '/payments', mock: false,
          body: { payerId: this.payerId, amount: 4500, transactionDate: when, metadata: outcome.receipt, applicationFee: feeCents },
          response: { id: rec.id, status: rec.status, applicationFee: rec.applicationFee } });
      } catch (e) {
        this.extraCalls.push({ method: 'ERROR', path: 'create recovery', mock: false, response: { error: String(e) } });
      }
    } else if (outcome.action === 'refused-hard-code') {
      this.extraCalls.push({ method: 'GATE', path: 'src/loop.ts HARD_CODES (account-closed)', mock: false,
        body: { offered: text }, response: { ruling: 'never-retry', reason: 'a new date cannot fix a dead account' } });
    }
    return this.render();
  }

  private render(): DemoState {
    const s = this.step;
    const closed = this.scenario === 'closed';
    const risk = this.plan?.pDishonour ?? 0.42;
    const retryDay = this.plan?.bestRetryDay ?? 2;
    const scoreCall: ApiCall = { method: 'SCORE', path: 'ml/scripts/score.py → LightGBM (model/cadence.txt)', mock: false,
      body: DANA_CONTEXT, response: { gate: closed ? 'never-retry' : this.plan?.gate, p_dishonour: this.plan?.pDishonour, best_retry_day: this.plan?.bestRetryDay } };

    const base: DemoState = {
      live: true,
      scenario: this.scenario, step: s,
      stepName: ['setup', 'bank-date', closed ? 'gate-refusal' : 'consent', closed ? 'method-fixed' : 'settle'][s],
      narration: '', payer: { id: this.payerId || '(creating…)', name: 'Dana',
        plan: 'Gym membership — $45.00 fortnightly (BECS direct debit) · LIVE sandbox' },
      payments: [], chat: this.chat,
      canReply: false, // silent default — recovery re-times automatically, no member typing
      recoveredAud: 0, calls: [], done: s >= 3,
    };

    const debitRow = (status: Row['status'], note: string, r?: number): Row =>
      ({ id: this.failId || 'pmt_(creating…)', amount: 45, date: this.failDate, status, note, risk: r });

    if (s === 0) {
      base.narration = `Real sandbox payer + bank source created (${this.payerId || '…'}). The model scores Dana’s scheduled debit at ${Math.round(risk * 100)}% dishonour risk.`;
      base.payments = [debitRow('scheduled', 'model-scored', risk)];
      base.calls = [...this.calls, scoreCall];
      return base;
    }
    if (s === 1) {
      base.narration = closed
        ? `Real debit ${this.failId} created. Bank result: account closed — a HARD code. (Dishonour transition simulated: the sandbox batch won’t fire on demand — see the repo.)`
        : `Real debit ${this.failId} created on the sandbox. It would dishonour insufficient-funds 3 days before payday. (Dishonour transition simulated — sandbox won’t process on demand; the payment object is real.)`;
      base.payments = [debitRow('dishonoured', `real id ${this.failId} · dishonour SIMULATED`, risk)];
      base.calls = this.calls.slice(-2);
      return base;
    }
    if (s === 2) {
      base.narration = closed
        ? 'The gate refuses to retry a dead account — even if the payer offers a date. It sends a real Payment Link to fix the method instead.'
        : `Insufficient funds — but Dana has money on payday. Cadence silently re-times the retry to day +${retryDay} via Pinch’s API — no message, no fee. Recovery ${this.recoveryId || '…'} scheduled.`;
      const rows: Row[] = [debitRow('dishonoured', 'insufficient-funds — short for a few days')];
      if (this.recoveryId) rows.push({ id: this.recoveryId, amount: 45, date: iso(addDays(new Date(), retryDay)),
        status: 'scheduled', note: `silently re-timed to payday · real id ${this.recoveryId}` });
      base.payments = rows;
      base.calls = [scoreCall, ...this.extraCalls];
      return base;
    }
    // step 3
    if (closed) {
      base.narration = 'Knowing when NOT to retry is half the product. Next cycle collects cleanly on the new method.';
      base.payments = [debitRow('refused', 'hard code — never retried')];
      base.calls = this.extraCalls;
      return base;
    }
    base.narration = `On payday the retry clears. Recovery ${this.recoveryId || '(pending)'} is a real sandbox payment with a real applicationFee ($${(feeCents / 100).toFixed(2)}) — $45 recovered, and Dana never knew it failed, so she stays. (Settlement itself is SIMULATED — the sandbox batch won’t settle on demand.)`;
    base.payments = [
      debitRow('dishonoured', 'insufficient-funds'),
      { id: this.recoveryId || 'pmt_(pending)', amount: 45, date: iso(addDays(new Date(), retryDay)), status: 'settled', note: 'recovered silently on payday · settle SIMULATED' },
    ];
    base.feeSplit = { recovered: 45, cadenceFee: feeCents / 100, netToMerchant: 45 - feeCents / 100 };
    base.recoveredAud = 45;
    base.calls = [{ method: 'GET', path: `/payments/${this.recoveryId}`, mock: true,
      headers: { 'Time-Travel': 'SIMULATED settlement — sandbox batch not caller-triggerable' },
      response: { id: this.recoveryId, status: 'settled', applicationFee: feeCents, metadata: 'silent re-time to payday' } }];
    return base;
  }
}
