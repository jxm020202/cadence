import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, type DebitRow } from './merchant.js';

const row = (amount: number, risk: number): DebitRow => ({
  payer: 'x', amount, dueDate: '2026-08-14', risk,
  band: risk >= 0.35 ? 'high' : risk >= 0.15 ? 'medium' : 'low', recommend: '',
});

test('summary: totals and at-risk are computed from the scored run', () => {
  const s = summarise([row(100, 0.5), row(50, 0.1)]); // 1 high, 1 low
  assert.equal(s.activeMandates, 2);
  assert.equal(s.thisRunAud, 150);
  // at-risk only counts non-low bands: 100 × 0.5 = 50
  assert.equal(s.atRiskAud, 50);
});

test('cash-flow forecast: with-Cadence ≥ without, and the lift == recovered', () => {
  const rows = [row(100, 0.5), row(80, 0.4), row(40, 0.05)];
  const s = summarise(rows);
  assert.ok(s.expectedWithAud >= s.expectedWithoutAud, 'Cadence never collects less than a blind run');
  // the lift the UI shows must equal the projected recovered dollars
  assert.equal(s.expectedWithAud - s.expectedWithoutAud, s.projectedRecoveredAud);
});

test('recovery rate scales the recovered dollars linearly', () => {
  const rows = [row(100, 0.5)];        // at-risk = 50
  assert.equal(summarise(rows, 0.5).projectedRecoveredAud, 25);
  assert.equal(summarise(rows, 0.0).projectedRecoveredAud, 0);
});

test('an all-low-risk run has zero at-risk and zero recovery', () => {
  const s = summarise([row(45, 0.02), row(30, 0.05)]);
  assert.equal(s.atRiskAud, 0);
  assert.equal(s.projectedRecoveredAud, 0);
  assert.equal(s.expectedWithAud, s.expectedWithoutAud);
});
