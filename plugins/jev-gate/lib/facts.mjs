// jev-gate — deterministic fact collection.
//
// Everything a machine can settle on its own is settled here, BEFORE Jev is
// asked anything. jev-1.13 is documented as weak at counting, arithmetic and
// date ordering, and it does not treat `state` as hostile — so exit codes,
// which command ran, and how many files changed are all read from the
// transcript by code, never inferred by the model.

import { readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const TAIL_BYTES = 2 * 1024 * 1024;

// Commands whose output counts as evidence that something was actually run.
const VERIFICATION = [
  /\b(pytest|tox|nox)\b/,
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|typecheck|lint|build)\b/,
  /\b(jest|vitest|mocha|ava|playwright|cypress)\b/,
  /\bgo\s+(test|build|vet)\b/,
  /\bcargo\s+(test|build|check|clippy)\b/,
  /\b(mvn|gradle|gradlew)\s+.*\b(test|build|check)\b/,
  /\bmake\s+(test|check|build|lint)\b/,
  /\b(tsc|eslint|ruff|mypy|flake8|rubocop|shellcheck)\b/,
  /\bdotnet\s+(test|build)\b/,
  /\bswift\s+(test|build)\b/,
  /\brspec\b|\brake\s+test\b/,
];

// Projects with a custom runner (`./scripts/verify`) are invisible to the list
// above, and an invisible runner reads as an absence of evidence. Extra
// patterns come from `gates.completion.verificationCommands` in config.
function buildMatcher(extra = []) {
  const patterns = [...VERIFICATION];
  for (const src of extra) {
    try {
      patterns.push(new RegExp(src));
    } catch {
      // a bad pattern in config must not take the gate down
    }
  }
  return (cmd) => typeof cmd === 'string' && patterns.some((re) => re.test(cmd));
}

// Work means the agent changed something or ran something — as opposed to a
// turn that only answered a question. Used to tell a task that stopped early
// apart from an ordinary conversational reply.
const WORK_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash', 'Task']);

// A transcript entry is a real user turn only if it carries no tool_result;
// tool results are delivered as user-type entries too.
function isUserTurn(entry) {
  if (entry?.type !== 'user') return false;
  return !blocks(entry).some((b) => b?.type === 'tool_result');
}

function readTail(path) {
  const size = statSync(path).size;
  const start = Math.max(0, size - TAIL_BYTES);
  if (start === 0) return readFileSync(path, 'utf8');
  const len = size - start;
  const buf = Buffer.alloc(len);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buf, 0, len, start);
  } finally {
    closeSync(fd);
  }
  // The first line is probably cut in half; drop it.
  return buf.toString('utf8').slice(buf.toString('utf8').indexOf('\n') + 1);
}

function blocks(entry) {
  const c = entry?.message?.content;
  return Array.isArray(c) ? c : [];
}

function resultText(block) {
  const c = block?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('\n');
  return '';
}

/**
 * Walks the tail of a session transcript and returns:
 *   finalMessage  — the last assistant text (the completion claim itself)
 *   commands      — verification commands run, oldest first, with output + error flag
 *   lastFailed    — the most recent verification command that reported an error
 *   sawAnyCommand — whether any Bash call happened at all
 *   workThisTurn  — whether anything was edited or run since the user last spoke
 */
export function readTranscript(transcriptPath, { maxCommands = 8, perCommandOutputChars = 1500, verificationCommands = [] } = {}) {
  const empty = { finalMessage: '', commands: [], lastFailed: null, sawAnyCommand: false, workThisTurn: false };
  const isVerification = buildMatcher(verificationCommands);
  if (!transcriptPath) return empty;

  let lines;
  try {
    lines = readTail(transcriptPath).split('\n');
  } catch {
    return empty;
  }

  const pending = new Map(); // tool_use_id -> command string
  const commands = [];
  let finalMessage = '';
  let sawAnyCommand = false;
  let workThisTurn = false;

  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    // A new user turn resets the work flag: only what happened since the user
    // last spoke tells us whether this stop interrupts work in progress.
    if (isUserTurn(entry)) workThisTurn = false;

    for (const b of blocks(entry)) {
      if (b?.type === 'tool_use') {
        if (WORK_TOOLS.has(b.name)) workThisTurn = true;
        if (b.name === 'Bash') {
          sawAnyCommand = true;
          const cmd = b?.input?.command;
          if (isVerification(cmd)) pending.set(b.id, cmd);
        }
      } else if (b?.type === 'tool_result') {
        const cmd = pending.get(b.tool_use_id);
        if (cmd === undefined) continue;
        pending.delete(b.tool_use_id);
        const output = resultText(b);
        commands.push({
          command: cmd,
          isError: b.is_error === true,
          output: output.length > perCommandOutputChars
            ? output.slice(0, perCommandOutputChars) + '\n…(truncated)'
            : output,
        });
      } else if (b?.type === 'text' && entry?.type === 'assistant') {
        const t = (b.text ?? '').trim();
        if (t) finalMessage = t;
      }
    }
  }

  const kept = commands.slice(-maxCommands);
  // Only the LAST run of a given command matters: a failure that was later
  // re-run green is not a failure any more.
  const latestByCommand = new Map();
  for (const c of commands) latestByCommand.set(c.command, c);
  const lastFailed = [...latestByCommand.values()].reverse().find((c) => c.isError) ?? null;

  return { finalMessage, commands: kept, lastFailed, sawAnyCommand, workThisTurn };
}

/** `git diff --stat` for the working tree, or null outside a repo. */
export function diffSummary(cwd) {
  try {
    const out = execFileSync('git', ['diff', '--stat', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      timeout: 1500,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}
