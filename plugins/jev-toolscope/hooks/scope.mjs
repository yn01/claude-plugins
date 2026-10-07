#!/usr/bin/env node
// jev-toolscope — UserPromptSubmit hook.
//
// Fires on every prompt the user sends, asks Jev which of the session's MCP
// tools the prompt needs, and stores that as the prompt's scope for the guard.
// This file is the harness: it reads stdin, assembles the catalog, calls
// decide(), writes the session state and the journal row, and prints the hint.
// What is asked and how it is read live in lib/ — contracts/scope.mjs and
// scope.mjs — versioned apart from this wiring.
//
// Modes:
//   off      — exits at once
//   shadow   — judges and records, prints NOTHING (the default)
//   advise   — as shadow, and points the agent at the in-scope tools
//   enforce  — as advise, and the guard denies out-of-scope MCP calls
//
// Failing open is a hard rule: no key, no catalog, a slow answer, bad JSON, a
// thrown error — every one exits 0, the prompt goes through untouched, and the
// scope is left open so the guard allows every call.

import { readFileSync } from 'node:fs';
import { loadConfig } from '../lib/config.mjs';
import { readCatalog, readLiveTools, mergeCatalog } from '../lib/catalog.mjs';
import { decide, adviceFor, summaryFor } from '../lib/scope.mjs';
import { readSession, writeSession } from '../lib/session.mjs';
import { record } from '../lib/journal.mjs';

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

  const sessionId = input.session_id ?? null;
  const state = readSession(config.sessionsDir, sessionId) ?? {};

  const cursor = readLiveTools(input.transcript_path, state.cursor ?? null);
  const live = cursor?.sawDelta ? cursor.live : [];
  const catalog = mergeCatalog(readCatalog(config.catalogPath), live, cwd);

  const decision = await decide({ prompt: input.prompt, catalog, config });

  // A skipped prompt ("yes", "continue") carries the previous scope over: it
  // is the same task, and resetting it would open every tool mid-task.
  const scope = decision.status === 'carry'
    ? state.scope ?? null
    : { status: decision.status, selected: decision.selected, catalogSize: decision.catalogSize, ts: Date.now() };
  writeSession(config.sessionsDir, sessionId, { cursor, scope });

  const acting = config.mode === 'advise' || config.mode === 'enforce';
  const advice = acting ? adviceFor(decision, config.mode, config) : null;
  const summary = acting && config.summary !== false ? summaryFor(decision) : null;

  const head = config.journal?.promptChars ?? 200;
  record(config.journalPath, {
    hook: 'scope',
    contract: decision.contract,
    session_id: sessionId,
    cwd,
    mode: config.mode,
    promptChars: decision.promptChars,
    promptHead: typeof input.prompt === 'string' ? input.prompt.slice(0, head) : null,
    status: decision.status,
    reason: decision.reason,
    catalogSource: decision.catalogSource,
    catalogSize: decision.catalogSize,
    servers: decision.servers,
    selected: decision.selected,
    selectedCount: decision.selected.length,
    scores: decision.scores,
    unanswered: decision.unanswered,
    delivered: Boolean(advice),
    latencyMs: decision.latencyMs,
    usage: decision.usage,
    error: decision.error,
  });

  if (!advice) return finish();
  const out = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: advice } };
  if (summary) out.systemMessage = summary;
  finish(out);
}

main().catch(() => process.exit(0));
