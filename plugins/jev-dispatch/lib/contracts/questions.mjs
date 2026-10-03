// jev-dispatch — question definitions shared by the routing contracts.
//
// route@1 judges a prompt the user typed; spawn@1 judges the brief handed to a
// subagent. Both ask what kind of work it is, how hard, and how much a stronger
// model would help, and those three questions must mean the same thing in both —
// a difficulty read off a prompt and one read off a brief feed the same
// threshold table. Only the grammatical subject differs, so the criteria live
// here once and each contract supplies its own subject.
//
// Changing a criteria text changes what the answers mean; do it in a new
// contract version, not in place.

export const taskKindCriteria = {
  implement: 'Write new code or add a new feature.',
  bugfix: 'Find and fix a defect, an error, or unexpected behaviour.',
  refactor: 'Restructure, rename or clean up existing code without changing its behaviour.',
  investigate: 'Work through the codebase or a system — read, search, run or trace it — to establish how something works or why it fails, as a task to carry out.',
  design: 'Decide an approach, an architecture or a plan before building, or weigh alternatives.',
  docs: 'Write or edit documentation, comments, messages or other prose.',
  question: 'Ask the assistant something to be answered in its reply — an explanation, a cause, an opinion or advice — with no change to the code requested.',
};

export const difficultyCriteria = [
  'Trivial: a one-line or purely mechanical change, such as fixing a typo.',
  'Easy: a small, well-specified change in one place.',
  'Moderate: several steps or files, with a clear way to do it.',
  'Hard: needs real understanding of a codebase or careful reasoning, with details to get right.',
  'Very hard: open-ended, spans a whole system, or needs deep judgement among competing options.',
];

export const gainCriteria = [
  'None: any capable assistant would produce the same result.',
  'Some: a more capable assistant would handle edge cases or style a little better.',
  'Large: a more capable assistant would likely get right what a lesser one gets wrong.',
];

/** The three shared questions, with `subject` naming what is being judged, e.g. "user_prompt". */
export function sharedQuestions(subject) {
  return {
    task_kind: {
      type: 'choice',
      instructions: `Classify what kind of work the ${subject} asks for.`,
      criteria: { ...taskKindCriteria },
    },
    difficulty: {
      type: 'score',
      instructions: `Rate how much skill and effort the work in the ${subject} takes to do well.`,
      criteria: [...difficultyCriteria],
    },
    stronger_gain: {
      type: 'score',
      instructions: `Rate how much a more capable assistant would improve the result of the work in the ${subject}.`,
      criteria: [...gainCriteria],
    },
  };
}
