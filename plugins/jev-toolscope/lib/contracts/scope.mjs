// jev-toolscope — the scoping contract.
//
// Versioned separately from the harness on purpose. The questions, the state
// they read and the way their answers are read are one replaceable unit; the
// hook wiring, fail-open paths and journal around it are not. Every journal
// row records `contract`, so rows from different generations are never pooled.
//
// One Noul per tool, all in one request: "does completing this prompt need
// this tool?". Jev answers each with a probability; which ones count as in
// scope is a threshold in code (minRelevance), not the judge's to choose.
//
// Question ids are t0..tN rather than tool names: tool names are long and may
// contain characters an id should not. The id -> name map stays in code.
//
// A short reply ("yes", "go ahead") means nothing alone: it accepts whatever
// the agent just offered. For those, the agent's last reply goes into the state
// as previous_assistant_message, and the questions say to read the prompt as a
// reply to it.
//
// Changing a question or criteria text changes what the answers mean; do it in
// a new contract version, not in place.
//   scope@1  the prompt alone
//   scope@2  short replies judged with the agent's previous message

import { noul } from '../judge.mjs';

export const id = 'scope@2';

const criteria = {
  true: 'The task cannot be done well without calling this tool.',
  false: 'The task can be done without it, or the tool serves an unrelated purpose.',
};

const subject = 'Completing the user_prompt (read as a reply to previous_assistant_message, when one is given)';

const clip = (text, max) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** -> { questions, ids: { t0: "mcp__srv__tool", ... } } */
export function questions(tools, config) {
  const max = config?.maxDescriptionChars ?? 300;
  const out = {};
  const ids = {};
  tools.forEach((t, i) => {
    const qid = `t${i}`;
    ids[qid] = t.name;
    const desc = clip(t.description, max);
    out[qid] = {
      type: 'noul',
      instructions: desc
        ? `${subject} needs the MCP tool "${t.server}/${t.tool}": ${desc}`
        : `${subject} needs the MCP tool "${t.server}/${t.tool}" (no description available; judge by its name).`,
      criteria: { ...criteria },
    };
  });
  return { questions: out, ids };
}

/**
 * The state is the prompt, plus one line per server saying what it is for, so
 * a terse tool description can be read in its server's context, plus — for a
 * short reply only — the agent's message it answers.
 */
export function stateOf(prompt, servers, config, previous) {
  const lines = Object.entries(servers ?? {}).map(([s, text]) => `${s}: ${clip(text, 200)}`);
  const state = { user_prompt: prompt.slice(0, config?.maxPromptChars ?? 4000) };
  if (previous) state.previous_assistant_message = previous;
  if (lines.length) state.mcp_servers = lines.join('\n');
  return state;
}

/**
 * Read the answers back as [{ tool, p }], most relevant first. A tool with no
 * readable answer has p: null and sorts first — scope.mjs keeps it in scope,
 * the cautious side.
 */
export function interpret(answers, ids) {
  return Object.entries(ids)
    .map(([qid, tool]) => ({ tool, p: noul(answers, qid) }))
    .sort((a, b) => (b.p ?? 2) - (a.p ?? 2));
}
