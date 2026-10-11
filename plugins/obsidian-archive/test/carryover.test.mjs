// Which open items reach a new session, and when nothing should.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openItems, section, listNotes, findCarryOver, render } from '../lib/carryover.mjs';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'session-start.mjs');
const NOW = new Date('2026-10-12T12:00:00Z');

function note({ project = 'proj', savedAt, carry, legacy = false }) {
  const d = new Date(savedAt);
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fm = [`date: "${date}"`, `time: "${time}"`, legacy ? null : `saved_at: "${d.toISOString()}"`, `project: "${project}"`].filter(Boolean);
  const text = `---\n${fm.join('\n')}\n---\n\n# t\n\n## 作業概要\nx\n\n## 未完了・次回への持ち越し\n${carry}\n\n## git の変更\n- [ ] not a carry-over\n`;
  return { name: `${date}_${time.replace(':', '')}_${project}`, text };
}

let root, vault, data;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'oa-carry-'));
  vault = join(root, 'vault', 'Summaries');
  data = join(root, 'data');
  mkdirSync(vault, { recursive: true });
  mkdirSync(data);
  writeFileSync(join(data, 'config.json'), JSON.stringify({ vault_path: join(root, 'vault') }));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (n) => writeFileSync(join(vault, `${n.name}.md`), n.text);

test('only unchecked items of the carry-over section count', () => {
  const { text } = note({ savedAt: NOW, carry: '- [ ] open one\n- [x] done\n- （なし）\n  - [ ] nested open\n- [ ] ' });
  assert.deepEqual(openItems(text), ['- [ ] open one', '- [ ] nested open']);
  assert.ok(!section(text, '未完了・次回への持ち越し').includes('not a carry-over'));
});

test('a newer note without open items does not hide an older one that has them', () => {
  put(note({ savedAt: '2026-10-12T09:00:00Z', carry: '- [ ] real work' }));
  put(note({ savedAt: '2026-10-12T10:00:00Z', carry: '- （なし）' }));
  const found = findCarryOver(vault, 'proj', NOW);
  assert.deepEqual(found.items, ['- [ ] real work']);
});

test('the newest note with open items wins', () => {
  put(note({ savedAt: '2026-10-11T09:00:00Z', carry: '- [ ] old' }));
  put(note({ savedAt: '2026-10-12T09:00:00Z', carry: '- [ ] new' }));
  assert.deepEqual(findCarryOver(vault, 'proj', NOW).items, ['- [ ] new']);
});

test('notes older than 14 days are ignored', () => {
  put(note({ savedAt: '2026-09-27T11:00:00Z', carry: '- [ ] too old' }));
  assert.equal(findCarryOver(vault, 'proj', NOW), null);
  put(note({ savedAt: '2026-09-29T11:00:00Z', carry: '- [ ] in range' }));
  assert.deepEqual(findCarryOver(vault, 'proj', NOW).items, ['- [ ] in range']);
});

test('other projects, including a name that only starts the same, are not read', () => {
  put(note({ project: 'proj-two', savedAt: '2026-10-12T09:00:00Z', carry: '- [ ] other' }));
  assert.equal(findCarryOver(vault, 'proj', NOW), null);
  assert.deepEqual(listNotes(vault, 'proj'), []);
});

test('a 1.1.0 note without saved_at is dated by its date and time', () => {
  put(note({ savedAt: '2026-10-12T09:00:00Z', carry: '- [ ] legacy', legacy: true }));
  assert.deepEqual(findCarryOver(vault, 'proj', NOW).items, ['- [ ] legacy']);
});

test('the context names the source note and says it is information, not an order', () => {
  const { context, message } = render({ name: 'n1', date: '2026-10-12', time: '02:55', items: ['- [ ] a', '- [ ] b'] });
  assert.match(context, /\[\[n1\]\]/);
  assert.match(context, /関係するときだけ/);
  assert.match(message, /2 件/);
});

function hook(input, env = {}) {
  const out = execFileSync('node', [HOOK], {
    input: JSON.stringify({ cwd: join(root, 'proj'), ...input }),
    env: { ...process.env, CLAUDE_PLUGIN_DATA: data, OBSIDIAN_ARCHIVE_CHILD: '', ...env },
    encoding: 'utf8',
  });
  return out ? JSON.parse(out) : null;
}

test('the hook hands the items over on startup and after /clear', () => {
  mkdirSync(join(root, 'proj'));
  put(note({ savedAt: new Date(), carry: '- [ ] from hook' }));
  for (const source of ['startup', 'clear']) {
    const out = hook({ source });
    assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.match(out.hookSpecificOutput.additionalContext, /- \[ \] from hook/);
    assert.match(out.systemMessage, /1 件/);
  }
});

test('the hook stays silent on resume, on compact, when off, and with nothing open', () => {
  mkdirSync(join(root, 'proj'));
  put(note({ savedAt: new Date(), carry: '- [ ] x' }));
  assert.equal(hook({ source: 'resume' }), null);
  assert.equal(hook({ source: 'compact' }), null);
  writeFileSync(join(data, 'config.json'), JSON.stringify({ vault_path: join(root, 'vault'), carry_over: false }));
  assert.equal(hook({ source: 'startup' }), null);
  writeFileSync(join(data, 'config.json'), JSON.stringify({ vault_path: join(root, 'vault') }));
  rmSync(vault, { recursive: true });
  assert.equal(hook({ source: 'startup' }), null);
});
