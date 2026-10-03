// decide() with a stub `ask`: skip rules, failure paths, and the happy path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from '../lib/dispatch.mjs';
import { ask as realAsk } from '../lib/judge.mjs';

const defaults = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'config.json'), 'utf8'));
const config = { ...defaults, apiKey: 'k' };

const answers = (kind, difficulty, gain = 0, ctx = 0.05) => ({
  task_kind: { type: 'choice', choice: kind, confidence: 0.9, probabilities: { [kind]: 0.9 } },
  difficulty: { type: 'score', score: difficulty, confidence: 0.9 },
  stronger_gain: { type: 'score', score: gain, confidence: 0.9 },
  context_dependent: { type: 'noul', noul: ctx },
});
const stub = (a) => async () => ({ ok: true, answers: a, latencyMs: 42, usage: { input_tokens: 10 } });
const never = async () => { throw new Error('ask must not be called'); };

test('a skipped prompt never reaches the judge', async () => {
  const d = await decide({ prompt: 'yes', sessionModel: 'claude-opus-5-5', config, ask: never });
  assert.deepEqual([d.action, d.reason], ['none', 'skip:too_short']);
  assert.equal(d.contract, 'route@1');
});

test('the question carries the prompt and the contract questions', async () => {
  let seen;
  await decide({
    prompt: 'Fix the typo in README', sessionModel: 'claude-opus-5-5', config,
    ask: async (req) => { seen = req; return { ok: true, answers: answers('bugfix', 0.3) }; },
  });
  assert.deepEqual(seen.state, { user_prompt: 'Fix the typo in README' });
  assert.equal(seen.model, 'jev-1.13.0');
  assert.equal(seen.apiKey, 'k');
  assert.deepEqual(Object.keys(seen.questions), ['task_kind', 'difficulty', 'stronger_gain', 'context_dependent']);
});

test('an easy prompt on opus becomes a delegate with advice', async () => {
  const d = await decide({ prompt: 'Fix the typo in README', sessionModel: 'claude-opus-5-5', config, ask: stub(answers('bugfix', 0.3)) });
  assert.deepEqual([d.tier, d.action, d.reason], ['light', 'delegate', 'lighter']);
  assert.match(d.advice, /jev-dispatch:light/);
  assert.equal(d.latencyMs, 42);
  assert.deepEqual(d.usage, { input_tokens: 10 });
  assert.equal(d.signals.taskKind, 'bugfix');
  assert.ok(d.answers.task_kind);
  assert.equal(d.baselineTier, 'light');
});

test('a hard design prompt on sonnet becomes a consult', async () => {
  const d = await decide({ prompt: 'Design the new plugin system', sessionModel: 'claude-sonnet-5-5', config, ask: stub(answers('design', 3.5)) });
  assert.deepEqual([d.tier, d.action], ['deep', 'consult']);
  assert.match(d.advice, /Keep working here/);
});

test('no action means no advice', async () => {
  const d = await decide({ prompt: 'What does this function do?', sessionModel: 'claude-opus-5-5', config, ask: stub(answers('question', 1)) });
  assert.deepEqual([d.action, d.reason, d.advice], ['none', 'question', null]);
});

for (const reason of ['no_api_key', 'timeout', 'http_500', 'network_error']) {
  test(`a judge failure (${reason}) is none, with the error recorded`, async () => {
    const d = await decide({
      prompt: 'Fix the typo in README', sessionModel: 'claude-opus-5-5', config,
      ask: async () => ({ ok: false, reason, latencyMs: 7 }),
    });
    assert.deepEqual([d.action, d.reason, d.error, d.latencyMs], ['none', 'judge_unavailable', reason, 7]);
  });
}

test('an empty answer set is unclear, not a crash', async () => {
  const d = await decide({ prompt: 'Fix the typo in README', sessionModel: 'claude-opus-5-5', config, ask: stub({}) });
  assert.deepEqual([d.action, d.reason, d.kindUsed], ['none', 'unclear', false]);
});

test('the real ask fails open with no key, and on a refused connection', async () => {
  assert.deepEqual(await realAsk({ endpoint: 'http://127.0.0.1:1', apiKey: '', model: 'm', state: {}, questions: {} }), { ok: false, reason: 'no_api_key' });
  const r = await realAsk({ endpoint: 'http://127.0.0.1:1/x', apiKey: 'k', model: 'm', state: {}, questions: {}, timeoutMs: 500 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /network_error|timeout/);
});
