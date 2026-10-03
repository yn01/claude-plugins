// End to end through the real hook: stdin in, stdout and journal row out.
//
// The invariants: the hook exits 0 on every path; shadow prints nothing and
// advise prints additionalContext only when there is something to say; and
// every path that can write a row writes one with its contract.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'route.mjs');
let dir, server, port, behavior;

const answersFor = (kind, difficulty) => ({
  task_kind: { type: 'choice', choice: kind, confidence: 0.9, probabilities: { [kind]: 0.9 } },
  difficulty: { type: 'score', score: difficulty, confidence: 0.9 },
  stronger_gain: { type: 'score', score: 0, confidence: 0.9 },
  context_dependent: { type: 'noul', noul: 0.05 },
});

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'jev-dispatch-test-'));
  behavior = { kind: 'ok', answers: answersFor('bugfix', 0.3) };
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

// Every run gets its own data dir and project dir, so journals never mix.
function run(input, { mode, key = 'k', timeoutMs = 3000, name } = {}) {
  const data = join(dir, name, 'data');
  const proj = join(dir, name, 'proj');
  mkdirSync(join(proj, '.jev-dispatch'), { recursive: true });
  writeFileSync(join(proj, '.jev-dispatch', 'config.json'), JSON.stringify({
    endpoint: `http://127.0.0.1:${port}/v1/systemone`, timeoutMs,
  }));

  const env = { ...process.env, CLAUDE_PLUGIN_DATA: data };
  delete env.TYPESAFE_API_KEY;
  delete env.JEV_DISPATCH_MODE;
  if (key) env.TYPESAFE_API_KEY = key;
  if (mode) env.JEV_DISPATCH_MODE = mode;

  return new Promise((resolve) => {
    const child = spawn('node', [HOOK], { env, cwd: proj });
    let stdout = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.on('close', (code) => {
      const path = join(data, 'journal.jsonl');
      const rows = existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
      resolve({ code, stdout, rows });
    });
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify({ cwd: proj, session_id: 's1', ...input }));
  });
}

const easy = { prompt: 'Fix the typo in README', model: 'claude-opus-5-5' };

test('shadow records the decision and prints nothing', async () => {
  behavior = { kind: 'ok', answers: answersFor('bugfix', 0.3) };
  const r = await run(easy, { name: 'shadow' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.rows.length, 1);
  const row = r.rows[0];
  assert.equal(row.contract, 'route@1');
  assert.equal(row.mode, 'shadow');
  assert.equal(row.session_id, 's1');
  assert.equal(row.sessionModel, 'claude-opus-5-5');
  assert.equal(row.promptChars, easy.prompt.length);
  assert.equal(row.promptHead, easy.prompt);
  assert.equal(row.tier, 'light');
  assert.equal(row.action, 'delegate');
  assert.equal(row.reason, 'lighter');
  assert.equal(row.baselineTier, 'light');
  assert.equal(row.kindUsed, true);
  assert.equal(row.delivered, false);
  assert.equal(row.error, null);
  assert.deepEqual(row.usage, { input_tokens: 5 });
  assert.equal(row.signals.taskKind, 'bugfix');
  assert.ok(row.answers.difficulty);
  assert.equal(typeof row.latencyMs, 'number');
  assert.ok(row.ts);
});

test('advise prints additionalContext for delegate and journals delivered', async () => {
  behavior = { kind: 'ok', answers: answersFor('bugfix', 0.3) };
  const r = await run(easy, { mode: 'advise', name: 'advise-delegate' });
  assert.equal(r.code, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(out.hookSpecificOutput.additionalContext, /^\[jev-dispatch\].*jev-dispatch:light/s);
  assert.equal(r.rows[0].mode, 'advise');
  assert.equal(r.rows[0].delivered, true);
});

test('advise prints a consult hint when the prompt is harder than the session', async () => {
  behavior = { kind: 'ok', answers: answersFor('design', 3.6) };
  const r = await run({ ...easy, prompt: 'Design the plugin system', model: 'claude-sonnet-5-5' }, { mode: 'advise', name: 'advise-consult' });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /consult/);
  assert.equal(r.rows[0].action, 'consult');
});

test('advise prints nothing when the action is none', async () => {
  behavior = { kind: 'ok', answers: answersFor('question', 1) };
  const r = await run({ ...easy, prompt: 'What does this do?' }, { mode: 'advise', name: 'advise-none' });
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].reason, 'question');
  assert.equal(r.rows[0].delivered, false);
});

test('off exits at once and writes nothing', async () => {
  const r = await run(easy, { mode: 'off', name: 'off' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.deepEqual(r.rows, []);
});

test('a skipped prompt is journalled without asking Jev', async () => {
  behavior = { kind: 'error' };
  const r = await run({ ...easy, prompt: 'はい' }, { mode: 'advise', name: 'skip' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].reason, 'skip:too_short');
  assert.equal(r.rows[0].error, null);
  assert.equal(r.rows[0].contract, 'route@1');
});

test('no API key fails open and records no_api_key', async () => {
  const r = await run(easy, { mode: 'advise', key: '', name: 'nokey' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].error, 'no_api_key');
  assert.equal(r.rows[0].action, 'none');
  assert.equal(r.rows[0].contract, 'route@1');
});

test('an http error fails open and records it', async () => {
  behavior = { kind: 'error' };
  const r = await run(easy, { mode: 'advise', name: 'http' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].error, 'http_500');
});

test('a slow answer times out, fails open and records it', async () => {
  behavior = { kind: 'slow' };
  const r = await run(easy, { mode: 'advise', timeoutMs: 200, name: 'timeout' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].error, 'timeout');
});

test('without model on stdin, the transcript supplies it and routing works', async () => {
  behavior = { kind: 'ok', answers: answersFor('bugfix', 0.3) };
  const tpath = join(dir, 'tx-delegate.jsonl');
  writeFileSync(tpath, JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5' } }) + '\n' +
    JSON.stringify({ type: 'user', message: { content: 'next' } }) + '\n');
  const r = await run({ prompt: easy.prompt, transcript_path: tpath }, { mode: 'advise', name: 'tx-delegate' });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /jev-dispatch:light/);
  assert.equal(r.rows[0].sessionModel, 'claude-opus-5-5');
  assert.equal(r.rows[0].sessionModelSource, 'transcript');
  assert.equal(r.rows[0].action, 'delegate');
});

test('without model on stdin, a sonnet transcript turns a hard prompt into a consult', async () => {
  behavior = { kind: 'ok', answers: answersFor('design', 3.6) };
  const tpath = join(dir, 'tx-consult.jsonl');
  writeFileSync(tpath, JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5-5' } }) + '\n');
  const r = await run({ prompt: 'Design the plugin system', transcript_path: tpath }, { mode: 'advise', name: 'tx-consult' });
  assert.equal(r.rows[0].action, 'consult');
  assert.equal(r.rows[0].sessionModelSource, 'transcript');
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /consult/);
});

test('the SessionStart cache is the last fallback', async () => {
  behavior = { kind: 'ok', answers: answersFor('bugfix', 0.3) };
  const name = 'cache';
  mkdirSync(join(dir, name, 'data', 'sessions'), { recursive: true });
  writeFileSync(join(dir, name, 'data', 'sessions', 's1.json'), JSON.stringify({ model: 'claude-opus-5-5', ts: 'x' }));
  const r = await run({ prompt: easy.prompt }, { mode: 'advise', name });
  assert.equal(r.rows[0].sessionModelSource, 'session_start');
  assert.equal(r.rows[0].action, 'delegate');
});

test('a payload model is journalled as source input', async () => {
  behavior = { kind: 'ok', answers: answersFor('bugfix', 0.3) };
  const r = await run(easy, { name: 'source-input' });
  assert.equal(r.rows[0].sessionModelSource, 'input');
});

test('garbage on stdin exits 0 without crashing', async () => {
  const r = await run('not json at all', { mode: 'advise', name: 'garbage' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('an unknown session model is journalled and nothing is delivered', async () => {
  behavior = { kind: 'ok', answers: answersFor('bugfix', 0.3) };
  const r = await run({ ...easy, model: undefined }, { mode: 'advise', name: 'nomodel' });
  assert.equal(r.stdout, '');
  assert.equal(r.rows[0].reason, 'unknown_session_model');
  assert.equal(r.rows[0].sessionModel, null);
  assert.equal(r.rows[0].sessionModelSource, null);
});
