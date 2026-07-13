/**
 * ONBOARD drafting brain — deterministic, no LLM, fully auditable.
 *
 * From a pasted business blob it:
 *   1. extracts the fields a create-managed-merchant call needs (regex, with
 *      per-field PROVENANCE: the exact blob snippet each value came from);
 *   2. validates the ABN with the real ATO checksum (weighted mod-89:
 *      subtract 1 from the first digit, weights 10,1,3,5,7,9,11,13,15,17,19,
 *      weighted sum must divide by 89);
 *   3. drafts the POST /managed-merchants payload;
 *   4. generates the KYC document checklist for the detected entity type.
 *
 * Every output is a pure function of the input text — same blob, same draft.
 * That determinism is the point: an onboarding pipeline you can unit-test.
 */

// ---- ABN checksum (ATO spec) ------------------------------------------------

export const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

export interface AbnCheck {
  abn: string; // 11 digits, normalised
  formatted: string; // "XX XXX XXX XXX"
  digits: number[]; // as written
  adjusted: number[]; // first digit - 1 (the ATO twist)
  weights: number[];
  products: number[]; // adjusted[i] * weights[i]
  sum: number;
  remainder: number; // sum % 89
  valid: boolean; // remainder === 0
}

export function checkAbn(raw: string): AbnCheck | null {
  const abn = raw.replace(/\D/g, '');
  if (abn.length !== 11) return null;
  const digits = [...abn].map(Number);
  const adjusted = digits.map((d, i) => (i === 0 ? d - 1 : d));
  const products = adjusted.map((d, i) => d * ABN_WEIGHTS[i]);
  const sum = products.reduce((a, b) => a + b, 0);
  const remainder = sum % 89;
  return {
    abn,
    formatted: `${abn.slice(0, 2)} ${abn.slice(2, 5)} ${abn.slice(5, 8)} ${abn.slice(8)}`,
    digits,
    adjusted,
    weights: ABN_WEIGHTS,
    products,
    sum,
    remainder,
    valid: remainder === 0,
  };
}

// ---- blob parsing ------------------------------------------------------------

export type EntityType = 'company' | 'sole-trader' | 'trust';

export interface DraftedField {
  key: string; // payload path, e.g. "contact.email"
  value: string;
  source: string; // the exact blob snippet this value came from
}

export interface ParsedBusiness {
  businessName?: string;
  tradingName?: string;
  entityType: EntityType;
  abn?: AbnCheck | null;
  abnRaw?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: { line1: string; suburb: string; state: string; postcode: string };
  settlementName?: string;
  bsb?: string;
  accountNumber?: string;
  fields: DraftedField[]; // flat, with provenance — what the UI renders
  missing: string[]; // required fields we could NOT find
}

function grab(blob: string, re: RegExp): { value: string; source: string } | null {
  const m = blob.match(re);
  if (!m) return null;
  return { value: (m[1] ?? m[0]).trim(), source: m[0].trim() };
}

export function parseBusinessBlob(blob: string): ParsedBusiness {
  const fields: DraftedField[] = [];
  const add = (key: string, hit: { value: string; source: string } | null) => {
    if (hit) fields.push({ key, value: hit.value, source: hit.source });
    return hit?.value;
  };

  // (?!We|This|…) skips sentence-opening pronouns so "We're Marlo & Co Pty Ltd"
  // drafts "Marlo & Co Pty Ltd", not the whole clause.
  const businessName = add(
    'businessName',
    grab(blob, /(?!(?:We|This|It|I|Hey|Our)\b)([A-Z][\w&.'’-]*(?:\s+[\w&.'’-]+)*?\s+(?:Pty\.?\s*Ltd\.?|Ltd\.?|Limited|Trust))/),
  ) ?? add('businessName', grab(blob, /(?:business|company|we(?:'|’)?re)\s+(?:is\s+|called\s+)?([A-Z][\w&.'’ -]{2,40})/i));

  // quoted forms first so apostrophes inside the name ("Marlo's") survive
  const tnMatch = blob.match(/trading\s+as\s+(?:"([^"\n]+)"|“([^”\n]+)”|‘([^’\n]+)’|'([^'\n]+)'|([^\n,()]+))/i);
  let tradingName: string | undefined;
  if (tnMatch) {
    tradingName = (tnMatch[1] ?? tnMatch[2] ?? tnMatch[3] ?? tnMatch[4] ?? tnMatch[5]).trim();
    fields.push({ key: 'tradingName', value: tradingName, source: tnMatch[0].trim() });
  }

  const entityType: EntityType = /trust/i.test(businessName ?? '')
    ? 'trust'
    : /pty\.?\s*ltd|limited|\bltd\b/i.test(businessName ?? '')
      ? 'company'
      : 'sole-trader';
  fields.push({ key: 'businessType', value: entityType, source: businessName ?? '(no legal suffix found)' });

  const abnHit = grab(blob, /ABN[:\s]*((?:\d[ ]?){11})/i) ?? grab(blob, /\b(\d{2}[ ]\d{3}[ ]\d{3}[ ]\d{3})\b/);
  const abn = abnHit ? checkAbn(abnHit.value) : null;
  if (abnHit) fields.push({ key: 'abn', value: abn?.formatted ?? abnHit.value, source: abnHit.source });

  const contactName = add(
    'contact.name',
    grab(blob, /contact(?:\s+is|\s+person)?[:\s]+([A-Z][a-z’'-]+(?:\s+[A-Z][a-z’'-]+)+)/i),
  );
  const email = add('contact.email', grab(blob, /([\w.+-]+@[\w-]+\.[\w.-]+)/));
  const phone = add('contact.phone', grab(blob, /((?:\+61\s?4\d{2}|04\d{2})[ ]?\d{3}[ ]?\d{3})/));

  const addrHit = grab(
    blob,
    /(\d+[\w/]*\s+[A-Z][\w'’ -]+(?:\s+\w+)*,\s*[A-Z][\w'’ -]+\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4}))/,
  );
  let address: ParsedBusiness['address'];
  if (addrHit) {
    const m = addrHit.value.match(/^(.*?),\s*(.*?)\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})$/);
    if (m) {
      address = { line1: m[1], suburb: m[2], state: m[3], postcode: m[4] };
      fields.push({ key: 'address', value: addrHit.value, source: addrHit.source });
    }
  }

  const settlementName = add('settlement.accountName', grab(blob, /settlement\s+to\s+([^—\-\n,]+?)\s*(?:[—\-]|$)/im));
  const bsbHit = grab(blob, /BSB[:\s]*(\d{3}[- ]?\d{3})/i);
  const bsb = bsbHit ? bsbHit.value.replace(/[^\d]/g, '').replace(/(\d{3})(\d{3})/, '$1-$2') : undefined;
  if (bsbHit) fields.push({ key: 'settlement.bsb', value: bsb!, source: bsbHit.source });
  const accountNumber = add('settlement.accountNumber', grab(blob, /acc(?:oun)?t(?:\s*(?:no\.?|number))?[:\s]*(\d{6,10})/i));

  const missing: string[] = [];
  if (!businessName) missing.push('businessName');
  if (!abn) missing.push('abn (11 digits)');
  if (!email) missing.push('contact.email');
  if (!bsb || !accountNumber) missing.push('settlement bank account');

  return {
    businessName,
    tradingName,
    entityType,
    abn,
    abnRaw: abnHit?.value,
    contactName,
    email,
    phone,
    address,
    settlementName,
    bsb,
    accountNumber,
    fields,
    missing,
  };
}

// ---- payload drafting ---------------------------------------------------------

/**
 * Draft the POST /managed-merchants body from the parsed blob.
 * Field names follow the Managed Merchants object shape from the Pinch docs;
 * in the demo this payload is shown with mock:true until pinned against the
 * live sandbox schema (honesty contract).
 */
export function draftMerchantPayload(p: ParsedBusiness): Record<string, unknown> {
  const [firstName, ...rest] = (p.contactName ?? '').split(/\s+/);
  return {
    businessName: p.businessName ?? null,
    tradingName: p.tradingName ?? p.businessName ?? null,
    abn: p.abn?.abn ?? null,
    businessType: p.entityType,
    contactPerson: {
      firstName: firstName || null,
      lastName: rest.join(' ') || null,
      email: p.email ?? null,
      phone: p.phone?.replace(/\s/g, '') ?? null,
    },
    address: p.address ? { ...p.address, country: 'AU' } : null,
    settlementAccount: {
      accountName: p.settlementName ?? p.businessName ?? null,
      bsb: p.bsb ?? null,
      accountNumber: p.accountNumber ?? null,
    },
  };
}

// ---- KYC checklist ------------------------------------------------------------

export interface KycDoc {
  id: string;
  name: string;
  why: string;
  file: string; // the file we'd attach in POST /documents
}

export function kycChecklist(entityType: EntityType): KycDoc[] {
  const common: KycDoc[] = [
    {
      id: 'bank-statement',
      name: 'Settlement account bank statement',
      why: 'proves the payout account belongs to the merchant',
      file: 'bank-statement-2026-06.pdf',
    },
    {
      id: 'photo-id',
      name: 'Photo ID — authorised contact',
      why: 'AML/CTF identity verification of the signatory',
      file: 'drivers-licence-priya-marlo.jpg',
    },
  ];
  if (entityType === 'company') {
    return [
      {
        id: 'asic-extract',
        name: 'ASIC company extract',
        why: 'confirms directors + registered office for the ACN behind the ABN',
        file: 'asic-current-extract.pdf',
      },
      ...common,
    ];
  }
  if (entityType === 'trust') {
    return [
      {
        id: 'trust-deed',
        name: 'Trust deed (certified)',
        why: 'identifies the trustee empowered to transact',
        file: 'trust-deed-certified.pdf',
      },
      ...common,
    ];
  }
  return common; // sole trader
}
