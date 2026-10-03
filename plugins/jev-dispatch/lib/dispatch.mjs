// jev-dispatch — the decision core.
//
//   decide({ prompt, sessionModel, config, ask }) -> decision
//   decideSpawn({ toolInput, sessionModel, config, ask }) -> decision
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
import { adviceFor, spawnAdvice } from './advice.mjs';
import * as policy from './policy.mjs';
import * as contract from './contracts/route.mjs';
import * as spawnContract from './contracts/spawn.mjs';

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

// --- subagent spawn ---------------------------------------------------------
//
// The same shape as decide(), for the Agent tool: the brief the main agent
// wrote is judged and the model it will run on is chosen. `toolInput` is the
// Agent tool's input. When the action is `route`, `updatedInput` is the whole
// input with only `model` replaced — the hook output REPLACES the input, so
// every other field has to be carried over.
//
// `sessionModel` is what an omitted `model` inherits; pass null when it is not
// known (inside a subagent, say) and a rewrite is then only made for an
// explicit request.

const DEFAULT_SUBAGENT = 'general-purpose';

export async function decideSpawn({ toolInput, sessionModel, config, ask = jevAsk }) {
  const input = toolInput && typeof toolInput === 'object' ? toolInput : {};
  const brief = typeof input.prompt === 'string' ? input.prompt : '';
  const subagentType = typeof input.subagent_type === 'string' && input.subagent_type ? input.subagent_type : DEFAULT_SUBAGENT;
  const requestedModel = typeof input.model === 'string' && input.model.trim() ? input.model.trim() : null;
  const spawn = config?.spawn ?? {};

  const base = {
    contract: spawnContract.id,
    subagentType,
    requestedModel,
    briefChars: brief.length,
    answers: null,
    signals: null,
    kindUsed: false,
    tier: null,
    routedModel: null,
    action: 'none',
    direction: null,
    reason: null,
    updatedInput: null,
    advice: null,
    latencyMs: null,
    usage: null,
    error: null,
  };

  // What is targeted is a list of names, so a subagent type nobody listed is
  // recorded (with its name) and left alone.
  const targets = Array.isArray(spawn.subagentTypes) ? spawn.subagentTypes : [DEFAULT_SUBAGENT];
  if (!targets.includes(subagentType)) return { ...base, reason: 'not_targeted' };
  if (spawn.respectExplicit === true && requestedModel) return { ...base, reason: 'explicit_respected' };
  if (!brief.trim()) return { ...base, reason: 'no_brief' };

  const answer = await ask({
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    model: config.model,
    state: spawnContract.stateOf(input, config),
    questions: spawnContract.questions(),
    timeoutMs: config.timeoutMs ?? 3000,
  });

  if (!answer?.ok) {
    return { ...base, reason: 'judge_unavailable', error: answer?.reason ?? 'unknown', latencyMs: answer?.latencyMs ?? null };
  }

  const signals = spawnContract.interpret(answer.answers);
  const outcome = policy.decideSpawn({ signals, requestedModel, sessionModel, config });
  const routed = outcome.action === 'route';
  return {
    ...base,
    answers: answer.answers,
    signals,
    kindUsed: outcome.kindUsed,
    tier: outcome.tier,
    routedModel: routed ? outcome.model : null,
    action: outcome.action,
    direction: outcome.direction,
    reason: outcome.reason,
    updatedInput: routed ? { ...input, model: outcome.model } : null,
    advice: routed ? spawnAdvice({ model: outcome.model, signals }) : null,
    latencyMs: answer.latencyMs ?? null,
    usage: answer.usage ?? null,
  };
}
