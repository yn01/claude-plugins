// obsidian-archive — a session transcript, cut down to what a summary needs.
//
// A transcript is JSONL, often megabytes. The summarizer gets what the people
// said and what was done: user prompts, the agent's text, one line per tool
// call. Thinking and tool output stay out.

import { readFileSync } from 'node:fs';

export const MAX_CHARS = 60_000;

// Strings that arrive as user turns but were written by Claude Code, not typed.
const MACHINE = /^<(local-command-|command-|system-reminder|task-notification|agent-message|teammate-message|bash-|user-prompt-submit-hook)/;
const SKILL_BODY = /^Base directory for this skill:/;

function commandLine(text) {
  const name = /<command-name>([^<]*)<\/command-name>/.exec(text)?.[1]?.trim();
  if (!name) return null;
  const args = /<command-args>([^<]*)<\/command-args>/.exec(text)?.[1]?.trim();
  return args ? `${name} ${args}` : name;
}

function toolLine(b) {
  const i = b.input ?? {};
  const what = i.description ?? i.file_path ?? i.pattern ?? i.url ?? i.query ?? (typeof i.command === 'string' ? i.command : '') ?? '';
  return `${b.name}${what ? `: ${String(what).replace(/\s+/g, ' ').slice(0, 120)}` : ''}`;
}

/**
 * Items in order: { ts: Date, kind: 'prompt'|'command'|'reply'|'tool', text }.
 * Only 'prompt' is something a person typed; it is what the save decision counts.
 */
export function digest(lines) {
  const out = [];
  for (const line of lines) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = new Date(e.timestamp);
    if (e.isMeta || Number.isNaN(ts.getTime())) continue;
    const content = e.message?.content;

    if (e.type === 'user') {
      const texts = typeof content === 'string'
        ? [content]
        : Array.isArray(content) ? content.filter((b) => b.type === 'text').map((b) => b.text) : [];
      for (const raw of texts) {
        const text = raw.trim();
        if (!text || SKILL_BODY.test(text)) continue;
        if (MACHINE.test(text)) {
          const cmd = commandLine(text);
          if (cmd) out.push({ ts, kind: 'command', text: cmd });
          continue;
        }
        out.push({ ts, kind: 'prompt', text });
      }
    } else if (e.type === 'assistant' && Array.isArray(content)) {
      for (const b of content) {
        if (b.type === 'text' && b.text.trim()) out.push({ ts, kind: 'reply', text: b.text.trim() });
        else if (b.type === 'tool_use') out.push({ ts, kind: 'tool', text: toolLine(b) });
      }
    }
  }
  return out;
}

export function readDigest(path) {
  return digest(readFileSync(path, 'utf8').split('\n'));
}

const LABEL = { prompt: 'USER', command: 'COMMAND', reply: 'ASSISTANT', tool: 'TOOL' };

/**
 * Plain text for the summarizer, at most `max` characters. Over the limit, the
 * first prompt (what the session was for) and the most recent items are kept.
 */
export function toText(items, max = MAX_CHARS) {
  const blocks = items.map((d) => `[${LABEL[d.kind]}] ${d.text}`);
  const all = blocks.join('\n\n');
  if (all.length <= max) return all;

  const firstIdx = items.findIndex((d) => d.kind === 'prompt');
  const head = firstIdx === -1 ? '' : blocks[firstIdx].slice(0, Math.floor(max / 4));
  const marker = '\n\n[… 途中を省略 …]\n\n';
  let budget = max - head.length - marker.length;
  const tail = [];
  for (let i = blocks.length - 1; i > firstIdx && budget > 0; i--) {
    const b = blocks[i].length > budget ? blocks[i].slice(-budget) : blocks[i];
    tail.unshift(b);
    budget -= b.length + 2;
  }
  return head + marker + tail.join('\n\n');
}
