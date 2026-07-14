import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger, PaymentStateLog } from './ledger.js';
import { IdempotencyStore, IdempotencyConflict } from './idempotency.js';
import { reconcile } from './recon.js';

const TS = '2026-08-20T00:00:00Z';

// ---- ledger ----------------------------------------------------------------

test('settlement posts a balanced double-entry split', () => {
  const l = new Ledger();
  l.postSettlement('pmt_1', TS, 4500, 675); // $45 recovered, 15% fee
  assert.equal(l.balance('bank_clearing'), 4500);
  assert.equal(l.balance('merchant_payable'), -3825); // credited (owed out)
  assert.equal(l.balance('cadence_revenue'), -675);
  assert.ok(l.trialBalanceOk(), 'whole ledger nets to zero');
});

test('a reversal exactly compensates a settlement', () => {
  const l = new Ledger();
  l.postSettlement('pmt_1', TS, 4500, 675);
  l.postReversal('pmt_1', TS, 4500, 675);
  assert.equal(l.balance('bank_clearing'), 0);
  assert.equal(l.balance('merchant_payable'), 0);
  assert.equal(l.balance('cadence_revenue'), 0);
  assert.ok(l.trialBalanceOk());
});

test('unbalanced postings are refused, not recorded', () => {
  const l = new Ledger();
  assert.throws(() => l.post('bogus', 'pmt_x', TS, [
    { account: 'bank_clearing', direction: 'debit', amountCents: 4500 },
    { account: 'cadence_revenue', direction: 'credit', amountCents: 500 }, // 4500 != 500
  ]), /unbalanced/);
  assert.equal(l.all().length, 0);
});

test('state log is append-only; current() is the last transition', () => {
  const log = new PaymentStateLog();
  log.append({ ts: TS, paymentId: 'pmt_1', payerId: 'pyr_1', state: 'scheduled', amountCents: 4500 });
  log.append({ ts: TS, paymentId: 'pmt_1', payerId: 'pyr_1', state: 'dishonoured', reason: 'insufficient-funds', amountCents: 4500 });
  log.append({ ts: TS, paymentId: 'pmt_1', payerId: 'pyr_1', state: 'settled', amountCents: 4500 });
  assert.equal(log.current('pmt_1'), 'settled');
  assert.equal(log.history('pmt_1').length, 3, 'every transition retained');
});

// ---- idempotency (the double-collect guard) --------------------------------

test('replaying the same recovery does NOT act twice', async () => {
  const store = new IdempotencyStore();
  let debits = 0;
  const payload = { paymentId: 'pmt_1', date: '2026-08-24', amount: 4500 };
  const act = async () => { debits++; return { id: 'pmt_recovery_1' }; };

  const first = await store.run('recover', 'pmt_1', payload, act, TS);
  const second = await store.run('recover', 'pmt_1', payload, act, TS); // webhook re-fires

  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.deepEqual(second.response, first.response);
  assert.equal(debits, 1, 'the debit ran exactly once despite two calls');
});

test('same key with a different payload is a 409 conflict', async () => {
  const store = new IdempotencyStore();
  const act = async () => ({ ok: true });
  await store.run('recover', 'pmt_1', { date: 'Mon' }, act, TS);
  await assert.rejects(
    () => store.run('recover', 'pmt_1', { date: 'Tue' }, act, TS),
    (e) => e instanceof IdempotencyConflict,
  );
});

// ---- reconciliation --------------------------------------------------------

test('recon is clean when all three views agree', () => {
  const log = new PaymentStateLog();
  log.append({ ts: TS, paymentId: 'pmt_1', payerId: 'pyr_1', state: 'settled', amountCents: 4500 });
  const r = reconcile(log, [{ paymentId: 'pmt_1', status: 'settled' }], [{ paymentId: 'pmt_1', amountCents: 4500 }]);
  assert.ok(r.clean);
  assert.equal(r.matched, 1);
});

test('recon catches an injected state mismatch', () => {
  const log = new PaymentStateLog();
  log.append({ ts: TS, paymentId: 'pmt_1', payerId: 'pyr_1', state: 'settled', amountCents: 4500 });
  // processor says it actually dishonoured — the drift a real operator fears
  const r = reconcile(log, [{ paymentId: 'pmt_1', status: 'dishonoured' }], []);
  assert.equal(r.clean, false);
  assert.equal(r.discrepancies[0].kind, 'state-mismatch');
});

test('recon catches money that settled with no internal record', () => {
  const log = new PaymentStateLog();
  const r = reconcile(log, [], [{ paymentId: 'pmt_ghost', amountCents: 4500 }]);
  assert.equal(r.clean, false);
  assert.equal(r.discrepancies[0].kind, 'settled-not-in-ledger');
});
