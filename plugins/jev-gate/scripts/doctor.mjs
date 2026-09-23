#!/usr/bin/env node
// jev-gate — connectivity and configuration check.
// Sends ONE tiny real request so "installed" and "actually working" stay
// separate facts. The API key is never printed.

import { loadConfig, gateSettings } from '../lib/config.mjs';
import { ask, noul } from '../lib/jev.mjs';

const cfg = loadConfig();
const gate = gateSettings(cfg, 'completion');

console.log(`mode              ${cfg.mode}`);
console.log(`model             ${cfg.model}`);
console.log(`endpoint          ${cfg.endpoint}`);
console.log(`timeout           ${cfg.timeoutMs} ms`);
console.log(`journal           ${cfg.journalPath}`);
console.log(`completion gate   ${gate.active ? 'active' : 'inactive'}`);
console.log(`TYPESAFE_API_KEY  ${cfg.apiKey ? 'set' : 'NOT SET — the gate will fail open on every event'}`);
console.log('');

if (!cfg.apiKey) {
  console.log('Set TYPESAFE_API_KEY in your environment, then run this again.');
  process.exit(0);
}

const res = await ask({
  endpoint: cfg.endpoint,
  apiKey: cfg.apiKey,
  model: cfg.model,
  timeoutMs: Math.max(cfg.timeoutMs ?? 2000, 5000),
  state: { final_message: 'Done. All 12 tests pass.', command_log: [] },
  questions: {
    claims_done: {
      type: 'noul',
      instructions: 'The final_message states that the requested work is now finished.',
    },
  },
});

if (!res.ok) {
  console.log(`request FAILED: ${res.reason} (${res.latencyMs} ms)`);
  console.log('The gate would have exited 0 and let the agent through.');
  process.exit(1);
}

console.log(`request OK        ${res.latencyMs} ms, served by ${res.model}`);
console.log(`claims_done       ${noul(res.answers, 'claims_done')}  (expect a high value)`);
console.log(`usage             ${JSON.stringify(res.usage)}`);
