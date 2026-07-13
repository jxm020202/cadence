import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pinch } from './pinch.js';
import { verifyPinchSignature } from './webhook.js';

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
    console.log(`[webhook] ${event.Type ?? event.type} ${event.Id ?? event.id}`);
    // TODO: route on event.Type — e.g. transfer / bank-results / scheduled-process
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

app.get('/thanks', (req, res) => {
  res.send(
    `<h1>Thanks!</h1><pre>paymentLinkId=${req.query.paymentLinkId ?? ''}\npaymentId=${req.query.paymentId ?? ''}</pre>`,
  );
});

app.listen(PORT, () => {
  console.log(`Pinch hackathon spine on http://localhost:${PORT}  (env=${Pinch.env})`);
});
