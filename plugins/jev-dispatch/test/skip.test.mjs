import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skipReason } from '../lib/skip.mjs';

const { skip } = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'config.json'), 'utf8'));

test('empty and whitespace prompts are skipped', () => {
  assert.equal(skipReason('', skip), 'empty');
  assert.equal(skipReason('   \n', skip), 'empty');
  assert.equal(skipReason(undefined, skip), 'empty');
});

test('slash commands are skipped', () => {
  assert.equal(skipReason('/model sonnet please', skip), 'slash_command');
  assert.equal(skipReason('/jev-dispatch:status', skip), 'slash_command');
});

test('a prompt that starts with an absolute path is judged', () => {
  assert.equal(skipReason('/Users/me/app/src/index.ts throws on startup, fix it', skip), null);
});

test('a prompt under minChars is skipped', () => {
  assert.equal(skipReason('ok go', skip), 'too_short');
  assert.equal(skipReason('fix typo in README', skip), null);
});

test('stock replies are matched by pattern, in either language', () => {
  // minChars would catch most of these first; zero it to exercise the patterns.
  const patterns = { ...skip, minChars: 0 };
  assert.equal(skipReason('Thank you!', patterns), 'pattern');
  assert.equal(skipReason('go ahead.', patterns), 'pattern');
  assert.equal(skipReason('お願いします。', patterns), 'pattern');
  assert.equal(skipReason('続けて', patterns), 'pattern');
});

test('a real task that starts with a stock word is judged', () => {
  assert.equal(skipReason('yes, and also rename the config loader', skip), null);
});

test('a malformed pattern is ignored rather than thrown', () => {
  assert.equal(skipReason('refactor the parser', { skipPatterns: ['('] }), null);
});

test('minChars counts the trimmed prompt', () => {
  assert.equal(skipReason('   abc   ', { minChars: 6 }), 'too_short');
});
