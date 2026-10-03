#!/usr/bin/env node
// jev-dispatch — SessionStart hook.
//
// Remembers which model the session started on, for route.mjs to fall back on
// when a prompt arrives without `model` and the transcript has no assistant
// reply yet. Writes <data dir>/sessions/<session_id>.json and nothing else:
// no stdout, no journal, always exit 0.

import { readFileSync } from 'node:fs';
import { dataDir } from '../lib/config.mjs';
import { writeCachedModel } from '../lib/session-model.mjs';

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  writeCachedModel(dataDir(), input?.session_id, input?.model);
} catch {
  // fail silent
}
process.exit(0);
