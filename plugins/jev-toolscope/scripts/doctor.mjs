#!/usr/bin/env node
// jev-toolscope — is it actually running?
//
// Reads the config, the catalog and the journal. It sends no request of its
// own: the API key option reaches hooks only, not commands run through the
// Bash tool, so the last judged prompt is the evidence that the key works.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, PLUGIN_ROOT } from '../lib/config.mjs';
import { readCatalog } from '../lib/catalog.mjs';

const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
})();

const cfg = loadConfig();
const ok = (b) => (b ? '✅' : '⚠️ ');

console.log(`jev-toolscope ${VERSION}  (${fileURLToPath(import.meta.url)})\n`);

console.log('Config');
console.log(`  mode          ${cfg.mode}${['off', 'shadow', 'advise', 'enforce'].includes(cfg.mode) ? '' : '  (unknown value — behaves like shadow)'}`);
console.log(`  minRelevance  ${cfg.minRelevance}   maxTools ${cfg.maxTools}   timeoutMs ${cfg.timeoutMs}`);
console.log(`  alwaysAllow   ${(cfg.alwaysAllow ?? []).join(', ') || '(none)'}`);
console.log(`  sources       ${cfg.sources.join('\n                ')}\n`);

const catalog = readCatalog(cfg.catalogPath);
console.log('Catalog');
if (!catalog) {
  console.log(`  ${ok(false)} no catalog at ${cfg.catalogPath}`);
  console.log('     Run /jev-toolscope:scan. Until then only tool names from the transcript are judged.\n');
} else {
  const servers = Object.entries(catalog.servers);
  const tools = servers.reduce((n, [, s]) => n + (s.tools?.length ?? 0), 0);
  console.log(`  ${ok(true)} ${servers.length} servers, ${tools} tools — scanned ${catalog.scannedAt}`);
  for (const [name, s] of servers) {
    const where = s.projects?.length ? s.projects.join(', ') : 'all projects';
    console.log(`     ${name.padEnd(24)} ${String(s.tools?.length ?? 0).padStart(4)} tools   ${where}`);
  }
  console.log();
}

let rows = [];
try {
  rows = readFileSync(cfg.journalPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
} catch {
  // no journal yet
}

console.log('Last judgement');
const lastScope = [...rows].reverse().find((r) => r.hook === 'scope' && r.status !== 'carry');
if (!lastScope) {
  console.log(`  ${ok(false)} no prompt judged yet — send a prompt in a session with the plugin enabled.`);
} else if (lastScope.error) {
  console.log(`  ${ok(false)} ${lastScope.ts}  ${lastScope.reason} (${lastScope.error})`);
  if (lastScope.error === 'no_api_key') console.log('     Set the key: /plugin > Installed > jev-toolscope > Configure options, then start a new session.');
} else {
  console.log(`  ${ok(lastScope.status === 'scoped')} ${lastScope.ts}  ${lastScope.reason}  ${lastScope.catalogSize} tools → ${lastScope.selectedCount ?? 0} in ${lastScope.latencyMs ?? '—'} ms  source ${lastScope.catalogSource}`);
  if (lastScope.catalogSource === 'scan-only') {
    console.log('     The transcript gave no live tool list (tool search off, or Claude Code changed its transcript format): the whole catalog was judged.');
  }
}

const lastGuard = [...rows].reverse().find((r) => r.hook === 'guard');
console.log(`  guard: ${lastGuard ? `${lastGuard.ts}  ${lastGuard.tool}  ${lastGuard.decision} (${lastGuard.reason})` : 'no MCP call seen yet'}`);
