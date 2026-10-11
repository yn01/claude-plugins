#!/usr/bin/env node
// Summarize a finished session and save it. Started detached by
// hooks/session-end.mjs with the SessionEnd input as its argument (or on stdin); nobody waits for it,
// so every outcome goes to <data dir>/auto-save.jsonl.

import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dataDir, expandHome, loadConfig } from '../lib/config.mjs';
import { SECTIONS, missingSections, latestNoteFor, writeNote } from '../lib/note.mjs';
import { readDigest, toText } from '../lib/transcript.mjs';

export const MIN_PROMPTS = 1;
const TIMEOUT_MS = 180_000;

/** Save or skip, from the session's items and its latest earlier note. */
export function decide(items, prev) {
  const since = prev?.savedAt ?? null;
  const fresh = since ? items.filter((d) => d.ts > since) : items;
  const prompts = fresh.filter((d) => d.kind === 'prompt').length;
  if (prompts < MIN_PROMPTS) {
    return { action: 'skipped', reason: prev ? 'no_progress_since_note' : 'no_prompts', prompts };
  }
  return { action: 'save', items: fresh, prompts };
}

export function buildPrompt(text, prev) {
  const scope = prev
    ? `このセッションには既に要約ノート [[${prev.name}]] があります。下の記録はその後の部分だけです。その部分だけを要約してください。`
    : '下の記録はセッション全体です。';
  return `あなたは Claude Code のセッション記録を要約します。${scope}

次の 4 つの見出しだけを、この順で、この文字のまま出力してください。前置きや後書き、コードフェンスは付けないでください。

## ${SECTIONS[0]}
1〜3 段落。何を頼まれ、何を達成し、何が終わらなかったか。
## ${SECTIONS[1]}
- ファイル名を含めた具体的な変更（作成・編集・削除・設定）。
## ${SECTIONS[2]}
- 採った設計とその理由、ユーザーからの重要なフィードバック、見つけた問題と解決。
## ${SECTIONS[3]}
- [ ] 次に手を付ける具体的な作業（1 行で、対象がわかる形）

書くことがない節には「（なし）」と書きます。記録にないことは書かないでください。

<session-record>
${text}
</session-record>`;
}

/** The model's answer from the first heading on; anything before it is preamble. */
export function extractBody(out) {
  const i = out.indexOf(`## ${SECTIONS[0]}`);
  return i === -1 ? out : out.slice(i);
}

/**
 * The child's environment. `claude -p` uses ANTHROPIC_API_KEY even when the user
 * declined that key in interactive Claude Code; drop it in that case, so the
 * child signs in the way the user's own sessions do. Claude Code stores a
 * declined key as its last 20 characters.
 */
export function childEnv(env, claudeJson) {
  const out = { ...env, OBSIDIAN_ARCHIVE_CHILD: '1' };
  const key = env.ANTHROPIC_API_KEY;
  const rejected = claudeJson?.customApiKeyResponses?.rejected ?? [];
  if (key && rejected.includes(key.slice(-20))) delete out.ANTHROPIC_API_KEY;
  return out;
}

function readClaudeJson() {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'));
  } catch {
    return null;
  }
}

function summarize(prompt, model) {
  const bin = process.env.OBSIDIAN_ARCHIVE_CLAUDE_BIN || 'claude';
  const args = ['-p', '--model', model, '--no-session-persistence', '--tools', '',
    '--strict-mcp-config', '--settings', '{"disableAllHooks":true}'];
  return execFileSync(bin, args, {
    input: prompt,
    cwd: tmpdir(),
    timeout: TIMEOUT_MS,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: childEnv(process.env, readClaudeJson()),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

export function run(input, { dir = dataDir(), now = () => new Date() } = {}) {
  const started = now();
  const row = { ts: started.toISOString(), session_id: input.session_id, reason_end: input.reason };
  const log = (extra) => {
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'auto-save.jsonl'), JSON.stringify({ ...row, ...extra, ms: now() - started }) + '\n');
    return extra;
  };

  const { config } = loadConfig(dir);
  if (!config.auto_save) return log({ action: 'skipped', reason: 'disabled' });

  let items;
  try {
    items = readDigest(input.transcript_path);
  } catch (e) {
    return log({ action: 'error', reason: 'transcript_unreadable', detail: e.message });
  }

  const vaultDir = join(expandHome(config.vault_path), config.folder);
  const prev = latestNoteFor(vaultDir, input.session_id);
  const d = decide(items, prev);
  if (d.action === 'skipped') return log({ action: 'skipped', reason: d.reason, prompts: d.prompts });

  let out;
  try {
    out = summarize(buildPrompt(toText(d.items), prev), config.auto_save_model);
  } catch (e) {
    const reason = e.code === 'ETIMEDOUT' || e.signal === 'SIGTERM' ? 'timeout' : 'claude_failed';
    return log({ action: 'error', reason, prompts: d.prompts, detail: String(e.stderr || e.stdout || e.message).trim().slice(0, 300) });
  }

  const body = extractBody(out);
  const missing = missingSections(body);
  if (missing.length) {
    return log({ action: 'error', reason: 'missing_sections', prompts: d.prompts, detail: missing.join(', ') });
  }
  const file = writeNote({ config, cwd: input.cwd, sessionId: input.session_id, body, source: 'auto', vaultDir });
  return log({ action: 'saved', prompts: d.prompts, file });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run(JSON.parse(process.argv[2] ?? readFileSync(0, 'utf8')));
  } catch (e) {
    console.error(`obsidian-archive auto-save: ${e.stack || e}`);
  }
}
