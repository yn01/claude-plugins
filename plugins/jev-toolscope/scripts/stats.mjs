#!/usr/bin/env node
// jev-toolscope — read the journal back.
//
//   node stats.mjs [--last N]
//
// Scope rows are grouped by `contract`: rows produced by different question
// sets are not comparable. Guard rows say what was actually called, which is
// how the scope is checked: of the MCP calls made under a scope, how many were
// inside it (recall). A scope that keeps missing the tool the agent then uses
// is too tight, whatever its latency.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, PLUGIN_ROOT } from '../lib/config.mjs';

const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
})();

const lastArg = process.argv.indexOf('--last');
const LAST = lastArg >= 0 ? Math.max(1, Number(process.argv[lastArg + 1]) || 5) : 5;

const cfg = loadConfig();
let rows;
try {
  rows = readFileSync(cfg.journalPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
} catch {
  console.log(`jev-toolscope ${VERSION}: no journal at ${cfg.journalPath} — send a prompt first.`);
  process.exit(0);
}

const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '—');
const quantile = (xs, q) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (v, d = 0) => (v === null || v === undefined ? '—' : Number(v).toFixed(d));
const count = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
const short = (n) => String(n).replace(/^mcp__/, '').replace('__', '/');

console.log(`jev-toolscope ${VERSION} — ${cfg.journalPath}`);
console.log(`mode now: ${cfg.mode}   minRelevance: ${cfg.minRelevance}   rows: ${rows.length}\n`);

// --- scope rows -------------------------------------------------------------
const scopeRows = rows.filter((r) => r.hook === 'scope');
for (const [contract, rs] of count(scopeRows.map((r) => r.contract))) {
  const these = scopeRows.filter((r) => r.contract === contract);
  const judged = these.filter((r) => r.status === 'scoped');
  const lat = judged.map((r) => r.latencyMs).filter(Number.isFinite);
  console.log(`## ${contract} — ${rs} prompts`);
  console.log(`  judged         ${judged.length}`);
  console.log(`  tools checked  mean ${fmt(mean(judged.map((r) => r.catalogSize)), 1)}   in scope mean ${fmt(mean(judged.map((r) => r.selectedCount)), 1)}`);
  console.log(`  latency        p50 ${fmt(quantile(lat, 0.5))} ms   p95 ${fmt(quantile(lat, 0.95))} ms   max ${fmt(lat.length ? Math.max(...lat) : null)} ms`);
  console.log('  outcomes');
  for (const [k, n] of [...count(these.map((r) => (r.error ? `${r.reason} (${r.error})` : r.reason)))].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(5)}  ${k}`);
  }
  console.log('  catalog source');
  for (const [k, n] of count(these.filter((r) => r.status !== 'carry').map((r) => r.catalogSource))) {
    console.log(`    ${String(n).padStart(5)}  ${k}`);
  }

  // Where the relevance scores fall decides whether minRelevance sits in a gap.
  const ps = judged.flatMap((r) => (Array.isArray(r.scores) ? r.scores.map((s) => s.p) : [])).filter(Number.isFinite);
  if (ps.length) {
    const bins = Array(10).fill(0);
    for (const p of ps) bins[Math.min(9, Math.floor(p * 10))] += 1;
    const peak = Math.max(...bins);
    console.log(`  relevance p (all tools, ${ps.length} answers)`);
    bins.forEach((n, i) => console.log(`    ${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}  ${'█'.repeat(Math.round((30 * n) / peak)).padEnd(30)} ${n}`));
  }
  console.log();
}

// --- guard rows -------------------------------------------------------------
const guard = rows.filter((r) => r.hook === 'guard');
const checked = guard.filter((r) => r.inScope !== null && r.inScope !== undefined);
const inside = checked.filter((r) => r.inScope);
console.log(`## guard — ${guard.length} MCP calls`);
console.log(`  checked against a scope  ${checked.length}   (no scope ${guard.filter((r) => r.reason === 'no_scope').length}, open ${guard.filter((r) => r.reason === 'open_scope').length}, subagent ${guard.filter((r) => r.reason === 'subagent').length})`);
console.log(`  recall                   ${pct(inside.length, checked.length)}  (${inside.length} of ${checked.length} calls were in scope)`);
console.log(`  denied ${guard.filter((r) => r.decision === 'deny').length}   would deny ${guard.filter((r) => r.decision === 'would_deny').length}`);
const misses = checked.filter((r) => !r.inScope);
if (misses.length) {
  console.log('  out-of-scope calls (most frequent)');
  for (const [k, n] of [...count(misses.map((r) => r.tool))].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${String(n).padStart(5)}  ${short(k)}`);
  }
}
console.log();

// --- the last few scopes, as the demo shows them -----------------------------
const recent = scopeRows.filter((r) => r.status === 'scoped').slice(-LAST);
if (recent.length) {
  console.log(`## last ${recent.length} scopes`);
  for (const r of recent) {
    const names = (r.selected ?? []).map(short).join(', ') || '(none)';
    console.log(`  ${r.ts}  ${r.catalogSize} tools → ${r.selectedCount} in ${r.latencyMs} ms  ${names}`);
    if (r.promptHead) console.log(`    "${r.promptHead.replace(/\s+/g, ' ').slice(0, 100)}"`);
  }
}
