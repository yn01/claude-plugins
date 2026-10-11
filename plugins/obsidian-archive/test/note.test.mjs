// The parts of a note a later reader matches on: headings, frontmatter, path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECTIONS, missingSections, buildMeta, frontmatter, notePath, projectName, gitSection } from '../lib/note.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'write-note.mjs');
const fullBody = SECTIONS.map((h) => `## ${h}\n（なし）\n`).join('\n');

function tmp() {
  return mkdtempSync(join(tmpdir(), 'obsidian-archive-'));
}

function gitRepo() {
  const dir = tmp();
  const run = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
  run('init', '-q', '-b', 'main');
  run('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  return dir;
}

test('a body with all four headings is complete', () => assert.deepEqual(missingSections(fullBody), []));

test('a missing or renamed heading is reported', () => {
  const body = fullBody.replace('## 決定事項・学び', '## 決定事項');
  assert.deepEqual(missingSections(body), ['決定事項・学び']);
});

test('a heading inside a line does not count', () => {
  assert.deepEqual(missingSections(`text ## 作業概要\n## 主な変更点\n## 決定事項・学び\n## 未完了・次回への持ち越し`), ['作業概要']);
});

test('the project is the git root, not the subdirectory', () => {
  const repo = gitRepo();
  try {
    mkdirSync(join(repo, 'plugins', 'x'), { recursive: true });
    assert.equal(projectName(join(repo, 'plugins', 'x')), projectName(repo));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('git paths are relative to the root, not the subdirectory', () => {
  const repo = gitRepo();
  try {
    mkdirSync(join(repo, 'sub'));
    writeFileSync(join(repo, 'top.txt'), '');
    const section = gitSection(join(repo, 'sub'));
    assert.match(section, /\?\? top\.txt/);
    assert.doesNotMatch(section, /\.\.\//);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('outside git the project is the directory name, and there is no branch or git section', () => {
  const dir = tmp();
  try {
    const sub = join(dir, 'plain-folder');
    mkdirSync(sub);
    const meta = buildMeta({ cwd: sub, now: new Date(2026, 9, 12, 9, 5), tags: [] });
    assert.equal(meta.project, 'plain-folder');
    assert.equal(meta.date, '2026-10-12');
    assert.equal(meta.time, '09:05');
    assert.ok(!('branch' in meta));
    assert.equal(gitSection(sub), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an unsubstituted session placeholder is dropped', () => {
  const meta = buildMeta({ cwd: tmpdir(), sessionId: '${CLAUDE_SESSION_ID}', tags: [] });
  assert.ok(!('session_id' in meta));
});

test('frontmatter quotes values so odd names cannot break the YAML', () => {
  const fm = frontmatter({ project: 'a: b #c', tags: ['x', 'y z'] });
  assert.equal(fm, '---\nproject: "a: b #c"\ntags: ["x", "y z"]\n---\n');
});

test('a taken file name gets _2', () => {
  const dir = tmp();
  try {
    const meta = { date: '2026-10-12', time: '21:40', project: 'p' };
    writeFileSync(notePath(dir, meta), '');
    assert.equal(notePath(dir, meta), join(dir, '2026-10-12_2140_p_2.md'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the script writes a note under the configured vault and prints its path', () => {
  const repo = gitRepo();
  const data = tmp();
  const vault = tmp();
  try {
    writeFileSync(join(data, 'config.json'), JSON.stringify({ vault_path: vault, folder: 'S' }));
    const out = execFileSync('node', [SCRIPT, '--session', 'abc-123', '--data', data, '--cwd', repo], { input: fullBody, encoding: 'utf8' }).trim();
    assert.ok(out.startsWith(join(vault, 'S') + '/'), out);
    const note = readFileSync(out, 'utf8');
    assert.match(note, /^---\ndate: "\d{4}-\d{2}-\d{2}"\n/);
    assert.match(note, /\nsession_id: "abc-123"\n/);
    assert.match(note, /\nbranch: "main"\n/);
    assert.match(note, /\n## 未完了・次回への持ち越し\n/);
    assert.match(note, /\n## git の変更\n/);
  } finally {
    for (const d of [repo, data, vault]) rmSync(d, { recursive: true, force: true });
  }
});

test('the script refuses a body without the headings and writes nothing', () => {
  const data = tmp();
  const vault = tmp();
  try {
    writeFileSync(join(data, 'config.json'), JSON.stringify({ vault_path: vault }));
    assert.throws(() => execFileSync('node', [SCRIPT, '--data', data], { input: '## 作業概要\nx', stdio: 'pipe' }));
    assert.throws(() => readFileSync(join(vault, 'Summaries'), 'utf8'), /ENOENT/);
  } finally {
    for (const d of [data, vault]) rmSync(d, { recursive: true, force: true });
  }
});
