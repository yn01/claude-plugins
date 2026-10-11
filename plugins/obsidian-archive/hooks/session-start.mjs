#!/usr/bin/env node
// SessionStart hook: hand the agent the open carry-over of this project's most
// recent note that still has one. Code only — no model is called. Any failure
// prints nothing and exits 0; a session never fails to start because of this.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, expandHome, loadConfig } from '../lib/config.mjs';
import { projectName } from '../lib/note.mjs';
import { findCarryOver, render } from '../lib/carryover.mjs';

// resume and compact continue a conversation that already holds the carry-over.
const DELIVER = new Set(['startup', 'clear']);

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const { config } = loadConfig(dataDir());
  if (config.carry_over && DELIVER.has(input.source ?? 'startup') && !process.env.OBSIDIAN_ARCHIVE_CHILD) {
    const vaultDir = join(expandHome(config.vault_path), config.folder);
    const found = findCarryOver(vaultDir, projectName(input.cwd || process.cwd()));
    if (found) {
      const { context, message } = render(found);
      process.stdout.write(JSON.stringify({
        systemMessage: message,
        hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
      }));
    }
  }
} catch {
  // Nothing to say.
}
process.exit(0);
