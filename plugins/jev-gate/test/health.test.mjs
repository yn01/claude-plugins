// The SessionStart health hook, end to end against a local stand-in for the API.
// It must write health.json, never the key, and never print anything.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'health.mjs');
let dir, server, port, calls, status;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'jev-gate-health-'));
  calls = 0;
  status = 200;
  server = createServer((req, res) => {
    calls++;
    req.resume();
    req.on('end', () => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: 'jev-1.13.0', answers: { claims_done: { type: 'noul', noul: 0.95 } }, usage: { input_tokens: 9 } }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

function run(name, { key, legacyKey } = {}) {
  const data = join(dir, name, 'data');
  const proj = join(dir, name, 'proj');
  mkdirSync(join(proj, '.jev-gate'), { recursive: true });
  writeFileSync(join(proj, '.jev-gate', 'config.json'), JSON.stringify({ endpoint: `http://127.0.0.1:${port}/v1/systemone`, timeoutMs: 3000 }));
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: data };
  delete env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY;
  delete env.TYPESAFE_API_KEY;
  if (key) env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY = key;
  if (legacyKey) env.TYPESAFE_API_KEY = legacyKey;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HOOK], { env, cwd: proj });
    let stdout = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.stdin.end(JSON.stringify({ session_id: 's1', cwd: proj }));
    child.on('close', (code) => {
      const raw = readFileSync(join(data, 'health.json'), 'utf8');
      resolve({ code, stdout, raw, health: JSON.parse(raw) });
    });
  });
}

test('no key: records keySet false and sends no request', async () => {
  const before = calls;
  const r = await run('nokey');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(calls, before);
  assert.deepEqual([r.health.keySet, r.health.ok, r.health.reason], [false, false, 'no_api_key']);
});

test('TYPESAFE_API_KEY alone is ignored', async () => {
  const before = calls;
  const r = await run('legacy', { legacyKey: 'legacy' });
  assert.equal(calls, before);
  assert.equal(r.health.keySet, false);
});

test('a working key: ok, latency and model recorded, key never written', async () => {
  status = 200;
  const r = await run('good', { key: 'secret-key-value' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.deepEqual([r.health.keySet, r.health.ok, r.health.model], [true, true, 'jev-1.13.0']);
  assert.equal(typeof r.health.latencyMs, 'number');
  assert.ok(!r.raw.includes('secret-key-value'));
});

test('a rejected key: ok false with the http reason', async () => {
  status = 401;
  const r = await run('bad', { key: 'bogus' });
  assert.equal(r.code, 0);
  assert.deepEqual([r.health.keySet, r.health.ok, r.health.reason], [true, false, 'http_401']);
});
