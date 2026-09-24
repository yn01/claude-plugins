#!/usr/bin/env node
// jev-gate — read the verdict journal back.
//
// Shadow Mode only earns its keep if the log is actually read. This prints the
// verdict distribution and, more usefully, where the evidence probabilities
// actually landed — which is what the thresholds should be set from.

import { readFileSync } from 'node:fs';
import { loadConfig } from '../lib/config.mjs';

const cfg = loadConfig();

const read = (p) => {
  try {
    return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim());
  } catch {
    return [];
  }
};

// Read the pre-0.3.0 location too. Nothing is moved on the user's behalf, and
// a sample lost to a path change is a sample that never informs a threshold.
const lines = [...read(cfg.legacyJournalPath), ...read(cfg.journalPath)];
if (!lines.length) {
  console.log(`No journal yet at ${cfg.journalPath}.`);
  console.log('Run some sessions with jev-gate installed, then try again.');
  process.exit(0);
}

const entries = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
entries.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
const gateArg = process.argv[2];
const rows = gateArg ? entries.filter((e) => e.gate === gateArg) : entries;

console.log(`journal: ${cfg.journalPath}`);
if (cfg.legacyJournalPath && read(cfg.legacyJournalPath).length) {
  console.log(`         + ${read(cfg.legacyJournalPath).length} entries from the pre-0.3.0 path ${cfg.legacyJournalPath}`);
}
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

// v0.4.0 replaced `evidence_present` ("did anything run?", which turned out to
// agree with commandCount every time) with `evidence_covers_claim` ("does what
// ran cover the claim?"). They measure different things, so they are never
// pooled into one histogram.
// `no_runs` rows carry a coverage probability that was never used — there was
// nothing to cover. Including them would put a phantom cluster in the histogram.
const judged = rows.filter((e) => typeof e.evidenceCovers === 'number' && e.reason !== 'no_runs');

// Every question is asked on every event, but a probability only earns a place
// in a threshold decision when the branch it governs was actually taken.
// Counting all answers instead flatters the sample: on the first real data
// 24 coverage answers came back and 3 of them decided anything.
const claimsCut = (e) => e.thresholds?.claimsDone ?? 0.5;
const coverageDecisive = judged.filter(
  (e) => typeof e.claimsDone === 'number' && e.claimsDone >= claimsCut(e) && (e.commandCount ?? 0) > 0
);
const blockedDecisive = rows.filter(
  (e) =>
    typeof e.blockedOnUser === 'number' &&
    e.workThisTurn &&
    typeof e.claimsDone === 'number' &&
    e.claimsDone < claimsCut(e)
);
const legacyJudged = rows.filter((e) => typeof e.evidencePresent === 'number');
if (!judged.length && !legacyJudged.length) {
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

if (judged.length) {
  hist('evidence_covers_claim  (all answers)', judged.map((e) => e.evidenceCovers));
  if (coverageDecisive.length) {
    hist('evidence_covers_claim  (DECISIVE — the only rows a threshold can be read from)',
      coverageDecisive.map((e) => e.evidenceCovers));
  } else {
    console.log('evidence_covers_claim  (DECISIVE): none yet — no completion claim has reached the coverage ladder.\n');
  }
}
if (legacyJudged.length) {
  console.log(`${legacyJudged.length} entries predate v0.4.0 and carry evidence_present, which asked a`);
  console.log('different question (whether anything ran at all). Not pooled with the above.\n');
}
const claimsRows = [...judged, ...legacyJudged].filter((e) => typeof e.claimsDone === 'number');
if (claimsRows.length) hist('claims_done', claimsRows.map((e) => e.claimsDone));

// Only the turns where work was under way and nothing was claimed say anything
// about early stopping; an answered question is not a stalled task, and a
// completion claim goes down the coverage ladder instead.
if (blockedDecisive.length) {
  hist('blocked_on_user  (DECISIVE — work turns, nothing claimed)', blockedDecisive.map((e) => e.blockedOnUser));
}

console.log('--- progress towards Enforce ---');
console.log(`  coverage ladder reached   ${String(coverageDecisive.length).padStart(4)} / 30`);
console.log(`  early-stop branch taken   ${String(blockedDecisive.length).padStart(4)} / 30`);
console.log(`  (answers returned but unused: ${judged.length - coverageDecisive.length} coverage)`);
console.log('');

const lat = rows.filter((e) => typeof e.latencyMs === 'number').map((e) => e.latencyMs).sort((a, b) => a - b);
if (lat.length) {
  const p = (q) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))];
  console.log(`latency ms  p50=${p(0.5)}  p90=${p(0.9)}  max=${lat[lat.length - 1]}`);
}
const tokens = rows.reduce((n, e) => n + (e.usage?.input_tokens ?? 0), 0);
if (tokens) console.log(`input tokens total ${tokens}  (~$${(tokens * 0.042 / 1e6).toFixed(4)} at $0.042/M)`);
