#!/usr/bin/env node
// Write one session note. The body comes on stdin; the path is printed.
//
//   node write-note.mjs [--session <id>] [--data <plugin data dir>] [--cwd <dir>] < body.md

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, expandHome, loadConfig } from '../lib/config.mjs';
import { SECTIONS, missingSections, writeNote } from '../lib/note.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

function fail(message) {
  console.error(`obsidian-archive: ${message}`);
  process.exit(1);
}

const body = readFileSync(0, 'utf8');
const missing = missingSections(body);
if (missing.length) {
  fail(`本文に見出しがありません: ${missing.map((h) => `## ${h}`).join(', ')}\n必要な見出し: ${SECTIONS.map((h) => `## ${h}`).join(' / ')}`);
}

const cwd = arg('--cwd') || process.cwd();
const { config } = loadConfig(dataDir(arg('--data')));
const vaultDir = join(expandHome(config.vault_path), config.folder);
console.log(writeNote({ config, cwd, sessionId: arg('--session'), body, source: 'manual', vaultDir }));
