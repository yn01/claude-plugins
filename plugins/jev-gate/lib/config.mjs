// jev-gate — configuration and storage-path resolution.
//
// Config layers, later wins:
//   1. the plugin default (config.json next to this package)
//   2. <plugin data dir>/config.json    (per user)
//   3. <cwd>/.jev-gate/config.json      (per project)
//   4. environment overrides
//
// Anything unreadable or malformed is skipped silently. A gate must never fail
// because a config file has a typo in it.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Where jev-gate keeps what it writes.
//
// Claude Code gives every plugin its own directory under
// ~/.claude/plugins/data/<plugin>-<marketplace>/ and points CLAUDE_PLUGIN_DATA
// at it; its own first-party plugins store their state there. Everything else
// directly under ~/.claude/ belongs to Claude Code, and ~/.claude/plugins/
// above `data/` holds install state that Claude Code rewrites — so neither is
// ours to write to.
//
// The env var is read first. The glob below covers running a script by hand,
// outside the process that sets it, and LEGACY_DIR keeps an existing install
// working. Order matters: never silently start a fresh journal beside a real one.
const LEGACY_DIR = join(homedir(), '.claude', 'jev-gate');

function findInstalledDataDir() {
  const base = join(homedir(), '.claude', 'plugins', 'data');
  try {
    const match = readdirSync(base).find((d) => d === 'jev-gate' || d.startsWith('jev-gate-'));
    return match ? join(base, match) : null;
  } catch {
    return null;
  }
}

export function dataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || findInstalledDataDir() || LEGACY_DIR;
}

/** The pre-0.3.0 location, only when it still holds something. */
export function legacyDir() {
  return existsSync(LEGACY_DIR) && LEGACY_DIR !== dataDir() ? LEGACY_DIR : null;
}

export function expandHome(p) {
  if (typeof p !== 'string') return p;
  return p.startsWith('~/') ? join(homedir(), p.slice(2)) : p;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function merge(base, overlay) {
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base?.[k] ?? {}, v) : v;
  }
  return out;
}

export function loadConfig(cwd = process.cwd()) {
  const dir = dataDir();

  // Every layer that actually contributed, in order. A project config written
  // to the wrong place is silently ignored and the plugin runs on defaults —
  // so the only way to confirm a setting took effect is to see which files
  // were read.
  const sources = [];
  const layer = (path) => {
    const j = readJson(path);
    if (j) sources.push(path);
    return j;
  };

  let cfg = layer(join(PLUGIN_ROOT, 'config.json')) ?? {};
  cfg = merge(cfg, layer(join(dir, 'config.json')) ?? layer(join(LEGACY_DIR, 'config.json')));
  cfg = merge(cfg, layer(join(cwd, '.jev-gate', 'config.json')));

  if (process.env.JEV_GATE_MODE) { cfg.mode = process.env.JEV_GATE_MODE; sources.push('env JEV_GATE_MODE'); }
  if (process.env.JEV_GATE_DISABLE === '1') { cfg.mode = 'off'; sources.push('env JEV_GATE_DISABLE=1'); }
  if (process.env.JEV_GATE_JOURNAL) cfg.journal = process.env.JEV_GATE_JOURNAL;
  cfg.sources = sources;

  // `journal` unset means "wherever this plugin's data lives" rather than a
  // fixed path, so an install that moves does not strand its own history.
  cfg.dataDir = dir;
  cfg.journalPath = cfg.journal ? expandHome(cfg.journal) : join(dir, 'journal.jsonl');
  cfg.sessionsPath = join(dir, 'sessions');
  const legacyJournal = legacyDir() ? join(LEGACY_DIR, 'journal.jsonl') : null;
  cfg.legacyJournalPath = legacyJournal === cfg.journalPath ? null : legacyJournal;
  cfg.apiKey = process.env.TYPESAFE_API_KEY || '';
  return cfg;
}

// A gate runs only when the plugin is on, the gate is on, and a key exists.
// `mode` is global; individual gates are enabled independently of it so that
// turning Enforce on does not silently turn on gates the user never trialled.
export function gateSettings(cfg, name) {
  const gate = cfg?.gates?.[name] ?? {};
  const mode = cfg?.mode ?? 'shadow';
  return {
    ...gate,
    mode,
    active: mode !== 'off' && gate.enabled !== false,
  };
}

export { PLUGIN_ROOT };

// What a verdict will actually do, which `mode` alone does not say: Enforce
// with a block budget of zero shows every verdict and stops nothing, while
// Enforce with a budget blocks. Both read "mode: enforce", and the difference
// is whether the gate can stop your work.
export function deliveryOf(cfg, name = 'completion') {
  const mode = cfg?.mode ?? 'shadow';
  const budget = cfg?.gates?.[name]?.maxBlocksPerSession ?? 2;
  if (mode === 'off') return { kind: 'off', summary: 'off — the gate is disabled' };
  if (mode !== 'enforce') return { kind: 'shadow', summary: 'shadow — recorded only, nothing shown, nothing blocked' };
  if (budget <= 0) return { kind: 'advisory', summary: 'advisory — every verdict shown, nothing blocked' };
  return { kind: 'enforce', summary: `enforce — blocks, at most ${budget} time(s) per session` };
}
