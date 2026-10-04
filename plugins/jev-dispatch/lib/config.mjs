// jev-dispatch — configuration and storage-path resolution.
//
// Config layers, later wins:
//   1. the plugin default (config.json next to this package)
//   2. <plugin data dir>/config.json       (per user)
//   3. <cwd>/.jev-dispatch/config.json     (per project)
//   4. environment overrides (JEV_DISPATCH_MODE, JEV_DISPATCH_SPAWN_MODE)
//
// Anything unreadable or malformed is skipped silently. A router must never
// fail a prompt because a config file has a typo in it.

import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Where jev-dispatch keeps what it writes. Claude Code gives every plugin its
// own directory under ~/.claude/plugins/data/<plugin>-<marketplace>/ and points
// CLAUDE_PLUGIN_DATA at it. The glob covers running a script by hand, outside
// the process that sets it; FALLBACK_DIR is the last resort when neither exists.
const FALLBACK_DIR = join(homedir(), '.claude', 'jev-dispatch');

function findInstalledDataDir() {
  const base = join(homedir(), '.claude', 'plugins', 'data');
  try {
    const match = readdirSync(base).find((d) => d === 'jev-dispatch' || d.startsWith('jev-dispatch-'));
    return match ? join(base, match) : null;
  } catch {
    return null;
  }
}

export function dataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || findInstalledDataDir() || FALLBACK_DIR;
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

export function merge(base, overlay) {
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
  cfg = merge(cfg, layer(join(dir, 'config.json')));
  cfg = merge(cfg, layer(join(cwd, '.jev-dispatch', 'config.json')));

  if (process.env.JEV_DISPATCH_MODE) { cfg.mode = process.env.JEV_DISPATCH_MODE; sources.push('env JEV_DISPATCH_MODE'); }
  if (process.env.JEV_DISPATCH_SPAWN_MODE) {
    cfg.spawn = { ...(cfg.spawn ?? {}), mode: process.env.JEV_DISPATCH_SPAWN_MODE };
    sources.push('env JEV_DISPATCH_SPAWN_MODE');
  }
  cfg.sources = sources;

  cfg.dataDir = dir;
  cfg.journalPath = join(dir, 'journal.jsonl');
  cfg.apiKey = process.env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY || '';
  return cfg;
}

export { PLUGIN_ROOT };
