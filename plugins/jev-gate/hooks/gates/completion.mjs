#!/usr/bin/env node
// jev-gate — completion gate (gate 1 of 5; see docs/implementation-plan.md).
//
// Fires when an agent tries to stop (TaskCompleted / SubagentStop / Stop) and
// asks what kind of stop this is. Two failure modes are in scope, and the
// Opus 5.5 playbook names both:
//
//   - claiming completion without evidence   ("check its evidence before you
//     accept it")
//   - pausing mid-task to report instead of going on — "a summary that names
//     the next step without taking it, an offer to continue, or a list of
//     choices that don't block the work"
//
// The second is the more common one in long-running work, and a gate that only
// watches for false completion claims lets all of it through.
//
// Order of business:
//   1. Code collects the facts (which commands ran, did any fail, what changed).
//      A recorded failure is decided here — Jev is not asked.
//   2. Jev answers the contract's questions — all of them read off the message.
//   3. The contract turns those probabilities plus the facts into one verdict.
//   4. Shadow records and exits 0; Enforce may exit 2.
//
// This file is the harness. What gets asked, how the answer is read, and which
// verdict follows all live in lib/contracts/completion.mjs, versioned apart
// from the wiring so a rewrite of the decision is a normal change rather than
// a rewrite of the plugin.
//
// Failing open is a hard rule. No key, no network, slow response, bad JSON —
// every one of those exits 0.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, gateSettings } from '../../lib/config.mjs';
import { ask, noul } from '../../lib/jev.mjs';
import { record } from '../../lib/journal.mjs';
import { readTranscript, subagentTranscript } from '../../lib/facts.mjs';
import * as contract from '../../lib/contracts/completion.mjs';

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

function budgetPath(dir, sessionId) {
  return join(dir, `${sessionId || 'unknown'}.json`);
}

function blocksSoFar(dir, sessionId) {
  try {
    return JSON.parse(readFileSync(budgetPath(dir, sessionId), 'utf8'))?.blocks ?? 0;
  } catch {
    return 0;
  }
}

function noteBlock(dir, sessionId) {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(budgetPath(dir, sessionId), JSON.stringify({ blocks: blocksSoFar(dir, sessionId) + 1 }), 'utf8');
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

  // Every row this gate writes carries the contract that governed it — the
  // ones written before any question is asked included. v0.8.0 stamped only
  // the rows that reached Jev, so 42 of its rows (every subagent stand-down,
  // and a recorded test failure) were filed as pre-contract data and dropped
  // out of every count. Building the stamp first makes an unstamped row
  // impossible rather than merely unlikely.
  const isSubagent = input.hook_event_name === 'SubagentStop';
  const stamp = {
    gate: GATE,
    mode: gate.mode,
    event: input.hook_event_name,
    session: input.session_id,
    cwd,
    contract: contract.id,
    agentType: input.agent_type ?? null,
    agentId: input.agent_id ?? null,
  };

  // Some agent types never run a check by design: Plan designs, Explore
  // searches, and neither holds a tool that edits. Judging their reports as
  // completion claims only ever produced "nothing ran" — true as a fact, wrong
  // as a verdict. They are recorded as skipped, before Jev is asked, and a skip
  // never counts as a decision. An event with no agent_type is judged, not
  // skipped: the unsafe error here is a silent exemption.
  const excluded = Array.isArray(gate.excludeAgentTypes) ? gate.excludeAgentTypes : [];
  if (isSubagent && input.agent_type && excluded.includes(input.agent_type)) {
    record(cfg.journalPath, { ...stamp, verdict: 'skip', decidedBy: 'code', reason: 'excluded_agent_type' });
    pass();
  }

  const budget = gate.maxBlocksPerSession ?? 2;
  const spent = blocksSoFar(cfg.sessionsPath, input.session_id);

  const sb = gate.stateBudget ?? {};
  const readOpts = { ...sb, verificationCommands: gate.verificationCommands ?? [] };

  // v0.6.0 moved the MESSAGE to the hook payload but left the FACTS coming from
  // transcript_path, which on SubagentStop is the parent's. The result was the
  // subagent's claim judged against the orchestrator's commands: across the
  // first 29 decisive rows, every single coverage value landed below 0.3 and
  // every one blocked. A subagent's work has to be read from the subagent.
  const subPath = isSubagent ? subagentTranscript(input.transcript_path, input.agent_id) : null;
  const facts = readTranscript(isSubagent ? subPath : input.transcript_path, readOpts);
  const factsSource = isSubagent ? (subPath ? 'subagent' : 'none') : 'parent';

  // The transcript is written asynchronously and lags the live conversation, so
  // it may not hold the turn that just ended. Claude Code hands Stop and
  // SubagentStop the text directly for exactly this reason, and the docs say to
  // use it instead of reading the transcript.
  //
  // This matters twice over on SubagentStop: the transcript_path there is the
  // PARENT session's — subagent turns are not written to it, verified by
  // isSidechain being absent from every line — so reading it judged the
  // orchestrator's last message instead of the subagent's report. Every earlier
  // measurement of this gate was taken that way.
  const hookMessage = typeof input.last_assistant_message === 'string'
    ? input.last_assistant_message.trim()
    : '';
  const finalMessage = hookMessage || facts.finalMessage;
  const msgSource = hookMessage ? 'hook' : 'transcript';

  // Nothing was run and nothing was claimed — there is no claim to check.
  if (!finalMessage) pass();

  // On SubagentStop the transcript belongs to the parent, so falling back to it
  // does not produce a worse answer — it produces an answer about the wrong
  // agent. Judge only when the event handed the text over directly.
  if (isSubagent && (msgSource !== 'hook' || factsSource !== 'subagent')) {
    record(cfg.journalPath, {
      ...stamp,
      verdict: 'pass', decidedBy: 'code',
      reason: msgSource !== 'hook' ? 'subagent_message_unavailable' : 'subagent_facts_unavailable',
    });
    pass();
  }

  const base = {
    ...stamp,
    pluginData: Boolean(process.env.CLAUDE_PLUGIN_DATA),
    // Diagnostics, so the next batch of data answers what this release had to
    // infer: does last_assistant_message arrive at all, and on SubagentStop is
    // it the subagent's text or the parent's?
    msgSource,
    factsSource,
    msgDiffers: Boolean(hookMessage) && hookMessage !== facts.finalMessage,
  };

  // --- 1. facts the code can settle on its own ------------------------------
  if (facts.lastFailed) {
    const msg =
      `jev-gate: the most recent verification run failed and has not been re-run successfully.\n` +
      `  $ ${facts.lastFailed.command}\n` +
      `Fix the failure and run it again before reporting this task as complete.`;
    record(cfg.journalPath, { ...base, verdict: 'block', decidedBy: 'code', reason: 'recorded_failure', command: facts.lastFailed.command });
    if (gate.mode === 'enforce' && spent < budget) {
      noteBlock(cfg.sessionsPath, input.session_id);
      block(msg);
    }
    pass();
  }

  // --- 2. ask the contract's questions --------------------------------------
  // The questions themselves live in lib/contracts/completion.mjs and are
  // versioned there. `state` keeps the agent's own words in whatever language
  // it wrote them; the instructions are English, which is what jev-1.13 is
  // tuned on.
  const task =
    input.task_description ?? input.task ?? input.description ?? input.prompt ?? null;

  // Every question in completion@2 reads the message and nothing else, so the
  // command log no longer belongs in the state: what ran is a fact code holds
  // and checks itself. Sending it anyway would be noise the model has to judge
  // around, and about three quarters of the tokens.
  const state = {
    task: typeof task === 'string' ? task.slice(0, 2000) : null,
    final_message: finalMessage.slice(0, sb.finalMessageChars ?? 4000),
  };

  const answer = await ask({
    endpoint: cfg.endpoint,
    apiKey: cfg.apiKey,
    model: cfg.model,
    state,
    questions: contract.questions,
    timeoutMs: cfg.timeoutMs ?? 2000,
  });

  if (!answer.ok) {
    record(cfg.journalPath, { ...base, verdict: 'pass', decidedBy: 'failopen', reason: answer.reason, latencyMs: answer.latencyMs });
    pass();
  }

  const probs = {
    claims_done: noul(answer.answers, 'claims_done'),
    claims_verified: noul(answer.answers, 'claims_verified'),
    blocked_on_user: noul(answer.answers, 'blocked_on_user'),
  };
  if (Object.values(probs).some((v) => v === null)) {
    record(cfg.journalPath, { ...base, verdict: 'pass', decidedBy: 'failopen', reason: 'missing_answer' });
    pass();
  }

  // --- 3. the contract decides; this file only carries it out ---------------
  const outcome = contract.decide({
    answers: probs,
    facts: { ranVerification: facts.commands.length > 0, workThisTurn: facts.workThisTurn },
    thresholds: gate.thresholds,
  });

  record(cfg.journalPath, {
    ...base,
    verdict: outcome.verdict,
    decidedBy: 'jev',
    reason: outcome.reason,
    deciding: outcome.deciding,
    confidence: outcome.confidence,
    claimsDone: probs.claims_done,
    claimsVerified: probs.claims_verified,
    blockedOnUser: probs.blocked_on_user,
    thresholds: { ...contract.defaultThresholds, ...(gate.thresholds ?? {}) },
    commandCount: facts.commands.length,
    sawAnyCommand: facts.sawAnyCommand,
    workThisTurn: facts.workThisTurn,
    latencyMs: answer.latencyMs,
    usage: answer.usage,
    jevModel: answer.model,
  });

  // --- 4. Shadow changes nothing; Enforce acts ------------------------------
  if (gate.mode !== 'enforce') pass();
  if (outcome.verdict === 'pass') pass();

  // Said, never enforced: a low-confidence read, and a completion with nothing
  // run behind it, are both worth surfacing and neither is worth stopping work
  // over.
  if (outcome.verdict === 'unclear' || outcome.verdict === 'unverified') notify(outcome.message);

  if (outcome.verdict === 'stopped_early') {
    // The playbook's own remedy for this failure mode is a CLAUDE.md rule, not
    // enforcement, and a wrong block interrupts a legitimate check-in.
    const earlyStop = gate.earlyStop ?? {};
    if (earlyStop.action !== 'block' || spent >= budget) notify(outcome.message);
    noteBlock(cfg.sessionsPath, input.session_id);
    block(outcome.message);
  }

  if (spent >= budget) {
    notify(`jev-gate: already sent back ${spent} time(s) this session; standing down. ${outcome.message}`);
  }
  noteBlock(cfg.sessionsPath, input.session_id);
  block(outcome.message);
}

main().catch(() => process.exit(0));
