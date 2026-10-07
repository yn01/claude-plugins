#!/usr/bin/env node
// jev-toolscope — PreToolUse hook on every MCP tool (matcher "mcp__.*").
//
// Checks the call against the scope the prompt hook stored for this session.
// Never asks Jev: the judgement was made once, per prompt, and this is a local
// file read on the path of every MCP call.
//
//   no scope, open scope, a call from a subagent     -> allow (nothing printed)
//   in scope                                          -> allow
//     (guardLevel "server", the default: any tool of a server that has an
//      in-scope tool; "tool": only the selected tools)
//   out of scope, mode enforce                        -> deny, with the reason
//   out of scope, any other mode                      -> allow, journaled as would_deny
//
// "allow" here means the hook stays silent and the normal permission flow
// decides. It never grants a permission the user has not given.
//
// Subagents are left alone: the scope was judged from the user's prompt, and a
// subagent's brief may legitimately need tools the prompt did not mention.
//
// Every row is journaled, in-scope calls included, so the status report can
// read how often the scope held the tool that was actually used.

import { readFileSync } from 'node:fs';
import { loadConfig } from '../lib/config.mjs';
import { readSession } from '../lib/session.mjs';
import { withinScope, scopeServers } from '../lib/scope.mjs';
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

function main() {
  const input = readStdin();
  const cwd = input.cwd || process.cwd();
  const config = loadConfig(cwd);
  if (config.mode === 'off') return finish();

  const tool = typeof input.tool_name === 'string' ? input.tool_name : null;
  if (!tool || !tool.startsWith('mcp__')) return finish();

  const sessionId = input.session_id ?? null;
  const scope = readSession(config.sessionsDir, sessionId)?.scope ?? null;
  const agentId = input.agent_id ?? null;

  let decision = 'allow';
  let reason;
  let inScope = null;
  if (agentId) reason = 'subagent';
  else if (!scope) reason = 'no_scope';
  else if (scope.status !== 'scoped') reason = 'open_scope';
  else {
    inScope = withinScope(tool, scope.selected, config);
    reason = inScope ? 'in_scope' : 'out_of_scope';
    if (!inScope) decision = config.mode === 'enforce' ? 'deny' : 'would_deny';
  }

  record(config.journalPath, {
    hook: 'guard',
    session_id: sessionId,
    cwd,
    mode: config.mode,
    tool,
    inScope,
    decision,
    reason,
    guardLevel: config.guardLevel === 'tool' ? 'tool' : 'server',
    scopeSize: Array.isArray(scope?.selected) ? scope.selected.length : null,
    scopeAgeMs: Number.isFinite(scope?.ts) ? Date.now() - scope.ts : null,
    agentId,
  });

  if (decision !== 'deny') return finish();
  const level = config.guardLevel === 'tool' ? 'tool' : 'server';
  const allowed = (level === 'tool' ? scope.selected : scopeServers(scope.selected)).join(', ') || 'none';
  finish({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `[jev-toolscope] ${tool} is outside this prompt's MCP tool scope (${level === 'tool' ? 'tools' : 'servers'} in scope: ${allowed}). ` +
        'Do not retry it. If it is truly needed, tell the user which tool and why; the scope is judged again on their next prompt.',
    },
  });
}

try {
  main();
} catch {
  process.exit(0);
}
