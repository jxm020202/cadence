import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pinch } from './pinch.js';
import { verifyPinchSignature } from './webhook.js';
import { demo as mockDemo, DANA_CONTEXT } from './demo/engine.js';
import { LiveDriver } from './demo/live.js';
import { handleBankResults, sweepRisk, type PayerContext } from './loop.js';

// PINCH_MODE=live drives the demo against the real sandbox (real object ids);
// otherwise the payload-exact mock driver. Same DemoState shape either way.
const LIVE = process.env.PINCH_MODE === 'live';
const demo = LIVE ? new LiveDriver() : mockDemo;
console.log(`[demo] driver = ${LIVE ? 'LIVE (real Pinch sandbox)' : 'MOCK (payload-exact)'}`);

// payment-id → payer billing context (in-memory for demo; merchant DB in prod)
const paymentContexts = new Map<string, PayerContext>();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const WEBHOOK_SECRET = process.env.PINCH_WEBHOOK_SECRET || '';

// The webhook route needs the RAW body for signature verification, so mount it
// with express.raw BEFORE the global json parser.
app.post(
  '/webhooks/pinch',
  express.raw({ type: '*/*' }),
  (req, res) => {
    const raw = req.body.toString('utf8');
    const ok = verifyPinchSignature(raw, req.header('pinch-signature'), WEBHOOK_SECRET);
    if (!ok) {
      console.warn('[webhook] BAD signature — ignoring');
      return res.status(400).send('bad signature');
    }
    const event = JSON.parse(raw);
    const type = event.Type ?? event.type;
    console.log(`[webhook] ${type} ${event.Id ?? event.id}`);
    if (type === 'bank-results') {
      // THE LOOP: dishonour → hard-code gate → model score → savePayment re-time.
      // Context lookup is in-memory for the demo; a merchant DB in production.
      handleBankResults(event, (paymentId) => paymentContexts.get(paymentId))
        .then((results) => results.forEach((r) =>
          console.log(`[loop] ${r.paymentId}: ${r.plan.gate}` +
            (r.plan.bestRetryDay != null ? ` day+${r.plan.bestRetryDay} p=${r.plan.pDishonour}` : ''))))
        .catch((e) => console.error('[loop] failed:', e));
    }
    res.sendStatus(200);
  },
);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- thin API over the Pinch client so the browser demo can drive it ---------

app.get('/api/health', async (_req, res) => {
  try {
    res.json(await Pinch.health());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/charge', async (req, res) => {
  try {
    const { token, amount, email, fullName, description } = req.body ?? {};
    const payment = await Pinch.realtimePayment({
      token,
      amount: Number(amount), // cents
      email,
      fullName,
      description,
      nonce: [`demo-${Date.now()}`], // one-shot idempotency
    });
    res.json(payment);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.post('/api/payment-links', async (req, res) => {
  try {
    const { amount, description } = req.body ?? {};
    const link = await Pinch.createPaymentLink({
      amount: Number(amount),
      description,
      returnUrl: `${process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`}/thanks`,
    });
    res.json(link);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

// --- demo engine (mock driver until sandbox keys; live driver via day-0 spike)
app.get('/api/demo/state', async (_req, res) => res.json(await demo.state()));
app.post('/api/demo/step', async (_req, res) => res.json(await demo.advance()));
app.post('/api/demo/reset', async (req, res) => res.json(await demo.reset(req.body?.scenario)));
app.post('/api/demo/reply', async (req, res) => res.json(await demo.reply(String(req.body?.text ?? ''))));
demo.warm().then(() => console.log('[demo] model bridge warm')).catch((e) => console.warn('[demo] warm failed:', e));

// the "drag the debit" spectacle beat: model risk at every candidate date
let sweepCache: Record<string, number> | null = null;
// merchant-facing dashboard: at-risk debits scored by the live model
app.get('/api/merchant/dashboard', async (_req, res) => {
  try {
    const { merchantDashboard } = await import('./merchant.js');
    res.json(await merchantDashboard());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/demo/sweep', async (_req, res) => {
  try {
    sweepCache ??= await sweepRisk(DANA_CONTEXT);
    res.json({ base_date: '2026-08-14', p_by_offset: sweepCache });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/thanks', (req, res) => {
  res.send(
    `<h1>Thanks!</h1><pre>paymentLinkId=${req.query.paymentLinkId ?? ''}\npaymentId=${req.query.paymentId ?? ''}</pre>`,
  );
});

app.listen(PORT, () => {
  console.log(`Pinch hackathon spine on http://localhost:${PORT}  (env=${Pinch.env})`);
});
