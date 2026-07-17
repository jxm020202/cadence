/** Spike 4 — Allen's question: does applicationFee get a 200 on a DIRECT
 * (non-managed) merchant's payment, and does it actually route anywhere?
 * Run: npx tsx scripts/spike4.ts */
process.loadEnvFile(new URL('../.env', import.meta.url));
const API = `https://api.getpinch.com.au/${process.env.PINCH_ENV || 'test'}`;
let token = '';
async function getToken() {
  const basic = Buffer.from(`${process.env.PINCH_APP_ID}:${process.env.PINCH_SECRET}`).toString('base64');
  const r = await fetch('https://auth.getpinch.com.au/connect/token', { method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'api1' }) });
  token = (await r.json()).access_token;
}
async function call(method: string, path: string, body?: unknown) {
  const h: Record<string,string> = { Authorization: `Bearer ${token}`, 'pinch-version': process.env.PINCH_VERSION || '2020.1', Accept: 'application/json' };
  if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(`${API}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j: any = null; try { j = JSON.parse(await r.text()); } catch {}
  return { status: r.status, j };
}
(async () => {
  await getToken();
  const payer = (await call('POST', '/payers', { firstName: 'Fee', lastName: 'Spike', emailAddress: `fee+${Date.now()}@cadence.test` })).j;
  await call('POST', `/payers/${payer.id}/sources`, { sourceType: 'bank-account', bankAccountName: 'Fee Spike', bankAccountBsb: '012-001', bankAccountNumber: '987654321' });
  const r = await call('POST', '/payments', { payerId: payer.id, amount: 4500, transactionDate: new Date().toISOString().slice(0,10), description: 'fee spike', applicationFee: 675, metadata: 'consent: test-receipt' });
  console.log('POST /payments with applicationFee=675 on DIRECT merchant ->', r.status);
  console.log('  applicationFee in response:', r.j?.applicationFee, '| totalFee:', r.j?.totalFee, '| metadata:', JSON.stringify(r.j?.metadata));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
