import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './consent/parser.js';

// The consent parser is the LIVE surface a judge types into during the demo,
// so it earns real coverage. Anchored to a fixed reference date; assertions use
// resolved weekday/day-of-month (robust to the anchor and to timezone).
const REF = new Date(2026, 7, 13); // 13 Aug 2026

test('weekday: "friday" resolves to a Friday', () => {
  const r = classify('friday', REF);
  assert.equal(r.type, 'date');
  if (r.type === 'date') { assert.equal(r.label, 'friday'); assert.equal(r.date.getDay(), 5); }
});

test('negation-aware: "cant do friday, monday works" picks MONDAY, not Friday', () => {
  const r = classify('cant do friday, monday works', REF);
  assert.equal(r.type, 'date');
  if (r.type === 'date') { assert.equal(r.label, 'monday'); assert.equal(r.date.getDay(), 1); }
});

test('day-of-month: "the 28th" resolves to the 28th', () => {
  const r = classify('the 28th', REF);
  assert.equal(r.type, 'date');
  if (r.type === 'date') assert.equal(r.date.getDate(), 28);
});

test('"tomorrow" resolves to the next day', () => {
  const r = classify('tomorrow', REF);
  assert.equal(r.type, 'date');
  if (r.type === 'date') { const exp = new Date(REF); exp.setDate(exp.getDate() + 1); assert.equal(r.date.getDate(), exp.getDate()); }
});

test('payday talk without a date → payday_no_date (model day stands)', () => {
  assert.equal(classify('when i get paid', REF).type, 'payday_no_date');
});

test('opt-out is recognised (the loop must never retry these)', () => {
  assert.equal(classify('STOP', REF).type, 'optout');
});

test('hardship path is separated from a date request', () => {
  assert.equal(classify('cant pay this week', REF).type, 'hardship');
});

test('split request is recognised', () => {
  assert.equal(classify('can i split it', REF).type, 'split');
});

test('short confirmation → confirm', () => {
  assert.equal(classify('ok', REF).type, 'confirm');
});

test('gibberish → unknown (parser asks a clarifying question, never guesses a debit date)', () => {
  assert.equal(classify('purple monkey dishwasher', REF).type, 'unknown');
});
