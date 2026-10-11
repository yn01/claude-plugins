// obsidian-archive — configuration and its location.
//
// One layer over the defaults: <plugin data dir>/config.json. The plugin
// directory itself is replaced on every update, so nothing the user sets may
// live there.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULTS = Object.freeze({
  vault_path: '~/Documents/Obsidian/Claude-Dev',
  folder: 'Summaries',
  include_git_diff: true,
  tags: ['claude-code', 'session-summary'],
  auto_save: true,
  auto_save_model: 'sonnet',
});

const LEGACY_DIR = join(homedir(), '.claude', 'obsidian-archive');

function findInstalledDataDir() {
  const base = join(homedir(), '.claude', 'plugins', 'data');
  try {
    const match = readdirSync(base).find((d) => d === 'obsidian-archive' || d.startsWith('obsidian-archive-'));
    return match ? join(base, match) : null;
  } catch {
    return null;
  }
}

// `explicit` is what the command passes as --data. An unsubstituted
// "${CLAUDE_PLUGIN_DATA}" counts as absent.
export function dataDir(explicit) {
  const usable = (v) => v && !v.includes('${');
  if (usable(explicit)) return explicit;
  if (usable(process.env.CLAUDE_PLUGIN_DATA)) return process.env.CLAUDE_PLUGIN_DATA;
  return findInstalledDataDir() || LEGACY_DIR;
}

export function expandHome(p) {
  if (p === '~') return homedir();
  return typeof p === 'string' && p.startsWith('~/') ? join(homedir(), p.slice(2)) : p;
}

function readJson(path) {
  try {
    const v = JSON.parse(readFileSync(path, 'utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** The resolved config, the file it came from, and keys that file sets but the plugin no longer reads. */
export function loadConfig(dir) {
  const path = join(dir, 'config.json');
  const file = readJson(path) ?? {};
  const config = { ...DEFAULTS };
  const ignored = [];
  for (const [k, v] of Object.entries(file)) {
    if (!(k in DEFAULTS)) ignored.push(k);
    else if (typeof v === typeof DEFAULTS[k] && Array.isArray(v) === Array.isArray(DEFAULTS[k])) config[k] = v;
  }
  return { config, path, file, ignored };
}

/** Parse a value typed on the command line into the type the key's default has. */
export function parseValue(key, raw) {
  if (!(key in DEFAULTS)) throw new Error(`unknown key: ${key} (known: ${Object.keys(DEFAULTS).join(', ')})`);
  const def = DEFAULTS[key];
  if (typeof def === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    throw new Error(`${key} takes true or false`);
  }
  if (Array.isArray(def)) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      const v = JSON.parse(trimmed);
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new Error(`${key} takes a list of strings`);
      return v;
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (!raw.trim()) throw new Error(`${key} cannot be empty`);
  return raw.trim();
}

/** Set one key in <dir>/config.json, keeping every other key in the file. */
export function setValue(dir, key, raw) {
  const { path, file, config } = loadConfig(dir);
  const value = parseValue(key, raw);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify({ ...file, [key]: value }, null, 2) + '\n');
  return { path, before: config[key], after: value };
}
