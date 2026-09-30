// What counts as a verification run. Both directions matter: a runner the gate
// cannot see turns a verified claim into a block, and a lookalike it wrongly
// counts turns an unverified claim into a pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVerificationCommand, subagentTranscript } from '../lib/facts.mjs';

// Every "counts" entry added in completion@3 is a command an agent really ran
// in a session where the gate then blocked it for having verified nothing.
const counts = [
  'npm test',
  'npm run test:unit',
  'npx vitest run src/a.test.ts',
  'pytest -q',
  'cd /repo && node --test plugins/jev-gate/test',
  'node --experimental-vm-modules --test',
  'npx prettier --check "src/**/*.ts"',
  'cd backend && npm run format:check',
  'pnpm format:check',
  'gh pr checks 23 --watch --interval 20 2>&1 | tail -20',
];

// Every "does not count" entry is taken from the same transcripts. A match on
// any of them would let a claim through on the strength of a command that
// checks nothing.
const doesNot = [
  'npx --prefix backend prettier --version',
  'npm run format',
  'grep -rn "prettier\\|format" --include=*.yml .github',
  'git status',
  'git diff --stat',
  'gh pr view 23',
  'node scripts/build-docs.mjs',
  'cat package.json',
];

for (const cmd of counts) {
  test(`counts as verification: ${cmd}`, () => assert.equal(isVerificationCommand(cmd), true));
}
for (const cmd of doesNot) {
  test(`does not count: ${cmd}`, () => assert.equal(isVerificationCommand(cmd), false));
}

test('a project can add its own runner', () => {
  assert.equal(isVerificationCommand('./scripts/verify --all'), false);
  assert.equal(isVerificationCommand('./scripts/verify --all', ['\\./scripts/verify']), true);
});

test('a malformed pattern in config is ignored, not thrown', () => {
  assert.equal(isVerificationCommand('npm test', ['(unclosed']), true);
});

test('subagent transcripts are looked up beside the parent, never guessed', () => {
  assert.equal(subagentTranscript(null, 'a1'), null);
  assert.equal(subagentTranscript('/nope/session.jsonl', null), null);
  assert.equal(subagentTranscript('/nope/session.jsonl', 'a1'), null); // not on disk
});
