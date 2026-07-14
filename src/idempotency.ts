import crypto from 'node:crypto';

/**
 * Idempotency as a durable state machine — the direct answer to "what happens
 * if a payer gets debited twice?".
 *
 * A recovery is keyed by (scope, key) where key is deterministic per intent
 * (e.g. `recover:${paymentId}`). The store guarantees:
 *   - first call with a key  → runs, records the response, returns it
 *   - repeat with the SAME payload hash → returns the stored response, the
 *     action does NOT run again (no second debit)
 *   - repeat with a DIFFERENT payload hash under the same key → 409 conflict
 *     (a bug on the caller's side; we refuse rather than silently double-act)
 *   - concurrent calls → the second sees `in_flight` and is told to back off
 *
 * This pairs at-least-once webhook delivery (Pinch may resend bank-results)
 * with idempotent writes — the standard way money systems avoid duplication.
 */

export type IdemStatus = 'in_flight' | 'done' | 'failed';

export interface IdemRecord {
  scope: string;
  key: string;
  requestHash: string;
  status: IdemStatus;
  response?: unknown;
  createdAt: string;
}

export class IdempotencyConflict extends Error {
  constructor(public key: string) {
    super(`idempotency conflict: key "${key}" already used with a different payload`);
    this.name = 'IdempotencyConflict';
  }
}

export function hashPayload(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

export class IdempotencyStore {
  private records = new Map<string, IdemRecord>();
  private id(scope: string, key: string) { return `${scope}:${key}`; }

  /**
   * Run `action` at most once per (scope,key). Returns { replayed, response }.
   * `now` is injected so the store is deterministic under test.
   */
  async run<T>(
    scope: string,
    key: string,
    payload: unknown,
    action: () => Promise<T>,
    now: string,
  ): Promise<{ replayed: boolean; response: T }> {
    const id = this.id(scope, key);
    const hash = hashPayload(payload);
    const existing = this.records.get(id);

    if (existing) {
      if (existing.requestHash !== hash) throw new IdempotencyConflict(key);
      if (existing.status === 'in_flight') {
        throw new Error(`idempotency: key "${key}" is in flight — retry later`);
      }
      if (existing.status === 'done') {
        return { replayed: true, response: existing.response as T }; // NO re-run
      }
      // failed → allow a genuine retry to proceed below
    }

    this.records.set(id, { scope, key, requestHash: hash, status: 'in_flight', createdAt: now });
    try {
      const response = await action();
      this.records.set(id, { scope, key, requestHash: hash, status: 'done', response, createdAt: now });
      return { replayed: false, response };
    } catch (e) {
      this.records.set(id, { scope, key, requestHash: hash, status: 'failed', createdAt: now });
      throw e;
    }
  }

  peek(scope: string, key: string): IdemRecord | undefined {
    return this.records.get(this.id(scope, key));
  }
}
