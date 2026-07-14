/**
 * The money spine — two append-only logs, because you cannot reconcile what
 * you have overwritten. This is the senior-payments signal Cull looks for.
 *
 *  1. PaymentStateLog — every lifecycle transition (scheduled → dishonoured →
 *     rescheduled → settled) is a new immutable row. Current state = last row
 *     for a paymentId. Nothing is ever updated in place.
 *  2. Ledger — double-entry CASH postings. Each posting is a set of entries
 *     that MUST balance (Σ debits = Σ credits). Money that moved is recorded
 *     once, in balance; reversals are compensating postings, never deletions.
 *
 * Balances are a pure fold over the log, so the whole system is replayable and
 * auditable from row zero.
 */

export type PaymentState =
  | 'scheduled' | 'processing' | 'dishonoured' | 'rescheduled' | 'settled' | 'refused' | 'cancelled';

export interface StateRow {
  seq: number;
  ts: string;              // ISO; injected (never Date.now — replayable/testable)
  paymentId: string;
  payerId: string;
  state: PaymentState;
  reason?: string;         // e.g. dishonour code, "payer-chose Monday"
  amountCents: number;
}

export type Account =
  | 'bank_clearing'        // cash in transit from the payer's bank
  | 'merchant_payable'     // net owed to the merchant
  | 'cadence_revenue';     // our applicationFee take

export interface LedgerEntry {
  seq: number;
  ts: string;
  postingId: string;       // groups the entries of one balanced posting
  event: string;
  paymentId: string;
  account: Account;
  direction: 'debit' | 'credit';
  amountCents: number;
}

const signed = (e: LedgerEntry) => (e.direction === 'debit' ? e.amountCents : -e.amountCents);

export class PaymentStateLog {
  private rows: StateRow[] = [];

  append(row: Omit<StateRow, 'seq'>): StateRow {
    const full = { ...row, seq: this.rows.length };
    this.rows.push(full);
    return full;
  }

  /** Current state = the last transition recorded for this payment. */
  current(paymentId: string): PaymentState | undefined {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].paymentId === paymentId) return this.rows[i].state;
    }
    return undefined;
  }

  history(paymentId?: string): StateRow[] {
    return paymentId ? this.rows.filter((r) => r.paymentId === paymentId) : [...this.rows];
  }
}

export class Ledger {
  private entries: LedgerEntry[] = [];
  private postings = 0;

  /**
   * Post a balanced set of entries. Throws if Σ debits ≠ Σ credits — an
   * unbalanced posting is a bug, and we refuse to record money that doesn't
   * add up rather than silently corrupt the books.
   */
  post(event: string, paymentId: string, ts: string, legs: Array<Omit<LedgerEntry, 'seq' | 'ts' | 'postingId' | 'event' | 'paymentId'>>): string {
    const net = legs.reduce((s, l) => s + (l.direction === 'debit' ? l.amountCents : -l.amountCents), 0);
    if (net !== 0) {
      throw new Error(`unbalanced posting for ${event}/${paymentId}: net ${net}c (must be 0)`);
    }
    const postingId = `pst_${this.postings++}`;
    for (const leg of legs) {
      this.entries.push({ ...leg, seq: this.entries.length, ts, postingId, event, paymentId });
    }
    return postingId;
  }

  /** Settlement: cash lands, split into the merchant's net and our fee. */
  postSettlement(paymentId: string, ts: string, amountCents: number, feeCents: number): string {
    return this.post('settlement', paymentId, ts, [
      { account: 'bank_clearing', direction: 'debit', amountCents },
      { account: 'merchant_payable', direction: 'credit', amountCents: amountCents - feeCents },
      { account: 'cadence_revenue', direction: 'credit', amountCents: feeCents },
    ]);
  }

  /** Reversal (refund / chargeback): the exact compensating posting. */
  postReversal(paymentId: string, ts: string, amountCents: number, feeCents: number): string {
    return this.post('reversal', paymentId, ts, [
      { account: 'merchant_payable', direction: 'debit', amountCents: amountCents - feeCents },
      { account: 'cadence_revenue', direction: 'debit', amountCents: feeCents },
      { account: 'bank_clearing', direction: 'credit', amountCents },
    ]);
  }

  /** Account balance = fold over the log (debit +, credit −). */
  balance(account: Account): number {
    return this.entries.filter((e) => e.account === account).reduce((s, e) => s + signed(e), 0);
  }

  /** The whole ledger must net to zero across accounts — the trial balance. */
  trialBalanceOk(): boolean {
    return this.entries.reduce((s, e) => s + signed(e), 0) === 0;
  }

  all(): LedgerEntry[] { return [...this.entries]; }
}
