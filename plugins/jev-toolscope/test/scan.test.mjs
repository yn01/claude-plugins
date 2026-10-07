// The scanner: config discovery, env expansion, and a real stdio round trip
// against a fake MCP server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverServers, expandEnv, probeStdio } from '../scripts/scan.mjs';

const FAKE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-mcp.mjs');

test('expandEnv handles ${VAR} and ${VAR:-default}', () => {
  const env = { A: 'x' };
  assert.equal(expandEnv('${A}/${B:-y}/${C}', env), 'x/y/');
  assert.equal(expandEnv(3, env), 3);
});

test('discoverServers: local beats project beats user', () => {
  const claudeJson = {
    mcpServers: { a: { command: 'user-a' }, b: { command: 'user-b' } },
    projects: { '/p': { mcpServers: { b: { command: 'local-b' } } } },
  };
  const mcpJson = { mcpServers: { a: { command: 'project-a' }, c: { type: 'http', url: 'https://x' } } };
  const s = Object.fromEntries(discoverServers('/p', { claudeJson, mcpJson }).map((x) => [x.name, x]));
  assert.deepEqual([s.a.scope, s.a.config.command], ['project', 'project-a']);
  assert.deepEqual([s.b.scope, s.b.config.command], ['local', 'local-b']);
  assert.equal(s.c.config.type, 'http');
  assert.deepEqual(discoverServers('/other', { claudeJson, mcpJson: null }).map((x) => x.name).sort(), ['a', 'b']);
});

test('probeStdio: initialize, paged tools/list, stdout noise ignored', async () => {
  const r = await probeStdio({ command: process.execPath, args: [FAKE], env: { FAKE_LABEL: '${HOME_NOT_SET:-demo}' } }, { timeoutMs: 5000 });
  assert.equal(r.status, 'ok');
  assert.equal(r.instructions, 'Fake server for demo');
  assert.deepEqual(r.tools, [
    { name: 'alpha', description: 'First tool' },
    { name: 'beta', description: 'Second tool' },
    { name: 'gamma', description: '' },
  ]);
});

test('probeStdio: a crash, a hang and a missing command are errors, not throws', async () => {
  const crash = await probeStdio({ command: process.execPath, args: [FAKE], env: { FAKE_MCP_MODE: 'crash' } }, { timeoutMs: 5000 });
  assert.equal(crash.status, 'error');
  assert.match(crash.error, /exited \(3\)/);

  const hang = await probeStdio({ command: process.execPath, args: [FAKE], env: { FAKE_MCP_MODE: 'hang' } }, { timeoutMs: 300 });
  assert.deepEqual(hang, { status: 'error', error: 'timeout' });

  const missing = await probeStdio({ command: 'definitely-not-a-command-jts' }, { timeoutMs: 2000 });
  assert.equal(missing.status, 'error');
  assert.match(missing.error, /spawn/);
});
