/**
 * ONBOARD demo engine — "become a payments platform in one screen".
 *
 * Same step-machine + honesty contract as the Cadence demo (src/demo/engine.ts):
 * every pane in the UI is a payload-exact request/response; anything not yet
 * executed against the live sandbox is labelled MOCK. The drafting brain
 * (brain.ts) is REAL and deterministic — its calls are labelled mock:false.
 *
 * Rail:  paste → 1 Draft → 2 KYC docs → 3 Live → 4 First $ (with platform cut)
 */

import type { ApiCall } from '../../src/demo/engine.js';
import {
  checkAbn,
  draftMerchantPayload,
  kycChecklist,
  parseBusinessBlob,
  type AbnCheck,
  type KycDoc,
  type ParsedBusiness,
} from './brain.js';

export const SAMPLE_BLOB = `Hey — can you get us live on your marketplace?
We're Marlo & Co Espresso Pty Ltd (trading as "Marlo's"), ABN 71 234 567 007.
Contact is Priya Marlo, priya@marlos.coffee, 0412 345 678.
We're at 12 Foundry Lane, Collingwood VIC 3066.
Settlement to Marlo & Co Espresso — BSB 012-001, account 987654321.`;

const MERCHANT_ID = 'mmch_demo_marlo_01';
const PAYMENT_ID = 'pmt_demo_marlo_first';

// The money beat, in cents (amounts are ALWAYS cents on the Pinch API).
const GROSS = 22000; // $220.00 first marketplace order
const APP_FEE = 550; // $5.50 — the platform's cut, 2.5%
const PINCH_FEE = 88; // processing fee borne by the sub-merchant
const NET = GROSS - APP_FEE - PINCH_FEE;

export interface OnboardState {
  step: number;
  stepName: string;
  narration: string;
  rail: Array<{ id: string; label: string; state: 'todo' | 'active' | 'done' }>;
  blob: string;
  fields?: ParsedBusiness['fields'];
  missing?: string[];
  abn?: AbnCheck | null;
  merchant?: { id: string; name: string; status: string };
  checklist?: Array<KycDoc & { status: 'required' | 'uploaded' | 'verified' }>;
  money?: {
    gross: number;
    applicationFee: number;
    processingFee: number;
    netToMerchant: number;
    platformEarnings: number;
  };
  calls: ApiCall[];
  done: boolean;
}

const RAIL = [
  { id: 'draft', label: 'Draft' },
  { id: 'kyc', label: 'KYC docs' },
  { id: 'live', label: 'Live' },
  { id: 'money', label: 'First $' },
];

export class OnboardEngine {
  private step = 0;
  private blob = SAMPLE_BLOB;
  private parsed: ParsedBusiness = parseBusinessBlob(SAMPLE_BLOB);

  state(): OnboardState {
    return this.render();
  }

  reset(): OnboardState {
    this.step = 0;
    this.blob = SAMPLE_BLOB;
    this.parsed = parseBusinessBlob(SAMPLE_BLOB);
    return this.render();
  }

  /** The paste beat: run the real brain over whatever blob the stage feeds it. */
  draft(blob: string): OnboardState {
    this.blob = blob;
    this.parsed = parseBusinessBlob(blob);
    this.step = 1;
    return this.render();
  }

  advance(): OnboardState {
    if (this.step === 0) return this.draft(this.blob);
    if (this.step < 4) this.step += 1;
    return this.render();
  }

  /** Live checksum for the flip-a-digit micro-beat — same code path as the draft. */
  abn(raw: string): AbnCheck | null {
    return checkAbn(raw);
  }

  private render(): OnboardState {
    const s = this.step;
    const p = this.parsed;
    const merchantName = p.tradingName ?? p.businessName ?? 'the merchant';
    const rail = RAIL.map((r, i) => ({
      ...r,
      state: (s > i + 1 || (s === 4 && i === 3) ? 'done' : s === i + 1 ? 'active' : 'todo') as
        | 'todo'
        | 'active'
        | 'done',
    }));

    const base: OnboardState = {
      step: s,
      stepName: ['paste', 'draft', 'kyc', 'live', 'money'][s],
      narration: '',
      rail,
      blob: this.blob,
      calls: [],
      done: s >= 4,
    };

    if (s === 0) {
      base.narration =
        'A sub-merchant emails your marketplace wanting to sell. Paste the email. That is the entire onboarding form.';
      return base;
    }

    // Everything from the draft onward shows the brain's output.
    base.fields = p.fields;
    base.missing = p.missing;
    base.abn = p.abn;

    const payload = draftMerchantPayload(p);
    const brainCall: ApiCall = {
      method: 'BRAIN',
      path: 'brain.ts → regex extraction + ABN weighted mod-89 checksum',
      mock: false, // the brain is real — deterministic, no LLM
      body: { blobChars: this.blob.length },
      response: {
        fieldsExtracted: p.fields.length,
        missing: p.missing,
        abn: p.abn
          ? { formatted: p.abn.formatted, weightedSum: p.abn.sum, mod89: p.abn.remainder, valid: p.abn.valid }
          : null,
      },
    };
    const createCall: ApiCall = {
      method: 'POST',
      path: '/managed-merchants',
      mock: true,
      body: payload,
      response: { id: MERCHANT_ID, status: 'pending-verification', businessName: p.businessName },
    };

    if (s === 1) {
      base.narration = p.abn?.valid
        ? `Drafted. ${p.fields.length} fields extracted with provenance, ABN passes the ATO mod-89 checksum (weighted sum ${p.abn.sum} = 89 × ${p.abn.sum / 89}). The create-managed-merchant payload is ready before a human could open the form.`
        : `Drafted ${p.fields.length} fields — but the ABN fails the ATO checksum (mod 89 = ${p.abn?.remainder ?? '—'}). Onboard blocks the application BEFORE it burns a KYC review. Fix the digit, not the fallout.`;
      base.merchant = { id: MERCHANT_ID, name: merchantName, status: 'drafted' };
      base.calls = [brainCall, createCall];
      return base;
    }

    const docs = kycChecklist(p.entityType);

    if (s === 2) {
      base.narration = `${p.entityType === 'company' ? 'It’s a Pty Ltd, so the checklist is ASIC extract + ID + bank statement' : 'Checklist generated for the entity type'} — each upload is one POST /documents against the managed merchant.`;
      base.merchant = { id: MERCHANT_ID, name: merchantName, status: 'pending-verification' };
      base.checklist = docs.map((d) => ({ ...d, status: 'uploaded' }));
      base.calls = docs.map((d) => ({
        method: 'POST',
        path: '/documents',
        mock: true,
        body: { merchantId: MERCHANT_ID, documentType: d.id, fileName: d.file },
        response: { id: `doc_demo_${d.id}`, status: 'received' },
      }));
      return base;
    }

    if (s === 3) {
      base.narration = `Verification clears. ${merchantName} is LIVE under your credentials — you now collect on their behalf. Time from paste to live: one screen.`;
      base.merchant = { id: MERCHANT_ID, name: merchantName, status: 'active' };
      base.checklist = docs.map((d) => ({ ...d, status: 'verified' }));
      base.calls = [
        {
          method: 'GET',
          path: `/managed-merchants/${MERCHANT_ID}`,
          mock: true,
          response: {
            id: MERCHANT_ID,
            status: 'active',
            businessName: p.businessName,
            abn: p.abn?.abn,
            settlementAccount: { bsb: p.bsb, accountNumber: p.accountNumber },
          },
        },
      ];
      return base;
    }

    // Step 4 — the money: collect for the sub-merchant, keep the platform's cut.
    const today = new Date().toISOString().slice(0, 10);
    base.narration = `${merchantName} takes its first order: $${(GROSS / 100).toFixed(2)}. One field — applicationFee — is the whole platform business model: $${(APP_FEE / 100).toFixed(2)} to you on every transaction, reconciled to the cent in the transfer line-items.`;
    base.merchant = { id: MERCHANT_ID, name: merchantName, status: 'active' };
    base.checklist = docs.map((d) => ({ ...d, status: 'verified' }));
    base.money = {
      gross: GROSS,
      applicationFee: APP_FEE,
      processingFee: PINCH_FEE,
      netToMerchant: NET,
      platformEarnings: APP_FEE,
    };
    base.calls = [
      {
        method: 'POST',
        path: '/payments/realtime',
        mock: true,
        body: {
          amount: GROSS,
          applicationFee: APP_FEE, // cents — the platform's cut on a managed-merchant payment
          email: 'first.customer@example.com',
          fullName: 'First Customer',
          description: `${merchantName} — first marketplace order`,
          nonce: ['onboard-demo-first-dollar'],
        },
        response: {
          id: PAYMENT_ID,
          status: 'success',
          amount: GROSS,
          currency: 'AUD',
          applicationFee: APP_FEE,
          totalFee: PINCH_FEE,
          transactionDate: today,
          estimatedTransferDate: today,
        },
      },
      {
        method: 'GET',
        path: '/events?type=transfer',
        mock: true,
        headers: { 'Time-Travel': `${today}T20:00:00Z` }, // sandbox clock past settlement
        response: {
          Id: 'evt_demo_transfer_marlo',
          Type: 'transfer',
          EventDate: `${today}T19:45:00Z`,
          Data: {
            TransferId: 'tra_demo_marlo_1',
            LineItems: [
              { PaymentId: PAYMENT_ID, Type: 'Settlement', Amount: GROSS },
              { PaymentId: PAYMENT_ID, Type: 'ApplicationFee', Amount: -APP_FEE },
              { PaymentId: PAYMENT_ID, Type: 'ProcessingFee', Amount: -PINCH_FEE },
            ],
            NetAmount: NET,
          },
        },
      },
    ];
    return base;
  }
}

export const onboard = new OnboardEngine();
