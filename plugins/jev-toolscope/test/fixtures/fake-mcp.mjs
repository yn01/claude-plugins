#!/usr/bin/env node
// A minimal stdio MCP server for scan tests: two pages of tools/list, one
// non-JSON log line on stdout, and FAKE_MCP_MODE to misbehave.
import { createInterface } from 'node:readline';

const mode = process.env.FAKE_MCP_MODE || 'ok';
if (mode === 'crash') process.exit(3);
console.log('starting fake server (not JSON)');

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
createInterface({ input: process.stdin }).on('line', (line) => {
  const msg = JSON.parse(line);
  if (mode === 'hang') return;
  if (msg.method === 'initialize') {
    send({ id: msg.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fake', version: '1' }, instructions: `Fake server for ${process.env.FAKE_LABEL || 'tests'}` } });
  } else if (msg.method === 'tools/list') {
    if (!msg.params?.cursor) send({ id: msg.id, result: { tools: [{ name: 'alpha', description: 'First tool' }], nextCursor: 'p2' } });
    else send({ id: msg.id, result: { tools: [{ name: 'beta', description: 'Second tool' }, { name: 'gamma' }] } });
  }
});
