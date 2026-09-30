// The wiring around the contract: edit counting, the agent-type exclusion, its
// per-project override, and how stats counts a skip. Runs the real hook and
// stats scripts as subprocesses against a throwaway data dir, with no API key,
// so nothing leaves the machine.
//
//   node --test plugins/jev-gate/test/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { readTranscript } from '../lib/facts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(ROOT, 'hooks', 'gates', 'completion.mjs');
const STATS = join(ROOT, 'scripts', 'stats.mjs');

const toolUse = (name, input = {}) => ({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', id: `t-${Math.random()}`, name, input }] },
});
const say = (text) => ({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const jsonl = (entries) => entries.map((e) => JSON.stringify(e)).join('\n') + '\n';

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'jev-gate-test-'));
  const data = join(dir, 'data');
  const project = join(dir, 'project');
  mkdirSync(data);
  mkdirSync(project);
  const parent = join(dir, 'session.jsonl');
  writeFileSync(parent, jsonl([say('parent')]));
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: data, JEV_GATE_JOURNAL: join(data, 'journal.jsonl') };
  delete env.TYPESAFE_API_KEY;
  delete env.JEV_GATE_MODE;
  delete env.JEV_GATE_DISABLE;
  return { dir, data, project, parent, env, journal: env.JEV_GATE_JOURNAL };
}

function subagentStop(sb, agentType, entries) {
  const agentId = `a${Math.floor(Math.random() * 1e9)}`;
  const subDir = join(sb.dir, 'session', 'subagents');
  mkdirSync(subDir, { recursive: true });
  writeFileSync(join(subDir, `agent-${agentId}.jsonl`), jsonl(entries));
  const input = {
    hook_event_name: 'SubagentStop',
    session_id: 's1',
    cwd: sb.project,
    transcript_path: sb.parent,
    agent_id: agentId,
    agent_type: agentType,
    last_assistant_message: '設計が完了しました。',
  };
  const r = spawnSync('node', [HOOK], { input: JSON.stringify(input), env: sb.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

const rowsOf = (sb) =>
  existsSync(sb.journal)
    ? readFileSync(sb.journal, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    : [];

test('facts count file edits separately from commands', () => {
  const sb = sandbox();
  const t = join(sb.dir, 't.jsonl');
  writeFileSync(t, jsonl([
    toolUse('Read', { file_path: 'a' }),
    toolUse('Edit', { file_path: 'a' }),
    toolUse('Write', { file_path: 'b' }),
    toolUse('NotebookEdit', { notebook_path: 'c' }),
    toolUse('Bash', { command: 'git status' }),
    say('done'),
  ]));
  const f = readTranscript(t);
  assert.equal(f.editCount, 3);
  assert.equal(f.commands.length, 0);
  assert.equal(f.sawAnyCommand, true);
});

test('an excluded agent type is skipped without a verdict', () => {
  const sb = sandbox();
  subagentStop(sb, 'Plan', [toolUse('Bash', { command: 'ls' }), say('設計が完了しました。')]);
  const rows = rowsOf(sb);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].skip, 'excluded_agent_type');
  assert.equal(rows[0].agentType, 'Plan');
  assert.equal('verdict' in rows[0], false);
});

test('an agent type not in the list is judged as before', () => {
  const sb = sandbox();
  subagentStop(sb, 'doc-manager', [toolUse('Edit', { file_path: 'x' }), say('done')]);
  const rows = rowsOf(sb);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].skip, undefined);
  // no key in the test env, so the judge fails open — but it was asked
  assert.equal(rows[0].reason, 'no_api_key');
});

test('a project config replaces the exclusion list', () => {
  const sb = sandbox();
  mkdirSync(join(sb.project, '.jev-gate'));
  writeFileSync(
    join(sb.project, '.jev-gate', 'config.json'),
    JSON.stringify({ gates: { completion: { excludeAgentTypes: ['general-purpose'] } } }),
  );
  subagentStop(sb, 'Plan', [say('done')]);
  subagentStop(sb, 'general-purpose', [say('done')]);
  const rows = rowsOf(sb);
  assert.equal(rows[0].skip, undefined, 'Plan is no longer excluded once the list is replaced');
  assert.equal(rows[1].skip, 'excluded_agent_type');
});

test('stats counts skips apart and keeps them out of decided totals', () => {
  const sb = sandbox();
  const row = (o) => ({ ts: '2026-09-30T00:00:00Z', gate: 'completion', mode: 'shadow', ...o });
  writeFileSync(sb.journal, jsonl([
    row({ skip: 'excluded_agent_type', decidedBy: 'code', agentType: 'Plan' }),
    row({ skip: 'excluded_agent_type', decidedBy: 'code', agentType: 'Explore' }),
    row({ contract: 'completion@3', verdict: 'pass', decidedBy: 'jev', reason: 'waiting_on_someone', deciding: 'blocked_on_user', confidence: 0.9, claimsDone: 0.1, claimsVerified: 0.1, blockedOnUser: 0.9 }),
  ]));
  const out = execFileSync('node', [STATS, 'completion'], { env: sb.env, cwd: sb.project, encoding: 'utf8' });
  assert.match(out, /skipped:\s+2\s+\(not judged; Plan=1, Explore=1\)/);
  assert.match(out, /completion@3\s+—\s+1 entries/);
  assert.match(out, /blocked_on_user decided\s+1 \/ 30/);
  assert.doesNotMatch(out, /before contracts were recorded/);
});
