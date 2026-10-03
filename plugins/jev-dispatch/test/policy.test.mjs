// The policy is a pure function, so every branch is tested directly: no
// network, no clock, no randomness.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, baselineTier, sessionRank, candidateTiers } from '../lib/policy.mjs';

const defaults = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'config.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));

const signals = (o = {}) => ({
  taskKind: 'implement', taskKindConfidence: 0.9,
  difficulty: 2, difficultyConfidence: 0.9,
  strongerGain: 0, strongerGainConfidence: 0.9,
  contextDependent: 0.05, contextDependentConfidence: 0.95,
  ...o,
});
const run = (s, sessionModel, config = defaults, promptChars = 100) =>
  decide({ signals: signals(s), sessionModel, promptChars, config });

const OPUS = 'claude-opus-5-5';
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-4-5-20251001';

test('a question gets nothing', () => {
  const r = run({ taskKind: 'question', difficulty: 4 }, SONNET);
  assert.equal(r.action, 'none');
  assert.equal(r.reason, 'question');
});

test('difficulty confidence 0.55 passes, 0.45 is unclear', () => {
  assert.equal(run({ difficulty: 0.3, difficultyConfidence: 0.55 }, OPUS).action, 'delegate');
  const r = run({ difficulty: 0.3, difficultyConfidence: 0.45 }, OPUS);
  assert.deepEqual([r.action, r.reason, r.tier], ['none', 'unclear', null]);
});

test('a missing difficulty is unclear, not an error', () => {
  const r = run({ difficulty: null, difficultyConfidence: null }, OPUS);
  assert.deepEqual([r.action, r.reason], ['none', 'unclear']);
});

test('a low-confidence task kind routes on difficulty, with the kind skipped', () => {
  const r = run({ taskKind: 'design', taskKindConfidence: 0.47, difficulty: 0.5 }, 'fable');
  assert.deepEqual([r.tier, r.action, r.kindUsed], ['light', 'delegate', false], 'design floor not applied');
});

test('a low-confidence question is not treated as a question', () => {
  const r = run({ taskKind: 'question', taskKindConfidence: 0.4, difficulty: 0.5 }, OPUS);
  assert.deepEqual([r.action, r.kindUsed], ['delegate', false]);
});

test('a missing task kind routes on difficulty', () => {
  const r = run({ taskKind: null, taskKindConfidence: null, difficulty: 3.5 }, SONNET);
  assert.deepEqual([r.tier, r.action, r.kindUsed], ['deep', 'consult', false]);
});

test('a confident kind is recorded as used', () => {
  assert.equal(run({ difficulty: 2 }, SONNET).kindUsed, true);
  assert.equal(run({ taskKind: 'question' }, SONNET).kindUsed, true);
});

test('a plain-number minConfidence applies to all three signals', () => {
  const c = clone(defaults);
  c.policy.minConfidence = 0.8;
  assert.equal(run({ difficultyConfidence: 0.7 }, OPUS, c).reason, 'unclear');
  assert.equal(run({ taskKindConfidence: 0.7, taskKind: 'design', difficulty: 0.5 }, 'fable', c).tier, 'light', 'kind skipped, no floor');
  assert.equal(run({ difficulty: 0.5, strongerGain: 2, strongerGainConfidence: 0.7 }, 'fable', c).tier, 'light', 'bump ignored');
  assert.equal(run({ difficulty: 0.5, strongerGain: 2, strongerGainConfidence: 0.9 }, 'fable', c).tier, 'standard');
});

test('per-signal thresholds come from config', () => {
  const c = clone(defaults);
  c.policy.minConfidence = { taskKind: 0.3, difficulty: 0.9, strongerGain: 0.6 };
  assert.equal(run({ difficultyConfidence: 0.8 }, OPUS, c).reason, 'unclear');
  assert.equal(run({ taskKind: 'design', taskKindConfidence: 0.4, difficulty: 0.5, difficultyConfidence: 0.95 }, 'fable', c).tier, 'standard', 'kind now used');
});

test('an easy prompt on a heavier session is delegated to light', () => {
  const r = run({ difficulty: 0.3 }, OPUS);
  assert.deepEqual([r.tier, r.action, r.reason], ['light', 'delegate', 'lighter']);
});

test('a moderate prompt on opus is delegated to standard', () => {
  const r = run({ difficulty: 2 }, OPUS);
  assert.deepEqual([r.tier, r.action], ['standard', 'delegate']);
});

test('a context-dependent prompt is not delegated', () => {
  const r = run({ difficulty: 0.3, contextDependent: 0.9, contextDependentConfidence: 0.9 }, OPUS);
  assert.deepEqual([r.tier, r.action, r.reason], ['light', 'none', 'context_dependent']);
});

test('an unreadable context-dependence counts as dependent', () => {
  const r = run({ difficulty: 0.3, contextDependent: null }, OPUS);
  assert.deepEqual([r.action, r.reason], ['none', 'context_dependent']);
});

test('a hard prompt on a lighter session is consulted', () => {
  const r = run({ difficulty: 3.5 }, SONNET);
  assert.deepEqual([r.tier, r.action, r.reason], ['deep', 'consult', 'heavier']);
});

test('context dependence does not block a consult', () => {
  const r = run({ difficulty: 3.5, contextDependent: 0.95 }, SONNET);
  assert.equal(r.action, 'consult');
});

test('the same tier as the session does nothing', () => {
  const r = run({ difficulty: 2 }, SONNET);
  assert.deepEqual([r.tier, r.action, r.reason], ['standard', 'none', 'same_tier']);
});

test('an unknown session model does nothing but still names a tier', () => {
  for (const m of [null, undefined, 'gpt-9', '']) {
    const r = run({ difficulty: 0.3 }, m);
    assert.deepEqual([r.tier, r.action, r.reason], ['light', 'none', 'unknown_session_model']);
  }
});

test('session model ranks match by substring', () => {
  assert.equal(sessionRank(HAIKU, defaults), 1);
  assert.equal(sessionRank(SONNET, defaults), 2);
  assert.equal(sessionRank('claude-opus-5-5[1m]', defaults), 3);
  assert.equal(sessionRank('claude-fable-5-1', defaults), 3);
  assert.equal(sessionRank('mystery', defaults), null);
});

test('difficulty thresholds are the boundaries in the table', () => {
  assert.equal(run({ difficulty: 1.19 }, 'fable').tier, 'light');
  assert.equal(run({ difficulty: 1.2 }, 'fable').tier, 'standard');
  assert.equal(run({ difficulty: 2.59 }, 'fable').tier, 'standard');
  assert.equal(run({ difficulty: 2.6 }, 'fable').tier, 'deep');
});

test('a large stronger_gain lifts the tier one step', () => {
  const r = run({ difficulty: 0.5, strongerGain: 1.8 }, 'fable');
  assert.equal(r.tier, 'standard');
  const top = run({ difficulty: 3.5, strongerGain: 2 }, SONNET);
  assert.equal(top.tier, 'deep', 'cannot lift past the top tier');
});

test('a gain below gainBump does not lift', () => {
  assert.equal(run({ difficulty: 0.5, strongerGain: 1.4 }, 'fable').tier, 'light');
});

test('an unreadable gain does not lift', () => {
  assert.equal(run({ difficulty: 0.5, strongerGain: 2, strongerGainConfidence: 0.3 }, 'fable').tier, 'light');
});

test('minTierByKind sets a floor', () => {
  const r = run({ taskKind: 'design', difficulty: 0.5 }, 'fable');
  assert.deepEqual([r.tier, r.action], ['standard', 'delegate']);
  assert.equal(run({ taskKind: 'implement', difficulty: 0.5 }, 'fable').tier, 'light');
});

test('minTierByKind never lowers a tier', () => {
  assert.equal(run({ taskKind: 'design', difficulty: 3.5 }, SONNET).tier, 'deep');
});

test('a disabled tier is ignored', () => {
  const c = clone(defaults);
  c.tiers.light.enabled = false;
  assert.deepEqual(candidateTiers(c).map((t) => t.name), ['standard', 'deep']);
  const r = run({ difficulty: 0.3 }, OPUS, c);
  assert.equal(r.tier, 'standard', 'an easy prompt routes up to the nearest enabled tier');
});

test('an external tier is never a candidate, even when enabled', () => {
  const c = clone(defaults);
  c.tiers.gemini.enabled = true;
  assert.ok(!candidateTiers(c).some((t) => t.name === 'gemini'));
});

test('no enabled subagent tier means nothing to do', () => {
  const c = clone(defaults);
  for (const t of Object.values(c.tiers)) t.enabled = false;
  assert.equal(run({ difficulty: 2 }, OPUS, c).reason, 'no_tier');
});

test('the baseline is a length heuristic, recorded on every outcome', () => {
  assert.equal(baselineTier(50, defaults), 'light');
  assert.equal(baselineTier(500, defaults), 'standard');
  assert.equal(baselineTier(5000, defaults), 'deep');
  assert.equal(run({ taskKind: 'question' }, OPUS, defaults, 5000).baselineTier, 'deep');
  assert.equal(run({ difficulty: 2 }, SONNET, defaults, 50).baselineTier, 'light');
});

test('thresholds come from config', () => {
  const c = clone(defaults);
  c.policy.difficultyTiers = [{ below: 3, tier: 'light' }, { tier: 'deep' }];
  assert.equal(run({ difficulty: 2.9 }, 'fable', c).tier, 'light');
});
