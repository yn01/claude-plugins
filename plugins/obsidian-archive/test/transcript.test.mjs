// What reaches the summarizer, and what counts as something a person typed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digest, toText } from '../lib/transcript.mjs';

const at = (s) => `2026-10-12T00:00:${String(s).padStart(2, '0')}.000Z`;
const user = (s, content, extra = {}) => JSON.stringify({ type: 'user', timestamp: at(s), message: { role: 'user', content }, ...extra });
const asst = (s, content) => JSON.stringify({ type: 'assistant', timestamp: at(s), message: { role: 'assistant', content } });

test('typed prompts count; machine turns, meta and skill bodies do not', () => {
  const items = digest([
    user(1, 'ディレクトリを作って'),
    user(2, '<local-command-stdout>(no content)</local-command-stdout>'),
    user(3, '<command-message>plugin</command-message>\n<command-name>/plugin</command-name>\n<command-args>install x</command-args>'),
    user(4, 'hidden', { isMeta: true }),
    user(5, [{ type: 'text', text: 'Base directory for this skill: /x' }]),
    user(6, [{ type: 'text', text: '画像を見て [Image #2]' }, { type: 'image' }]),
    user(7, [{ type: 'tool_result', content: 'big output' }]),
    user(8, '\n<pasted_content id="a">返答</pasted_content>'),
  ]);
  assert.deepEqual(items.map((d) => [d.kind, d.text]), [
    ['prompt', 'ディレクトリを作って'],
    ['command', '/plugin install x'],
    ['prompt', '画像を見て [Image #2]'],
    ['prompt', '<pasted_content id="a">返答</pasted_content>'],
  ]);
});

test('the agent contributes text and one line per tool call, never thinking', () => {
  const items = digest([asst(1, [
    { type: 'thinking', thinking: 'secret' },
    { type: 'text', text: '作ります。' },
    { type: 'tool_use', name: 'Bash', input: { command: 'ls -la', description: 'List files' } },
    { type: 'tool_use', name: 'Edit', input: { file_path: '/a/b.mjs', old_string: 'x' } },
  ])]);
  assert.deepEqual(items.map((d) => d.text), ['作ります。', 'Bash: List files', 'Edit: /a/b.mjs']);
});

test('broken lines and lines without a timestamp are skipped', () => {
  assert.deepEqual(digest(['{nope', JSON.stringify({ type: 'user', message: { content: 'x' } }), '']), []);
});

test('an over-long record keeps the first prompt and the end', () => {
  const items = [{ kind: 'prompt', text: 'FIRST' }];
  for (let i = 0; i < 200; i++) items.push({ kind: 'reply', text: `r${i} ${'x'.repeat(100)}` });
  items.push({ kind: 'prompt', text: 'LAST' });
  const t = toText(items, 3000);
  assert.ok(t.length <= 3000, String(t.length));
  assert.ok(t.startsWith('[USER] FIRST'));
  assert.ok(t.endsWith('[USER] LAST'));
  assert.match(t, /途中を省略/);
});
