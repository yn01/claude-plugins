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

function runHook(input, { key = 'dummy' } = {}) {
  const journal = join(dir, `j-${Math.random().toString(36).slice(2)}.jsonl`);
  return new Promise((resolve) => {
    const env = { ...process.env, JEV_GATE_JOURNAL: journal, CLAUDE_PLUGIN_DATA: join(dir, 'pd') };
    if (key) env.TYPESAFE_API_KEY = key; else delete env.TYPESAFE_API_KEY;
    const child = spawn(process.execPath, [HOOK], { env });
    child.stdin.end(JSON.stringify({ cwd: join(dir, 'proj'), session_id: 's1', ...input }));
    child.on('close', (code) => {
      const rows = existsSync(journal)
        ? readFileSync(journal, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
        : [];
      resolve({ code, rows });
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
