// jev-toolscope — configuration and storage-path resolution.
//
// Config layers, later wins:
//   1. the plugin default (config.json next to this package)
//   2. <plugin data dir>/config.json        (per user)
//   3. <cwd>/.jev-toolscope/config.json     (per project)
//   4. environment override (JEV_TOOLSCOPE_MODE)
//
// Anything unreadable or malformed is skipped silently. A scope hook must never
// fail a prompt because a config file has a typo in it.

import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Where jev-toolscope keeps what it writes. Claude Code gives every plugin its
// own directory under ~/.claude/plugins/data/<plugin>-<marketplace>/ and points
// CLAUDE_PLUGIN_DATA at it. The glob covers running a script by hand, outside
// the process that sets it; FALLBACK_DIR is the last resort when neither exists.
const FALLBACK_DIR = join(homedir(), '.claude', 'jev-toolscope');

function findInstalledDataDir() {
  const base = join(homedir(), '.claude', 'plugins', 'data');
  try {
    const match = readdirSync(base).find((d) => d === 'jev-toolscope' || d.startsWith('jev-toolscope-'));
    return match ? join(base, match) : null;
  } catch {
    return null;
  }
}

export function dataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || findInstalledDataDir() || FALLBACK_DIR;
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

  // Every layer that actually contributed, in order — the only way to confirm
  // a project config was picked up rather than silently ignored.
  const sources = [];
  const layer = (path) => {
    const j = readJson(path);
    if (j) sources.push(path);
    return j;
  };

  let cfg = layer(join(PLUGIN_ROOT, 'config.json')) ?? {};
  cfg = merge(cfg, layer(join(dir, 'config.json')));
  cfg = merge(cfg, layer(join(cwd, '.jev-toolscope', 'config.json')));

  if (process.env.JEV_TOOLSCOPE_MODE) { cfg.mode = process.env.JEV_TOOLSCOPE_MODE; sources.push('env JEV_TOOLSCOPE_MODE'); }
  cfg.sources = sources;

  cfg.dataDir = dir;
  cfg.journalPath = join(dir, 'journal.jsonl');
  cfg.catalogPath = join(dir, 'catalog.json');
  cfg.sessionsDir = join(dir, 'sessions');
  cfg.apiKey = process.env.CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY || '';
  return cfg;
}

export { PLUGIN_ROOT };
