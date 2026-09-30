// completion@3 — every branch of decide(), run directly. decide() is pure, so
// no network, clock or fixture transcript is needed.
//
//   node --test plugins/jev-gate/test/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, id } from '../lib/contracts/completion.mjs';

const answers = (done, verified, blocked) => ({
  claims_done: done,
  claims_verified: verified,
  blocked_on_user: blocked,
});
const facts = (over = {}) => ({ ranVerification: false, editedFiles: false, workThisTurn: false, ...over });
const run = (a, f) => decide({ answers: a, facts: f });

test('contract id is completion@3', () => {
  assert.equal(id, 'completion@3');
});

test('a claimed check with no run blocks, edits or not', () => {
  for (const editedFiles of [false, true]) {
    const o = run(answers(0.9, 0.95, 0.05), facts({ editedFiles }));
    assert.equal(o.verdict, 'block');
    assert.equal(o.reason, 'claimed_check_never_ran');
    assert.equal(o.deciding, 'claims_verified');
  }
});

test('a low-confidence claimed check becomes unclear', () => {
  const o = run(answers(0.9, 0.6, 0.05), facts());
  assert.equal(o.verdict, 'unclear');
  assert.equal(o.reason, 'low_confidence:claimed_check_never_ran');
});

test('done with nothing run and nothing edited is unverified', () => {
  const o = run(answers(0.95, 0.05, 0.05), facts());
  assert.equal(o.verdict, 'unverified');
  assert.equal(o.reason, 'claimed_done_nothing_ran');
  assert.equal(o.deciding, 'claims_done');
});

test('a low-confidence nothing-ran claim becomes unclear', () => {
  const o = run(answers(0.6, 0.05, 0.05), facts());
  assert.equal(o.verdict, 'unclear');
  assert.equal(o.reason, 'low_confidence:claimed_done_nothing_ran');
});

test('done with files edited and no check claimed passes on the edits', () => {
  const o = run(answers(0.95, 0.05, 0.05), facts({ editedFiles: true }));
  assert.equal(o.verdict, 'pass');
  assert.equal(o.reason, 'claim_backed_by_edits');
  assert.equal(o.deciding, 'claims_done');
});

test('done with a run behind it passes', () => {
  const o = run(answers(0.95, 0.95, 0.05), facts({ ranVerification: true }));
  assert.equal(o.verdict, 'pass');
  assert.equal(o.reason, 'claim_backed_by_a_run');
});

test('nothing claimed and waiting on the user passes', () => {
  const o = run(answers(0.1, 0.05, 0.9), facts({ workThisTurn: true }));
  assert.equal(o.verdict, 'pass');
  assert.equal(o.reason, 'waiting_on_someone');
  assert.equal(o.deciding, 'blocked_on_user');
});

test('nothing claimed after work, nobody waited on, is an early stop', () => {
  const o = run(answers(0.1, 0.05, 0.05), facts({ workThisTurn: true }));
  assert.equal(o.verdict, 'stopped_early');
  assert.equal(o.deciding, 'blocked_on_user');
});

test('an unsure early stop becomes unclear', () => {
  const o = run(answers(0.1, 0.05, 0.4), facts({ workThisTurn: true }));
  assert.equal(o.verdict, 'unclear');
  assert.equal(o.reason, 'low_confidence:paused_to_report');
});

test('nothing claimed and no work passes undecided', () => {
  const o = run(answers(0.1, 0.05, 0.05), facts());
  assert.equal(o.verdict, 'pass');
  assert.equal(o.reason, 'no_claim_no_work');
  assert.equal(o.deciding, null);
});
