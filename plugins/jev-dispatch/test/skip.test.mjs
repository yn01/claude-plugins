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

const prefixes = skip.systemPrefixes;

test('every default prefix marks a system message', () => {
  assert.equal(prefixes.length, 6);
  for (const p of prefixes) {
    assert.equal(skipReason(`${p}>body that is long enough</x>`, skip), 'system_message', p);
  }
});

test('real shapes: agent hand-back and task notification', () => {
  assert.equal(skipReason('<agent-message from="a8595c5e">\n[Subagent hand-back] done', skip), 'system_message');
  assert.equal(skipReason('<task-notification>\n<task-id>b19</task-id>', skip), 'system_message');
});

test('leading whitespace does not hide a system message', () => {
  assert.equal(skipReason('  \n<task-notification>\n<task-id>x</task-id>', skip), 'system_message');
});

test('a prompt that merely mentions a tag later is judged', () => {
  assert.equal(skipReason('Why does the <agent-message from="x"> tag show up in my logs?', skip), null);
});

test('prefix matching is case-sensitive', () => {
  assert.equal(skipReason('<Task-Notification> is not the real tag, fix the parser', skip), null);
});

test('an empty systemPrefixes array disables the rule', () => {
  assert.equal(skipReason('<task-notification>\n<task-id>x</task-id>', { ...skip, systemPrefixes: [] }), null);
  assert.equal(skipReason('<task-notification>\n<task-id>x</task-id>', { minChars: 0 }), null);
});

test('a custom prefix is honoured, and an empty string prefix matches nothing', () => {
  assert.equal(skipReason('[bot] build finished with warnings', { systemPrefixes: ['[bot]'] }), 'system_message');
  assert.equal(skipReason('fix the parser please', { systemPrefixes: [''] }), null);
});
