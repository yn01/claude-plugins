// obsidian-archive — the session note: its sections, metadata and path.
//
// The agent writes the body. Everything a later reader matches on — the file
// name, the frontmatter, the section headings — is decided here, so it does
// not drift from note to note.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

export function buildMeta({ cwd, now = new Date(), sessionId, tags }) {
  const meta = {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    project: projectName(cwd),
  };
  // An unsubstituted "${CLAUDE_SESSION_ID}" is no id at all.
  if (sessionId && !sessionId.includes('${')) meta.session_id = sessionId;
  const branch = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch) meta.branch = branch;
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
  return `${frontmatter(meta)}\n# ${meta.project} · ${meta.date} ${meta.time}\n\n${body.trim()}\n${git}`;
}

/** <vault>/<folder>/YYYY-MM-DD_HHmm_<project>.md, with _2, _3 … when that name is taken. */
export function notePath(dir, meta) {
  const stem = `${meta.date}_${meta.time.replace(':', '')}_${meta.project}`;
  let file = join(dir, `${stem}.md`);
  for (let n = 2; existsSync(file); n++) file = join(dir, `${stem}_${n}.md`);
  return file;
}
