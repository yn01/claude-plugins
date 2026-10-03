#!/usr/bin/env node
// jev-gate — read the verdict journal back.
//
// Shadow Mode only earns its keep if the log is actually read. Everything here
// is grouped by `contract`, because rows produced by different question sets
// are not comparable and pooling them has already produced two wrong readings
// of this data. Rows from before contracts were recorded are counted and set
// aside rather than mixed in.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig, deliveryOf, PLUGIN_ROOT } from '../lib/config.mjs';
import * as current from '../lib/contracts/completion.mjs';

// Which copy of this script is running, and what version it belongs to.
// Claude Code keeps every installed version under the plugin cache, and an old
// copy of this file does not know about newer contracts — reading one showed a
// live branch as zero. Printing the path makes that visible at a glance.
const SELF = fileURLToPath(import.meta.url);
const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
})();

const cfg = loadConfig();
const read = (p) => {
  try {
    return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim());
  } catch {
    return [];
  }
};

const lines = [...read(cfg.legacyJournalPath), ...read(cfg.journalPath)];
if (!lines.length) {
  console.log(`No journal yet at ${cfg.journalPath}.`);
  console.log('Run some sessions with jev-gate installed, then try again.');
  process.exit(0);
}

const all = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
all.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

const gateArg = process.argv[2];
const rows = gateArg ? all.filter((e) => e.gate === gateArg) : all;
const byContract = rows.reduce((m, e) => ((m[e.contract ?? '(before contracts were recorded)'] ??= []).push(e), m), {});

console.log(`script:   ${SELF}  (v${VERSION})`);
console.log(`journal:  ${cfg.journalPath}`);
if (cfg.legacyJournalPath && read(cfg.legacyJournalPath).length) {
  console.log(`          + ${read(cfg.legacyJournalPath).length} from the pre-0.3.0 path`);
}
console.log(`delivery: ${deliveryOf(cfg).summary}`);
console.log(`config:   ${cfg.sources.join('\n          ')}`);
console.log(`entries:  ${rows.length}${gateArg ? ` (gate=${gateArg})` : ''}`);
console.log(`current:  ${current.id}\n`);

for (const [name, of] of Object.entries(byContract)) {
  const span = `${of[0].ts?.slice(0, 16)} .. ${of[of.length - 1].ts?.slice(0, 16)}`;
  console.log(`${'='.repeat(4)} ${name}  —  ${of.length} entries  (${span})`);
  if (name !== current.id) {
    console.log('     a different question set; not comparable with the current one, shown for reference only\n');
    table('     verdict', count(of, 'verdict'), of.length);
    continue;
  }
  report(of);
}

function count(list, key) {
  return list.reduce((m, e) => (m[e[key] ?? '—'] = (m[e[key] ?? '—'] ?? 0) + 1, m), {});
}

function table(label, counts, total) {
  console.log(label);
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(k).padEnd(30)} ${String(v).padStart(5)}  ${((100 * v) / total).toFixed(1)}%`);
  }
  console.log('');
}

function hist(label, values) {
  if (!values.length) return;
  console.log(`${label}  (n=${values.length})`);
  const buckets = Array.from({ length: 10 }, () => 0);
  for (const v of values) buckets[Math.min(9, Math.floor(v * 10))]++;
  const max = Math.max(...buckets, 1);
  buckets.forEach((n, i) => {
    console.log(`  ${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}  ${String(n).padStart(4)} ${'█'.repeat(Math.round((n / max) * 38))}`);
  });
  console.log('');
}

function report(all) {
  // A skip is a deliberate non-decision — an agent type excluded by config —
  // and counting it alongside verdicts would dilute every rate below.
  const skipped = all.filter((e) => e.verdict === 'skip');
  const of = all.filter((e) => e.verdict !== 'skip');
  if (skipped.length) {
    const why = count(skipped, 'agentType');
    console.log(`skipped   ${skipped.length}  (${Object.entries(why).map(([k, v]) => `${k}=${v}`).join(', ')}) — not decisions, excluded below\n`);
  }
  table('verdict', count(of, 'verdict'), of.length);
  table('decided by', count(of, 'decidedBy'), of.length);

  const judged = of.filter((e) => e.decidedBy === 'jev');
  if (!judged.length) {
    console.log('No Jev-decided entries under this contract yet.\n');
    return;
  }

  // Where the message came from, and whether reading the transcript instead
  // would have judged something else. Both should stay boring.
  const src = count(of, 'msgSource');
  const facts = count(of, 'factsSource');
  console.log('plumbing');
  console.log(`  message from                   ${Object.entries(src).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  facts from                     ${Object.entries(facts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  hook text differed             ${of.filter((e) => e.msgDiffers).length}`);
  console.log(`  subagent stood down            ${of.filter((e) => String(e.reason).startsWith('subagent_')).length}\n`);

  hist('confidence of the deciding answer', judged.filter((e) => typeof e.confidence === 'number').map((e) => e.confidence));
  for (const [k, f] of [['claims_done', 'claimsDone'], ['claims_verified', 'claimsVerified'], ['blocked_on_user', 'blockedOnUser']]) {
    hist(k, judged.filter((e) => typeof e[f] === 'number').map((e) => e[f]));
  }

  // A probability only informs a threshold when the branch it governs was
  // taken. Counting every answer flatters the sample — that mistake has been
  // made here once already.
  const decided = (q) => judged.filter((e) => e.deciding === q).length;
  console.log('--- progress towards Enforce ---');
  console.log(`  claims_verified decided        ${String(decided('claims_verified')).padStart(4)} / 30`);
  console.log(`  blocked_on_user decided        ${String(decided('blocked_on_user')).padStart(4)} / 30`);
  console.log(`  claims_done decided            ${String(decided('claims_done')).padStart(4)} / 30`);
  console.log('  each branch also needs ~100 labelled examples before a threshold is set from it;');
  console.log('  see the threshold recipe in docs/implementation-plan.md.\n');

  const lat = judged.filter((e) => typeof e.latencyMs === 'number').map((e) => e.latencyMs).sort((a, b) => a - b);
  if (lat.length) {
    const p = (q) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))];
    console.log(`latency ms  p50=${p(0.5)}  p90=${p(0.9)}  max=${lat[lat.length - 1]}`);
  }
  const tokens = of.reduce((n, e) => n + (e.usage?.input_tokens ?? 0), 0);
  if (tokens) console.log(`input tokens ${tokens}  (~$${((tokens * 0.042) / 1e6).toFixed(4)} at $0.042/M)`);
  console.log('');
}
