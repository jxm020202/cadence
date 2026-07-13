import crypto from 'node:crypto';

/**
 * Verify a Pinch webhook signature.
 *
 * Verified against Pinch.SDK/Webhooks/WebhookClient.cs:
 *   header `pinch-signature` looks like:  t=1619577772,v2=<hex>
 *   signed string  = `${timestamp}.${rawBody}`
 *   signature      = HMAC-SHA256(secret, signedString)  -> lowercase hex
 *   reject if |now - t| > tolerance (default 5 min)
 *
 * IMPORTANT: pass the RAW request body bytes/string, not the parsed JSON —
 * re-serialising JSON changes the bytes and breaks the signature.
 */
export function verifyPinchSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !secret) return false;

  let timestamp = '';
  const signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.trim().split('=');
    if (k === 't') timestamp = v;
    else if (k === 'v2') signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  // timestamp tolerance (replay protection)
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Date.now() / 1000;
  if (Math.abs(nowSec - ts) > toleranceSeconds) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
