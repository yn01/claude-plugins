// The catalog: tool-name parsing, the transcript reader, and the merge.
//
// The transcript fixture mirrors the shape of a real `deferred_tools_delta`
// row. That shape is Claude Code's internal storage, not a documented
// interface; if Claude Code changes it, these tests keep passing while real
// sessions fall back to scan-only — doctor and status report that.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, copyFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitToolName, normalizeServer, fullName, readTranscript, mergeCatalog, applyTranscriptRow, applyMessageRow } from '../lib/catalog.mjs';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'transcript.jsonl');

test('splitToolName splits on the first double underscore after mcp__', () => {
  assert.deepEqual(splitToolName('mcp__github__create_issue'), { server: 'github', tool: 'create_issue' });
  assert.deepEqual(splitToolName('mcp__claude_ai_Gmail__search__threads'), { server: 'claude_ai_Gmail', tool: 'search__threads' });
  assert.equal(splitToolName('WebFetch'), null);
  assert.equal(splitToolName('mcp__github'), null);
  assert.equal(splitToolName('mcp__github__'), null);
});

test('server names are normalized the way Claude Code prefixes tools', () => {
  assert.equal(normalizeServer('claude.ai Gmail'), 'claude_ai_Gmail');
  assert.equal(fullName('brave-search', 'web'), 'mcp__brave-search__web');
});

test('the transcript yields live MCP names, removals applied, built-ins ignored', () => {
  const c = readTranscript(FIXTURE, null);
  assert.equal(c.sawDelta, true);
  assert.deepEqual(c.live.sort(), ['mcp__claude_ai_Gmail__search', 'mcp__github__create_issue', 'mcp__github__list_pull_requests']);
  assert.ok(c.offset > 0);
});

test('reading resumes from the cursor and only consumes whole lines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jts-cat-'));
  const path = join(dir, 't.jsonl');
  copyFileSync(FIXTURE, path);
  const first = readTranscript(path, null);

  const row = JSON.stringify({ type: 'attachment', attachment: { type: 'deferred_tools_delta', addedNames: ['mcp__slack__post'] } });
  appendFileSync(path, row.slice(0, 20)); // half a line, still being written
  const second = readTranscript(path, first);
  assert.equal(second.offset, first.offset);
  assert.ok(!second.live.includes('mcp__slack__post'));

  appendFileSync(path, row.slice(20) + '\n');
  const third = readTranscript(path, second);
  assert.ok(third.live.includes('mcp__slack__post'));
  assert.ok(third.live.includes('mcp__github__create_issue'), 'earlier names are kept from the cursor');
});

test('a transcript shorter than the cursor is read again from the start', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jts-cat-'));
  const path = join(dir, 't.jsonl');
  copyFileSync(FIXTURE, path);
  const first = readTranscript(path, null);
  writeFileSync(path, JSON.stringify({ attachment: { type: 'deferred_tools_delta', addedNames: ['mcp__x__y'] } }) + '\n');
  const again = readTranscript(path, first);
  assert.deepEqual(again.live, ['mcp__x__y']);
});

test('a missing transcript keeps the old cursor; no record means sawDelta false', () => {
  const kept = { path: '/nope', offset: 5, live: ['mcp__a__b'], sawDelta: true };
  assert.equal(readTranscript('/definitely/not/here.jsonl', kept), kept);
  assert.equal(readTranscript(undefined, null), null);

  const dir = mkdtempSync(join(tmpdir(), 'jts-cat-'));
  const path = join(dir, 'plain.jsonl');
  writeFileSync(path, JSON.stringify({ type: 'user', message: { content: 'hi' } }) + '\nnot json\n');
  const c = readTranscript(path, null);
  assert.equal(c.sawDelta, false);
  assert.deepEqual(c.live, []);
});

test('applyTranscriptRow treats readdedNames as added and ignores other rows', () => {
  const live = new Set();
  assert.equal(applyTranscriptRow({ attachment: { type: 'something_else', addedNames: ['mcp__a__b'] } }, live), false);
  assert.equal(applyTranscriptRow({ attachment: { type: 'deferred_tools_delta', readdedNames: ['mcp__a__b'] } }, live), true);
  assert.deepEqual([...live], ['mcp__a__b']);
});

test('the agent\'s last reply: joined within a turn, kept across tool results, cleared by a user message', () => {
  const st = { lastAssistant: '' };
  const say = (text) => applyMessageRow({ type: 'assistant', message: { content: [{ type: 'text', text }] } }, st);
  say('Looking.');
  applyMessageRow({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'a', content: 'x' }] } }, st);
  say('Close the tab?');
  assert.equal(st.lastAssistant, 'Looking.\nClose the tab?');
  applyMessageRow({ type: 'assistant', isSidechain: true, message: { content: [{ type: 'text', text: 'sub' }] } }, st);
  assert.equal(st.lastAssistant, 'Looking.\nClose the tab?', 'sidechain rows are ignored');
  applyMessageRow({ type: 'user', message: { content: 'next request' } }, st);
  assert.equal(st.lastAssistant, '');
  say('x'.repeat(3000));
  assert.equal(st.lastAssistant.length, 2000, 'only the tail is kept');
});

test('readTranscript carries the last reply in the cursor across reads', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jts-cat-'));
  const path = join(dir, 't.jsonl');
  writeFileSync(path, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Shall I?' }] } }) + '\n');
  const first = readTranscript(path, null);
  assert.equal(first.lastAssistant, 'Shall I?');
  appendFileSync(path, JSON.stringify({ type: 'attachment', attachment: { type: 'deferred_tools_delta', addedNames: ['mcp__a__b'] } }) + '\n');
  const second = readTranscript(path, first);
  assert.equal(second.lastAssistant, 'Shall I?');
  assert.deepEqual(second.live, ['mcp__a__b']);
});

const catalog = {
  servers: {
    github: { instructions: 'GitHub API', tools: [{ name: 'create_issue', description: 'Create an issue' }, { name: 'list_pull_requests', description: 'List PRs' }] },
    'my db': { projects: ['/proj/a'], tools: [{ name: 'query', description: 'Run SQL' }] },
    other: { projects: ['/proj/b'], tools: [{ name: 'x', description: 'X' }] },
  },
};

test('with a live set: live names win, scanned descriptions attach, unscanned are name-only', () => {
  const m = mergeCatalog(catalog, ['mcp__github__create_issue', 'mcp__claude_ai_Gmail__search'], '/proj/a');
  assert.equal(m.source, 'scan+transcript');
  assert.deepEqual(m.tools.map((t) => t.name), ['mcp__claude_ai_Gmail__search', 'mcp__github__create_issue']);
  assert.equal(m.tools[1].description, 'Create an issue');
  assert.equal(m.tools[0].description, '');
  assert.deepEqual(Object.keys(m.servers), ['github'], 'servers with no live tool are dropped from the state');
});

test('with a live set the scan does not describe: transcript-only', () => {
  const m = mergeCatalog(null, ['mcp__a__b'], '/x');
  assert.equal(m.source, 'transcript-only');
  assert.deepEqual(m.tools, [{ name: 'mcp__a__b', server: 'a', tool: 'b', description: '' }]);
});

test('without a live set: the scan for this project, normalized names', () => {
  const m = mergeCatalog(catalog, [], '/proj/a');
  assert.equal(m.source, 'scan-only');
  assert.deepEqual(m.tools.map((t) => t.name), ['mcp__github__create_issue', 'mcp__github__list_pull_requests', 'mcp__my_db__query']);
  assert.equal(mergeCatalog(null, [], '/x').source, 'none');
});
