// Auto-save end to end, with a fake `claude` standing in for the model.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide, childEnv, extractBody, buildPrompt, run } from '../scripts/auto-save.mjs';
import { writeNote } from '../lib/note.mjs';
import { DEFAULTS } from '../lib/config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FAKE = join(HERE, 'fixtures', 'fake-claude.mjs');
const HOOK = join(HERE, '..', 'hooks', 'session-end.mjs');
const SID = 'sess-1';

const line = (iso, content) => JSON.stringify({ type: 'user', timestamp: iso, message: { role: 'user', content } });
const BODY = '## 作業概要\nx\n## 主な変更点\nx\n## 決定事項・学び\nx\n## 未完了・次回への持ち越し\nx\n';

let root, data, vault, transcript, record;
const env0 = { ...process.env };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'oa-auto-'));
  data = join(root, 'data');
  vault = join(root, 'vault');
  transcript = join(root, `${SID}.jsonl`);
  record = join(root, 'record.json');
  execFileSync('mkdir', ['-p', data]);
  writeFileSync(join(data, 'config.json'), JSON.stringify({ vault_path: vault, include_git_diff: false }));
  process.env.OBSIDIAN_ARCHIVE_CLAUDE_BIN = FAKE;
  process.env.FAKE_CLAUDE_RECORD = record;
  delete process.env.FAKE_CLAUDE_MODE;
});

afterEach(() => {
  process.env = { ...env0 };
  rmSync(root, { recursive: true, force: true });
});

const input = () => ({ session_id: SID, transcript_path: transcript, cwd: root, reason: 'prompt_input_exit' });
const logRows = () => readFileSync(join(data, 'auto-save.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const notes = () => (existsSync(join(vault, 'Summaries')) ? readdirSync(join(vault, 'Summaries')).sort() : []);

test('one prompt is enough; none is skipped', () => {
  const p = (s) => ({ ts: new Date(`2026-10-12T00:00:0${s}Z`), kind: 'prompt' });
  assert.equal(decide([p(1)], null).action, 'save');
  assert.deepEqual(decide([{ ts: new Date(), kind: 'command' }], null), { action: 'skipped', reason: 'no_prompts', prompts: 0 });
});

test('only prompts after the earlier note count', () => {
  const prev = { name: 'n', part: 1, savedAt: new Date('2026-10-12T00:00:05Z') };
  const items = [{ ts: new Date('2026-10-12T00:00:04Z'), kind: 'prompt' }, { ts: new Date('2026-10-12T00:00:06Z'), kind: 'reply' }];
  assert.equal(decide(items, prev).reason, 'no_progress_since_note');
  items.push({ ts: new Date('2026-10-12T00:00:07Z'), kind: 'prompt' });
  assert.deepEqual(decide(items, prev).items.map((d) => d.kind), ['reply', 'prompt']);
});

test('a declined API key is removed from the child; an approved or unknown one stays', () => {
  const key = 'sk-ant-' + 'a'.repeat(30) + 'TAIL_OF_KEY_12345678';
  const declined = { customApiKeyResponses: { rejected: [key.slice(-20)] } };
  assert.ok(!('ANTHROPIC_API_KEY' in childEnv({ ANTHROPIC_API_KEY: key }, declined)));
  assert.equal(childEnv({ ANTHROPIC_API_KEY: key }, null).ANTHROPIC_API_KEY, key);
  assert.equal(childEnv({}, declined).OBSIDIAN_ARCHIVE_CHILD, '1');
});

test('preamble before the first heading is dropped', () => {
  assert.ok(extractBody('はい。\n## 作業概要\nx').startsWith('## 作業概要'));
});

test('a continuation prompt names the earlier note', () => {
  assert.match(buildPrompt('rec', { name: '2026-10-12_0255_p' }), /\[\[2026-10-12_0255_p\]\] があります/);
});

test('a session is summarized with hooks, tools and persistence off, and saved as auto part 1', () => {
  writeFileSync(transcript, line('2026-10-12T00:00:01Z', 'やって') + '\n');
  const r = run(input(), { dir: data });
  assert.equal(r.action, 'saved', JSON.stringify(r));
  const rec = JSON.parse(readFileSync(record, 'utf8'));
  for (const flag of ['--no-session-persistence', '--strict-mcp-config', '{"disableAllHooks":true}', 'sonnet']) assert.ok(rec.argv.includes(flag), flag);
  assert.equal(rec.argv[rec.argv.indexOf('--tools') + 1], '');
  assert.equal(rec.child, '1');
  assert.match(rec.stdin, /\[USER\] やって/);
  const note = readFileSync(r.file, 'utf8');
  assert.match(note, /\nsource: "auto"\npart: 1\n/);
  assert.ok(!/以下が要約です/.test(note));
  assert.equal(logRows().at(-1).action, 'saved');
});

test('after a manual note, only later work is saved, as part 2 linked to it', () => {
  const vaultDir = join(vault, 'Summaries');
  const cfg = { ...DEFAULTS, include_git_diff: false };
  const manual = writeNote({ config: cfg, cwd: root, sessionId: SID, body: BODY, source: 'manual', vaultDir, now: new Date('2026-10-12T00:00:05Z') });
  const prevName = manual.split('/').pop().replace('.md', '');

  writeFileSync(transcript, line('2026-10-12T00:00:01Z', '前の作業') + '\n');
  assert.equal(run(input(), { dir: data }).reason, 'no_progress_since_note');

  writeFileSync(transcript, [line('2026-10-12T00:00:01Z', '前の作業'), line('2026-10-12T00:00:09Z', '後の作業')].join('\n'));
  const r = run(input(), { dir: data });
  assert.equal(r.action, 'saved');
  const rec = JSON.parse(readFileSync(record, 'utf8'));
  assert.ok(!rec.stdin.includes('前の作業'), 'work before the manual note is not sent');
  assert.match(rec.stdin, /後の作業/);
  const note = readFileSync(r.file, 'utf8');
  assert.match(note, /\npart: 2\n/);
  assert.match(note, new RegExp(`\\ncontinues: "\\[\\[${prevName}\\]\\]"\\n`));
  assert.match(note, /（続き）/);
  assert.equal(notes().length, 2);
});

test('auto_save false writes nothing but a log row', () => {
  writeFileSync(join(data, 'config.json'), JSON.stringify({ vault_path: vault, auto_save: false }));
  writeFileSync(transcript, line('2026-10-12T00:00:01Z', 'やって'));
  assert.equal(run(input(), { dir: data }).reason, 'disabled');
  assert.deepEqual(notes(), []);
});

test('a failing claude or a body without the headings writes no note', () => {
  writeFileSync(transcript, line('2026-10-12T00:00:01Z', 'やって'));
  process.env.FAKE_CLAUDE_MODE = 'fail';
  const r1 = run(input(), { dir: data });
  assert.equal(r1.reason, 'claude_failed');
  assert.match(logRows().at(-1).detail, /Credit balance/);
  process.env.FAKE_CLAUDE_MODE = 'bad';
  assert.equal(run(input(), { dir: data }).reason, 'missing_sections');
  assert.deepEqual(notes(), []);
});

test('the hook returns at once and the detached child saves the note', async () => {
  writeFileSync(transcript, line('2026-10-12T00:00:01Z', 'やって'));
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: data, CLAUDE_CODE_ENTRYPOINT: 'cli' };
  delete env.OBSIDIAN_ARCHIVE_CHILD;
  const t0 = Date.now();
  execFileSync('node', [HOOK], { input: JSON.stringify(input()), env });
  assert.ok(Date.now() - t0 < 1500, `hook took ${Date.now() - t0} ms`);
  for (let i = 0; i < 100 && notes().length === 0; i++) await new Promise((r) => setTimeout(r, 50));
  assert.equal(notes().length, 1);
});

const settle = () => new Promise((r) => setTimeout(r, 1000)); // a spawned child would have logged by now

test('the hook does nothing inside the summarizing child', async () => {
  writeFileSync(transcript, line('2026-10-12T00:00:01Z', 'やって'));
  execFileSync('node', [HOOK], { input: JSON.stringify(input()), env: { ...process.env, CLAUDE_PLUGIN_DATA: data, CLAUDE_CODE_ENTRYPOINT: 'cli', OBSIDIAN_ARCHIVE_CHILD: '1' } });
  await settle();
  assert.ok(!existsSync(join(data, 'auto-save.jsonl')));
});

test('the hook does nothing for a headless claude -p or SDK run', async () => {
  writeFileSync(transcript, line('2026-10-12T00:00:01Z', 'やって'));
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: data, CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' };
  delete env.OBSIDIAN_ARCHIVE_CHILD;
  execFileSync('node', [HOOK], { input: JSON.stringify(input()), env });
  await settle();
  assert.ok(!existsSync(join(data, 'auto-save.jsonl')));
});
