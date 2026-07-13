/**
 * Minimal Pinch Payments API client.
 *
 * Verified against docs.getpinch.com.au (July 2026):
 *  - OAuth client-credentials token from  https://auth.getpinch.com.au/connect/token
 *    (Basic auth = base64(appId:secret), form body grant_type=client_credentials&scope=api1)
 *  - REST base:  https://api.getpinch.com.au/{test|live}
 *  - All amounts are in CENTS ($10.00 -> 1000).
 *  - Always send the `pinch-version` header.
 *
 * Endpoint paths are pulled out as constants so they're trivial to correct
 * against the reference (docs/pinch-api-reference.md) as we wire each flow up.
 */

const ENV = process.env.PINCH_ENV === 'live' ? 'live' : 'test';
const AUTH_URL = 'https://auth.getpinch.com.au/connect/token';
const API_BASE = `https://api.getpinch.com.au/${ENV}`;
const PINCH_VERSION = process.env.PINCH_VERSION || '2020.1';

const APP_ID = required('PINCH_APP_ID');
const SECRET = required('PINCH_SECRET');

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} — copy .env.example to .env and fill it in.`);
  return v;
}

// ---- token cache -----------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const basic = Buffer.from(`${APP_ID}:${SECRET}`).toString('base64');
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'api1' }),
  });
  if (!res.ok) {
    throw new Error(`Pinch auth failed ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

// ---- request helper --------------------------------------------------------

type Json = Record<string, unknown>;

// `timeTravel` (ISO-8601 UTC, e.g. "2026-08-01T00:00:00Z") makes the TEST
// sandbox process the request "as at" that moment — fast-forward recurring
// billing / settlement without waiting real days. Send it per request.
async function api<T = Json>(
  method: string,
  path: string,
  body?: Json,
  opts?: { timeTravel?: string },
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'pinch-version': PINCH_VERSION,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(opts?.timeTravel ? { 'Time-Travel': opts.timeTravel } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Pinch ${method} ${path} -> ${res.status}: ${text}`);
  }
  return parsed as T;
}

// ---- endpoints (confirm exact paths in docs/pinch-api-reference.md) ---------

export const Pinch = {
  env: ENV,
  base: API_BASE,

  // Escape hatch for anything not wrapped below (and for Time-Travel demos):
  //   Pinch.request('POST', '/payments', body, { timeTravel: '2026-08-01T00:00:00Z' })
  request: <T = Json>(method: string, path: string, body?: Json, opts?: { timeTravel?: string }) =>
    api<T>(method, path, body, opts),

  health: () => api('GET', '/health/auth'), // authenticated connectivity check

  // Payer = the customer you collect from. Create-or-update. Min: firstName + emailAddress.
  savePayer: (payer: Json) => api('POST', '/payers', payer),
  listPayers: () => api('GET', '/payers'),
  getPayer: (id: string) => api('GET', `/payers/${id}`),

  // Attach a saved payment method to a payer (card token from CaptureJs, or bank account).
  createPaymentSource: (source: Json) => api('POST', '/payment-sources', source),

  // One-off collection. `token` comes from CaptureJs (client-side), or use an
  // existing `sourceId`. Amount in cents. `nonce` prevents accidental doubles.
  realtimePayment: (payment: {
    amount: number;
    token?: string;
    sourceId?: string;
    payerId?: string;
    email?: string;
    fullName?: string;
    description?: string;
    metadata?: string;
    nonce?: string[]; // one-time refs -> idempotency / no accidental doubles
    applicationFee?: number; // managed-merchant split, cents
  }) => api('POST', '/payments/realtime', payment),

  // Scheduled / future-dated collection. Pair a future transactionDate with a
  // Time-Travel request to simulate the day it processes. Put "#insufficient-funds"
  // (etc.) in `description` to force a dishonour in the sandbox.
  savePayment: (payment: Json, opts?: { timeTravel?: string }) =>
    api('POST', '/payments', payment, opts),

  // Hosted, shareable checkout page. Returns a URL you send by SMS/email/chat.
  createPaymentLink: (link: {
    amount: number;
    description?: string;
    returnUrl?: string;
    payerId?: string;
    metadata?: string;
  }) => api('POST', '/payment-links', link),

  // Recurring: a Plan is the template, a Subscription binds a payer to a plan.
  savePlan: (plan: Json) => api('POST', '/plans', plan),
  createSubscription: (sub: Json) => api('POST', '/subscriptions', sub),

  // Register where Pinch should POST events. Response includes the signing secret.
  createWebhook: (hook: { url: string; events?: string[] }) =>
    api('POST', '/webhooks', hook),
  listWebhooks: () => api('GET', '/webhooks'),

  // PayFac / platform: create a sub-merchant you control; collect on their behalf
  // and take a cut via `applicationFee` (cents) on each payment.
  createManagedMerchant: (merchant: Json) => api('POST', '/managed-merchants', merchant),
  listManagedMerchants: () => api('GET', '/managed-merchants'),
};
