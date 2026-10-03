// The routing contract: what is asked, and how raw answers become signals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../lib/contracts/route.mjs';

test('the contract identifies itself', () => assert.equal(c.id, 'route@1'));

test('it asks four questions of the right types', () => {
  const q = c.questions();
  assert.deepEqual(Object.keys(q), ['task_kind', 'difficulty', 'stronger_gain', 'context_dependent']);
  assert.equal(q.task_kind.type, 'choice');
  assert.deepEqual(Object.keys(q.task_kind.criteria), ['implement', 'bugfix', 'refactor', 'investigate', 'design', 'docs', 'question']);
  assert.equal(q.difficulty.type, 'score');
  assert.equal(q.difficulty.criteria.length, 5);
  assert.equal(q.stronger_gain.type, 'score');
  assert.equal(q.stronger_gain.criteria.length, 3);
  assert.equal(q.context_dependent.type, 'noul');
});

test('no question mentions a model by name', () => {
  assert.doesNotMatch(JSON.stringify(c.questions()), /haiku|sonnet|opus|fable|claude|gpt/i);
});

test('every choice key carries a description', () => {
  for (const d of Object.values(c.questions().task_kind.criteria)) assert.ok(d.length > 10);
});

const answers = {
  task_kind: { type: 'choice', choice: 'bugfix', confidence: 0.92, probabilities: { bugfix: 0.92 } },
  difficulty: { type: 'score', score: 2.4, confidence: 0.8, legend: [], probabilities: { 2: 0.6, 3: 0.2 } },
  stronger_gain: { type: 'score', score: 0.4, confidence: 0.7, probabilities: {} },
  context_dependent: { type: 'noul', noul: 0.08 },
};

test('interpret reads each answer and its confidence', () => {
  const s = c.interpret(answers);
  assert.equal(s.taskKind, 'bugfix');
  assert.equal(s.taskKindConfidence, 0.92);
  assert.equal(s.difficulty, 2.4);
  assert.equal(s.difficultyConfidence, 0.8);
  assert.equal(s.strongerGain, 0.4);
  assert.equal(s.contextDependent, 0.08);
  assert.equal(s.contextDependentConfidence, 0.92, 'a noul has no confidence: distance from a coin flip');
});

test('a missing confidence falls back to the best probability', () => {
  const s = c.interpret({ ...answers, difficulty: { type: 'score', score: 1, probabilities: { 1: 0.7, 2: 0.3 } } });
  assert.equal(s.difficultyConfidence, 0.7);
});

test('missing or malformed answers become nulls, never throw', () => {
  const s = c.interpret({ task_kind: { choice: 5 }, difficulty: null });
  assert.equal(s.taskKind, null);
  assert.equal(s.difficulty, null);
  assert.equal(s.strongerGain, null);
  assert.equal(s.contextDependent, null);
  assert.equal(s.contextDependentConfidence, null);
  assert.doesNotThrow(() => c.interpret(undefined));
});

test('confidenceOf is the distance from a coin flip', () => {
  assert.equal(c.confidenceOf(0.95), 0.95);
  assert.equal(c.confidenceOf(0.05), 0.95);
  assert.equal(c.confidenceOf(null), null);
});

test('state is the prompt, truncated to maxPromptChars', () => {
  assert.deepEqual(c.stateOf('abc', { maxPromptChars: 10 }), { user_prompt: 'abc' });
  assert.equal(c.stateOf('x'.repeat(50), { maxPromptChars: 10 }).user_prompt.length, 10);
});

test('investigate and question are told apart by who does the work', () => {
  const k = c.questions().task_kind.criteria;
  assert.match(k.investigate, /as a task to carry out/);
  assert.match(k.question, /answered in its reply/);
  assert.match(k.question, /no change to the code requested/);
});
