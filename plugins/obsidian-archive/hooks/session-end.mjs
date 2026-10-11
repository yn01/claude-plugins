#!/usr/bin/env node
// SessionEnd hook. Claude Code gives SessionEnd hooks 1.5 s by default, far too
// little for a summary, so this only hands the input to scripts/auto-save.mjs in
// a detached process and returns. It never fails the session's exit.

import { spawn } from 'node:child_process';
import { readFileSync, openSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir, loadConfig } from '../lib/config.mjs';

const AUTO_SAVE = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'auto-save.mjs');

try {
  // The summarizing child is a Claude Code session too; it must not start another.
  // Headless runs (`claude -p`, the SDK: CLAUDE_CODE_ENTRYPOINT sdk-*) are scripts,
  // not sessions a person worked in, and each one would cost a summary.
  const headless = (process.env.CLAUDE_CODE_ENTRYPOINT ?? '').startsWith('sdk');
  if (!process.env.OBSIDIAN_ARCHIVE_CHILD && !headless) {
    const input = readFileSync(0, 'utf8');
    const dir = dataDir();
    if (loadConfig(dir).config.auto_save) {
      mkdirSync(dir, { recursive: true });
      const err = openSync(join(dir, 'auto-save.err'), 'a');
      // The input rides on argv: a write to the child's stdin could still be
      // buffered when this process exits.
      spawn(process.execPath, [AUTO_SAVE, input], {
        detached: true,
        stdio: ['ignore', 'ignore', err],
        env: { ...process.env, OBSIDIAN_ARCHIVE_CHILD: '1' },
      }).unref();
    }
  }
} catch {
  // Nothing here is worth delaying or failing the exit for.
}
process.exit(0);
