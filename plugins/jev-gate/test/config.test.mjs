// What `mode` alone cannot say — whether the gate will stop your work — and
// which config files actually took effect.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deliveryOf, loadConfig } from '../lib/config.mjs';

const cfg = (mode, budget) => ({ mode, gates: budget === undefined ? {} : { completion: { maxBlocksPerSession: budget } } });

test('shadow records and shows nothing', () => assert.equal(deliveryOf(cfg('shadow')).kind, 'shadow'));
test('off is off', () => assert.equal(deliveryOf(cfg('off')).kind, 'off'));
test('enforce with a zero budget is advisory', () => assert.equal(deliveryOf(cfg('enforce', 0)).kind, 'advisory'));
test('enforce with the default budget blocks', () => {
  const d = deliveryOf(cfg('enforce'));
  assert.equal(d.kind, 'enforce');
  assert.match(d.summary, /at most 2 time\(s\)/);
});
test('a budget of 0 under shadow is still shadow, not advisory', () => {
  assert.equal(deliveryOf(cfg('shadow', 0)).kind, 'shadow');
});

test('a project config is listed when it is read, and absent when it is not', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-gate-cfg-'));
  try {
    const project = join(dir, '.jev-gate', 'config.json');
    assert.ok(!loadConfig(dir).sources.includes(project), 'not listed before it exists');

    mkdirSync(join(dir, '.jev-gate'));
    writeFileSync(project, JSON.stringify({ mode: 'enforce', gates: { completion: { maxBlocksPerSession: 0 } } }));
    const c = loadConfig(dir);
    assert.ok(c.sources.includes(project), 'listed once it is read');
    assert.equal(deliveryOf(c).kind, 'advisory');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a malformed project config is not listed — it did not take effect', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-gate-cfg-'));
  try {
    mkdirSync(join(dir, '.jev-gate'));
    writeFileSync(join(dir, '.jev-gate', 'config.json'), '{ "mode": "enforce", ');
    const c = loadConfig(dir);
    assert.ok(!c.sources.some((s) => s.startsWith(dir)));
    assert.equal(deliveryOf(c).kind, 'shadow', 'falls back to the default');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
