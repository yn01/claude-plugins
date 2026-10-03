// jev-dispatch — the subagent-spawn contract.
//
// When the main agent launches a subagent, the brief it writes is the whole of
// that subagent's task, and it is self-contained by construction: a subagent
// has no conversation to lean on. So this contract asks what route@1 asks —
// kind, difficulty, gain from a stronger model — about the BRIEF, and leaves out
// `context_dependent`: there is nothing to depend on.
//
// The questions are defined in questions.mjs and shared with route@1, so a
// difficulty means the same thing in both and feeds the same threshold table.
// As there, Jev is never told a model name; which model follows is policy's job.

import { choice, score } from '../judge.mjs';
import { sharedQuestions } from './questions.mjs';

export const id = 'spawn@1';

export const questions = () => sharedQuestions('task_brief given to a subagent');

/** Same shape as route@1's signals, minus context dependence. */
export function interpret(answers) {
  const kind = choice(answers, 'task_kind');
  const difficulty = score(answers, 'difficulty');
  const gain = score(answers, 'stronger_gain');
  return {
    taskKind: kind?.key ?? null,
    taskKindConfidence: kind?.confidence ?? null,
    difficulty: difficulty?.score ?? null,
    difficultyConfidence: difficulty?.confidence ?? null,
    strongerGain: gain?.score ?? null,
    strongerGainConfidence: gain?.confidence ?? null,
  };
}

// The description is the main agent's own one-line label for the task; the
// brief is the instruction itself. Only the brief is truncated.
export function stateOf(toolInput, config) {
  const brief = typeof toolInput?.prompt === 'string' ? toolInput.prompt : '';
  return {
    task_description: typeof toolInput?.description === 'string' ? toolInput.description : '',
    task_brief: brief.slice(0, config?.maxPromptChars ?? 4000),
  };
}
