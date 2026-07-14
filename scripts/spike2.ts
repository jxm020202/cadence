/**
 * Spike 2 — how do you actually make a scheduled BECS payment PROCESS in the
 * sandbox? Spike 1 proved Time-Travel on a GET does nothing. Hypotheses here:
 *   H1: Time-Travel on the POST /payments (create "as at" a future date).
 *   H2: transactionDate today + Time-Travel forward on create.
 *   H3: re-save (POST with id) under Time-Travel to trigger processing.
 *   H4: read /events + the payment repeatedly after creating-under-TT.
 * Run: npx tsx scripts/spike2.ts
 */
process.loadEnvFile(new URL('../.env', import.meta.url));
const ENV = process.env.PINCH_ENV || 'test';
const API = `https://api.getpinch.com.au/${ENV}`;
const VER = process.env.PINCH_VERSION || '2020.1';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

let token = '';
async function getToken() {
  const basic = Buffer.from(`${process.env.PINCH_APP_ID}:${process.env.PINCH_SECRET}`).toString('base64');
  const res = await fetch('https://auth.getpinch.com.au/connect/token', { method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'api1' }) });
  token = (await res.json()).access_token;
}
async function call(method: string, path: string, opts: { body?: unknown; timeTravel?: string } = {}) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'pinch-version': VER, Accept: 'application/json' };
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (opts.timeTravel) headers['Time-Travel'] = opts.timeTravel;
  const res = await fetch(`${API}${path}`, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let json: any = null; try { json = JSON.parse(await res.text()); } catch {}
  return { status: res.status, json };
}
const st = (r: any) => r?.json?.status ?? '(none)';

(async () => {
  await getToken();
  const now = new Date();
  const today = isoDate(now);
  const past = isoDate(addDays(now, -3));
  const ttFuture = `${isoDate(addDays(now, 9))}T09:00:00Z`;

  const payer = (await call('POST', '/payers', { body: { firstName: 'Dana', lastName: 'H2', emailAddress: `dana+${Date.now()}@cadence.test` } })).json;
  await call('POST', `/payers/${payer.id}/sources`, { body: { sourceType: 'bank-account', bankAccountName: 'Dana H2', bankAccountBsb: '012-001', bankAccountNumber: '987654321' } });
  console.log('payer', payer.id);

  // H1: create the forced-dishonour payment UNDER a future Time-Travel clock
  console.log('\n[H1] POST /payments with Time-Travel=future, transactionDate=today, #insufficient-funds');
  const h1 = await call('POST', '/payments', { timeTravel: ttFuture, body: { payerId: payer.id, amount: 4500, transactionDate: today, description: 'Gym #insufficient-funds' } });
  console.log('  status =', st(h1), '| id =', h1.json?.id);

  // H2: transactionDate in the PAST, under future TT
  console.log('\n[H2] POST /payments TT=future, transactionDate=past(-3d), #insufficient-funds');
  const h2 = await call('POST', '/payments', { timeTravel: ttFuture, body: { payerId: payer.id, amount: 4500, transactionDate: past, description: 'Gym #insufficient-funds' } });
  console.log('  status =', st(h2), '| id =', h2.json?.id);
  if (h2.json?.id) {
    const h2b = await call('GET', `/payments/${h2.json.id}`, { timeTravel: ttFuture });
    console.log('  re-GET under TT =', st(h2b));
  }

  // H3: create normally, then re-save (POST with id) under TT
  console.log('\n[H3] create normal, then re-POST with id under TT');
  const base = await call('POST', '/payments', { body: { payerId: payer.id, amount: 4500, transactionDate: today, description: 'Gym #insufficient-funds' } });
  const idc = base.json?.id;
  const h3 = await call('POST', '/payments', { timeTravel: ttFuture, body: { id: idc, payerId: payer.id, amount: 4500, transactionDate: past, description: 'Gym #insufficient-funds' } });
  console.log('  re-saved status =', st(h3));

  // H4: events under TT
  const ev = await call('GET', '/events', { timeTravel: ttFuture });
  console.log('\n[events] types:', (ev.json?.data ?? []).map((e: any) => e.type));

  console.log('\nVERDICT: H1=%s H2=%s H3=%s', st(h1), st(h2), st(h3));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
