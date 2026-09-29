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
//   2. Jev answers three independent Nouls in one request.
//   3. Code turns the probabilities into pass / unclear / block / stopped_early.
//   4. Shadow records and exits 0; Enforce may exit 2.
//
// Failing open is a hard rule. No key, no network, slow response, bad JSON —
// every one of those exits 0.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, gateSettings } from '../../lib/config.mjs';
import { ask, noul } from '../../lib/jev.mjs';
import { record } from '../../lib/journal.mjs';
import { readTranscript, diffSummary, subagentTranscript } from '../../lib/facts.mjs';

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

  const budget = gate.maxBlocksPerSession ?? 2;
  const spent = blocksSoFar(cfg.sessionsPath, input.session_id);

  const sb = gate.stateBudget ?? {};
  const readOpts = { ...sb, verificationCommands: gate.verificationCommands ?? [] };

  // v0.6.0 moved the MESSAGE to the hook payload but left the FACTS coming from
  // transcript_path, which on SubagentStop is the parent's. The result was the
  // subagent's claim judged against the orchestrator's commands: across the
  // first 29 decisive rows, every single coverage value landed below 0.3 and
  // every one blocked. A subagent's work has to be read from the subagent.
  const isSubagent = input.hook_event_name === 'SubagentStop';
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
      gate: GATE, mode: gate.mode, event: input.hook_event_name, session: input.session_id, cwd,
      verdict: 'pass', decidedBy: 'code',
      reason: msgSource !== 'hook' ? 'subagent_message_unavailable' : 'subagent_facts_unavailable',
      agentType: input.agent_type ?? null,
    });
    pass();
  }

  const base = {
    gate: GATE,
    mode: gate.mode,
    event: input.hook_event_name,
    session: input.session_id,
    cwd,
    pluginData: Boolean(process.env.CLAUDE_PLUGIN_DATA),
    // Diagnostics, so the next batch of data answers what this release had to
    // infer: does last_assistant_message arrive at all, and on SubagentStop is
    // it the subagent's text or the parent's?
    msgSource,
    factsSource,
    agentType: input.agent_type ?? null,
    agentId: input.agent_id ?? null,
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

  // --- 2. the questions ------------------------------------------------------
  // Both are phrased POSITIVELY. jev-1.13 reads negations at face value, so
  // "is there NO evidence" is the one shape to avoid; the inversion happens in
  // code below instead.
  //
  // `state` keeps the agent's own words in whatever language it wrote them.
  // `instructions` are English, which is what the model is tuned on.
  // The playbook's advice is to name the finish line per task ("done means:
  // every endpoint uses the new client ... and the test suite passes"). When
  // the event carries that text, evidence is judged against it rather than
  // against a generic notion of "some test ran".
  const task =
    input.task_description ?? input.task ?? input.description ?? input.prompt ?? null;

  const state = {
    task: typeof task === 'string' ? task.slice(0, 2000) : null,
    final_message: finalMessage.slice(0, sb.finalMessageChars ?? 4000),
    command_log: facts.commands.map((c) => ({
      command: c.command,
      result: c.isError ? 'error' : 'ok',
      output: c.output,
    })),
    changed_files: diffSummary(cwd),
  };

  const questions = {
    // Until v0.5.0 this read "the requested work is now finished". In a session
    // that delegates step after step, a step finishing is not "the requested
    // work" finishing, and jev-1.13 read it exactly that literally: across 33
    // real stopped_early verdicts, 11 were messages that plainly announced
    // something done — "移行完了", "ジャーナル統合が完了しました" — scoring 0.03
    // to 0.47 and falling into the early-stop branch. The fault was upstream of
    // blocked_on_user, which had correctly answered that nobody was waiting.
    //
    // Measured on those same messages: this wording takes the completion side
    // from 4/8 to 8/8 while holding the early-stop side at 8/10, and both of
    // the two it gives up are messages that do report something finished.
    claims_done: {
      type: 'noul',
      instructions: 'The final_message reports that something has been completed.',
      criteria: {
        true: 'It announces a finished action — merged, pushed, fixed, migrated, verified, opened.',
        false: 'It describes work still under way, or names something it is about to do.',
      },
    },
    // Until v0.4.0 this asked whether a verification run EXISTED. Over 66 real
    // verdicts that question agreed with `commandCount > 0` every single time —
    // 0.02 when nothing had run, 0.98-0.99 when something had, never anything
    // between. It was spending a question on a fact code already holds, which
    // is precisely what design rule 1 forbids.
    //
    // Whether a run exists is now settled in code below. What is left for Jev
    // is the judgement code cannot make: does what ran actually cover what was
    // claimed? A suite of one test passing does not support "every endpoint is
    // migrated". Success or failure is not asked either — the exit code is a
    // fact, and a failed run short-circuits long before this point.
    evidence_covers_claim: {
      type: 'noul',
      instructions:
        'The commands in command_log exercise the work that final_message says was completed.',
      criteria: {
        true: 'What was run covers the thing being claimed.',
        false: 'What was run is unrelated to the claim, or reaches only a small part of it.',
      },
    },
    blocked_on_user: {
      type: 'noul',
      instructions:
        'The final_message stops because it needs a decision or information that only the user can give.',
      criteria: {
        true: 'It asks a question whose answer is required before the work can continue, or it is waiting for approval of a destructive action.',
        false: 'It summarises progress and names a next step without taking it, offers to continue, or lists choices that do not block the work.',
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
  const evidenceCovers = noul(answer.answers, 'evidence_covers_claim');
  const blockedOnUser = noul(answer.answers, 'blocked_on_user');
  if (claimsDone === null || evidenceCovers === null) {
    record(cfg.journalPath, { ...base, verdict: 'pass', decidedBy: 'failopen', reason: 'missing_answer' });
    pass();
  }

  // --- 3. thresholds are code's decision, not the model's -------------------
  const t = gate.thresholds ?? {};
  const tClaims = t.claimsDone ?? 0.5;
  const tPass = t.evidencePass ?? 0.7;
  const tBlock = t.evidenceBlock ?? 0.3;
  const tBlocked = t.blockedOnUser ?? 0.5;

  const earlyStop = gate.earlyStop ?? {};
  const earlyStopOn = earlyStop.enabled !== false;

  let verdict;
  // When nothing ran, "does what ran cover the claim?" has no subject. The
  // model still answers it, and that answer must not reach the histogram the
  // thresholds are read from.
  let coverageMeaningless = false;
  if (claimsDone >= tClaims) {
    // Completion is being claimed. Whether anything ran at all is a count, so
    // code answers it; only the coverage question goes to the model.
    if (facts.commands.length === 0) {
      verdict = 'block';
      coverageMeaningless = true;
    }
    else if (evidenceCovers >= tPass) verdict = 'pass';
    else if (evidenceCovers >= tBlock) verdict = 'unclear';
    else verdict = 'block';
  } else if (
    earlyStopOn &&
    facts.workThisTurn &&
    blockedOnUser !== null &&
    blockedOnUser < tBlocked
  ) {
    // Completion is NOT being claimed, work was under way, and nothing is
    // actually waiting on the user. That is the shape the playbook describes:
    // stopping to report instead of going on.
    //
    // `workThisTurn` is what keeps an ordinary answered question out of this
    // branch — a turn that edited and ran nothing is a conversation, not a
    // task that stalled.
    verdict = 'stopped_early';
  } else {
    verdict = 'pass';
  }

  record(cfg.journalPath, {
    ...base,
    verdict,
    decidedBy: coverageMeaningless ? 'code' : 'jev',
    reason: coverageMeaningless ? 'no_runs' : undefined,
    claimsDone,
    evidenceCovers,
    blockedOnUser,
    thresholds: { claimsDone: tClaims, evidencePass: tPass, evidenceBlock: tBlock, blockedOnUser: tBlocked },
    commandCount: facts.commands.length,
    sawAnyCommand: facts.sawAnyCommand,
    workThisTurn: facts.workThisTurn,
    latencyMs: answer.latencyMs,
    usage: answer.usage,
    jevModel: answer.model,
  });

  // --- 4. Shadow changes nothing; Enforce acts ------------------------------
  if (gate.mode !== 'enforce') pass();
  if (verdict === 'pass') pass();

  if (verdict === 'stopped_early') {
    const msg =
      `jev-gate: this looks like a pause to report rather than a stop that needs you ` +
      `(blocked_on_user=${blockedOnUser.toFixed(2)}). If the next step does not need the ` +
      `user's input, take it instead of describing it.`;
    // Default is advisory. The playbook's own remedy for this failure mode is a
    // CLAUDE.md rule, not a hard stop, and a wrong block here interrupts a
    // legitimate check-in — so pushing an agent onward is opt-in.
    if (earlyStop.action !== 'block' || spent >= budget) notify(msg);
    noteBlock(cfg.sessionsPath, input.session_id);
    block(msg);
  }

  if (verdict === 'unclear') {
    notify(
      `jev-gate: completion claimed, but whether the runs cover it is unclear ` +
        `(evidence_covers_claim=${evidenceCovers.toFixed(2)}). Worth a look.`
    );
  }

  if (spent >= budget) {
    notify(
      `jev-gate: this session has already been sent back ${spent} time(s); standing down. ` +
        `The completion claim still has no verification run behind it.`
    );
  }

  noteBlock(cfg.sessionsPath, input.session_id);
  block(
    facts.commands.length === 0
      ? `jev-gate: this task is being reported as complete, but no test, build, lint, or ` +
        `type-check run appears in this session.\n` +
        `Run the project's verification command and report its actual output, ` +
        `or say plainly that the work was not verified.`
      : `jev-gate: this task is being reported as complete, but what was run does not appear ` +
        `to cover it (evidence_covers_claim=${evidenceCovers.toFixed(2)}).\n` +
        `Run something that exercises what you are claiming, or narrow the claim to what was ` +
        `actually verified.`
  );
}

main().catch(() => process.exit(0));
