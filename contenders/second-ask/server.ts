/**
 * Second Ask — self-contained mini-server (port 3220).
 *
 * Zero npm dependencies of its own: node:http + the repo's existing
 * src/pinch.ts (API client, used in live mode) and src/webhook.ts
 * (pinch-signature HMAC verification on the real webhook route).
 *
 * Run from this directory:  npm start   (uses the repo root's tsx)
 */

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPinchSignature } from '../../src/webhook.js';
import { SecondAskAgent } from './agent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3220);
const WEBHOOK_SECRET = process.env.PINCH_WEBHOOK_SECRET || '';

const agent = new SecondAskAgent();

function json(res: http.ServerResponse, code: number, obj: unknown): void {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = `${req.method} ${url.pathname}`;

    if (route === 'GET /api/state') return json(res, 200, agent.state());
    if (route === 'POST /api/reset') return json(res, 200, agent.reset());
    if (route === 'POST /api/scenario') {
      const b = JSON.parse((await readBody(req)) || '{}') as { code?: string };
      return json(res, 200, await agent.dishonour(String(b.code ?? 'insufficient-funds')));
    }
    if (route === 'POST /api/sms') {
      const b = JSON.parse((await readBody(req)) || '{}') as { text?: string };
      return json(res, 200, await agent.sms(String(b.text ?? '')));
    }
    if (route === 'POST /api/timetravel') return json(res, 200, await agent.timeTravel());

    // Real webhook plumbing: verified pinch-signature → bank-results → the agent.
    if (route === 'POST /webhooks/pinch') {
      const raw = await readBody(req);
      const sig = req.headers['pinch-signature'];
      const ok = verifyPinchSignature(raw, Array.isArray(sig) ? sig[0] : sig, WEBHOOK_SECRET);
      if (!ok) {
        res.writeHead(400);
        return res.end('bad signature');
      }
      const event = JSON.parse(raw) as Record<string, unknown>;
      const type = event.Type ?? event.type;
      if (type === 'bank-results') await agent.onBankResults(event);
      res.writeHead(200);
      return res.end('ok');
    }

    if (route === 'GET /thanks') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<h1>Details updated — thanks, Sam.</h1><p>Second Ask takes it from here.</p>');
    }

    // Static files
    if (req.method === 'GET') {
      const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = path.normalize(path.join(PUBLIC_DIR, rel));
      if (!file.startsWith(PUBLIC_DIR + path.sep) && file !== path.join(PUBLIC_DIR, 'index.html')) {
        res.writeHead(403);
        return res.end('forbidden');
      }
      try {
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
        return res.end(data);
      } catch {
        res.writeHead(404);
        return res.end('not found');
      }
    }

    res.writeHead(404);
    res.end('not found');
  } catch (e) {
    json(res, 500, { error: String(e) });
  }
});

server.listen(PORT, () => {
  const mode = process.env.PINCH_MODE === 'live' ? 'LIVE sandbox' : 'mock (payload-exact)';
  console.log(`Second Ask on http://localhost:${PORT}  (${mode})`);
});
