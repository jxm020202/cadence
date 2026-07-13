/**
 * Second Ask — post-dishonour conversational recovery agent.
 *
 * When a BECS debit dishonours (bank-results webhook), don't silently retry —
 * ASK the payer when suits, parse their answer deterministically, and schedule
 * the recovery debit on THEIR stated day via Pinch's own POST /payments.
 * Consent is the mechanism: the payer's exact words travel with the payment
 * as a consent receipt in `metadata`.
 *
 * Honesty contract (same as the repo's Cadence demo): every Pinch payload in
 * the API pane is byte-exact; `mock: true` until PINCH_MODE=live routes the
 * recovery POST /payments through the real sandbox client (../../src/pinch.ts).
 *
 * The hard-code gate: dishonour codes that mean "the payment method is dead"
 * (account closed, card invalid, bank blocked) NEVER produce a retry ask —
 * a new date can't fix a dead account. Those payers get a payment-method
 * update link (a Pinch Payment Link) instead.
 */

import { classify, iso, human, plusDays, rollForward, type Intent } from './parser.js';
import { Pinch } from '../../src/pinch.js';

export interface ApiCall {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  response?: unknown;
  mock: boolean;
  note?: string;
}
export interface Bubble { from: 'agent' | 'payer' | 'system'; text: string }
export interface PaymentCard {
  id: string;
  amount: number; // AUD for display
  date: string;
  status: 'dishonoured' | 'scheduled' | 'settled';
  note?: string;
}
export type Stage =
  | 'idle' | 'awaiting_day' | 'awaiting_split_day' | 'scheduled'
  | 'settled' | 'hard_fail' | 'hardship' | 'opted_out' | 'paused';

export interface State {
  mode: 'live' | 'mock';
  scenario: string | null;
  stage: Stage;
  payer: { id: string; name: string; plan: string };
  thread: Bubble[];
  calls: ApiCall[];
  payments: PaymentCard[];
  recoveredAud: number;
}

const LIVE = process.env.PINCH_MODE === 'live' && !!process.env.PINCH_APP_ID && !!process.env.PINCH_SECRET;

const PAYER_ID = 'pyr_demo_sam_01';
const SOURCE_ID = 'src_demo_sam_bank';
const ORIG_ID = 'pmt_demo_sam_original';
const AMOUNT_CENTS = 4500;
const PLAN_LABEL = 'Apex Gym — $45.00 fortnightly (BECS direct debit)';
const UPDATE_LINK = 'https://pay.getpinch.com.au/plk_demo_update_sam';
const MAX_DAYS_OUT = 35;

/** The gate. `ask: false` codes must NEVER produce a retry conversation. */
export const GATE: Record<string, { ask: boolean; reason: string }> = {
  'insufficient-funds': { ask: true, reason: 'timing problem — the payer can pick a funded day' },
  'temporary-problem':  { ask: true, reason: 'transient bank issue — safe to ask for a new day' },
  'technical-error':    { ask: true, reason: 'processing hiccup — safe to ask for a new day' },
  'invalid-account':    { ask: false, reason: 'account closed/invalid — a new date cannot fix a dead account' },
  'invalid-card':       { ask: false, reason: 'card invalid — needs a new payment method, not a new date' },
  'unsupported-card':   { ask: false, reason: 'card type unsupported — needs a new payment method' },
  'blocked-by-bank':    { ask: false, reason: 'bank blocked the debit — retrying invites complaints; fix the mandate' },
};

const REASON: Record<string, string> = {
  'insufficient-funds': 'Refer to Drawer',
  'temporary-problem': 'Temporary problem — try again later',
  'technical-error': 'Processing error at the bank',
  'invalid-account': 'Account closed',
  'invalid-card': 'Card invalid or expired',
  'unsupported-card': 'Card type not supported',
  'blocked-by-bank': 'Payer authority revoked',
};

export class SecondAskAgent {
  private scenario: string | null = null;
  private stage: Stage = 'idle';
  private thread: Bubble[] = [];
  private calls: ApiCall[] = [];
  private payments: PaymentCard[] = [];
  private recoveredAud = 0;
  private askAttempts = 0;
  private splitMode = false;
  private rescheduleIds: string[] = [];
  private recoverySeq = 0;

  state(): State {
    return {
      mode: LIVE ? 'live' : 'mock',
      scenario: this.scenario,
      stage: this.stage,
      payer: { id: PAYER_ID, name: 'Sam Nguyen', plan: PLAN_LABEL },
      thread: this.thread,
      calls: this.calls,
      payments: this.payments,
      recoveredAud: this.recoveredAud,
    };
  }

  reset(): State {
    this.scenario = null;
    this.stage = 'idle';
    this.thread = [];
    this.calls = [];
    this.payments = [];
    this.recoveredAud = 0;
    this.askAttempts = 0;
    this.splitMode = false;
    this.rescheduleIds = [];
    this.recoverySeq = 0;
    return this.state();
  }

  private agentSay(...texts: string[]): void {
    for (const t of texts) this.thread.push({ from: 'agent', text: t });
  }
  private sys(text: string): void {
    this.thread.push({ from: 'system', text });
  }
  private today(): Date {
    return new Date();
  }

  /** Live-webhook entry point: a verified bank-results event lands here. */
  async onBankResults(event: Record<string, unknown>): Promise<void> {
    const data = (event.Data ?? event.data) as Array<Record<string, unknown>> | undefined;
    const first = Array.isArray(data) ? data[0] : undefined;
    const dishonour = (first?.Dishonour ?? first?.dishonour) as Record<string, unknown> | undefined;
    const code = String(dishonour?.Type ?? dishonour?.type ?? '');
    if (code && this.stage === 'idle') await this.dishonour(code);
  }

  /** A debit dishonours — the whole product starts here. */
  async dishonour(code: string): Promise<State> {
    if (this.stage !== 'idle') {
      this.sys('Reset the stage before starting a new scenario.');
      return this.state();
    }
    const gate = GATE[code] ?? GATE['technical-error'];
    this.scenario = code;
    const todayIso = iso(this.today());

    this.calls.push(
      {
        method: 'POST', path: '/payers', mock: true,
        body: { firstName: 'Sam', lastName: 'Nguyen', emailAddress: 'sam@example.com', mobileNumber: '+61400000001' },
        response: { id: PAYER_ID, firstName: 'Sam', lastName: 'Nguyen' },
      },
      {
        method: 'POST', path: '/payment-sources', mock: true,
        body: { payerId: PAYER_ID, sourceType: 'bank-account', bankAccountBsb: '012-001', bankAccountNumber: '987654321' },
        response: { id: SOURCE_ID },
      },
      {
        method: 'POST', path: '/payments', mock: true,
        note: `the #${code} tag in the description forces this exact dishonour in the Pinch sandbox`,
        body: { payerId: PAYER_ID, amount: AMOUNT_CENTS, transactionDate: todayIso, description: `Apex Gym membership #${code}` },
        response: { id: ORIG_ID, status: 'scheduled', amount: AMOUNT_CENTS, transactionDate: todayIso },
      },
      {
        method: 'EVENT', path: 'POST /webhooks/pinch — bank-results', mock: true,
        note: 'pinch-signature verified with HMAC-SHA256 (src/webhook.ts) before anything runs',
        response: {
          Id: 'evt_demo_bankresults_1', Type: 'bank-results', EventDate: `${todayIso}T19:45:00Z`,
          Metadata: { SuccessCount: 23, DishonourCount: 1, DishonourAmount: AMOUNT_CENTS },
          Data: [{ PaymentId: ORIG_ID, Status: 'dishonoured', Dishonour: { Type: code, Reason: REASON[code] ?? code } }],
        },
      },
      {
        method: 'GATE', path: `dishonour-code policy — ${code}`, mock: false,
        body: { code },
        response: {
          decision: gate.ask ? 'open-conversation' : 'never-ask-for-a-retry — offer a payment-method fix',
          reason: gate.reason,
        },
      },
    );

    this.payments.push({
      id: ORIG_ID, amount: 45, date: todayIso, status: 'dishonoured',
      note: `${code} — ${REASON[code] ?? ''}`,
    });

    if (gate.ask) {
      this.stage = 'awaiting_day';
      const why = code === 'insufficient-funds' ? '(insufficient funds)' : '(a temporary problem at the bank)';
      this.agentSay(
        `Hi Sam — it's Apex Gym. Your $45.00 membership payment didn't go through today ${why}. No fee from us, and no drama — it happens.`,
        "Rather than retrying blind, when suits you? You can say things like 'Friday', 'when I get paid on the 28th', or 'next week'.",
        'Reply STOP any time and we stop.',
      );
    } else {
      this.stage = 'hard_fail';
      this.calls.push({
        method: 'POST', path: '/payment-links', mock: true,
        note: 'hard dishonour code → a retry can never succeed, so the agent never asks for one',
        body: {
          amount: AMOUNT_CENTS, description: 'Apex Gym — update your payment method & pay',
          payerId: PAYER_ID, returnUrl: 'http://localhost:3220/thanks',
        },
        response: { id: 'plk_demo_update_sam', url: UPDATE_LINK },
      });
      this.agentSay(
        "Hi Sam — it's Apex Gym. Your $45.00 membership payment didn't go through, and it looks like the bank account itself is the problem (the bank says it's closed or invalid) — not your balance. No fee.",
        `There's no point retrying until it's fixed, so we won't. Here's a secure link to update your details — it takes about a minute, and we'll handle the rest: ${UPDATE_LINK}`,
        'Reply STOP to opt out of these messages.',
      );
    }
    return this.state();
  }

  /** The payer texts back. */
  async sms(text: string): Promise<State> {
    const trimmed = text.trim();
    if (!trimmed) return this.state();
    if (this.stage === 'idle') {
      this.sys('Pick a scenario first — the conversation opens when a debit dishonours.');
      return this.state();
    }
    if (this.stage === 'opted_out' || this.stage === 'paused' || this.stage === 'settled') {
      this.sys('Conversation closed.');
      return this.state();
    }

    this.thread.push({ from: 'payer', text: trimmed });
    const intent = classify(trimmed, this.today());
    this.calls.push({
      method: 'PARSE', path: 'intent parser — deterministic, no LLM', mock: false,
      body: { text: trimmed },
      response: intent.type === 'date'
        ? { intent: 'date', date: iso(intent.date), matched: intent.label, payday: intent.payday, split: intent.split }
        : { intent: intent.type },
    });
    await this.handle(intent);
    return this.state();
  }

  private async handle(intent: Intent): Promise<void> {
    switch (intent.type) {
      case 'optout': {
        this.agentSay("Done — you won't hear from us again about this payment, and nothing will be debited without you asking. Take care, Sam.");
        if (this.payments.some((p) => p.status === 'scheduled')) {
          this.sys('Scheduled recovery flagged for cancellation — merchant follow-up (auto-cancel not wired in this build).');
        }
        this.stage = 'opted_out';
        return;
      }
      case 'pause': {
        this.agentSay('Paused — no retries, no fees, no more texts unless you message us first. Nathan from Apex Gym will check in this week to sort a plan that works.');
        this.stage = 'paused';
        return;
      }
      case 'hardship': {
        this.agentSay(
          "That's completely okay, Sam — thanks for telling us. There's no fee, and nothing gets debited until you say so.",
          'Two options: reply SPLIT to break it into two $22.50 payments on days you pick, or reply PAUSE and a human will sort a plan with you. No pressure either way.',
        );
        this.stage = 'hardship';
        return;
      }
      case 'split': {
        if (this.stage === 'hard_fail') return this.gateRefusal();
        // Splitting an already-scheduled debit replaces it — never adds to it.
        this.rescheduleIds = this.payments.filter((p) => p.status === 'scheduled').map((p) => p.id);
        this.agentSay("Easy — two payments of $22.50, a fortnight apart, no fee. When suits for the first one? ('Friday' or 'the 28th' both work.)");
        this.stage = 'awaiting_split_day';
        this.splitMode = true;
        return;
      }
      case 'change': {
        if (this.stage === 'hard_fail') return this.gateRefusal();
        const scheduled = this.payments.filter((p) => p.status === 'scheduled');
        if (scheduled.length > 0) {
          this.rescheduleIds = scheduled.map((p) => p.id);
          this.splitMode = scheduled.length > 1;
          this.stage = this.splitMode ? 'awaiting_split_day' : 'awaiting_day';
          this.agentSay(this.splitMode
            ? 'No problem — when suits for the first of the two payments? The second follows a fortnight later.'
            : 'No problem — what day suits better?');
        } else {
          this.stage = this.stage === 'awaiting_split_day' ? 'awaiting_split_day' : 'awaiting_day';
          this.agentSay("Which day works for you? 'Friday' or 'the 28th' both work.");
        }
        return;
      }
      case 'payday_no_date': {
        if (this.stage === 'hard_fail') return this.gateRefusal();
        this.agentSay("Nice one — which day does your pay land? A weekday ('Friday') or a date ('the 28th') both work.");
        return;
      }
      case 'confirm': {
        const scheduled = this.payments.filter((p) => p.status === 'scheduled');
        this.agentSay(scheduled.length > 0
          ? `You're all set — ${scheduled.map((p) => `$${p.amount.toFixed(2)} on ${p.date}`).join(' and ')}. Nothing else to do.`
          : "All good — just tell me a day that suits, like 'Friday' or 'the 28th'.");
        return;
      }
      case 'date':
        return this.handleDate(intent);
      case 'unknown': {
        this.askAttempts += 1;
        this.agentSay(this.askAttempts <= 1
          ? "Sorry — I didn't quite get that. Just tell me a day: 'Friday', 'the 28th' or 'next week' all work."
          : "You can reply with: a day ('Friday') - a date ('the 28th') - SPLIT for two half payments - PAUSE for a human - STOP to opt out.");
        return;
      }
    }
  }

  /** The gate, enforced mid-conversation: never schedule a retry on a dead method. */
  private gateRefusal(): void {
    this.calls.push({
      method: 'GATE', path: `retry blocked — ${this.scenario}`, mock: false,
      body: { requested: 'schedule retry', code: this.scenario },
      response: { decision: 'refused', reason: (this.scenario && GATE[this.scenario]?.reason) || 'payment method is unusable' },
    });
    this.agentSay(`A new date won't fix this one, unfortunately — the bank says the account itself is the problem, so we won't retry and risk another mark against you. The link is the quick fix: ${UPDATE_LINK}`);
  }

  private async handleDate(intent: Extract<Intent, { type: 'date' }>): Promise<void> {
    if (this.stage === 'hard_fail') return this.gateRefusal();

    const now = this.today();
    const cap = plusDays(now, MAX_DAYS_OUT);
    if (intent.date > cap) {
      this.agentSay(`That's a fair way out — the latest I can lock in from here is ${human(cap)}. Want that, or reply PAUSE and the team will sort something custom.`);
      return;
    }

    // A date while something is already scheduled is a re-date, never a new
    // debit — otherwise "monday works" after a schedule would double-collect.
    if (this.stage === 'scheduled' && this.rescheduleIds.length === 0) {
      this.rescheduleIds = this.payments.filter((p) => p.status === 'scheduled').map((p) => p.id);
    }

    const { date, rolled } = rollForward(intent.date);
    const split = this.stage === 'awaiting_split_day' || intent.split || this.splitMode
      || this.rescheduleIds.length > 1;

    if (split) {
      const first = date;
      const second = rollForward(plusDays(date, 14)).date;
      const c1 = Math.ceil(AMOUNT_CENTS / 2);
      const c2 = AMOUNT_CENTS - c1;
      await this.scheduleRecovery(first, intent.quote, c1, this.rescheduleIds[0]);
      await this.scheduleRecovery(second, intent.quote, c2, this.rescheduleIds[1]);
      this.agentSay(
        `Done — two payments, no fee:\n- $${(c1 / 100).toFixed(2)} on ${human(first)}\n- $${(c2 / 100).toFixed(2)} on ${human(second)}`,
        'Both on your say-so. Reply CHANGE any time if that stops suiting, or STOP and we stop.',
      );
    } else {
      await this.scheduleRecovery(date, intent.quote, AMOUNT_CENTS, this.rescheduleIds[0]);
      const ack = intent.payday ? 'Payday it is.' : 'Perfect.';
      const rollNote = rolled ? ` (you said ${intent.label} — that's a weekend, so the banks run it ${human(date)})` : '';
      this.agentSay(
        `${ack} I've moved your $45.00 to ${human(date)} — the day you chose${rollNote}. No fee, nothing else to do.`,
        'If anything changes, reply CHANGE. Reply STOP and we stop.',
      );
    }

    this.rescheduleIds = [];
    this.splitMode = false;
    this.askAttempts = 0;
    this.stage = 'scheduled';
  }

  /**
   * The star call: POST /payments with the payer's OWN day as transactionDate,
   * and their exact words stamped into `metadata` as an auditable consent receipt.
   */
  private async scheduleRecovery(date: Date, quote: string, cents: number, existingId?: string): Promise<void> {
    const dateIso = iso(date);
    const id = existingId ?? `pmt_demo_recovery_${++this.recoverySeq}`;
    const body: Record<string, unknown> = {
      ...(existingId ? { id } : {}),
      payerId: PAYER_ID,
      amount: cents,
      transactionDate: dateIso,
      description: 'Apex Gym membership — recovery (payer-chosen date)',
      metadata: JSON.stringify({
        source: 'second-ask',
        consentText: quote,
        consentAt: new Date().toISOString(),
        originalPaymentId: ORIG_ID,
      }),
    };
    const call: ApiCall = {
      method: 'POST', path: '/payments', mock: true, body,
      note: existingId
        ? 'save-payment is create-or-update: same id + new transactionDate re-dates the debit'
        : "the payer's own words travel with the payment — an auditable consent receipt in metadata",
    };
    if (LIVE) {
      try {
        const resp = await Pinch.savePayment(body);
        call.mock = false;
        call.response = resp;
      } catch (e) {
        call.note = `live call failed (${String(e).slice(0, 140)}) — payload shown as built`;
        call.response = { id, status: 'scheduled', amount: cents, transactionDate: dateIso };
      }
    } else {
      call.response = { id, status: 'scheduled', amount: cents, transactionDate: dateIso };
    }
    this.calls.push(call);

    const card: PaymentCard = {
      id, amount: cents / 100, date: dateIso, status: 'scheduled',
      note: `payer-chose: "${quote}"`,
    };
    const at = this.payments.findIndex((p) => p.id === id);
    if (at >= 0) this.payments[at] = card;
    else this.payments.push(card);
  }

  /** Fast-forward the sandbox clock past the payer's chosen day — the payoff beat. */
  async timeTravel(): Promise<State> {
    if (this.stage !== 'scheduled') {
      this.sys('Nothing scheduled yet — the payer picks the day first.');
      return this.state();
    }
    const scheduled = this.payments.filter((p) => p.status === 'scheduled');
    const latest = scheduled.map((p) => p.date).sort().at(-1)!;
    const tt = `${iso(plusDays(new Date(latest), 1))}T09:00:00Z`;

    for (const p of scheduled) {
      this.calls.push({
        method: 'GET', path: `/payments/${p.id}`, mock: true,
        headers: { 'Time-Travel': tt },
        response: { id: p.id, status: 'settled', amount: Math.round(p.amount * 100), transactionDate: p.date },
      });
      p.status = 'settled';
      p.note = 'recovered — on the day Sam chose';
    }
    this.calls.push({
      method: 'GET', path: '/events?type=transfer', mock: true,
      headers: { 'Time-Travel': tt },
      response: {
        Id: 'evt_demo_transfer_1', Type: 'transfer', EventDate: tt,
        Data: {
          TransferId: 'tra_demo_1',
          LineItems: scheduled.map((p) => ({ PaymentId: p.id, Type: 'Settlement', Amount: Math.round(p.amount * 100) })),
        },
      },
    });

    this.recoveredAud = scheduled.reduce((s, p) => s + p.amount, 0);
    this.stage = 'settled';
    this.agentSay('Payment received — all sorted, Sam. Thanks for sorting it with us. See you at the gym.');
    this.sys(`$${this.recoveredAud.toFixed(2)} recovered — one question asked, zero fees, zero blind retries.`);
    return this.state();
  }
}
