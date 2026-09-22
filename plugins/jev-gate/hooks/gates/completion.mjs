#!/usr/bin/env node
// jev-gate — completion gate (gate 1 of 5; see docs/implementation-plan.md).
//
// Fires when an agent tries to stop (TaskCompleted / SubagentStop / Stop) and
// asks one narrow question: does the completion claim have a verification run
// behind it?
//
// Order of business:
//   1. Code collects the facts (which commands ran, did any fail, what changed).
//      A recorded failure is decided here — Jev is not asked.
//   2. Jev answers two independent Nouls in one request.
//   3. Code turns the two probabilities into pass / unclear / block.
//   4. Shadow records and exits 0; Enforce may exit 2.
//
// Failing open is a hard rule. No key, no network, slow response, bad JSON —
// every one of those exits 0.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, gateSettings } from '../../lib/config.mjs';
import { ask, noul } from '../../lib/jev.mjs';
import { record } from '../../lib/journal.mjs';
import { readTranscript, diffSummary } from '../../lib/facts.mjs';

const GATE = 'completion';

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

// --- block budget -----------------------------------------------------------
// A gate that can block the same session forever is worse than no gate. Once
// the budget is spent the gate goes quiet and the human decides.

function budgetPath(sessionId) {
  return join(homedir(), '.claude', 'jev-gate', 'sessions', `${sessionId || 'unknown'}.json`);
}

function blocksSoFar(sessionId) {
  try {
    return JSON.parse(readFileSync(budgetPath(sessionId), 'utf8'))?.blocks ?? 0;
  } catch {
    return 0;
  }
}

function noteBlock(sessionId) {
  const p = budgetPath(sessionId);
  try {
    mkdirSync(join(homedir(), '.claude', 'jev-gate', 'sessions'), { recursive: true });
    writeFileSync(p, JSON.stringify({ blocks: blocksSoFar(sessionId) + 1 }), 'utf8');
  } catch {
    // ignored
  }
}

// --- exits ------------------------------------------------------------------

function pass() {
  process.exit(0);
}

function notify(message) {
  process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

function block(message) {
  process.stderr.write(message);
  process.exit(2);
}

// --- main -------------------------------------------------------------------

async function main() {
  const input = readStdin();
  const cwd = input.cwd || process.cwd();
  const cfg = loadConfig(cwd);
  const gate = gateSettings(cfg, GATE);

  if (!gate.active) pass();

  // Claude Code sets this when the agent was already stopped once by a hook.
  // Blocking again from here is how infinite loops start.
  if (input.stop_hook_active === true) pass();

  const budget = gate.maxBlocksPerSession ?? 2;
  const spent = blocksSoFar(input.session_id);

  const sb = gate.stateBudget ?? {};
  const facts = readTranscript(input.transcript_path, sb);

  // Nothing was run and nothing was claimed — there is no claim to check.
  if (!facts.finalMessage) pass();

  const base = {
    gate: GATE,
    mode: gate.mode,
    event: input.hook_event_name,
    session: input.session_id,
    cwd,
  };

  // --- 1. facts the code can settle on its own ------------------------------
  if (facts.lastFailed) {
    const msg =
      `jev-gate: the most recent verification run failed and has not been re-run successfully.\n` +
      `  $ ${facts.lastFailed.command}\n` +
      `Fix the failure and run it again before reporting this task as complete.`;
    record(cfg.journalPath, { ...base, verdict: 'block', decidedBy: 'code', reason: 'recorded_failure', command: facts.lastFailed.command });
    if (gate.mode === 'enforce' && spent < budget) {
      noteBlock(input.session_id);
      block(msg);
    }
    pass();
  }

  // --- 2. the two questions -------------------------------------------------
  // Both are phrased POSITIVELY. jev-1.13 reads negations at face value, so
  // "is there NO evidence" is the one shape to avoid; the inversion happens in
  // code below instead.
  //
  // `state` keeps the agent's own words in whatever language it wrote them.
  // `instructions` are English, which is what the model is tuned on.
  const state = {
    final_message: (facts.finalMessage || '').slice(0, sb.finalMessageChars ?? 4000),
    command_log: facts.commands.map((c) => ({
      command: c.command,
      result: c.isError ? 'error' : 'ok',
      output: c.output,
    })),
    changed_files: diffSummary(cwd),
  };

  const questions = {
    claims_done: {
      type: 'noul',
      instructions: 'The final_message states that the requested work is now finished.',
      criteria: {
        true: 'The message reports the work as done, complete, finished, or ready for review.',
        false: 'The message reports partial progress, asks a question, or describes remaining work.',
      },
    },
    evidence_present: {
      type: 'noul',
      instructions:
        'The command_log contains output from a test, build, lint, or type-check run that was actually executed.',
      criteria: {
        true: 'At least one entry shows real output from such a run.',
        false: 'The command_log is empty, or contains no run of that kind.',
      },
    },
  };

  const answer = await ask({
    endpoint: cfg.endpoint,
    apiKey: cfg.apiKey,
    model: cfg.model,
    state,
    questions,
    timeoutMs: cfg.timeoutMs ?? 2000,
  });

  if (!answer.ok) {
    record(cfg.journalPath, { ...base, verdict: 'pass', decidedBy: 'failopen', reason: answer.reason, latencyMs: answer.latencyMs });
    pass();
  }

  const claimsDone = noul(answer.answers, 'claims_done');
  const evidencePresent = noul(answer.answers, 'evidence_present');
  if (claimsDone === null || evidencePresent === null) {
    record(cfg.journalPath, { ...base, verdict: 'pass', decidedBy: 'failopen', reason: 'missing_answer' });
    pass();
  }

  // --- 3. thresholds are code's decision, not the model's -------------------
  const t = gate.thresholds ?? {};
  const tClaims = t.claimsDone ?? 0.5;
  const tPass = t.evidencePass ?? 0.7;
  const tBlock = t.evidenceBlock ?? 0.3;

  let verdict;
  if (claimsDone < tClaims || evidencePresent >= tPass) verdict = 'pass';
  else if (evidencePresent >= tBlock) verdict = 'unclear';
  else verdict = 'block';

  record(cfg.journalPath, {
    ...base,
    verdict,
    decidedBy: 'jev',
    claimsDone,
    evidencePresent,
    thresholds: { claimsDone: tClaims, evidencePass: tPass, evidenceBlock: tBlock },
    commandCount: facts.commands.length,
    sawAnyCommand: facts.sawAnyCommand,
    latencyMs: answer.latencyMs,
    usage: answer.usage,
    jevModel: answer.model,
  });

  // --- 4. Shadow changes nothing; Enforce acts ------------------------------
  if (gate.mode !== 'enforce') pass();
  if (verdict === 'pass') pass();

  if (verdict === 'unclear') {
    notify(
      `jev-gate: completion claimed, but the evidence of a verification run is unclear ` +
        `(evidence_present=${evidencePresent.toFixed(2)}). Worth a look.`
    );
  }

  if (spent >= budget) {
    notify(
      `jev-gate: this session has already been sent back ${spent} time(s); standing down. ` +
        `The completion claim still has no verification run behind it.`
    );
  }

  noteBlock(input.session_id);
  block(
    `jev-gate: this task is being reported as complete, but no test, build, lint, or type-check ` +
      `run appears in this session (evidence_present=${evidencePresent.toFixed(2)}).\n` +
      `Run the project's verification command and report its actual output, ` +
      `or say plainly that the work was not verified.`
  );
}

main().catch(() => process.exit(0));
