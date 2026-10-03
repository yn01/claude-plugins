// decideSpawn() in dispatch.mjs with a stub `ask`: targeting, the question sent,
// and the shape of updatedInput.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideSpawn } from '../lib/dispatch.mjs';
import * as spawnContract from '../lib/contracts/spawn.mjs';
import * as route from '../lib/contracts/route.mjs';
import { spawnAdvice } from '../lib/advice.mjs';

const defaults = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'config.json'), 'utf8'));
const config = { ...defaults, apiKey: 'k' };
const clone = (o) => JSON.parse(JSON.stringify(o));

const answers = (kind, difficulty, gain = 0) => ({
  task_kind: { type: 'choice', choice: kind, confidence: 0.9 },
  difficulty: { type: 'score', score: difficulty, confidence: 0.9 },
  stronger_gain: { type: 'score', score: gain, confidence: 0.9 },
});
const stub = (a) => async () => ({ ok: true, answers: a, latencyMs: 9, usage: { input_tokens: 3 } });
const never = async () => { throw new Error('ask must not be called'); };

const toolInput = {
  description: 'Fix typo', prompt: 'Fix the typo "teh" in README.md line 3.',
  subagent_type: 'general-purpose', model: 'sonnet', name: 'typo', isolation: 'worktree', run_in_background: true,
};

test('an untargeted subagent type is recorded by name and never judged', async () => {
  const d = await decideSpawn({ toolInput: { ...toolInput, subagent_type: 'Explore' }, sessionModel: 'opus', config, ask: never });
  assert.deepEqual([d.action, d.reason, d.subagentType, d.contract], ['none', 'not_targeted', 'Explore', 'spawn@1']);
});

test('a missing subagent_type is general-purpose', async () => {
  const { subagent_type, ...rest } = toolInput;
  const d = await decideSpawn({ toolInput: rest, sessionModel: 'opus', config, ask: stub(answers('docs', 0.3)) });
  assert.equal(d.subagentType, 'general-purpose');
  assert.equal(d.action, 'route');
});

test('respectExplicit leaves an explicit model alone, and only an explicit one', async () => {
  const c = clone(config);
  c.spawn.respectExplicit = true;
  const a = await decideSpawn({ toolInput, sessionModel: 'opus', config: c, ask: never });
  assert.deepEqual([a.action, a.reason, a.requestedModel], ['none', 'explicit_respected', 'sonnet']);
  const { model, ...noModel } = toolInput;
  const b = await decideSpawn({ toolInput: noModel, sessionModel: 'claude-opus-5-5', config: c, ask: stub(answers('docs', 0.3)) });
  assert.equal(b.action, 'route');
});

test('an empty brief is not judged', async () => {
  const d = await decideSpawn({ toolInput: { ...toolInput, prompt: '  ' }, sessionModel: 'opus', config, ask: never });
  assert.equal(d.reason, 'no_brief');
});

test('the request carries description and truncated brief and three questions', async () => {
  let seen;
  const c = { ...config, maxPromptChars: 10 };
  await decideSpawn({ toolInput, sessionModel: 'opus', config: c, ask: async (r) => { seen = r; return { ok: true, answers: answers('docs', 0.3) }; } });
  assert.deepEqual(seen.state, { task_description: 'Fix typo', task_brief: toolInput.prompt.slice(0, 10) });
  assert.deepEqual(Object.keys(seen.questions), ['task_kind', 'difficulty', 'stronger_gain']);
  assert.match(seen.questions.task_kind.instructions, /task_brief given to a subagent/);
});

test('a route keeps every original field and changes only model', async () => {
  const d = await decideSpawn({ toolInput, sessionModel: 'opus', config, ask: stub(answers('docs', 0.4)) });
  assert.deepEqual([d.action, d.direction, d.tier, d.routedModel, d.requestedModel], ['route', 'down', 'light', 'haiku', 'sonnet']);
  assert.deepEqual(d.updatedInput, { ...toolInput, model: 'haiku' });
  assert.notEqual(d.updatedInput, toolInput, 'the original is not mutated');
  assert.equal(toolInput.model, 'sonnet');
  assert.equal(d.advice, '[jev-dispatch] routed this subagent to haiku (docs, difficulty 0.4).');
  assert.deepEqual([d.latencyMs, d.usage], [9, { input_tokens: 3 }]);
});

test('a route adds model when none was given', async () => {
  const { model, ...noModel } = toolInput;
  const d = await decideSpawn({ toolInput: noModel, sessionModel: 'claude-opus-5-5', config, ask: stub(answers('docs', 0.4)) });
  assert.deepEqual(d.updatedInput, { ...noModel, model: 'haiku' });
});

test('keep produces no updatedInput and no advice', async () => {
  const d = await decideSpawn({ toolInput, sessionModel: 'opus', config, ask: stub(answers('implement', 2)) });
  assert.deepEqual([d.action, d.updatedInput, d.advice, d.routedModel], ['keep', null, null, null]);
});

for (const reason of ['no_api_key', 'timeout', 'http_500', 'bad_json']) {
  test(`a judge failure (${reason}) leaves the call alone`, async () => {
    const d = await decideSpawn({ toolInput, sessionModel: 'opus', config, ask: async () => ({ ok: false, reason, latencyMs: 4 }) });
    assert.deepEqual([d.action, d.reason, d.error, d.updatedInput], ['none', 'judge_unavailable', reason, null]);
  });
}

test('garbage tool input does not throw', async () => {
  for (const bad of [undefined, null, 'x', 5, {}]) {
    const d = await decideSpawn({ toolInput: bad, sessionModel: 'opus', config, ask: never });
    assert.equal(d.action, 'none');
  }
});

test('spawn@1 shares the three questions with route@1, differing only in subject', () => {
  const s = spawnContract.questions();
  const r = route.questions();
  assert.equal(spawnContract.id, 'spawn@1');
  assert.deepEqual(Object.keys(s), ['task_kind', 'difficulty', 'stronger_gain'], 'no context_dependent');
  for (const k of Object.keys(s)) {
    assert.deepEqual(s[k].criteria, r[k].criteria);
    assert.equal(s[k].type, r[k].type);
    assert.equal(s[k].instructions.replace('task_brief given to a subagent', 'user_prompt'), r[k].instructions);
  }
});

test('route@1 questions are unchanged by the extraction', () => {
  const r = route.questions();
  assert.equal(r.task_kind.instructions, 'Classify what kind of work the user_prompt asks for.');
  assert.equal(r.difficulty.instructions, 'Rate how much skill and effort the work in the user_prompt takes to do well.');
  assert.equal(r.stronger_gain.instructions, 'Rate how much a more capable assistant would improve the result of the work in the user_prompt.');
  assert.equal(r.context_dependent.instructions, 'The user_prompt can only be understood with the earlier conversation.');
});

test('spawn@1 interpret reads signals without context dependence', () => {
  const s = spawnContract.interpret(answers('docs', 1.5, 1));
  assert.deepEqual([s.taskKind, s.difficulty, s.strongerGain, 'contextDependent' in s], ['docs', 1.5, 1, false]);
  assert.doesNotThrow(() => spawnContract.interpret(undefined));
});

test('spawnAdvice reads cleanly with missing signals', () => {
  assert.equal(spawnAdvice({ model: 'opus', signals: null }), '[jev-dispatch] routed this subagent to opus (difficulty unknown).');
});
