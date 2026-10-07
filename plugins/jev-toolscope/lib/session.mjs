// jev-toolscope — per-session state, shared by the two hooks.
//
// <data dir>/sessions/<session_id>.json holds
//   cursor  how far the transcript has been read, and the live MCP tool names
//   scope   the current prompt's judgement, which the guard checks calls against
//
// Written atomically (temp file + rename): the guard may read it while the
// prompt hook is writing. Every failure reads as "no state", which every caller
// treats as "allow everything".

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const fileFor = (dir, sessionId) => join(dir, `${String(sessionId).replace(/[^\w-]/g, '_')}.json`);

export function readSession(dir, sessionId) {
  if (!dir || !sessionId) return null;
  try {
    const s = JSON.parse(readFileSync(fileFor(dir, sessionId), 'utf8'));
    return s && typeof s === 'object' ? s : null;
  } catch {
    return null;
  }
}

export function writeSession(dir, sessionId, state) {
  if (!dir || !sessionId) return;
  try {
    mkdirSync(dir, { recursive: true });
    const path = fileFor(dir, sessionId);
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(state), 'utf8');
    renameSync(tmp, path);
  } catch {
    // ignored on purpose: no state means no scope, and no scope allows all
  }
}
