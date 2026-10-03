#!/usr/bin/env node
// jev-dispatch — UserPromptSubmit hook.
//
// Fires on every prompt the user sends, asks Jev what kind of work it is and how
// hard, and recommends whether a lighter subagent could take it or a stronger
// one should be consulted. This file is the harness: it reads stdin, calls
// decide(), writes the journal row and prints the hint. What is asked, how the
// answers are read and what follows from them live in lib/ — contracts/route.mjs
// and policy.mjs — versioned apart from this wiring.
//
// Modes:
//   off     — exits at once
//   shadow  — decides and records, prints NOTHING (the default)
//   advise  — as shadow, and prints additionalContext when the action is not none
//
// Failing open is a hard rule: no key, no network, a slow answer, bad JSON, a
// thrown error — every one exits 0 and the prompt goes through untouched.

import { readFileSync } from 'node:fs';
import { loadConfig, dataDir } from '../lib/config.mjs';
import { decide } from '../lib/dispatch.mjs';
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
  const cwd = input.cwd || process.cwd();
  const config = loadConfig(cwd);
  if (config.mode === 'off') return finish();

  // `model` is not guaranteed on this event; see lib/session-model.mjs.
  const { model: sessionModel, source: sessionModelSource } = resolveSessionModel(input, dataDir());
  const decision = await decide({ prompt: input.prompt, sessionModel, config });

  const deliver = config.mode === 'advise' && decision.action !== 'none' && Boolean(decision.advice);

  const head = config.journal?.promptChars ?? 200;
  record(config.journalPath, {
    hook: 'prompt',
    contract: decision.contract,
    session_id: input.session_id ?? null,
    cwd,
    mode: config.mode,
    sessionModel,
    sessionModelSource,
    promptChars: decision.promptChars,
    promptHead: typeof input.prompt === 'string' ? input.prompt.slice(0, head) : null,
    answers: decision.answers,
    signals: decision.signals,
    kindUsed: decision.kindUsed,
    tier: decision.tier,
    baselineTier: decision.baselineTier,
    action: decision.action,
    reason: decision.reason,
    delivered: deliver,
    latencyMs: decision.latencyMs,
    usage: decision.usage,
    error: decision.error,
  });

  if (!deliver) return finish();
  finish({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: decision.advice } });
}

main().catch(() => process.exit(0));
