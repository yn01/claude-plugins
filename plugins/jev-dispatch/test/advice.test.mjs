import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adviceFor } from '../lib/advice.mjs';

const config = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'config.json'), 'utf8'));
const signals = { taskKind: 'bugfix', difficulty: 0.8 };

test('delegate names the agent and the model, and asks for verification', () => {
  const t = adviceFor({ action: 'delegate', tier: 'light', signals }, config);
  assert.match(t, /^\[jev-dispatch\]/);
  assert.match(t, /bugfix task/);
  assert.match(t, /difficulty 0\.8\/4/);
  assert.match(t, /subagent_type "jev-dispatch:light"/);
  assert.match(t, /model "haiku"/);
  assert.match(t, /Verify what it returns/);
});

test('consult keeps the work here and asks for a plan check and a final review', () => {
  const t = adviceFor({ action: 'consult', tier: 'deep', signals: { taskKind: 'design', difficulty: 3.4 } }, config);
  assert.match(t, /^\[jev-dispatch\]/);
  assert.match(t, /design task/);
  assert.match(t, /Keep working here/);
  assert.match(t, /jev-dispatch:deep/);
  assert.match(t, /model "opus"/);
  assert.match(t, /self-contained summary/);
  assert.match(t, /review the result before you declare/);
});

test('the model in the hint follows the config', () => {
  const c = JSON.parse(JSON.stringify(config));
  c.tiers.light.model = 'sonnet';
  assert.match(adviceFor({ action: 'delegate', tier: 'light', signals }, c), /model "sonnet"/);
});

test('a tier with no model omits the model override', () => {
  const c = JSON.parse(JSON.stringify(config));
  c.tiers.light.model = '';
  assert.doesNotMatch(adviceFor({ action: 'delegate', tier: 'light', signals }, c), /model "/);
});

test('there is no advice for none, or for an unknown tier', () => {
  assert.equal(adviceFor({ action: 'none', tier: 'light', signals }, config), null);
  assert.equal(adviceFor({ action: 'delegate', tier: 'nope', signals }, config), null);
});

test('missing signals still read cleanly', () => {
  const t = adviceFor({ action: 'delegate', tier: 'light', signals: null }, config);
  assert.match(t, /unknown task that a lighter/);
});
