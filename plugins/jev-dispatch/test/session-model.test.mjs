// Where the session model comes from, and which source wins.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveSessionModel, modelFromTranscript, writeCachedModel, readCachedModel, cachePath,
} from '../lib/session-model.mjs';

const START = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'session-start.mjs');
let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'jev-dispatch-sm-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const line = (o) => JSON.stringify(o) + '\n';
const assistant = (model) => line({ type: 'assistant', message: { role: 'assistant', model, content: [] } });
const transcript = (...parts) => {
  const p = join(dir, 't.jsonl');
  writeFileSync(p, parts.join(''));
  return p;
};

test('the payload model wins over everything', () => {
  writeCachedModel(dir, 's', 'claude-haiku-4-5');
  const t = transcript(assistant('claude-sonnet-5-5'));
  assert.deepEqual(
    resolveSessionModel({ model: 'claude-opus-5-5', transcript_path: t, session_id: 's' }, dir),
    { model: 'claude-opus-5-5', source: 'input' },
  );
});

test('an empty payload model falls through to the transcript', () => {
  const t = transcript(assistant('claude-sonnet-5-5'));
  assert.deepEqual(resolveSessionModel({ model: '  ', transcript_path: t }, dir), { model: 'claude-sonnet-5-5', source: 'transcript' });
});

test('the transcript wins over the SessionStart cache (a /model switch)', () => {
  writeCachedModel(dir, 's', 'claude-opus-5-5');
  const t = transcript(assistant('claude-opus-5-5'), assistant('claude-haiku-4-5'));
  assert.deepEqual(resolveSessionModel({ transcript_path: t, session_id: 's' }, dir), { model: 'claude-haiku-4-5', source: 'transcript' });
});

test('the cache answers when the transcript has no assistant line', () => {
  writeCachedModel(dir, 's', 'claude-opus-5-5');
  const t = transcript(line({ type: 'user', message: { role: 'user', content: 'hi' } }));
  assert.deepEqual(resolveSessionModel({ transcript_path: t, session_id: 's' }, dir), { model: 'claude-opus-5-5', source: 'session_start' });
});

test('nothing anywhere resolves to null', () => {
  assert.deepEqual(resolveSessionModel({}, dir), { model: null, source: null });
  assert.deepEqual(resolveSessionModel(undefined, dir), { model: null, source: null });
});

test('the transcript reader takes the newest assistant line, skipping others', () => {
  const t = transcript(
    assistant('claude-sonnet-5-5'),
    assistant('claude-opus-5-5'),
    line({ type: 'user', message: { role: 'user', content: 'x' } }),
    line({ type: 'system', message: { model: 'not-this' } }),
  );
  assert.equal(modelFromTranscript(t), 'claude-opus-5-5');
});

test('a malformed or partial line is skipped, not fatal', () => {
  const t = transcript(assistant('claude-sonnet-5-5'), '{"type":"assistant","message":{"mod\n', 'garbage\n');
  assert.equal(modelFromTranscript(t), 'claude-sonnet-5-5');
});

test('an assistant line without a string model is skipped', () => {
  const t = transcript(assistant('claude-sonnet-5-5'), line({ type: 'assistant', message: { content: [] } }), assistant(''));
  assert.equal(modelFromTranscript(t), 'claude-sonnet-5-5');
});

test('a missing, empty or absent transcript is null', () => {
  assert.equal(modelFromTranscript(join(dir, 'nope.jsonl')), null);
  assert.equal(modelFromTranscript(transcript('')), null);
  assert.equal(modelFromTranscript(undefined), null);
  assert.equal(modelFromTranscript(dir), null, 'a directory is not a transcript');
});

test('only the tail of a large transcript is read', () => {
  const filler = line({ type: 'user', message: { content: 'x'.repeat(1000) } }).repeat(600); // ~600 KB
  const t = transcript(assistant('claude-old-model'), filler, assistant('claude-opus-5-5'));
  assert.equal(modelFromTranscript(t), 'claude-opus-5-5');
  const onlyOld = transcript(assistant('claude-old-model'), filler);
  assert.equal(modelFromTranscript(onlyOld), null, 'an assistant line beyond the tail is not found');
});

test('the cache round-trips and sanitises the session id', () => {
  assert.equal(writeCachedModel(dir, '../../etc/passwd', 'claude-opus-5-5'), true);
  assert.equal(readCachedModel(dir, '../../etc/passwd'), 'claude-opus-5-5');
  assert.equal(dirname(cachePath(dir, '../../etc/passwd')), join(dir, 'sessions'));
  assert.deepEqual(readdirSync(join(dir, 'sessions')), ['.._.._etc_passwd.json']);
});

test('the cache refuses an unusable id or model', () => {
  assert.equal(writeCachedModel(dir, '', 'm'), false);
  assert.equal(writeCachedModel(dir, '..', 'm'), false);
  assert.equal(writeCachedModel(dir, 's', ''), false);
  assert.equal(writeCachedModel(dir, 's', null), false);
  assert.equal(readCachedModel(dir, 'never-written'), null);
});

function startHook(input) {
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: dir };
  return spawnSync('node', [START], { env, input: typeof input === 'string' ? input : JSON.stringify(input) });
}

test('the SessionStart hook writes {model, ts} and prints nothing', () => {
  const r = startHook({ session_id: 'abc', model: 'claude-opus-5-5', hook_event_name: 'SessionStart' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.length, 0);
  const saved = JSON.parse(readFileSync(join(dir, 'sessions', 'abc.json'), 'utf8'));
  assert.equal(saved.model, 'claude-opus-5-5');
  assert.ok(saved.ts);
});

test('the SessionStart hook writes nothing without a model, and survives garbage', () => {
  assert.equal(startHook({ session_id: 'abc' }).status, 0);
  assert.equal(existsSync(join(dir, 'sessions', 'abc.json')), false);
  const g = startHook('not json');
  assert.equal(g.status, 0);
  assert.equal(g.stdout.length, 0);
});
