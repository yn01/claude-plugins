// End to end through hooks/spawn.mjs: stdin in, stdout and journal row out.
//
// The invariants: exit 0 on every path; shadow prints nothing; apply prints
// updatedInput (a full copy, only `model` changed) and never a
// permissionDecision; and every row records hook:"spawn" and its contract.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'spawn.mjs');
const ROUTE_HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'route.mjs');
let dir, server, port, behavior;

const answersFor = (kind, difficulty) => ({
  task_kind: { type: 'choice', choice: kind, confidence: 0.9 },
  difficulty: { type: 'score', score: difficulty, confidence: 0.9 },
  stronger_gain: { type: 'score', score: 0, confidence: 0.9 },
});

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'jev-dispatch-spawn-'));
  behavior = { kind: 'ok', answers: answersFor('docs', 0.3) };
  server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      if (behavior.kind === 'error') { res.writeHead(500); return res.end('boom'); }
      if (behavior.kind === 'slow') return setTimeout(() => { try { res.end('{}'); } catch {} }, 1500);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: 'jev-1.13.0', answers: behavior.answers, usage: { input_tokens: 5 } }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

function run(input, { spawnMode, mode, key = 'k', timeoutMs = 3000, name, project = {}, hook = HOOK } = {}) {
  const data = join(dir, name, 'data');
  const proj = join(dir, name, 'proj');
  mkdirSync(join(proj, '.jev-dispatch'), { recursive: true });
  writeFileSync(join(proj, '.jev-dispatch', 'config.json'), JSON.stringify({
    endpoint: `http://127.0.0.1:${port}/v1/systemone`, timeoutMs, ...project,
  }));

  const env = { ...process.env, CLAUDE_PLUGIN_DATA: data };
  for (const k of ['CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY', 'JEV_DISPATCH_MODE', 'JEV_DISPATCH_SPAWN_MODE']) delete env[k];
  if (key) env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY = key;
  if (spawnMode) env.JEV_DISPATCH_SPAWN_MODE = spawnMode;
  if (mode) env.JEV_DISPATCH_MODE = mode;

  return new Promise((resolve) => {
    const child = spawn('node', [hook], { env, cwd: proj });
    let stdout = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.on('close', (code) => {
      const path = join(data, 'journal.jsonl');
      const rows = existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
      resolve({ code, stdout, rows });
    });
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify({ cwd: proj, session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Agent', ...input }));
  });
}

const tool_input = {
  description: 'Fix typo', prompt: 'Fix the typo "teh" in README.md line 3.',
  subagent_type: 'general-purpose', model: 'sonnet', name: 'typo', run_in_background: false,
};
const opusTranscript = () => {
  const p = join(dir, 'opus.jsonl');
  writeFileSync(p, JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5' } }) + '\n');
  return p;
};

test('shadow records the route and prints nothing', async () => {
  const r = await run({ tool_input }, { name: 'shadow' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  const row = r.rows[0];
  assert.equal(row.hook, 'spawn');
  assert.equal(row.contract, 'spawn@1');
  assert.equal(row.mode, 'shadow');
  assert.equal(row.subagentType, 'general-purpose');
  assert.equal(row.requestedModel, 'sonnet');
  assert.equal(row.tier, 'light');
  assert.equal(row.routedModel, 'haiku');
  assert.equal(row.action, 'route');
  assert.equal(row.direction, 'down');
  assert.equal(row.reason, 'lighter');
  assert.equal(row.delivered, false);
  assert.equal(row.descriptionHead, 'Fix typo');
  assert.equal(row.briefChars, tool_input.prompt.length);
  assert.equal(row.agentId, null);
  assert.equal(row.kindUsed, true);
  assert.equal(row.error, null);
  assert.ok(row.answers.difficulty);
});

test('apply prints updatedInput with only model changed, and no permissionDecision', async () => {
  const r = await run({ tool_input }, { spawnMode: 'apply', name: 'apply' });
  assert.equal(r.code, 0);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(out), ['hookSpecificOutput']);
  const h = out.hookSpecificOutput;
  assert.equal(h.hookEventName, 'PreToolUse');
  assert.deepEqual(h.updatedInput, { ...tool_input, model: 'haiku' });
  assert.match(h.additionalContext, /^\[jev-dispatch\] routed this subagent to haiku/);
  assert.ok(!('permissionDecision' in h));
  assert.equal(r.rows[0].delivered, true);
  assert.equal(r.rows[0].mode, 'apply');
});

test('apply routes up when the brief is hard', async () => {
  behavior = { kind: 'ok', answers: answersFor('design', 3.6) };
  const r = await run({ tool_input: { ...tool_input, model: 'haiku' } }, { spawnMode: 'apply', name: 'apply-up' });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.updatedInput.model, 'opus');
  assert.equal(r.rows[0].direction, 'up');
  behavior = { kind: 'ok', answers: answersFor('docs', 0.3) };
});

test('apply with the same model prints nothing', async () => {
  const r = await run({ tool_input: { ...tool_input, model: 'haiku' } }, { spawnMode: 'apply', name: 'keep' });
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].action, 'keep');
  assert.equal(r.rows[0].delivered, false);
});

test('an unknown mode value behaves like shadow', async () => {
  const r = await run({ tool_input }, { spawnMode: 'bogus', name: 'bogus' });
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].action, 'route');
  assert.equal(r.rows[0].delivered, false);
});

test('off exits at once and writes nothing', async () => {
  const r = await run({ tool_input }, { spawnMode: 'off', name: 'off' });
  assert.deepEqual([r.code, r.stdout, r.rows], [0, '', []]);
});

test('the main mode does not govern spawn routing', async () => {
  const r = await run({ tool_input }, { mode: 'off', spawnMode: 'apply', name: 'main-off' });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.updatedInput.model, 'haiku');
});

test('the spawn mode can come from a project config', async () => {
  const r = await run({ tool_input }, { name: 'proj-apply', project: { spawn: { mode: 'apply' } } });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.updatedInput.model, 'haiku');
});

test('an untargeted subagent type is journalled by name without asking Jev', async () => {
  behavior = { kind: 'error' };
  const r = await run({ tool_input: { ...tool_input, subagent_type: 'Explore' } }, { spawnMode: 'apply', name: 'not-targeted' });
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].reason, 'not_targeted');
  assert.equal(r.rows[0].subagentType, 'Explore');
  assert.equal(r.rows[0].error, null);
  behavior = { kind: 'ok', answers: answersFor('docs', 0.3) };
});

test('respectExplicit is honoured from config', async () => {
  const r = await run({ tool_input }, { spawnMode: 'apply', name: 'explicit', project: { spawn: { respectExplicit: true } } });
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].reason, 'explicit_respected');
});

test('an omitted model inherits the session model from the transcript', async () => {
  const { model, ...noModel } = tool_input;
  const r = await run({ tool_input: noModel, transcript_path: opusTranscript() }, { spawnMode: 'apply', name: 'inherit' });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.updatedInput.model, 'haiku');
  assert.equal(r.rows[0].sessionModel, 'claude-opus-5-5');
  assert.equal(r.rows[0].sessionModelSource, 'transcript');
  assert.equal(r.rows[0].requestedModel, null);
});

test('with no model anywhere the call is left alone', async () => {
  const { model, ...noModel } = tool_input;
  const r = await run({ tool_input: noModel }, { spawnMode: 'apply', name: 'unknown-model' });
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].reason, 'unknown_model');
});

test('inside a subagent the inherited model is unknown, and the ids are recorded', async () => {
  const { model, ...noModel } = tool_input;
  const r = await run({ tool_input: noModel, transcript_path: opusTranscript(), agent_id: 'ag1', agent_type: 'general-purpose' }, { spawnMode: 'apply', name: 'nested' });
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].reason, 'unknown_model');
  assert.equal(r.rows[0].agentId, 'ag1');
  assert.equal(r.rows[0].agentType, 'general-purpose');
  const explicit = await run({ tool_input, agent_id: 'ag1', agent_type: 'general-purpose' }, { spawnMode: 'apply', name: 'nested-explicit' });
  assert.equal(JSON.parse(explicit.stdout).hookSpecificOutput.updatedInput.model, 'haiku');
});

test('a tool other than Agent is ignored', async () => {
  const r = await run({ tool_name: 'Bash', tool_input: { command: 'ls' } }, { spawnMode: 'apply', name: 'bash' });
  assert.deepEqual([r.code, r.stdout, r.rows], [0, '', []]);
});

test('no key, http error, timeout all fail open and record the error', async () => {
  const nokey = await run({ tool_input }, { spawnMode: 'apply', key: '', name: 'nokey' });
  assert.deepEqual([nokey.code, nokey.stdout, nokey.rows[0].error], [0, '', 'no_api_key']);

  behavior = { kind: 'error' };
  const http = await run({ tool_input }, { spawnMode: 'apply', name: 'http' });
  assert.deepEqual([http.code, http.stdout, http.rows[0].error], [0, '', 'http_500']);

  behavior = { kind: 'slow' };
  const slow = await run({ tool_input }, { spawnMode: 'apply', timeoutMs: 200, name: 'timeout' });
  assert.deepEqual([slow.code, slow.stdout, slow.rows[0].error], [0, '', 'timeout']);
  for (const x of [nokey, http, slow]) {
    assert.equal(x.rows[0].hook, 'spawn');
    assert.equal(x.rows[0].contract, 'spawn@1');
  }
  behavior = { kind: 'ok', answers: answersFor('docs', 0.3) };
});

test('garbage on stdin exits 0 without output', async () => {
  const r = await run('not json', { spawnMode: 'apply', name: 'garbage' });
  assert.deepEqual([r.code, r.stdout], [0, '']);
});

test('prompt-hook rows now carry hook:"prompt"', async () => {
  const r = await run({ prompt: 'Fix the typo in README', model: 'claude-opus-5-5' }, { name: 'prompt-row', hook: ROUTE_HOOK });
  assert.equal(r.rows[0].hook, 'prompt');
  assert.equal(r.rows[0].contract, 'route@1');
});
