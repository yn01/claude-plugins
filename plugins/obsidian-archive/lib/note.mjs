// obsidian-archive — the session note: its sections, metadata and path.
//
// The agent writes the body. Everything a later reader matches on — the file
// name, the frontmatter, the section headings — is decided here, so it does
// not drift from note to note.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';

// Fixed headings. A later SessionStart hook reads the carry-over section by
// this exact name, so renaming one is a breaking change.
export const SECTIONS = Object.freeze(['作業概要', '主な変更点', '決定事項・学び', '未完了・次回への持ち越し']);

export function missingSections(body) {
  return SECTIONS.filter((h) => !new RegExp(`^## ${h}\\s*$`, 'm').test(body));
}

function git(cwd, args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
  } catch {
    return null;
  }
}

/** The git root's directory name, so a cd into a subdirectory keeps the same project. */
export function projectName(cwd) {
  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  return basename(root || cwd);
}

const pad = (n) => String(n).padStart(2, '0');

// `prev` is the latest note of the same session, if any: this note is then its
// next part and links back to it.
export function buildMeta({ cwd, now = new Date(), sessionId, tags, source = 'manual', prev = null }) {
  const meta = {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    saved_at: now.toISOString(),
    project: projectName(cwd),
  };
  // An unsubstituted "${CLAUDE_SESSION_ID}" is no id at all.
  if (sessionId && !sessionId.includes('${')) meta.session_id = sessionId;
  const branch = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch) meta.branch = branch;
  meta.source = source;
  meta.part = prev ? prev.part + 1 : 1;
  if (prev) meta.continues = `[[${prev.name}]]`;
  meta.tags = tags;
  return meta;
}

// JSON strings are valid YAML scalars, so quoting through JSON keeps any
// project or branch name from breaking the frontmatter.
export function frontmatter(meta) {
  const lines = Object.entries(meta).map(([k, v]) =>
    Array.isArray(v) ? `${k}: [${v.map((x) => JSON.stringify(x)).join(', ')}]` : `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

export function gitSection(cwd) {
  // From the root, so paths read the same whichever subdirectory the session is in.
  const root = git(cwd, ['rev-parse', '--show-toplevel']);
  if (!root) return '';
  const status = git(root, ['status', '--short']) || '(変更なし)';
  const log = git(root, ['log', '--oneline', '-5']) || '(コミットなし)';
  return `\n## git の変更\n\n\`\`\`\n${status}\n\`\`\`\n\n直近のコミット:\n\n\`\`\`\n${log}\n\`\`\`\n`;
}

export function render(meta, body, git = '') {
  const cont = meta.part > 1 ? '（続き）' : '';
  return `${frontmatter(meta)}\n# ${meta.project} · ${meta.date} ${meta.time}${cont}\n\n${body.trim()}\n${git}`;
}

/** <vault>/<folder>/YYYY-MM-DD_HHmm_<project>.md, with _2, _3 … when that name is taken. */
export function notePath(dir, meta) {
  const stem = `${meta.date}_${meta.time.replace(':', '')}_${meta.project}`;
  let file = join(dir, `${stem}.md`);
  for (let n = 2; existsSync(file); n++) file = join(dir, `${stem}_${n}.md`);
  return file;
}

function readFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = /^(\w+): (.*)$/.exec(line);
    if (!kv) continue;
    try { out[kv[1]] = JSON.parse(kv[2]); } catch { out[kv[1]] = kv[2]; }
  }
  return out;
}

/**
 * The latest note in `dir` for this session: { name, part, savedAt }, or null.
 * Notes from 1.1.0 have no saved_at or part; their date and time stand in, read
 * as the end of that minute so nothing typed before the save counts as later.
 */
export function latestNoteFor(dir, sessionId) {
  if (!sessionId) return null;
  let names;
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.md'));
  } catch {
    return null;
  }
  let best = null;
  for (const name of names) {
    let fm;
    try {
      fm = readFrontmatter(readFileSync(join(dir, name), 'utf8').slice(0, 2000));
    } catch {
      continue;
    }
    if (!fm || fm.session_id !== sessionId) continue;
    const savedAt = fm.saved_at ? new Date(fm.saved_at) : new Date(`${fm.date}T${fm.time}:59.999`);
    const note = { name: name.replace(/\.md$/, ''), part: Number(fm.part) || 1, savedAt };
    if (!best || note.savedAt > best.savedAt) best = note;
  }
  return best;
}

/** Write a note for a body that has all four sections. Returns its path. */
export function writeNote({ config, cwd, sessionId, body, source, now = new Date(), vaultDir: dir }) {
  const prev = latestNoteFor(dir, sessionId);
  const meta = buildMeta({ cwd, now, sessionId, tags: config.tags, source, prev });
  mkdirSync(dir, { recursive: true });
  const file = notePath(dir, meta);
  writeFileSync(file, render(meta, body, config.include_git_diff ? gitSection(cwd) : ''));
  return file;
}
