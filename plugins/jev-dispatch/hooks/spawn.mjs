#!/usr/bin/env node
// jev-dispatch — PreToolUse hook for the Agent tool.
//
// The prompt hook can only hint; this is where a model is actually chosen. When
// the main agent launches a subagent, the brief it wrote is judged and, in
// apply mode, the call's `model` is rewritten to the tier that brief calls for —
// up or down. Same structure as route.mjs: this file is wiring, the decision is
// decideSpawn() in lib/dispatch.mjs.
//
// spawn.mode:
//   off     — exits at once
//   shadow  — decides and records, changes and prints NOTHING (the default)
//   apply   — as shadow, and rewrites `model` when the action is `route`
// Any other value behaves like shadow.
//
// Output is `updatedInput` plus an additionalContext notice and NO
// permissionDecision: the permission flow is not this hook's to touch. The
// updated input REPLACES the original, so every field is copied over.
//
// Failing open is a hard rule: every failure exits 0 with no output and the
// subagent launches as the main agent asked.

import { readFileSync } from 'node:fs';
import { loadConfig, dataDir } from '../lib/config.mjs';
import { decideSpawn } from '../lib/dispatch.mjs';
import { record } from '../lib/journal.mjs';
import { resolveSessionModel } from '../lib/session-model.mjs';

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function finish(output) {
  if (!output) process.exit(0);
  process.stdout.write(JSON.stringify(output), () => process.exit(0));
}

async function main() {
  const input = readStdin();
  if (input.tool_name && input.tool_name !== 'Agent') return finish();

  const cwd = input.cwd || process.cwd();
  const config = loadConfig(cwd);
  const mode = config.spawn?.mode ?? 'shadow';
  if (mode === 'off') return finish();

  // An omitted `model` inherits the session's. Inside a subagent (agent_id is
  // set) the transcript and cache describe the top-level session, not the
  // subagent that is spawning, so the inherited model is unknown and only an
  // explicit request can be compared.
  const resolved = resolveSessionModel(input, dataDir());
  const nested = Boolean(input.agent_id);
  const decision = await decideSpawn({
    toolInput: input.tool_input,
    sessionModel: nested ? null : resolved.model,
    config,
  });

  const deliver = mode === 'apply' && decision.action === 'route' && Boolean(decision.updatedInput);

  const head = config.journal?.promptChars ?? 200;
  const description = input.tool_input?.description;
  record(config.journalPath, {
    hook: 'spawn',
    contract: decision.contract,
    session_id: input.session_id ?? null,
    agentId: input.agent_id ?? null,
    agentType: input.agent_type ?? null,
    cwd,
    mode,
    subagentType: decision.subagentType,
    requestedModel: decision.requestedModel,
    sessionModel: resolved.model,
    sessionModelSource: resolved.source,
    descriptionHead: typeof description === 'string' ? description.slice(0, head) : null,
    briefChars: decision.briefChars,
    answers: decision.answers,
    signals: decision.signals,
    kindUsed: decision.kindUsed,
    tier: decision.tier,
    routedModel: decision.routedModel,
    action: decision.action,
    direction: decision.direction,
    reason: decision.reason,
    delivered: deliver,
    latencyMs: decision.latencyMs,
    usage: decision.usage,
    error: decision.error,
  });

  if (!deliver) return finish();
  finish({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput: decision.updatedInput,
      additionalContext: decision.advice,
    },
  });
}

main().catch(() => process.exit(0));
