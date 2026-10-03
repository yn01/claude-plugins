// jev-dispatch — append-only decision log.
//
// One JSONL file for every project. That is deliberate: Shadow mode exists to
// accumulate decisions in ONE place and read the distribution back to tune the
// thresholds. Splitting the log per project would make that impossible.
//
// Writing is best-effort. A router must never fail because the disk is full.

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function record(journalPath, entry) {
  if (!journalPath) return;
  try {
    mkdirSync(dirname(journalPath), { recursive: true });
    appendFileSync(journalPath, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf8');
  } catch {
    // ignored on purpose
  }
}
