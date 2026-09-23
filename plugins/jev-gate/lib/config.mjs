// jev-gate — configuration resolution.
//
// Layers, later wins:
//   1. the plugin default (config.json next to this package)
//   2. ~/.claude/jev-gate/config.json   (per user)
//   3. <cwd>/.jev-gate/config.json      (per project)
//   4. environment overrides
//
// Anything unreadable or malformed is skipped silently. A gate must never fail
// because a config file has a typo in it.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
  let cfg = readJson(join(PLUGIN_ROOT, 'config.json')) ?? {};
  cfg = merge(cfg, readJson(join(homedir(), '.claude', 'jev-gate', 'config.json')));
  cfg = merge(cfg, readJson(join(cwd, '.jev-gate', 'config.json')));

  if (process.env.JEV_GATE_MODE) cfg.mode = process.env.JEV_GATE_MODE;
  if (process.env.JEV_GATE_DISABLE === '1') cfg.mode = 'off';
  if (process.env.JEV_GATE_JOURNAL) cfg.journal = process.env.JEV_GATE_JOURNAL;

  cfg.journalPath = expandHome(cfg.journal);
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
