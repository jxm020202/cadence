/**
 * ONBOARD mini-server (port 3230) — self-contained contender.
 *
 * Endpoints:
 *   GET  /api/onboard/state   current demo state
 *   POST /api/onboard/draft   { blob } → run the real drafting brain
 *   POST /api/onboard/step    advance the rail
 *   POST /api/onboard/reset   back to the paste screen
 *   POST /api/onboard/abn     { abn } → live ATO checksum (flip-a-digit beat)
 *   GET  /api/health          real authenticated Pinch sandbox check (reuses
 *                             src/pinch.ts; needs PINCH_APP_ID/PINCH_SECRET)
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pinch } from '../../src/pinch.js'; // reuse the repo client — no duplication
import { onboard } from './engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3230);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/onboard/state', (_req, res) => res.json(onboard.state()));
app.post('/api/onboard/step', (_req, res) => res.json(onboard.advance()));
app.post('/api/onboard/reset', (_req, res) => res.json(onboard.reset()));

app.post('/api/onboard/draft', (req, res) => {
  const blob = typeof req.body?.blob === 'string' ? req.body.blob : '';
  if (!blob.trim()) return res.status(400).json({ error: 'blob required' });
  res.json(onboard.draft(blob));
});

// The spectacle micro-beat: every digit flip re-runs the REAL checksum server-side.
app.post('/api/onboard/abn', (req, res) => {
  const check = onboard.abn(String(req.body?.abn ?? ''));
  if (!check) return res.status(400).json({ error: 'need 11 digits' });
  res.json(check);
});

// Real sandbox connectivity via the shared client (only works with keys in env).
app.get('/api/health', async (_req, res) => {
  try {
    res.json({ env: Pinch.env, health: await Pinch.health() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`ONBOARD on http://localhost:${PORT}  (pinch env=${Pinch.env})`);
});
