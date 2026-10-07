// jev-toolscope — the decision core.
//
//   decide({ prompt, catalog, config, ask }) -> decision
//
// `catalog` is mergeCatalog()'s output: the tools to judge, already assembled.
// `ask` is a parameter so tests (and a different judge backend) can stand in
// for the network.
//
// Order of business:
//   1. skip rules, in code. A short reply ("yes", "go ahead") that answers
//      a known agent message is judged together with that message (context
//      "reply"); any other skipped prompt — a slash command, a machine-made
//      message, a reply with no message to read it against — carries the
//      previous prompt's scope over (status "carry")
//   2. nothing to judge, or more tools than maxTools          -> status "open"
//   3. one Noul per tool, one request
//   4. p >= minRelevance, plus alwaysAllow, is the scope      -> status "scoped"
//
// Never throws on a judge failure: the status is "open" with `error` set, and
// an open scope allows every call.

import { ask as jevAsk } from './judge.mjs';
import { skipReason } from './skip.mjs';
import * as contract from './contracts/scope.mjs';
import { splitToolName } from './catalog.mjs';

/**
 * alwaysAllow entries are full tool names ("mcp__github__create_issue") or a
 * server's tools ("mcp__github__*").
 */
export function isAlwaysAllowed(name, alwaysAllow) {
  if (!Array.isArray(alwaysAllow)) return false;
  return alwaysAllow.some((p) => typeof p === 'string' && (p === name || (p.endsWith('*') && name.startsWith(p.slice(0, -1)))));
}

/**
 * Is a call to `tool` inside the scope? At guardLevel "server" (the default) a
 * server with any in-scope tool has all its tools allowed: a judgement made
 * from tool names alone misses a server's setup and helper tools, and blocking
 * those stops the work the scope was meant to allow. At "tool", only the
 * selected tools themselves.
 */
export function withinScope(tool, selected, config) {
  if (isAlwaysAllowed(tool, config?.alwaysAllow)) return true;
  const list = Array.isArray(selected) ? selected : [];
  if (list.includes(tool)) return true;
  if (config?.guardLevel === 'tool') return false;
  const server = splitToolName(tool)?.server;
  return Boolean(server) && list.some((t) => splitToolName(t)?.server === server);
}

/** The servers a server-level scope allows, for messages. */
export const scopeServers = (selected) => [...new Set((selected ?? []).map((t) => splitToolName(t)?.server).filter(Boolean))].sort();

// Skip reasons that are the user answering the agent, rather than not talking
// to it at all.
const REPLY_SKIPS = new Set(['too_short', 'pattern']);

export async function decide({ prompt, catalog, config, previous = '', ask = jevAsk }) {
  const text = typeof prompt === 'string' ? prompt : '';
  const tools = Array.isArray(catalog?.tools) ? catalog.tools : [];
  const base = {
    contract: contract.id,
    promptChars: text.length,
    status: 'open',
    reason: null,
    catalogSource: catalog?.source ?? 'none',
    catalogSize: tools.length,
    servers: [...new Set(tools.map((t) => t.server))].sort(),
    selected: [],
    scores: null,
    unanswered: 0,
    context: null,
    latencyMs: null,
    usage: null,
    error: null,
  };

  const skipped = skipReason(text, config?.skip);
  const reply = Boolean(skipped) && REPLY_SKIPS.has(skipped) && typeof previous === 'string' && previous.trim() !== '';
  if (skipped && !reply) return { ...base, status: 'carry', reason: `skip:${skipped}` };
  if (!tools.length) return { ...base, reason: 'no_tools' };

  const maxTools = config?.maxTools ?? 150;
  if (tools.length > maxTools) return { ...base, reason: 'catalog_too_large' };

  const { questions, ids } = contract.questions(tools, config);
  const answer = await ask({
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    model: config.model,
    state: contract.stateOf(text, catalog.servers, config, reply ? previous : null),
    questions,
    timeoutMs: config.timeoutMs ?? 3000,
  });

  if (!answer?.ok) {
    return { ...base, context: reply ? 'reply' : null, reason: 'judge_unavailable', error: answer?.reason ?? 'unknown', latencyMs: answer?.latencyMs ?? null };
  }

  const min = config?.minRelevance ?? 0.4;
  const scores = contract.interpret(answer.answers, ids);
  // An unanswered tool stays in scope: blocking a tool because the judge
  // skipped it would be failing closed.
  const selected = scores
    .filter(({ tool, p }) => p === null || p >= min || isAlwaysAllowed(tool, config?.alwaysAllow))
    .map(({ tool }) => tool);

  return {
    ...base,
    status: 'scoped',
    reason: reply ? 'judged_reply' : 'judged',
    context: reply ? 'reply' : null,
    selected,
    scores,
    unanswered: scores.filter((s) => s.p === null).length,
    latencyMs: answer.latencyMs ?? null,
    usage: answer.usage ?? null,
  };
}

// --- what the agent and the user see ---------------------------------------

const short = (name) => name.replace(/^mcp__/, '').replace('__', '/');

/** The additionalContext for advise and enforce; null when there is nothing to say. */
export function adviceFor(decision, mode, config) {
  if (decision?.status !== 'scoped') return null;
  const n = decision.catalogSize;
  const sel = decision.selected;
  const rest = n - sel.length;
  const lines = [];
  if (sel.length) {
    lines.push(`[jev-toolscope] Of the ${n} MCP tools available, these look relevant to this request: ${sel.join(', ')}.`);
    lines.push(`If any are not loaded yet, load them with ToolSearch \`select:${sel.join(',')}\` rather than searching.`);
    if (rest > 0) lines.push(`The other ${rest} MCP tools are unlikely to be needed.`);
  } else {
    lines.push(`[jev-toolscope] None of the ${n} MCP tools available looks relevant to this request.`);
  }
  if (mode === 'enforce') {
    const servers = scopeServers(sel);
    const what = config?.guardLevel === 'tool' || !servers.length
      ? 'Calls to MCP tools outside this list'
      : `Calls to MCP tools on servers other than ${servers.join(', ')}`;
    lines.push(`${what} will be blocked until the next prompt. If one is truly needed, tell the user which and why instead of retrying.`);
  }
  return lines.join(' ');
}

/** The one-line systemMessage shown to the user. */
export function summaryFor(decision) {
  if (decision?.status !== 'scoped') return null;
  const ms = decision.latencyMs ?? '?';
  const names = decision.selected.map(short);
  const shown = names.slice(0, 4).join(', ') + (names.length > 4 ? `, +${names.length - 4}` : '');
  return `🔭 jev-toolscope: ${decision.catalogSize} MCP tools → ${decision.selected.length} in scope in ${ms} ms${shown ? ` (${shown})` : ''}`;
}
