// obsidian-archive — the open carry-over items of a project's recent notes.
//
// A note whose carry-over is "（なし）" is common (a short session, a question),
// so the newest note alone would often hide real open work. The carry-over is
// taken from the newest note that still has an unchecked item.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECTIONS, readFrontmatter, savedAtOf } from './note.mjs';

export const MAX_AGE_DAYS = 14;
const CARRY_OVER = SECTIONS[3];

/** The body of a `## <heading>` section, up to the next `## ` heading. */
export function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/** Unchecked task lines only: an item ticked in Obsidian (- [x]) is done. */
export function openItems(text) {
  return section(text, CARRY_OVER)
    .split('\n')
    .filter((l) => /^\s*- \[ \] \S/.test(l))
    .map((l) => l.trim());
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Notes of `project` in `dir`, newest first. The file name narrows; the frontmatter decides. */
export function listNotes(dir, project) {
  const nameRe = new RegExp(`^\\d{4}-\\d{2}-\\d{2}_\\d{4}_${escape(project)}(_\\d+)?\\.md$`);
  let names;
  try {
    names = readdirSync(dir).filter((n) => nameRe.test(n));
  } catch {
    return [];
  }
  const notes = [];
  for (const name of names) {
    let text;
    try {
      text = readFileSync(join(dir, name), 'utf8');
    } catch {
      continue;
    }
    const fm = readFrontmatter(text);
    if (!fm || fm.project !== project) continue;
    const savedAt = savedAtOf(fm);
    if (Number.isNaN(savedAt.getTime())) continue;
    notes.push({ name: name.replace(/\.md$/, ''), date: fm.date, time: fm.time, savedAt, text });
  }
  return notes.sort((a, b) => b.savedAt - a.savedAt);
}

/** The newest note within MAX_AGE_DAYS that has open items: { name, date, time, items }, or null. */
export function findCarryOver(dir, project, now = new Date(), maxAgeDays = MAX_AGE_DAYS) {
  const cutoff = now.getTime() - maxAgeDays * 86_400_000;
  for (const note of listNotes(dir, project)) {
    if (note.savedAt.getTime() < cutoff) break;
    const items = openItems(note.text);
    if (items.length) return { name: note.name, date: note.date, time: note.time, items };
  }
  return null;
}

/** What the agent reads, and the one line the user sees. */
export function render(found) {
  const context = [
    `[obsidian-archive] このプロジェクトの前回のセッションからの持ち越しです（[[${found.name}]]、${found.date} ${found.time}）。`,
    '関係するときだけ扱ってください。ユーザーが別の作業を頼んだら、そちらを優先します。',
    '',
    ...found.items,
  ].join('\n');
  const message = `📌 obsidian-archive: 前回の持ち越し ${found.items.length} 件 — ${found.name}`;
  return { context, message };
}
