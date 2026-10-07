// End to end through the real hooks: stdin in, stdout, session state and
// journal rows out.
//
// The invariants: both hooks exit 0 on every path; shadow prints nothing;
// a failed judgement leaves the scope open and the guard allows; only enforce
// ever denies, and only an out-of-scope call from the main thread.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCOPE = join(HERE, '..', 'hooks', 'scope.mjs');
const GUARD = join(HERE, '..', 'hooks', 'guard.mjs');
const TRANSCRIPT = join(HERE, 'fixtures', 'transcript.jsonl');
let dir, server, port, behavior, lastBody;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'jev-toolscope-test-'));
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastBody = body ? JSON.parse(body) : null;
      if (behavior.kind === 'error') { res.writeHead(500); return res.end('boom'); }
      if (behavior.kind === 'slow') return setTimeout(() => { try { res.end('{}'); } catch {} }, 1500);
      // answer each question by the tool name it mentions
      const answers = {};
      for (const [qid, q] of Object.entries(lastBody.questions)) {
        const hit = Object.entries(behavior.p).find(([needle]) => q.instructions.includes(needle));
        answers[qid] = { type: 'noul', noul: hit ? hit[1] : 0.02 };
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: 'jev-1.13.0', answers, usage: { input_tokens: 7 } }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

// One sandbox per test: its own data dir and project, so journals never mix.
function sandbox(name, { catalog } = {}) {
  const data = join(dir, name, 'data');
  const proj = join(dir, name, 'proj');
  mkdirSync(join(proj, '.jev-toolscope'), { recursive: true });
  mkdirSync(data, { recursive: true });
  writeFileSync(join(proj, '.jev-toolscope', 'config.json'), JSON.stringify({ endpoint: `http://127.0.0.1:${port}/v1/systemone` }));
  if (catalog) writeFileSync(join(data, 'catalog.json'), JSON.stringify(catalog));
  const transcript = join(dir, name, 'transcript.jsonl');
  copyFileSync(TRANSCRIPT, transcript);
  return { name, data, proj, transcript };
}

function run(hook, sb, input, { mode, key = 'k', config, projectDir } = {}) {
  if (config) writeFileSync(join(sb.proj, '.jev-toolscope', 'config.json'), JSON.stringify({ endpoint: `http://127.0.0.1:${port}/v1/systemone`, ...config }));
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: sb.data };
  delete env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY;
  delete env.JEV_TOOLSCOPE_MODE;
  delete env.CLAUDE_PROJECT_DIR;
  if (projectDir) env.CLAUDE_PROJECT_DIR = projectDir;
  if (key) env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY = key;
  if (mode) env.JEV_TOOLSCOPE_MODE = mode;

  return new Promise((resolve) => {
    const child = spawn('node', [hook], { env, cwd: sb.proj });
    let stdout = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.on('close', (code) => {
      const path = join(sb.data, 'journal.jsonl');
      const rows = existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
      resolve({ code, stdout, rows, last: rows.at(-1) });
    });
    child.stdin.end(JSON.stringify({ cwd: sb.proj, session_id: 's1', transcript_path: sb.transcript, ...input }));
  });
}

const catalog = {
  servers: {
    github: { instructions: 'GitHub API', tools: [{ name: 'create_issue', description: 'Create an issue' }, { name: 'list_pull_requests', description: 'List PRs' }] },
  },
};
const prompt = { prompt: 'Open a GitHub issue for the login bug and link the failing PR' };
const call = (tool, extra = {}) => ({ tool_name: tool, tool_input: {}, ...extra });

test('shadow: judges the live tools, journals, prints nothing; guard records would_deny', async () => {
  behavior = { kind: 'ok', p: { create_issue: 0.91, list_pull_requests: 0.45 } };
  const sb = sandbox('shadow', { catalog });
  const r = await run(SCOPE, sb, prompt);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  const row = r.last;
  assert.equal(row.hook, 'scope');
  assert.equal(row.contract, 'scope@2');
  assert.equal(row.context, null);
  assert.equal(row.mode, 'shadow');
  assert.equal(row.status, 'scoped');
  assert.equal(row.catalogSource, 'scan+transcript');
  assert.equal(row.catalogSize, 3, 'the three live MCP tools from the transcript');
  assert.deepEqual(row.selected, ['mcp__github__create_issue', 'mcp__github__list_pull_requests']);
  assert.equal(row.delivered, false);
  assert.equal(typeof row.latencyMs, 'number');
  assert.deepEqual(row.usage, { input_tokens: 7 });
  assert.equal(lastBody.state.mcp_servers, 'github: GitHub API');
  assert.equal(Object.keys(lastBody.questions).length, 3);

  const g = await run(GUARD, sb, call('mcp__claude_ai_Gmail__search'));
  assert.equal(g.code, 0);
  assert.equal(g.stdout, '');
  assert.deepEqual([g.last.hook, g.last.decision, g.last.inScope], ['guard', 'would_deny', false]);

  const ok = await run(GUARD, sb, call('mcp__github__create_issue'));
  assert.deepEqual([ok.last.decision, ok.last.reason], ['allow', 'in_scope']);
});

test('advise: additionalContext with a select: hint, and the summary line', async () => {
  behavior = { kind: 'ok', p: { create_issue: 0.91 } };
  const sb = sandbox('advise', { catalog });
  const r = await run(SCOPE, sb, prompt, { mode: 'advise' });
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(out.hookSpecificOutput.additionalContext, /select:mcp__github__create_issue/);
  assert.match(out.systemMessage, /^🔭 jev-toolscope: 3 MCP tools → 1 in scope in \d+ ms \(github\/create_issue\)$/);
  assert.equal(r.last.delivered, true);

  const g = await run(GUARD, sb, call('mcp__claude_ai_Gmail__search'), { mode: 'advise' });
  assert.equal(g.stdout, '', 'advise never denies');
  assert.equal(g.last.decision, 'would_deny');
});

test('summary: false keeps the hint but drops the user-facing line', async () => {
  behavior = { kind: 'ok', p: { create_issue: 0.91 } };
  const sb = sandbox('nosummary', { catalog });
  const r = await run(SCOPE, sb, prompt, { mode: 'advise', config: { summary: false } });
  const out = JSON.parse(r.stdout);
  assert.ok(out.hookSpecificOutput.additionalContext);
  assert.equal(out.systemMessage, undefined);
});

test('enforce: out-of-scope main-thread calls are denied, in-scope and subagent calls are not', async () => {
  behavior = { kind: 'ok', p: { create_issue: 0.91 } };
  const sb = sandbox('enforce', { catalog });
  const r = await run(SCOPE, sb, prompt, { mode: 'enforce' });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Calls to MCP tools on servers other than github will be blocked/);

  const denied = await run(GUARD, sb, call('mcp__claude_ai_Gmail__search'), { mode: 'enforce' });
  assert.equal(denied.code, 0);
  const out = JSON.parse(denied.stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /outside this prompt's MCP tool scope \(servers in scope: github\)/);
  assert.deepEqual([denied.last.decision, denied.last.guardLevel], ['deny', 'server']);

  // server level, the default: a tool Jev did not pick, on a server it did, is allowed
  const sibling = await run(GUARD, sb, call('mcp__github__list_pull_requests'), { mode: 'enforce' });
  assert.equal(sibling.stdout, '');
  assert.deepEqual([sibling.last.decision, sibling.last.reason], ['allow', 'in_scope']);

  const allowed = await run(GUARD, sb, call('mcp__github__create_issue'), { mode: 'enforce' });
  assert.equal(allowed.stdout, '');

  const sub = await run(GUARD, sb, call('mcp__claude_ai_Gmail__search', { agent_id: 'a1' }), { mode: 'enforce' });
  assert.equal(sub.stdout, '');
  assert.deepEqual([sub.last.decision, sub.last.reason, sub.last.agentId], ['allow', 'subagent', 'a1']);

  const always = await run(GUARD, sb, call('mcp__claude_ai_Gmail__search'), { mode: 'enforce', config: { alwaysAllow: ['mcp__claude_ai_Gmail__*'] } });
  assert.equal(always.stdout, '');
  assert.equal(always.last.reason, 'in_scope');
});

test('guardLevel tool: only the selected tools themselves are allowed', async () => {
  behavior = { kind: 'ok', p: { create_issue: 0.91 } };
  const sb = sandbox('toollevel', { catalog });
  const r = await run(SCOPE, sb, prompt, { mode: 'enforce', config: { guardLevel: 'tool' } });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /Calls to MCP tools outside this list will be blocked/);
  const sibling = await run(GUARD, sb, call('mcp__github__list_pull_requests'), { mode: 'enforce', config: { guardLevel: 'tool' } });
  const out = JSON.parse(sibling.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, 'deny');
  assert.match(out.permissionDecisionReason, /\(tools in scope: mcp__github__create_issue\)/);
  assert.equal(sibling.last.guardLevel, 'tool');
});

test('after the agent cds into a subdirectory, the project config still applies via CLAUDE_PROJECT_DIR', async () => {
  behavior = { kind: 'ok', p: { create_issue: 0.91 } };
  const sb = sandbox('moved', { catalog });
  writeFileSync(join(sb.proj, '.jev-toolscope', 'config.json'), JSON.stringify({ endpoint: `http://127.0.0.1:${port}/v1/systemone`, guardLevel: 'tool' }));
  const sub = join(sb.proj, 'packages', 'app');
  mkdirSync(sub, { recursive: true });

  await run(SCOPE, sb, { ...prompt, cwd: sub }, { mode: 'enforce', projectDir: sb.proj });
  const g = await run(GUARD, sb, call('mcp__github__list_pull_requests', { cwd: sub }), { mode: 'enforce', projectDir: sb.proj });
  assert.equal(JSON.parse(g.stdout).hookSpecificOutput.permissionDecision, 'deny', 'guardLevel "tool" from the project root config');
  assert.deepEqual([g.last.cwd, g.last.project, g.last.guardLevel], [sub, sb.proj, 'tool']);

  // without the variable, the moved cwd loses the project config: the old behaviour
  const lost = await run(GUARD, sb, call('mcp__github__list_pull_requests', { cwd: sub }), { mode: 'enforce' });
  assert.equal(lost.last.guardLevel, 'server');
});

test('a slash command carries the previous scope over', async () => {
  behavior = { kind: 'ok', p: { create_issue: 0.91 } };
  const sb = sandbox('carry', { catalog });
  await run(SCOPE, sb, prompt, { mode: 'enforce' });
  behavior = { kind: 'error' };
  const r = await run(SCOPE, sb, { prompt: '/jev-toolscope:status' }, { mode: 'enforce' });
  assert.equal(r.stdout, '');
  assert.deepEqual([r.last.status, r.last.reason, r.last.error], ['carry', 'skip:slash_command', null]);
  const g = await run(GUARD, sb, call('mcp__claude_ai_Gmail__search'), { mode: 'enforce' });
  assert.equal(JSON.parse(g.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

test('a short reply is judged with the agent message it answers, and opens the offered tool', async () => {
  behavior = { kind: 'ok', p: { create_issue: 0.91 } };
  const sb = sandbox('reply', { catalog });
  await run(SCOPE, sb, prompt, { mode: 'enforce' });

  // the agent offers something outside the first scope; the user says yes
  appendFileSync(sb.transcript, [
    { type: 'user', message: { role: 'user', content: prompt.prompt } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: 'mcp__github__create_issue', input: {} }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Issue opened. Shall I also list the open pull requests to link the failing one?' }] } },
    { type: 'assistant', isSidechain: true, message: { role: 'assistant', content: [{ type: 'text', text: 'subagent chatter' }] } },
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');

  behavior = { kind: 'ok', p: { list_pull_requests: 0.88 } };
  const r = await run(SCOPE, sb, { prompt: 'お願いします' }, { mode: 'enforce' });
  assert.deepEqual([r.last.status, r.last.reason, r.last.context], ['scoped', 'judged_reply', 'reply']);
  assert.deepEqual(r.last.selected, ['mcp__github__list_pull_requests']);
  assert.equal(lastBody.state.user_prompt, 'お願いします');
  assert.equal(lastBody.state.previous_assistant_message, 'Issue opened. Shall I also list the open pull requests to link the failing one?');

  const g = await run(GUARD, sb, call('mcp__github__list_pull_requests'), { mode: 'enforce', config: { guardLevel: 'tool' } });
  assert.equal(g.stdout, '');
  assert.equal(g.last.reason, 'in_scope');
});

for (const [name, setup, error] of [
  ['no API key', { key: '' }, 'no_api_key'],
  ['an http error', { kind: 'error' }, 'http_500'],
  ['a slow answer', { kind: 'slow', config: { timeoutMs: 200 } }, 'timeout'],
]) {
  test(`${name} fails open: scope open, nothing printed, guard allows even in enforce`, async () => {
    behavior = { kind: setup.kind ?? 'ok', p: {} };
    const sb = sandbox(`fail-${error}`, { catalog });
    const r = await run(SCOPE, sb, prompt, { mode: 'enforce', key: setup.key ?? 'k', config: setup.config });
    assert.equal(r.code, 0);
    assert.equal(r.stdout, '');
    assert.deepEqual([r.last.status, r.last.reason, r.last.error], ['open', 'judge_unavailable', error]);
    const g = await run(GUARD, sb, call('mcp__claude_ai_Gmail__search'), { mode: 'enforce' });
    assert.equal(g.stdout, '');
    assert.equal(g.last.reason, 'open_scope');
  });
}

test('no catalog and no transcript: open with no_tools, no request sent', async () => {
  behavior = { kind: 'error' };
  const sb = sandbox('empty');
  const r = await run(SCOPE, sb, { ...prompt, transcript_path: join(dir, 'missing.jsonl') }, { mode: 'enforce' });
  assert.equal(r.stdout, '');
  assert.deepEqual([r.last.status, r.last.reason, r.last.catalogSource], ['open', 'no_tools', 'none']);
});

test('guard with no scope at all allows and records no_scope', async () => {
  const sb = sandbox('noscope');
  const g = await run(GUARD, sb, call('mcp__a__b'), { mode: 'enforce' });
  assert.equal(g.code, 0);
  assert.equal(g.stdout, '');
  assert.equal(g.last.reason, 'no_scope');
});

test('off: both hooks exit at once and write nothing', async () => {
  const sb = sandbox('off', { catalog });
  const r = await run(SCOPE, sb, prompt, { mode: 'off' });
  const g = await run(GUARD, sb, call('mcp__a__b'), { mode: 'off' });
  assert.equal(r.stdout + g.stdout, '');
  assert.deepEqual(g.rows, []);
});

test('garbage on stdin exits 0', async () => {
  const sb = sandbox('garbage');
  for (const hook of [SCOPE, GUARD]) {
    const r = await new Promise((resolve) => {
      const child = spawn('node', [hook], { env: { ...process.env, CLAUDE_PLUGIN_DATA: sb.data }, cwd: sb.proj });
      child.on('close', (code) => resolve(code));
      child.stdin.end('{not json');
    });
    assert.equal(r, 0);
  }
});
