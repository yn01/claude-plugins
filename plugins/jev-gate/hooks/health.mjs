#!/usr/bin/env node
// jev-gate — SessionStart health check.
//
// Sends ONE tiny Jev request and writes the outcome to <data dir>/health.json
// for /jev-gate:doctor to read. The API key reaches hooks as an env var but not
// commands Claude runs through Bash, so doctor cannot test it itself; this hook
// is the only place that can. No key means no request. The key is never
// written. No stdout (nothing is injected into context), always exit 0.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { ask } from '../lib/jev.mjs';

try {
  const cfg = loadConfig();
  const health = { ts: new Date().toISOString(), keySet: Boolean(cfg.apiKey) };

  if (!cfg.apiKey) {
    Object.assign(health, { ok: false, reason: 'no_api_key' });
  } else {
    const res = await ask({
      endpoint: cfg.endpoint,
      apiKey: cfg.apiKey,
      model: cfg.model,
      // Stay under the 5 s hook timeout in hooks.json: a killed hook writes
      // nothing and doctor would report the previous session's result.
      timeoutMs: Math.min(cfg.timeoutMs ?? 2000, 4000),
      state: { final_message: 'Done. All 12 tests pass.', command_log: [] },
      questions: {
        claims_done: {
          type: 'noul',
          instructions: 'The final_message states that the requested work is now finished.',
        },
      },
    });
    Object.assign(health, {
      ok: res.ok,
      reason: res.ok ? null : res.reason,
      latencyMs: res.latencyMs ?? null,
      model: res.model ?? null,
      usage: res.usage ?? null,
    });
  }

  mkdirSync(cfg.dataDir, { recursive: true });
  writeFileSync(join(cfg.dataDir, 'health.json'), JSON.stringify(health) + '\n');
} catch {
  // fail silent
}
process.exit(0);
