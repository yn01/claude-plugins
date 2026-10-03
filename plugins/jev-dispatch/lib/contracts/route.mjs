// jev-dispatch — the routing contract.
//
// Versioned separately from the harness on purpose. The questions, the state
// they read and the way their answers are read are one replaceable unit; the
// hook wiring, fail-open paths and journal around it are not. Every journal
// row records `contract`, so rows from different generations are never pooled.
//
// What is asked here is what can be read off the prompt text: what kind of work
// it is, how hard, how much a stronger model would help, and whether it only
// makes sense with the earlier conversation. Which MODEL that implies is not
// asked — Jev is never given a model name — it is policy's job, in code.
//
// Choice keys are neutral words, not model-flavoured ones ("easy", "hard"
// would bias toward the answer they hint at); every key carries a description
// that says what the work IS.

import { choice, score, noul } from '../judge.mjs';
import { sharedQuestions } from './questions.mjs';

export const id = 'route@1';

// The first three questions are shared with spawn@1; see questions.mjs.
export const questions = () => ({
  ...sharedQuestions('user_prompt'),

  context_dependent: {
    type: 'noul',
    instructions: 'The user_prompt can only be understood with the earlier conversation.',
    criteria: {
      true: 'It refers to something unstated — "the earlier approach", "the rest", "that file", "do the same again".',
      false: 'It names everything it needs, and a reader seeing only this prompt could start.',
    },
  },
});

// A Noul has no confidence field; the distance from a coin flip stands in.
export const confidenceOf = (p) => (typeof p === 'number' ? Math.max(p, 1 - p) : null);

/**
 * Turn the raw answers into signals. Anything missing is null, and policy reads
 * a null as "cannot tell" — this function does not decide what that means.
 */
export function interpret(answers) {
  const kind = choice(answers, 'task_kind');
  const difficulty = score(answers, 'difficulty');
  const gain = score(answers, 'stronger_gain');
  const ctx = noul(answers, 'context_dependent');

  return {
    taskKind: kind?.key ?? null,
    taskKindConfidence: kind?.confidence ?? null,
    difficulty: difficulty?.score ?? null,
    difficultyConfidence: difficulty?.confidence ?? null,
    strongerGain: gain?.score ?? null,
    strongerGainConfidence: gain?.confidence ?? null,
    contextDependent: ctx,
    contextDependentConfidence: confidenceOf(ctx),
  };
}

// The state is the prompt and nothing else. `maxPromptChars` bounds the cost;
// the head of a prompt carries the request, the tail is usually pasted material.
export function stateOf(prompt, config) {
  return { user_prompt: prompt.slice(0, config?.maxPromptChars ?? 4000) };
}
