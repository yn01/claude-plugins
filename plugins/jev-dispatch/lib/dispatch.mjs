// jev-dispatch — the decision core.
//
//   decide({ prompt, sessionModel, config, ask }) -> decision
//
// The hook calls this, and so can a future manual command: neither the stdin
// parsing nor the journal nor the output lives here. `ask` is a parameter so
// tests (and a different judge backend) can stand in for the network.
//
// Order of business:
//   1. skip rules, in code — Jev is not asked about a "yes"
//   2. ask the route contract's questions in one request
//   3. contract.interpret -> signals; policy.decide -> tier and action
//   4. advice text for the actions that have any
//
// Never throws on a judge failure: the decision is `none` with `error` set.

import { ask as jevAsk } from './judge.mjs';
import { skipReason } from './skip.mjs';
import { adviceFor } from './advice.mjs';
import * as policy from './policy.mjs';
import * as contract from './contracts/route.mjs';

export async function decide({ prompt, sessionModel, config, ask = jevAsk }) {
  const text = typeof prompt === 'string' ? prompt : '';
  const promptChars = text.length;
  const base = {
    contract: contract.id,
    promptChars,
    answers: null,
    signals: null,
    kindUsed: false,
    tier: null,
    baselineTier: policy.baselineTier(promptChars, config),
    action: 'none',
    reason: null,
    advice: null,
    latencyMs: null,
    usage: null,
    error: null,
  };

  const skipped = skipReason(text, config?.skip);
  if (skipped) return { ...base, reason: `skip:${skipped}` };

  const answer = await ask({
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    model: config.model,
    state: contract.stateOf(text, config),
    questions: contract.questions(),
    timeoutMs: config.timeoutMs ?? 3000,
  });

  if (!answer?.ok) {
    return { ...base, reason: 'judge_unavailable', error: answer?.reason ?? 'unknown', latencyMs: answer?.latencyMs ?? null };
  }

  const signals = contract.interpret(answer.answers);
  const outcome = policy.decide({ signals, sessionModel, promptChars, config });
  const decision = {
    ...base,
    ...outcome,
    answers: answer.answers,
    signals,
    latencyMs: answer.latencyMs ?? null,
    usage: answer.usage ?? null,
  };
  decision.advice = adviceFor(decision, config);
  return decision;
}
