// Config lives outside the plugin directory and survives a bad file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, dataDir, loadConfig, parseValue, setValue } from '../lib/config.mjs';

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'obsidian-archive-cfg-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('no file gives the defaults', () => withDir((dir) => assert.deepEqual(loadConfig(dir).config, DEFAULTS)));

test('a malformed file gives the defaults', () => withDir((dir) => {
  writeFileSync(join(dir, 'config.json'), '{ nope');
  assert.deepEqual(loadConfig(dir).config, DEFAULTS);
}));

test('a value of the wrong type is ignored', () => withDir((dir) => {
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ include_git_diff: 'no', tags: 'a' }));
  assert.equal(loadConfig(dir).config.include_git_diff, true);
  assert.deepEqual(loadConfig(dir).config.tags, DEFAULTS.tags);
}));

test('keys from 1.0 are reported as ignored', () => withDir((dir) => {
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ filename_format: 'x', auto_save_interval_minutes: 30 }));
  assert.deepEqual(loadConfig(dir).ignored, ['filename_format', 'auto_save_interval_minutes']);
}));

test('values are parsed by the type of their default', () => {
  assert.equal(parseValue('include_git_diff', 'false'), false);
  assert.deepEqual(parseValue('tags', '["a", "b c"]'), ['a', 'b c']);
  assert.deepEqual(parseValue('tags', 'a, b'), ['a', 'b']);
  assert.equal(parseValue('vault_path', ' ~/V '), '~/V');
  assert.throws(() => parseValue('include_git_diff', 'yes'));
  assert.throws(() => parseValue('filename_format', 'x'), /unknown key/);
});

test('setting a key keeps the other keys in the file', () => withDir((dir) => {
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ folder: 'F' }));
  const r = setValue(dir, 'include_git_diff', 'false');
  assert.equal(r.before, true);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')), { folder: 'F', include_git_diff: false });
}));

test('an explicit dir wins, and an unsubstituted placeholder does not', () => {
  assert.equal(dataDir('/x'), '/x');
  assert.notEqual(dataDir('${CLAUDE_PLUGIN_DATA}'), '${CLAUDE_PLUGIN_DATA}');
});
