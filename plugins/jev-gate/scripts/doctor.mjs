#!/usr/bin/env node
// jev-gate — configuration and health report.
//
// Prints the resolved configuration, then the result of the last SessionStart
// health check (hooks/health.mjs). The API key reaches hook processes but not
// commands Claude runs through Bash, so this script cannot see it and sends no
// request itself. The key is never printed.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadConfig, gateSettings, deliveryOf } from '../lib/config.mjs';

const STALE_MS = 24 * 60 * 60 * 1000;

const cfg = loadConfig();
const gate = gateSettings(cfg, 'completion');

console.log(`delivery          ${deliveryOf(cfg).summary}`);
console.log(`config read from  ${cfg.sources.join('\n                  ')}`);
console.log(`model             ${cfg.model}`);
console.log(`endpoint          ${cfg.endpoint}`);
console.log(`timeout           ${cfg.timeoutMs} ms`);
console.log(`data dir          ${cfg.dataDir}`);
console.log(`  from            ${process.env.CLAUDE_PLUGIN_DATA ? 'CLAUDE_PLUGIN_DATA' : 'discovered under ~/.claude/plugins/data'}`);
console.log(`journal           ${cfg.journalPath}`);
console.log(`completion gate   ${gate.active ? 'active' : 'inactive'}`);
if (cfg.legacyJournalPath && existsSync(cfg.legacyJournalPath)) {
  const legacyRoot = dirname(cfg.legacyJournalPath);
  console.log('');
  console.log(`A journal from before v0.3.0 is still at ${cfg.legacyJournalPath}.`);
  console.log('/jev-gate:status reads it as well, so nothing is lost. To finish the move:');
  console.log(`  cat "${cfg.legacyJournalPath}" >> "${cfg.journalPath}" && rm -rf "${legacyRoot}"`);
}
console.log('');

const healthPath = join(cfg.dataDir, 'health.json');
let health = null;
try {
  health = JSON.parse(readFileSync(healthPath, 'utf8'));
} catch {
  // missing or unreadable
}

if (!health) {
  console.log('health check      no result yet');
  console.log('The check runs at session start. Start a new session, then run this again.');
  process.exit(0);
}

const age = Date.now() - Date.parse(health.ts);
console.log(`health check      ${health.ts}${Number.isFinite(age) && age > STALE_MS ? '  (STALE: over 24 h old, start a new session for a fresh check)' : ''}`);
console.log(`API key           ${health.keySet ? 'set' : 'NOT SET — the gate will fail open on every event'}`);
if (health.ok) {
  console.log(`request           OK, ${health.latencyMs} ms`);
  console.log(`model             ${health.model ?? 'unknown'}`);
  console.log(`usage             ${JSON.stringify(health.usage)}`);
} else if (!health.keySet) {
  console.log('The gate would have exited 0 and let the agent through.');
  console.log('Set the key in /plugin > Installed > jev-gate > Configure options, then start a new session.');
  process.exit(1);
} else {
  console.log(`request           FAILED: ${health.reason}${health.latencyMs != null ? ` (${health.latencyMs} ms)` : ''}`);
  console.log('The gate would have exited 0 and let the agent through.');
  process.exit(1);
}
