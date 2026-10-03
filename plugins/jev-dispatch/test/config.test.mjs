// Which config files took effect, in which order, and where data lives.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, dataDir, merge } from '../lib/config.mjs';

let dir, saved;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'jev-dispatch-cfg-'));
  saved = { data: process.env.CLAUDE_PLUGIN_DATA, mode: process.env.JEV_DISPATCH_MODE, key: process.env.TYPESAFE_API_KEY };
  process.env.CLAUDE_PLUGIN_DATA = join(dir, 'data');
  delete process.env.JEV_DISPATCH_MODE;
  delete process.env.TYPESAFE_API_KEY;
});
afterEach(() => {
  for (const [k, v] of [['CLAUDE_PLUGIN_DATA', saved.data], ['JEV_DISPATCH_MODE', saved.mode], ['TYPESAFE_API_KEY', saved.key]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  rmSync(dir, { recursive: true, force: true });
});

const write = (path, obj) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(obj));
};

test('defaults: shadow mode, Jev endpoint, built-in tiers', () => {
  const c = loadConfig(join(dir, 'proj'));
  assert.equal(c.mode, 'shadow');
  assert.equal(c.model, 'jev-1.13.0');
  assert.equal(c.tiers.deep.agent, 'jev-dispatch:deep');
  assert.equal(c.tiers.gemini.enabled, false);
  assert.equal(c.journalPath, join(dir, 'data', 'journal.jsonl'));
});

test('CLAUDE_PLUGIN_DATA decides where data lives', () => {
  assert.equal(dataDir(), join(dir, 'data'));
});

test('a project config overrides the default, deeply', () => {
  const project = join(dir, 'proj', '.jev-dispatch', 'config.json');
  assert.ok(!loadConfig(join(dir, 'proj')).sources.includes(project), 'not listed before it exists');
  write(project, { mode: 'advise', policy: { gainBump: 1.9 }, tiers: { standard: { model: 'opus' } } });
  const c = loadConfig(join(dir, 'proj'));
  assert.ok(c.sources.includes(project));
  assert.equal(c.mode, 'advise');
  assert.equal(c.policy.gainBump, 1.9);
  assert.deepEqual(c.policy.minConfidence, { taskKind: 0.6, difficulty: 0.5, strongerGain: 0.6 }, 'sibling keys survive');
  assert.equal(c.tiers.standard.model, 'opus');
  assert.equal(c.tiers.standard.agent, 'jev-dispatch:standard', 'sibling keys survive');
});

test('layers apply in order: default, user data, project, env', () => {
  write(join(dir, 'data', 'config.json'), { mode: 'advise', timeoutMs: 111 });
  write(join(dir, 'proj', '.jev-dispatch', 'config.json'), { timeoutMs: 222 });
  let c = loadConfig(join(dir, 'proj'));
  assert.equal(c.mode, 'advise');
  assert.equal(c.timeoutMs, 222);

  process.env.JEV_DISPATCH_MODE = 'off';
  c = loadConfig(join(dir, 'proj'));
  assert.equal(c.mode, 'off');
  assert.ok(c.sources.includes('env JEV_DISPATCH_MODE'));
});

test('a malformed config file is skipped, not fatal', () => {
  mkdirSync(join(dir, 'proj', '.jev-dispatch'), { recursive: true });
  writeFileSync(join(dir, 'proj', '.jev-dispatch', 'config.json'), '{ not json');
  assert.equal(loadConfig(join(dir, 'proj')).mode, 'shadow');
});

test('the API key comes from the environment only', () => {
  assert.equal(loadConfig(dir).apiKey, '');
  process.env.TYPESAFE_API_KEY = 'k';
  assert.equal(loadConfig(dir).apiKey, 'k');
});

test('merge replaces arrays and ignores a non-object overlay', () => {
  assert.deepEqual(merge({ a: [1, 2] }, { a: [3] }), { a: [3] });
  assert.deepEqual(merge({ a: 1 }, null), { a: 1 });
});
