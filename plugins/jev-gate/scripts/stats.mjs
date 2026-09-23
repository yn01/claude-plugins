#!/usr/bin/env node
// jev-gate — read the verdict journal back.
//
// Shadow Mode only earns its keep if the log is actually read. This prints the
// verdict distribution and, more usefully, where the evidence probabilities
// actually landed — which is what the thresholds should be set from.

import { readFileSync } from 'node:fs';
import { loadConfig } from '../lib/config.mjs';

const cfg = loadConfig();
let lines;
try {
  lines = readFileSync(cfg.journalPath, 'utf8').split('\n').filter((l) => l.trim());
} catch {
  console.log(`No journal yet at ${cfg.journalPath}.`);
  console.log('Run some sessions with jev-gate installed, then try again.');
  process.exit(0);
}

const entries = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const gateArg = process.argv[2];
const rows = gateArg ? entries.filter((e) => e.gate === gateArg) : entries;

console.log(`journal: ${cfg.journalPath}`);
console.log(`mode:    ${cfg.mode}`);
console.log(`entries: ${rows.length}${gateArg ? ` (gate=${gateArg})` : ''}\n`);

const by = (key) => rows.reduce((m, e) => (m[e[key] ?? '—'] = (m[e[key] ?? '—'] ?? 0) + 1, m), {});
const table = (label, counts) => {
  console.log(label);
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(k).padEnd(18)} ${String(v).padStart(5)}  ${(100 * v / rows.length).toFixed(1)}%`);
  }
  console.log('');
};

table('verdict', by('verdict'));
table('decided by', by('decidedBy'));
const failopen = rows.filter((e) => e.decidedBy === 'failopen');
if (failopen.length) table('fail-open reasons', failopen.reduce((m, e) => (m[e.reason] = (m[e.reason] ?? 0) + 1, m), {}));

const judged = rows.filter((e) => typeof e.evidencePresent === 'number');
if (!judged.length) {
  console.log('No Jev-decided entries yet — nothing to set thresholds from.');
  process.exit(0);
}

const hist = (label, values) => {
  console.log(`${label}  (n=${values.length})`);
  const buckets = Array.from({ length: 10 }, () => 0);
  for (const v of values) buckets[Math.min(9, Math.floor(v * 10))]++;
  const max = Math.max(...buckets, 1);
  buckets.forEach((n, i) => {
    const bar = '█'.repeat(Math.round((n / max) * 40));
    console.log(`  ${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}  ${String(n).padStart(4)} ${bar}`);
  });
  console.log('');
};

hist('evidence_present', judged.map((e) => e.evidencePresent));
hist('claims_done', judged.filter((e) => typeof e.claimsDone === 'number').map((e) => e.claimsDone));

// Only the turns where work was under way say anything about early stopping;
// an ordinary answered question is not a stalled task.
const early = rows.filter((e) => typeof e.blockedOnUser === 'number' && e.workThisTurn);
if (early.length) hist('blocked_on_user  (work turns only)', early.map((e) => e.blockedOnUser));

const lat = rows.filter((e) => typeof e.latencyMs === 'number').map((e) => e.latencyMs).sort((a, b) => a - b);
if (lat.length) {
  const p = (q) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))];
  console.log(`latency ms  p50=${p(0.5)}  p90=${p(0.9)}  max=${lat[lat.length - 1]}`);
}
const tokens = rows.reduce((n, e) => n + (e.usage?.input_tokens ?? 0), 0);
if (tokens) console.log(`input tokens total ${tokens}  (~$${(tokens * 0.042 / 1e6).toFixed(4)} at $0.042/M)`);
