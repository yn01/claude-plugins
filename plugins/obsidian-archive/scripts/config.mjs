#!/usr/bin/env node
// Show the resolved config, or set one key.
//
//   node config.mjs [--data <plugin data dir>]              show
//   node config.mjs [--data <plugin data dir>] <key> <value>  set

import { DEFAULTS, dataDir, loadConfig, setValue } from '../lib/config.mjs';

const argv = process.argv.slice(2);
let explicit;
const i = argv.indexOf('--data');
if (i !== -1) explicit = argv.splice(i, 2)[1];
const dir = dataDir(explicit);
const show = (v) => JSON.stringify(v);

if (argv.length === 0) {
  const { config, path, file, ignored } = loadConfig(dir);
  console.log(`config file: ${path}`);
  const width = Math.max(...Object.keys(DEFAULTS).map((k) => k.length));
  for (const [k, v] of Object.entries(config)) {
    console.log(`  ${k.padEnd(width)} : ${show(v)}${k in file ? '' : '  (default)'}`);
  }
  if (ignored.length) console.log(`ignored (no longer used): ${ignored.join(', ')}`);
} else {
  const [key, ...rest] = argv;
  try {
    const { path, before, after } = setValue(dir, key, rest.join(' '));
    console.log(`updated ${path}\n  ${key}: ${show(before)} → ${show(after)}`);
  } catch (e) {
    console.error(`obsidian-archive: ${e.message}`);
    process.exit(1);
  }
}
