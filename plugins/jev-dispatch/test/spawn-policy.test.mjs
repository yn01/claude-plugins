// decideSpawn and the judgeTier it shares with the prompt policy: pure, so every
// branch is tested directly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideSpawn, judgeTier } from '../lib/policy.mjs';

const defaults = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'config.json'), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));

const signals = (o = {}) => ({
  taskKind: 'implement', taskKindConfidence: 0.9,
  difficulty: 2, difficultyConfidence: 0.9,
  strongerGain: 0, strongerGainConfidence: 0.9,
  ...o,
});
const spawn = (s, requestedModel, sessionModel = 'claude-opus-5-5', config = defaults) =>
  decideSpawn({ signals: signals(s), requestedModel, sessionModel, config });

test('judgeTier picks the tier object from the threshold table', () => {
  assert.equal(judgeTier(signals({ difficulty: 0.3 }), defaults).tier.name, 'light');
  assert.equal(judgeTier(signals({ difficulty: 2 }), defaults).tier.name, 'standard');
  assert.equal(judgeTier(signals({ difficulty: 3.5 }), defaults).tier.name, 'deep');
});

test('judgeTier reports why it has no tier, and still reports the kind', () => {
  const j = judgeTier(signals({ taskKind: 'question', difficultyConfidence: 0.1 }), defaults);
  assert.deepEqual([j.tier, j.reason, j.kind, j.kindUsed], [null, 'unclear', 'question', true]);
  const c = clone(defaults);
  for (const t of Object.values(c.tiers)) t.enabled = false;
  assert.equal(judgeTier(signals(), c).reason, 'no_tier');
});

test('a hard brief on a haiku request is routed up to opus', () => {
  const r = spawn({ difficulty: 3.5 }, 'haiku');
  assert.deepEqual([r.tier, r.model, r.action, r.direction, r.reason], ['deep', 'opus', 'route', 'up', 'heavier']);
});

test('an easy brief with an explicit sonnet is routed down to haiku', () => {
  const r = spawn({ difficulty: 0.4 }, 'sonnet');
  assert.deepEqual([r.tier, r.model, r.action, r.direction, r.reason], ['light', 'haiku', 'route', 'down', 'lighter']);
});

test('the same step is kept', () => {
  const r = spawn({ difficulty: 2 }, 'sonnet');
  assert.deepEqual([r.tier, r.action, r.direction, r.reason], ['standard', 'keep', null, 'same_model']);
});

test('a full model id counts by rank, and opus and fable are the same step', () => {
  assert.equal(spawn({ difficulty: 2 }, 'claude-sonnet-5-5').action, 'keep');
  assert.equal(spawn({ difficulty: 3.5 }, 'fable').action, 'keep');
});

test('no requested model inherits the session model for the comparison', () => {
  assert.equal(spawn({ difficulty: 0.4 }, null, 'claude-opus-5-5').direction, 'down');
  assert.equal(spawn({ difficulty: 2 }, null, 'claude-sonnet-5-5').action, 'keep');
  assert.equal(spawn({ difficulty: 3.5 }, undefined, 'claude-sonnet-5-5').direction, 'up');
});

test('an unknown inherited model leaves the call alone', () => {
  for (const session of [null, 'gpt-9']) {
    const r = spawn({ difficulty: 0.4 }, null, session);
    assert.deepEqual([r.action, r.reason, r.tier], ['none', 'unknown_model', 'light']);
  }
});

test('an explicit request still routes when the session model is unknown', () => {
  assert.equal(spawn({ difficulty: 0.4 }, 'opus', null).action, 'route');
});

test('an unrecognised requested model is unknown, not rewritten', () => {
  assert.equal(spawn({ difficulty: 0.4 }, 'mystery-model').reason, 'unknown_model');
});

test('a tier with no model cannot be routed to', () => {
  const c = clone(defaults);
  c.tiers.light.model = '';
  assert.equal(spawn({ difficulty: 0.4 }, 'opus', null, c).reason, 'unknown_model');
});

test('maxTier caps the tier and says so', () => {
  const c = clone(defaults);
  c.spawn.maxTier = 'standard';
  const r = spawn({ difficulty: 3.5 }, 'haiku', null, c);
  assert.deepEqual([r.tier, r.model, r.action, r.direction, r.reason], ['standard', 'sonnet', 'route', 'up', 'heavier:capped']);
});

test('a capped tier that matches the request is kept, still marked capped', () => {
  const c = clone(defaults);
  c.spawn.maxTier = 'standard';
  const r = spawn({ difficulty: 3.5 }, 'sonnet', null, c);
  assert.deepEqual([r.action, r.reason], ['keep', 'same_model:capped']);
});

test('an uncapped tier carries no capped suffix', () => {
  assert.doesNotMatch(spawn({ difficulty: 3.5 }, 'haiku').reason, /capped/);
});

test('an unreadable difficulty is unclear and nothing is touched', () => {
  const r = spawn({ difficultyConfidence: 0.3 }, 'haiku');
  assert.deepEqual([r.action, r.reason, r.tier, r.model], ['none', 'unclear', null, null]);
});

test('the per-kind floor applies to spawns, and a gain bump when spawn.gainBump is set', () => {
  assert.equal(spawn({ taskKind: 'design', difficulty: 0.4 }, 'opus').tier, 'standard');
  const c = clone(defaults);
  c.spawn.gainBump = 1.5;
  assert.equal(spawn({ difficulty: 0.4, strongerGain: 1.8 }, 'opus', null, c).tier, 'standard');
});

test('a question brief is routed on difficulty like any other', () => {
  const r = spawn({ taskKind: 'question', difficulty: 0.4 }, 'opus');
  assert.deepEqual([r.action, r.tier, r.kindUsed], ['route', 'light', true]);
});

test('a low-confidence kind is recorded as not used', () => {
  assert.equal(spawn({ taskKindConfidence: 0.2 }, 'opus').kindUsed, false);
});

test('a disabled cap tier rounds down, not up', () => {
  const c = clone(defaults);
  c.spawn.maxTier = 'standard';
  c.tiers.standard.enabled = false;
  const r = spawn({ difficulty: 3.5 }, 'opus', null, c);
  assert.deepEqual([r.tier, r.model, r.action, r.reason], ['light', 'haiku', 'route', 'lighter:capped']);
});

test('an unknown cap name is no cap, not the lowest tier', () => {
  const c = clone(defaults);
  c.spawn.maxTier = 'Deep';
  const r = spawn({ difficulty: 3.5 }, 'haiku', null, c);
  assert.deepEqual([r.tier, r.reason], ['deep', 'heavier']);
});

// Real-looking brief signals: detailed briefs score high and nearly uniform.
test('spawn thresholds: difficulty 3.04 with gain 1.92 is standard, with no bump', () => {
  const r = spawn({ difficulty: 3.04, strongerGain: 1.92 }, 'haiku');
  assert.deepEqual([r.tier, r.model, r.direction], ['standard', 'sonnet', 'up']);
});

test('spawn thresholds: 3.38 is deep, 0.0 is light, the table boundaries are 1.2 and 3.3', () => {
  assert.equal(spawn({ difficulty: 3.38 }, 'haiku').tier, 'deep');
  assert.equal(spawn({ difficulty: 0.0 }, 'opus').tier, 'light');
  assert.equal(spawn({ difficulty: 1.19 }, 'opus').tier, 'light');
  assert.equal(spawn({ difficulty: 1.2 }, 'opus').tier, 'standard');
  assert.equal(spawn({ difficulty: 3.29 }, 'opus').tier, 'standard');
  assert.equal(spawn({ difficulty: 3.3 }, 'haiku').tier, 'deep');
});

test('an absent spawn.difficultyTiers falls back to the policy table', () => {
  const c = clone(defaults);
  delete c.spawn.difficultyTiers;
  assert.equal(spawn({ difficulty: 2.7 }, 'haiku', null, c).tier, 'deep');
  assert.equal(spawn({ difficulty: 2.5 }, 'haiku', null, c).tier, 'standard');
});

test('an absent spawn.gainBump falls back to policy.gainBump; null disables it', () => {
  const c = clone(defaults);
  delete c.spawn.gainBump;
  assert.equal(spawn({ difficulty: 0.5, strongerGain: 1.8 }, 'opus', null, c).tier, 'standard', 'policy bump of 1.5 applies');
  c.spawn.gainBump = null;
  assert.equal(spawn({ difficulty: 0.5, strongerGain: 1.8 }, 'opus', null, c).tier, 'light', 'null means no bump');
  c.spawn.gainBump = 1.9;
  assert.equal(spawn({ difficulty: 0.5, strongerGain: 1.8 }, 'opus', null, c).tier, 'light');
  assert.equal(spawn({ difficulty: 0.5, strongerGain: 1.95 }, 'opus', null, c).tier, 'standard');
});

test('spawn overrides do not touch the prompt policy', () => {
  assert.equal(defaults.policy.gainBump, 1.5);
  assert.equal(judgeTier(signals({ difficulty: 0.5, strongerGain: 1.8 }), defaults).tier.name, 'standard', 'prompts still bump');
  assert.equal(judgeTier(signals({ difficulty: 3.0 }), defaults).tier.name, 'deep', 'prompts still use the 2.6 table');
  const withNull = clone(defaults);
  withNull.spawn.gainBump = null;
  assert.equal(judgeTier(signals({ difficulty: 0.5, strongerGain: 1.8 }), withNull).tier.name, 'standard');
});

test('judgeTier takes explicit overrides', () => {
  const o = { difficultyTiers: [{ tier: 'standard' }], gainBump: null };
  assert.equal(judgeTier(signals({ difficulty: 0.1, strongerGain: 2 }), defaults, o).tier.name, 'standard');
});

test('minTierByKind stays shared for spawns', () => {
  assert.equal(spawn({ taskKind: 'design', difficulty: 0.5 }, 'opus').tier, 'standard');
});
