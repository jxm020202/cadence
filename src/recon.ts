import type { PaymentStateLog, PaymentState } from './ledger.js';

/**
 * Three-way reconciliation — the control every payments operator runs, and the
 * thing BECS makes non-negotiable: with no positive confirmation and dishonours
 * trickling in over 1–3 days, your internal view, the processor's view, and the
 * settlement file drift apart constantly. Recon is how you catch it.
 *
 *   A. internal  — our PaymentStateLog (what we believe)
 *   B. processor — Pinch API payment states (what Pinch says)
 *   C. settlement— transfer line-items that actually moved money
 *
 * A discrepancy is any payment where these three disagree in a way that matters
 * (e.g. we think settled, Pinch says dishonoured; or money settled with no
 * matching internal record). Returns them explicitly — silence is not proof.
 */

export interface ProcessorState { paymentId: string; status: PaymentState }
export interface SettlementLine { paymentId: string; amountCents: number }

export interface Discrepancy {
  paymentId: string;
  kind: 'state-mismatch' | 'settled-not-in-ledger' | 'ledger-settled-not-in-file' | 'missing-at-processor';
  internal?: PaymentState;
  processor?: PaymentState;
  settledCents?: number;
  detail: string;
}

export interface ReconResult {
  checked: number;
  matched: number;
  discrepancies: Discrepancy[];
  clean: boolean;
}

export function reconcile(
  internal: PaymentStateLog,
  processor: ProcessorState[],
  settlement: SettlementLine[],
): ReconResult {
  const procById = new Map(processor.map((p) => [p.paymentId, p.status]));
  const settledById = new Map(settlement.map((s) => [s.paymentId, s.amountCents]));
  const ids = new Set<string>([
    ...internal.history().map((r) => r.paymentId),
    ...procById.keys(),
    ...settledById.keys(),
  ]);

  const discrepancies: Discrepancy[] = [];
  let matched = 0;

  for (const id of ids) {
    const internalState = internal.current(id);
    const procState = procById.get(id);
    const settledCents = settledById.get(id);

    // A vs B: do we and the processor agree on the state?
    if (internalState && procState && internalState !== procState) {
      discrepancies.push({
        paymentId: id, kind: 'state-mismatch', internal: internalState, processor: procState,
        detail: `internal="${internalState}" but processor="${procState}"`,
      });
      continue;
    }
    if (internalState && !procState) {
      discrepancies.push({
        paymentId: id, kind: 'missing-at-processor', internal: internalState,
        detail: `we hold "${internalState}" but the processor has no record`,
      });
      continue;
    }

    // B/A vs C: settlement file must match settled state, both ways.
    const believeSettled = internalState === 'settled' || procState === 'settled';
    if (settledCents != null && !believeSettled) {
      discrepancies.push({
        paymentId: id, kind: 'settled-not-in-ledger', settledCents,
        detail: `money settled (${settledCents}c) but no settled state on record`,
      });
      continue;
    }
    if (believeSettled && settledCents == null) {
      discrepancies.push({
        paymentId: id, kind: 'ledger-settled-not-in-file', internal: internalState, processor: procState,
        detail: `marked settled but absent from the settlement file`,
      });
      continue;
    }
    matched++;
  }

  return { checked: ids.size, matched, discrepancies, clean: discrepancies.length === 0 };
}
