#!/usr/bin/env node
// jev-toolscope — build the tool catalog.
//
//   node scan.mjs [--cwd <dir>] [--server <name>]
//
// Reads the MCP servers Claude Code would load for <dir> — ~/.claude.json
// (user scope, and the project's local scope) and <dir>/.mcp.json (project
// scope) — starts each stdio server, asks it for `initialize` and `tools/list`,
// and writes names, descriptions and server instructions to
// <data dir>/catalog.json. The prompt hook judges against that file.
//
// This starts the same commands Claude Code starts for those servers, with the
// same env from their config, and stops each one when it has answered or after
// scan.serverTimeoutMs. HTTP / SSE servers, plugin-provided servers and
// claude.ai connectors are not scanned: the prompt hook still sees their tool
// names in the transcript and judges them by name.
//
// Servers scanned for other projects are kept in the catalog, tagged with
// their project, so one catalog serves every project.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

/** ${VAR} and ${VAR:-default}, as in .mcp.json. */
export function expandEnv(value, env = process.env) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (_, name, def) => env[name] ?? def ?? '');
}

/**
 * The servers Claude Code would load for `cwd`, later scopes winning:
 * user (~/.claude.json mcpServers) < project (.mcp.json) < local
 * (~/.claude.json projects[cwd].mcpServers).
 * -> [{ name, scope, config }]
 */
export function discoverServers(cwd, { claudeJson, mcpJson } = {}) {
  const home = claudeJson === undefined ? readJson(join(homedir(), '.claude.json')) : claudeJson;
  const project = mcpJson === undefined ? readJson(join(cwd, '.mcp.json')) : mcpJson;
  const found = new Map();
  const add = (servers, scope) => {
    for (const [name, config] of Object.entries(servers ?? {})) {
      if (config && typeof config === 'object') found.set(name, { name, scope, config });
    }
  };
  add(home?.mcpServers, 'user');
  add(project?.mcpServers, 'project');
  add(home?.projects?.[cwd]?.mcpServers, 'local');
  return [...found.values()];
}

const transportOf = (config) => config.type ?? (config.command ? 'stdio' : config.url ? 'http' : 'unknown');

/**
 * Talk to one stdio server: initialize, then tools/list until no nextCursor.
 * -> { status: "ok", instructions, tools } | { status: "error", error }
 */
export function probeStdio(config, { cwd, timeoutMs = 10000 } = {}) {
  return new Promise((resolvePromise) => {
    const env = { ...process.env };
    for (const [k, v] of Object.entries(config.env ?? {})) env[k] = expandEnv(String(v));
    const command = expandEnv(config.command);
    const args = (Array.isArray(config.args) ? config.args : []).map((a) => expandEnv(String(a)));

    let child;
    let settled = false;
    const tools = [];
    let instructions = '';
    let buffer = '';
    let stderr = '';
    let nextId = 1;
    const pending = new Map();

    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child?.kill(); } catch {}
      resolvePromise(result);
    };
    const timer = setTimeout(() => done({ status: 'error', error: 'timeout' }), timeoutMs);

    try {
      child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      return done({ status: 'error', error: `spawn: ${err.message}` });
    }

    const send = (method, params, onResult) => {
      const id = nextId++;
      if (onResult) pending.set(id, onResult);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    };
    const notify = (method) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');

    const listTools = (cursor) =>
      send('tools/list', cursor ? { cursor } : {}, (msg) => {
        if (msg.error) return done({ status: 'error', error: `tools/list: ${msg.error.message ?? 'error'}` });
        for (const t of msg.result?.tools ?? []) {
          if (typeof t?.name === 'string') tools.push({ name: t.name, description: typeof t.description === 'string' ? t.description : '' });
        }
        if (msg.result?.nextCursor) return listTools(msg.result.nextCursor);
        done({ status: 'ok', instructions, tools });
      });

    child.on('error', (err) => done({ status: 'error', error: `spawn: ${err.message}` }));
    child.on('exit', (code) => done({ status: 'error', error: `exited (${code})${stderr ? `: ${stderr.trim().split('\n').pop()}` : ''}` }));
    child.stdin.on('error', () => {});
    child.stderr.on('data', (c) => { stderr = (stderr + c).slice(-2000); });
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue; // servers that log to stdout
        }
        const handler = pending.get(msg.id);
        if (handler) {
          pending.delete(msg.id);
          handler(msg);
        }
      }
    });

    send('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'jev-toolscope-scan', version: VERSION },
    }, (msg) => {
      if (msg.error) return done({ status: 'error', error: `initialize: ${msg.error.message ?? 'error'}` });
      instructions = typeof msg.result?.instructions === 'string' ? msg.result.instructions : '';
      notify('notifications/initialized');
      listTools();
    });
  });
}

async function main() {
  const cwd = resolve(argValue('--cwd') ?? process.cwd());
  const only = argValue('--server');
  const config = loadConfig(cwd);
  const timeoutMs = config.scan?.serverTimeoutMs ?? 10000;

  const servers = discoverServers(cwd).filter((s) => !only || s.name === only);
  const previous = readCatalog(config.catalogPath)?.servers ?? {};
  const next = { ...previous };
  const rows = [];

  await Promise.all(servers.map(async ({ name, scope, config: sc }) => {
    const transport = transportOf(sc);
    const startedAt = Date.now();
    const result = transport === 'stdio'
      ? await probeStdio(sc, { cwd, timeoutMs })
      : { status: 'skipped', error: `transport ${transport} is not scanned` };
    const ms = Date.now() - startedAt;
    rows.push({ name, scope, transport, ...result, ms });

    if (result.status !== 'ok') return;
    const prevProjects = Array.isArray(previous[name]?.projects) ? previous[name].projects : [];
    next[name] = {
      transport,
      scope,
      // user-scope servers apply everywhere; the others only where they were found
      projects: scope === 'user' ? [] : [...new Set([...prevProjects, cwd])],
      instructions: result.instructions,
      tools: result.tools,
      scannedAt: new Date().toISOString(),
    };
  }));

  const catalog = { version: 1, scannedAt: new Date().toISOString(), servers: next };
  mkdirSync(dirname(config.catalogPath), { recursive: true });
  const tmp = `${config.catalogPath}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(catalog, null, 2), 'utf8');
  renameSync(tmp, config.catalogPath);

  rows.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`jev-toolscope ${VERSION} — scan of ${cwd}`);
  console.log(`catalog: ${config.catalogPath}\n`);
  if (!rows.length) console.log('No MCP servers found in ~/.claude.json or .mcp.json for this directory.');
  for (const r of rows) {
    const what = r.status === 'ok' ? `${r.tools.length} tools` : r.error;
    console.log(`  ${r.status === 'ok' ? 'ok     ' : r.status === 'skipped' ? 'skipped' : 'error  '}  ${r.name.padEnd(24)} ${r.scope.padEnd(8)} ${r.transport.padEnd(6)} ${String(r.ms).padStart(6)} ms  ${what}`);
  }
  const total = Object.values(next).reduce((n, s) => n + (s.tools?.length ?? 0), 0);
  console.log(`\n${Object.keys(next).length} servers, ${total} tools in the catalog.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`scan failed: ${err.message}`);
    process.exit(1);
  });
}
