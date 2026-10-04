// End to end through the real hook: stdin in, exit code and journal row out.
//
// The point of this file is one invariant. v0.8.0 wrote the contract onto the
// rows that reached Jev and nowhere else, so every subagent stand-down and
// recorded test failure was filed as pre-contract data and silently dropped
// from every count. Each path that can write a row is exercised here, and
// every row it writes must name its contract.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as contract from '../lib/contracts/completion.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'gates', 'completion.mjs');
let dir, server, port, calls;

const line = (o) => JSON.stringify(o) + '\n';
const user = (text) => line({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } });
const bash = (id, command) => line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } });
const result = (id, is_error, content) => line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, is_error, content }] } });

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'jev-gate-test-'));
  calls = 0;
  server = createServer((req, res) => {
    calls++;
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const n = (v) => ({ type: 'noul', noul: v });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        model: 'jev-1.13.0',
        answers: { claims_done: n(0.95), claims_verified: n(0.95), blocked_on_user: n(0.05) },
        usage: { input_tokens: 200 },
      }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;

  mkdirSync(join(dir, 'proj', '.jev-gate'), { recursive: true });
  writeFileSync(join(dir, 'proj', '.jev-gate', 'config.json'), JSON.stringify({
    mode: 'shadow', endpoint: `http://127.0.0.1:${port}/v1/systemone`, timeoutMs: 3000,
  }));
  writeFileSync(join(dir, 'ran.jsonl'), user('go') + bash('t1', 'npm test') + result('t1', false, '12 passed'));
  writeFileSync(join(dir, 'failed.jsonl'), user('go') + bash('t1', 'npm test') + result('t1', true, '1 failed'));
});

after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

// `config` gives the run its own project directory, so a test can switch to
// Enforce or change the block budget without touching the others. `pd` lets a
// test reuse a plugin data dir, which is where the block budget is counted.
function runHook(input, { key = 'dummy', legacyKey, config = null, pd = null } = {}) {
  const tag = Math.random().toString(36).slice(2);
  const journal = join(dir, `j-${tag}.jsonl`);
  let cwd = join(dir, 'proj');
  if (config) {
    cwd = join(dir, `proj-${tag}`);
    mkdirSync(join(cwd, '.jev-gate'), { recursive: true });
    writeFileSync(join(cwd, '.jev-gate', 'config.json'), JSON.stringify({
      endpoint: `http://127.0.0.1:${port}/v1/systemone`, timeoutMs: 3000, ...config,
    }));
  }
  return new Promise((resolve) => {
    const env = { ...process.env, JEV_GATE_JOURNAL: journal, CLAUDE_PLUGIN_DATA: pd ?? join(dir, `pd-${tag}`) };
    if (key) env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY = key; else delete env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY;
    if (legacyKey) env.TYPESAFE_API_KEY = legacyKey; else delete env.TYPESAFE_API_KEY;
    const child = spawn(process.execPath, [HOOK], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.stdin.end(JSON.stringify({ cwd, session_id: 's1', ...input }));
    child.on('close', (code) => {
      const rows = existsSync(journal)
        ? readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
        : [];
      const shown = stdout ? JSON.parse(stdout).systemMessage : null;
      resolve({ code, rows, shown, stderr });
    });
  });
}

const paths = [
  ['a judged Stop', { hook_event_name: 'Stop', transcript_path: 'ran', last_assistant_message: 'テストも通り、完了しました。' }, {}, 'jev'],
  ['a recorded test failure', { hook_event_name: 'Stop', transcript_path: 'failed', last_assistant_message: '完了しました。' }, {}, 'code'],
  ['a SubagentStop with no transcript of its own', { hook_event_name: 'SubagentStop', transcript_path: 'ran', agent_id: 'missing', agent_type: 'implementer', last_assistant_message: '完了しました。' }, {}, 'code'],
  ['an excluded agent type', { hook_event_name: 'SubagentStop', transcript_path: 'ran', agent_id: 'p1', agent_type: 'Plan', last_assistant_message: '設計を終えました。' }, {}, 'code'],
  ['a request with no API key', { hook_event_name: 'Stop', transcript_path: 'ran', last_assistant_message: '完了しました。' }, { key: null }, 'failopen'],
];

for (const [name, input, opts, decidedBy] of paths) {
  test(`every row names its contract: ${name}`, async () => {
    const { code, rows } = await runHook({ ...input, transcript_path: join(dir, `${input.transcript_path}.jsonl`) }, opts);
    assert.equal(code, 0, 'shadow mode never exits non-zero');
    assert.equal(rows.length, 1, 'exactly one row per event');
    assert.equal(rows[0].contract, contract.id);
    assert.equal(rows[0].decidedBy, decidedBy);
  });
}

test('TYPESAFE_API_KEY alone is ignored: no request, fail open', async () => {
  const before = calls;
  const { code, rows } = await runHook({
    hook_event_name: 'Stop', transcript_path: join(dir, 'ran.jsonl'), last_assistant_message: '完了しました。',
  }, { key: null, legacyKey: 'legacy' });
  assert.equal(code, 0);
  assert.equal(calls, before, 'no request was sent');
  assert.equal(rows[0].decidedBy, 'failopen');
  assert.equal(rows[0].reason, 'no_api_key');
});

test('an excluded agent type is skipped before Jev is asked', async () => {
  const before = calls;
  const { rows } = await runHook({
    hook_event_name: 'SubagentStop', transcript_path: join(dir, 'ran.jsonl'),
    agent_id: 'e1', agent_type: 'Explore', last_assistant_message: '調べました。',
  });
  assert.equal(calls, before, 'no request was sent');
  assert.equal(rows[0].verdict, 'skip');
  assert.equal(rows[0].reason, 'excluded_agent_type');
});

test('an event with no agent_type is judged, never silently exempted', async () => {
  const { rows } = await runHook({
    hook_event_name: 'Stop', transcript_path: join(dir, 'ran.jsonl'), last_assistant_message: '完了しました。',
  });
  assert.notEqual(rows[0].verdict, 'skip');
});

// --- how a verdict is delivered under Enforce --------------------------------
// The mock answers "claims a check passed" for every request, so a transcript
// with no verification in it is a block; one with a failed run is a recorded
// failure. Only the block budget varies.

const claimsCheck = (transcript) => ({
  hook_event_name: 'Stop', transcript_path: join(dir, `${transcript}.jsonl`),
  last_assistant_message: 'テストも全部通りました。',
});

test('enforce, default budget: a block still stops work', async () => {
  writeFileSync(join(dir, 'edited.jsonl'), user('go') + line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'e1', name: 'Edit', input: { file_path: 'a' } }] } }));
  const { code, stderr } = await runHook(claimsCheck('edited'), { config: { mode: 'enforce' } });
  assert.equal(code, 2);
  assert.match(stderr, /no test, build, lint or type-check/);
});

test('enforce, budget 0: advisory — shown, never blocked, and says so', async () => {
  const { code, shown } = await runHook(claimsCheck('edited'), { config: { mode: 'enforce', gates: { completion: { maxBlocksPerSession: 0 } } } });
  assert.equal(code, 0, 'advisory never exits 2');
  assert.match(shown, /^jev-gate \(advisory, nothing is blocked\): /);
  assert.doesNotMatch(shown, /standing down|sent back/, 'must not read as an exhausted budget');
});

test('enforce, budget 0: a recorded test failure is shown, not dropped', async () => {
  const { code, shown } = await runHook(claimsCheck('failed'), { config: { mode: 'enforce', gates: { completion: { maxBlocksPerSession: 0 } } } });
  assert.equal(code, 0);
  assert.ok(shown, 'a recorded failure must surface in advisory mode');
  assert.match(shown, /advisory, nothing is blocked.*verification run failed/s);
});

test('enforce, budget spent: the gate stands down and says how many times', async () => {
  const pd = join(dir, 'pd-spent');
  const config = { mode: 'enforce', gates: { completion: { maxBlocksPerSession: 1 } } };
  const first = await runHook(claimsCheck('edited'), { config, pd });
  assert.equal(first.code, 2, 'the first block is carried out');
  const second = await runHook(claimsCheck('edited'), { config, pd });
  assert.equal(second.code, 0, 'the second is withheld');
  assert.match(second.shown, /already sent back 1 time\(s\) this session; standing down/);
});
