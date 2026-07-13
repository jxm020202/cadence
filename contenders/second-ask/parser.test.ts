/**
 * Deterministic parser tests — fixed `now` = Monday 2026-07-13 so every
 * expectation is a hard-coded calendar fact. Run: npm test
 */

import assert from 'node:assert/strict';
import { classify, extractDates, rollForward, iso, plusDays } from './parser.js';

const NOW = new Date(2026, 6, 13); // Monday 13 July 2026

let n = 0;
function date(text: string, expectIso: string, extra?: { payday?: boolean; split?: boolean }): void {
  const r = classify(text, NOW);
  assert.equal(r.type, 'date', `"${text}" → expected date, got ${r.type}`);
  if (r.type !== 'date') return;
  assert.equal(iso(r.date), expectIso, `"${text}" → ${iso(r.date)}, expected ${expectIso}`);
  if (extra?.payday !== undefined) assert.equal(r.payday, extra.payday, `"${text}" payday flag`);
  if (extra?.split !== undefined) assert.equal(r.split, extra.split, `"${text}" split flag`);
  n++;
}
function intent(text: string, expect: string): void {
  const r = classify(text, NOW);
  assert.equal(r.type, expect, `"${text}" → ${r.type}, expected ${expect}`);
  n++;
}

// --- weekdays ---------------------------------------------------------------
date('friday', '2026-07-17');
date('Friday works', '2026-07-17');
date('I get paid Friday', '2026-07-17', { payday: true });
date('next friday', '2026-07-24');
date('monday', '2026-07-20'); // said on a Monday → next Monday
date('saturday', '2026-07-18');
date('thurs', '2026-07-16');

// --- relative ---------------------------------------------------------------
date('today', '2026-07-13');
date('tomorrow', '2026-07-14');
date('in 3 days', '2026-07-16');
date('in a week', '2026-07-20');
date('in two weeks', '2026-07-27');
date('in a fortnight', '2026-07-27');
date('next week', '2026-07-20');
date('week after next', '2026-07-27');
date('end of the month', '2026-07-31');

// --- day-of-month & explicit dates -------------------------------------------
date('the 28th', '2026-07-28');
date('on the 28', '2026-07-28');
date('the 5th', '2026-08-05'); // 5th already passed this month
date('the 13th', '2026-08-13'); // today's dom → next month
date('the 31st', '2026-07-31');
date('28/7', '2026-07-28');
date('5/7', '2027-07-05'); // passed → next year
date('july 28', '2026-07-28');
date('28th of july', '2026-07-28'); // explicit beats bare-dom on overlap
date('friday the 28th', '2026-07-28'); // explicit dom beats the weekday
date('when I get paid on the 28th', '2026-07-28', { payday: true });

// --- negation ----------------------------------------------------------------
date("can't do friday, monday works", '2026-07-20'); // second candidate wins
intent("can't do friday", 'change'); // negated single date → ask again
intent("can't pay this week", 'hardship');
intent('I cannot pay right now, lost my job', 'hardship');

// --- split -------------------------------------------------------------------
intent('can I split it?', 'split');
intent('could we do two payments', 'split');
date('half now half on the 28th', '2026-07-28', { split: true });

// --- control intents -----------------------------------------------------------
intent('STOP', 'optout');
intent('stop', 'optout');
intent('please stop texting me', 'optout');
intent('pause', 'pause');
intent('change', 'change');
intent('can we do a different day', 'change');
intent('when I get paid', 'payday_no_date');
intent('yes', 'confirm');
intent('ok!', 'confirm');
intent('sounds good', 'confirm');
intent('idk maybe', 'unknown');
intent('hello?', 'unknown');

// --- weekend roll (BECS has no weekend processing) -----------------------------
{
  const sat = new Date(2026, 6, 18); // Saturday
  const r = rollForward(sat);
  assert.equal(iso(r.date), '2026-07-20');
  assert.equal(r.rolled, true);
  const wed = new Date(2026, 6, 15);
  const r2 = rollForward(wed);
  assert.equal(iso(r2.date), '2026-07-15');
  assert.equal(r2.rolled, false);
  n += 2;
}

// --- helpers -------------------------------------------------------------------
assert.equal(iso(plusDays(NOW, 35)), '2026-08-17');
assert.equal(extractDates('nothing here', NOW).length, 0);
n += 2;

console.log(`parser.test.ts: ${n} assertions passed`);
