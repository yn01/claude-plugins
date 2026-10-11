#!/usr/bin/env node
// Stands in for `claude -p` in tests: records its argv, env flag and stdin, then
// prints a preamble and the four sections (or FAKE_CLAUDE_MODE=bad|fail).
import { readFileSync, writeFileSync } from 'node:fs';
const stdin = readFileSync(0, 'utf8');
if (process.env.FAKE_CLAUDE_RECORD) {
  writeFileSync(process.env.FAKE_CLAUDE_RECORD, JSON.stringify({
    argv: process.argv.slice(2), child: process.env.OBSIDIAN_ARCHIVE_CHILD, hasKey: 'ANTHROPIC_API_KEY' in process.env, stdin,
  }));
}
if (process.env.FAKE_CLAUDE_MODE === 'fail') { console.error('Credit balance is too low'); process.exit(1); }
if (process.env.FAKE_CLAUDE_MODE === 'bad') { console.log('## 作業概要\nだけ'); process.exit(0); }
console.log('以下が要約です。\n\n## 作業概要\n要約。\n\n## 主な変更点\n（なし）\n\n## 決定事項・学び\n（なし）\n\n## 未完了・次回への持ち越し\n- [ ] 次の作業');
