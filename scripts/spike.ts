/**
 * Day-0 sandbox spike — the flip-to-win verification every judge asked for.
 * Loads TEST keys from .env, walks the real Pinch sandbox, and REPORTS what
 * actually happens (no assumptions). Central question: does the Time-Travel
 * header actually advance a scheduled BECS payment to dishonoured / settled?
 * Run: npx tsx scripts/spike.ts
 */
process.loadEnvFile(new URL('../.env', import.meta.url));

const ENV = process.env.PINCH_ENV || 'test';
const AUTH = 'https://auth.getpinch.com.au/connect/token';
const API = `https://api.getpinch.com.au/${ENV}`;
const VER = process.env.PINCH_VERSION || '2020.1';
const APP = process.env.PINCH_APP_ID!;
const SECRET = process.env.PINCH_SECRET!;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

let token = '';
async function getToken() {
  const basic = Buffer.from(`${APP}:${SECRET}`).toString('base64');
  const res = await fetch(AUTH, { method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'api1' }) });
  if (!res.ok) { console.log(await res.text()); throw new Error('auth failed'); }
  token = (await res.json()).access_token;
  console.log('[TOKEN] ok');
}

async function call(method: string, path: string, opts: { body?: unknown; timeTravel?: string } = {}) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'pinch-version': VER, Accept: 'application/json' };
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (opts.timeTravel) headers['Time-Travel'] = opts.timeTravel;
  const res = await fetch(`${API}${path}`, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let json: any = null; try { json = text ? JSON.parse(text) : null; } catch {}
  const tt = opts.timeTravel ? ` [TT ${opts.timeTravel}]` : '';
  console.log(`[${method} ${path}]${tt} -> ${res.status}`);
  if (json) console.log('  ' + JSON.stringify(json).slice(0, 600)); else if (text) console.log('  ' + text.slice(0, 400));
  return { status: res.status, json };
}

const statusOf = (r: any) => r?.json?.status ?? r?.json?.data?.status ?? '(none)';

(async () => {
  await getToken();
  await call('GET', '/health/auth');

  const t0 = new Date();
  const txDate = isoDate(addDays(t0, 2));            // scheduled 2 days out
  const future = `${isoDate(addDays(t0, 9))}T09:00:00Z`; // time-travel a week past it

  // payer + bank source
  const payer = await call('POST', '/payers', { body: { firstName: 'Dana', lastName: 'Spike', emailAddress: `dana+${Date.now()}@cadence.test` } });
  const payerId = payer.json.id;
  await call('POST', `/payers/${payerId}/sources`, { body: { sourceType: 'bank-account', bankAccountName: 'Dana Spike', bankAccountBsb: '012-001', bankAccountNumber: '987654321' } });

  // --- A: forced dishonour via #insufficient-funds in the description ---
  console.log('\n===== A: forced-dishonour payment =====');
  const payA = await call('POST', '/payments', { body: { payerId, amount: 4500, transactionDate: txDate, description: 'Gym membership #insufficient-funds' } });
  const idA = payA.json?.id;
  console.log(`  A id=${idA} status(now)=${statusOf(payA)}`);
  const aTT = await call('GET', `/payments/${idA}`, { timeTravel: future });
  console.log(`  ==> A status after Time-Travel: ${statusOf(aTT)}`);

  // --- B: clean payment, expect settle after Time-Travel ---
  console.log('\n===== B: clean payment (expect settle) =====');
  const payB = await call('POST', '/payments', { body: { payerId, amount: 4500, transactionDate: txDate, description: 'Gym membership recovery' } });
  const idB = payB.json?.id;
  const bTT = await call('GET', `/payments/${idB}`, { timeTravel: future });
  console.log(`  ==> B status after Time-Travel: ${statusOf(bTT)}`);

  // --- events under Time-Travel: did bank-results / transfer fire? ---
  console.log('\n===== events under Time-Travel =====');
  await call('GET', '/events', { timeTravel: future });

  console.log('\n===== VERDICT =====');
  console.log(`A (forced-dishonour) -> ${statusOf(aTT)} | B (clean) -> ${statusOf(bTT)}`);
  console.log('If A=dishonoured and B=successful/settled, Time-Travel drives state on a GET. If both still scheduled, processing needs a scheduled-job tick (fallback plan).');
})().catch((e) => { console.error('SPIKE ERROR:', e.message); process.exit(1); });
