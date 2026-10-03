// jev-dispatch — which model the session is running on.
//
// policy compares a judged tier with the session's own model, so a session
// model that cannot be found turns every decision into `unknown_session_model`
// and the router never acts. UserPromptSubmit is not guaranteed to carry
// `model` (SessionStart is), so it is resolved from three sources, in order:
//
//   1. `input.model` on the UserPromptSubmit payload, when present.
//   2. The transcript: the newest assistant line's `message.model`.
//   3. A per-session cache written by the SessionStart hook.
//
// The transcript outranks the cache on purpose. SessionStart records the model
// the session STARTED with; a later /model switch shows up in the transcript
// from the first reply after it, and not in the cache at all. The cache is the
// answer for a session that has not replied yet — exactly when the transcript
// has nothing to read.
//
// Nothing here throws. A source that fails is a source that has no answer.

import { openSync, readSync, closeSync, fstatSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Transcripts grow without bound and this runs on every prompt, so only the
// tail is read. The newest assistant line is always near the end.
const TAIL_BYTES = 256 * 1024;

const nonEmpty = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function fileName(sessionId) {
  const id = nonEmpty(sessionId);
  if (!id) return null;
  const safe = id.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 128);
  return /^\.*$/.test(safe) ? null : `${safe}.json`;
}

export function modelFromTranscript(path) {
  if (!nonEmpty(path)) return null;
  let fd;
  try {
    fd = openSync(path, 'r');
    const size = fstatSync(fd).size;
    const length = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, size - length);
    const lines = buf.toString('utf8').split('\n');
    // When the read began mid-file, the first line is a fragment; parsing it
    // fails and it is skipped like any other malformed line.
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const row = JSON.parse(lines[i]);
        const model = row?.type === 'assistant' ? nonEmpty(row?.message?.model) : null;
        if (model) return model;
      } catch {
        // malformed or partial line
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) try { closeSync(fd); } catch { /* ignored */ }
  }
}

export function cachePath(dataDir, sessionId) {
  const name = fileName(sessionId);
  return name ? join(dataDir, 'sessions', name) : null;
}

export function readCachedModel(dataDir, sessionId) {
  try {
    const path = cachePath(dataDir, sessionId);
    return path ? nonEmpty(JSON.parse(readFileSync(path, 'utf8'))?.model) : null;
  } catch {
    return null;
  }
}

/** Best-effort. Returns true when a file was written. */
export function writeCachedModel(dataDir, sessionId, model) {
  try {
    const path = cachePath(dataDir, sessionId);
    const m = nonEmpty(model);
    if (!path || !m) return false;
    mkdirSync(join(dataDir, 'sessions'), { recursive: true });
    writeFileSync(path, JSON.stringify({ model: m, ts: new Date().toISOString() }), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** -> { model, source } with source "input" | "transcript" | "session_start" | null */
export function resolveSessionModel(input, dataDir) {
  const fromInput = nonEmpty(input?.model);
  if (fromInput) return { model: fromInput, source: 'input' };

  const fromTranscript = modelFromTranscript(input?.transcript_path);
  if (fromTranscript) return { model: fromTranscript, source: 'transcript' };

  const cached = readCachedModel(dataDir, input?.session_id);
  if (cached) return { model: cached, source: 'session_start' };

  return { model: null, source: null };
}
