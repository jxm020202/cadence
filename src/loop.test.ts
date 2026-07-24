import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { handleBankResults, type PayerContext } from './loop.js';
import { verifyPinchSignature } from './webhook.js';

// Dana-shaped context: two prior NSFs so the model has a pay-cycle to lock.
const ctx: PayerContext = {
  payerId: 'pyr_test', amount: 45, day: 226, n_prior: 12, n_prior_nsf: 2, nsf_days: [198, 212],
  schedule_period: 14, schedule_dom: -1, mandate_age: 180, days_since_last_nsf: 14, amount_over_payer_mean: 1.0,
};
const bankResults = (type: string) => ({
  Type: 'bank-results', Id: 'evt_test',
  Data: [{ PaymentId: 'pmt_test', Status: 'dishonoured', Dishonour: { Type: type } }],
});

// END-TO-END: a bank-results webhook payload → hard-code gate → LightGBM →
// a model-timed recovery plan. act:false so no Pinch API call is made.
test('insufficient-funds event → gate=retry + a model-picked day', { timeout: 30_000 }, async () => {
  const [r] = await handleBankResults(bankResults('insufficient-funds'), () => ctx, { act: false });
  assert.equal(r.plan.gate, 'retry');
  assert.equal(typeof r.plan.bestRetryDay, 'number');
  assert.ok((r.plan.bestRetryDay as number) >= 0 && (r.plan.bestRetryDay as number) <= 14);
  assert.ok(typeof r.plan.pDishonour === 'number' && r.plan.pDishonour > 0);
});

test('account-closed event → gate=never-retry, no retry day', { timeout: 30_000 }, async () => {
  const [r] = await handleBankResults(bankResults('account-closed'), () => ctx, { act: false });
  assert.equal(r.plan.gate, 'never-retry');
  assert.equal(r.plan.bestRetryDay, undefined);
});

test('no context for a payment → skipped, not crashed', { timeout: 30_000 }, async () => {
  const results = await handleBankResults(bankResults('insufficient-funds'), () => undefined, { act: false });
  assert.equal(results.length, 0);
});

// The webhook auth end: a signature we compute the way Pinch does must verify,
// and any tamper of the body must fail.
test('pinch-signature round-trips and rejects tampering', () => {
  const secret = 'whsec_test';
  const raw = JSON.stringify(bankResults('insufficient-funds'));
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const header = `t=${t},v2=${sig}`;
  assert.equal(verifyPinchSignature(raw, header, secret), true);
  assert.equal(verifyPinchSignature(raw + ' ', header, secret), false); // tampered body
  assert.equal(verifyPinchSignature(raw, header, 'wrong-secret'), false);
});
