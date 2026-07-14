/**
 * Spike 3 — does the sandbox batch EVER process a payment on its own, and how
 * fast? Create a past-dated #insufficient-funds payment, poll it, and check the
 * processed-payments list for this merchant. Decides the demo's processing story.
 * Run: npx tsx scripts/spike3.ts
 */
process.loadEnvFile(new URL('../.env', import.meta.url));
const ENV = process.env.PINCH_ENV || 'test';
const API = `https://api.getpinch.com.au/${ENV}`;
const VER = process.env.PINCH_VERSION || '2020.1';
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let token = '';
async function getToken() {
  const basic = Buffer.from(`${process.env.PINCH_APP_ID}:${process.env.PINCH_SECRET}`).toString('base64');
  const res = await fetch('https://auth.getpinch.com.au/connect/token', { method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'api1' }) });
  token = (await res.json()).access_token;
}
async function call(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'pinch-version': VER, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = JSON.parse(await res.text()); } catch {}
  return { status: res.status, json };
}

(async () => {
  await getToken();
  const now = new Date();
  const payer = (await call('POST', '/payers', { firstName: 'Dana', lastName: 'H3', emailAddress: `dana+${Date.now()}@cadence.test` } as any)).json;
  await call('POST', `/payers/${payer.id}/sources`, { sourceType: 'bank-account', bankAccountName: 'Dana H3', bankAccountBsb: '012-001', bankAccountNumber: '987654321' } as any);
  const pay = (await call('POST', '/payments', { payerId: payer.id, amount: 4500, transactionDate: isoDate(addDays(now, -2)), description: 'Gym #insufficient-funds' } as any)).json;
  console.log('created', pay.id, 'status', pay.status, 'txDate', pay.transactionDate);

  for (let i = 0; i < 6; i++) {
    await sleep(15000);
    const r = await call('GET', `/payments/${pay.id}`);
    console.log(`  +${(i + 1) * 15}s -> ${r.json?.status}`);
    if (r.json?.status && r.json.status !== 'scheduled') break;
  }

  const processed = await call('GET', '/payments/processed');
  console.log('\nprocessed-payments list totalItems =', processed.json?.totalItems ?? processed.json?.data?.length ?? '(?)');
  console.log('processed sample:', JSON.stringify(processed.json?.data?.slice(0, 2) ?? processed.json).slice(0, 400));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
