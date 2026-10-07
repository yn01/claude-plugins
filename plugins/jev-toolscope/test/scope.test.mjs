// The contract and the decision core, with a stand-in for the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as contract from '../lib/contracts/scope.mjs';
import { decide, adviceFor, summaryFor, isAlwaysAllowed, withinScope, scopeServers } from '../lib/scope.mjs';

const tools = [
  { name: 'mcp__github__create_issue', server: 'github', tool: 'create_issue', description: 'Create an issue' },
  { name: 'mcp__github__list_pull_requests', server: 'github', tool: 'list_pull_requests', description: 'List PRs' },
  { name: 'mcp__chrome__navigate', server: 'chrome', tool: 'navigate', description: '' },
];
const catalog = { source: 'scan+transcript', tools, servers: { github: 'GitHub API' } };
const config = { minRelevance: 0.4, maxTools: 150, skip: { minChars: 6 } };

const answering = (ps) => async ({ questions, state }) => {
  answering.last = { questions, state };
  const answers = {};
  Object.keys(questions).forEach((qid, i) => {
    if (ps[i] !== undefined) answers[qid] = { type: 'noul', noul: ps[i] };
  });
  return { ok: true, answers, latencyMs: 210, usage: { input_tokens: 9 } };
};

test('one noul per tool, ids map back to names, name-only tools say so', () => {
  const { questions, ids } = contract.questions(tools, { maxDescriptionChars: 300 });
  assert.deepEqual(Object.keys(questions), ['t0', 't1', 't2']);
  assert.equal(ids.t1, 'mcp__github__list_pull_requests');
  assert.equal(questions.t0.type, 'noul');
  assert.match(questions.t0.instructions, /"github\/create_issue": Create an issue$/);
  assert.match(questions.t2.instructions, /no description available/);
  assert.deepEqual(Object.keys(questions.t0.criteria), ['true', 'false']);
});

test('long descriptions are clipped', () => {
  const long = [{ ...tools[0], description: 'x'.repeat(500) }];
  const { questions } = contract.questions(long, { maxDescriptionChars: 50 });
  assert.ok(questions.t0.instructions.endsWith('…'));
  assert.ok(questions.t0.instructions.length < 120);
});

test('state carries the prompt and one line per server', () => {
  assert.deepEqual(contract.stateOf('abcdef', { github: 'GitHub API' }, { maxPromptChars: 3 }), { user_prompt: 'abc', mcp_servers: 'github: GitHub API' });
  assert.deepEqual(contract.stateOf('abc', {}, {}), { user_prompt: 'abc' });
});

test('interpret sorts by p, unanswered first (they are kept in scope)', () => {
  const s = contract.interpret({ t0: { noul: 0.2 }, t2: { noul: 0.9 } }, { t0: 'a', t1: 'b', t2: 'c' });
  assert.deepEqual(s, [{ tool: 'b', p: null }, { tool: 'c', p: 0.9 }, { tool: 'a', p: 0.2 }]);
});

test('scoped: p >= minRelevance selected, in one request', async () => {
  const d = await decide({ prompt: 'Open an issue for the login bug', catalog, config, ask: answering([0.91, 0.45, 0.05]) });
  assert.equal(d.status, 'scoped');
  assert.equal(d.reason, 'judged');
  assert.deepEqual(d.selected, ['mcp__github__create_issue', 'mcp__github__list_pull_requests']);
  assert.equal(d.catalogSize, 3);
  assert.deepEqual(d.servers, ['chrome', 'github']);
  assert.equal(d.latencyMs, 210);
  assert.equal(Object.keys(answering.last.questions).length, 3);
  assert.equal(answering.last.state.mcp_servers, 'github: GitHub API');
});

test('an unanswered tool stays in scope; alwaysAllow adds tools', async () => {
  const d = await decide({ prompt: 'Open an issue', catalog, config: { ...config, alwaysAllow: ['mcp__chrome__*'] }, ask: answering([0.1]) });
  assert.deepEqual(d.selected.sort(), ['mcp__chrome__navigate', 'mcp__github__list_pull_requests']);
  assert.equal(d.unanswered, 2);
});

test('skips carry the scope over without asking', async () => {
  let asked = false;
  const d = await decide({ prompt: 'はい', catalog, config, ask: async () => { asked = true; } });
  assert.equal(d.status, 'carry');
  assert.equal(d.reason, 'skip:too_short');
  assert.equal(asked, false);
});

test('open on: no tools, too many tools, judge failure', async () => {
  const none = await decide({ prompt: 'Open an issue', catalog: { source: 'none', tools: [] }, config });
  assert.deepEqual([none.status, none.reason], ['open', 'no_tools']);

  const big = await decide({ prompt: 'Open an issue', catalog, config: { ...config, maxTools: 2 } });
  assert.deepEqual([big.status, big.reason], ['open', 'catalog_too_large']);

  const fail = await decide({ prompt: 'Open an issue', catalog, config, ask: async () => ({ ok: false, reason: 'timeout', latencyMs: 3000 }) });
  assert.deepEqual([fail.status, fail.reason, fail.error], ['open', 'judge_unavailable', 'timeout']);
  assert.deepEqual(fail.selected, []);
});

test('isAlwaysAllowed: exact names and server globs', () => {
  assert.equal(isAlwaysAllowed('mcp__a__b', ['mcp__a__b']), true);
  assert.equal(isAlwaysAllowed('mcp__a__b', ['mcp__a__*']), true);
  assert.equal(isAlwaysAllowed('mcp__ab__c', ['mcp__a__*']), false);
  assert.equal(isAlwaysAllowed('mcp__a__b', undefined), false);
});

test('advice names the tools and a select: query; enforce warns of blocking', () => {
  const d = { status: 'scoped', catalogSize: 42, selected: ['mcp__github__create_issue'], latencyMs: 245 };
  const a = adviceFor(d, 'advise');
  assert.match(a, /^\[jev-toolscope\] Of the 42 MCP tools/);
  assert.match(a, /select:mcp__github__create_issue/);
  assert.match(a, /other 41/);
  assert.doesNotMatch(a, /blocked/);
  assert.match(adviceFor(d, 'enforce'), /on servers other than github will be blocked/);
  assert.match(adviceFor(d, 'enforce', { guardLevel: 'tool' }), /outside this list will be blocked/);
  assert.match(adviceFor({ ...d, selected: [] }, 'enforce'), /outside this list will be blocked/);
  assert.match(adviceFor({ ...d, selected: [] }, 'advise'), /None of the 42/);
  assert.equal(adviceFor({ status: 'open' }, 'advise'), null);
});

test('summary is the demo line', () => {
  const s = summaryFor({ status: 'scoped', catalogSize: 42, selected: ['mcp__github__create_issue', 'mcp__a__1', 'mcp__a__2', 'mcp__a__3', 'mcp__a__4'], latencyMs: 245 });
  assert.equal(s, '🔭 jev-toolscope: 42 MCP tools → 5 in scope in 245 ms (github/create_issue, a/1, a/2, a/3, +1)');
  assert.equal(summaryFor({ status: 'carry' }), null);
});

test('withinScope: server level by default, tool level on request, alwaysAllow either way', () => {
  const sel = ['mcp__claude-in-chrome__navigate'];
  assert.equal(withinScope('mcp__claude-in-chrome__tabs_context_mcp', sel, {}), true);
  assert.equal(withinScope('mcp__claude_ai_Gmail__search', sel, {}), false);
  assert.equal(withinScope('mcp__claude-in-chrome__tabs_context_mcp', sel, { guardLevel: 'tool' }), false);
  assert.equal(withinScope('mcp__claude-in-chrome__navigate', sel, { guardLevel: 'tool' }), true);
  assert.equal(withinScope('mcp__claude_ai_Gmail__search', [], { alwaysAllow: ['mcp__claude_ai_Gmail__*'] }), true);
  assert.equal(withinScope('mcp__a__b', [], {}), false, 'an empty scope allows no server');
  assert.deepEqual(scopeServers(['mcp__b__x', 'mcp__a__y', 'mcp__b__z']), ['a', 'b']);
});
