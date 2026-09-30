// The decision contract is a pure function, so every route is tested directly:
// no network, no clock, no randomness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../lib/contracts/completion.mjs';

const facts = (ranVerification, workThisTurn = true) => ({ ranVerification, workThisTurn });
const decide = (answers, f) => c.decide({ answers, facts: f, thresholds: {} });

test('the contract identifies itself', () => {
  assert.equal(c.id, 'completion@3');
});

test('confidence is the distance from a coin flip', () => {
  assert.equal(c.confidenceOf(0.95), 0.95);
  assert.equal(c.confidenceOf(0.05), 0.95);
  assert.equal(c.confidenceOf(0.5), 0.5);
  assert.equal(c.confidenceOf(null), null);
});

const cases = [
  // [name, answers, facts, verdict, reason]
  ['asserts a check passed, none ran', { claims_done: 0.95, claims_verified: 0.95, blocked_on_user: 0.05 }, facts(false), 'block', 'claimed_check_never_ran'],
  ['same, read with low confidence', { claims_done: 0.95, claims_verified: 0.55, blocked_on_user: 0.05 }, facts(false), 'unclear', 'low_confidence:claimed_check_never_ran'],
  ['asserts a check passed, one ran', { claims_done: 0.95, claims_verified: 0.95, blocked_on_user: 0.05 }, facts(true), 'pass', 'claim_backed_by_a_run'],
  ['done, nothing ran, no check claimed', { claims_done: 0.95, claims_verified: 0.05, blocked_on_user: 0.05 }, facts(false), 'unverified', 'claimed_done_nothing_ran'],
  ['done, something ran', { claims_done: 0.95, claims_verified: 0.05, blocked_on_user: 0.05 }, facts(true), 'pass', 'claim_backed_by_a_run'],
  ['no claim, waiting on someone', { claims_done: 0.05, claims_verified: 0.05, blocked_on_user: 0.9 }, facts(true), 'pass', 'waiting_on_someone'],
  ['no claim, work happened, nobody waited', { claims_done: 0.05, claims_verified: 0.05, blocked_on_user: 0.05 }, facts(true), 'stopped_early', 'paused_to_report'],
  ['same, read with low confidence', { claims_done: 0.05, claims_verified: 0.05, blocked_on_user: 0.45 }, facts(true), 'unclear', 'low_confidence:paused_to_report'],
  ['no claim, no work — a conversation', { claims_done: 0.05, claims_verified: 0.05, blocked_on_user: 0.05 }, facts(false, false), 'pass', 'no_claim_no_work'],
];

for (const [name, answers, f, verdict, reason] of cases) {
  test(`route: ${name}`, () => {
    const o = decide(answers, f);
    assert.equal(o.verdict, verdict);
    assert.equal(o.reason, reason);
  });
}

test('decide() is deterministic: same input, same output', () => {
  const a = { claims_done: 0.7, claims_verified: 0.6, blocked_on_user: 0.2 };
  assert.deepEqual(decide(a, facts(false)), decide(a, facts(false)));
});

test('a threshold from config overrides the default', () => {
  const a = { claims_done: 0.95, claims_verified: 0.65, blocked_on_user: 0.05 };
  // At the default 0.5, 0.65 counts as asserting a check — but its confidence,
  // 0.65, is under minConfidence, so the block is downgraded to unclear. Raise
  // the threshold to 0.7 and the message no longer asserts a check at all; what
  // is left is a completion claim with nothing run.
  assert.equal(c.decide({ answers: a, facts: facts(false), thresholds: {} }).verdict, 'unclear');
  assert.equal(c.decide({ answers: a, facts: facts(false), thresholds: { claimsVerified: 0.7 } }).verdict, 'unverified');
});
