// jev-dispatch — from signals to an action. Pure: no network, no clock, no
// randomness — so a journal row can be replayed against a later version of
// this function and the two answers compared.
//
// Order of business:
//   1. A confidently-read question gets nothing: there is no work to hand to
//      anyone.
//   2. A difficulty that cannot be read with confidence gets nothing: acting
//      on a coin flip is how a router earns distrust.
//   3. difficulty picks a tier from a threshold table; a large `stronger_gain`
//      lifts it one tier; a per-kind floor applies last.
//   4. The tier is compared with the session's own model. Lighter -> delegate,
//      heavier -> consult, the same -> nothing. A prompt that leans on the
//      earlier conversation is never delegated: the subagent would not have it.
//
// Only enabled tiers whose executor is "subagent" are candidates. External
// executors (gemini, codex) sit in the config as placeholders.
//
// Returns { tier, action: 'delegate'|'consult'|'none', reason, baselineTier }.
// `baselineTier` is what a length heuristic alone would have chosen, recorded
// so a later report can tell whether Jev beats the trivial rule.

const num = (v) => typeof v === 'number' && Number.isFinite(v);

export function candidateTiers(config) {
  return Object.entries(config?.tiers ?? {})
    .filter(([, t]) => t && t.enabled !== false && t.executor === 'subagent' && num(t.rank))
    .map(([name, t]) => ({ name, ...t }))
    .sort((a, b) => a.rank - b.rank);
}

// The named tier if it is a candidate; otherwise the nearest one above it, then
// the top one. A threshold table that names a disabled tier still routes.
function resolveTier(name, tiers, config) {
  const exact = tiers.find((t) => t.name === name);
  if (exact) return exact;
  const wanted = config?.tiers?.[name]?.rank ?? 0;
  return tiers.find((t) => t.rank >= wanted) ?? tiers[tiers.length - 1];
}

export function tierForDifficulty(difficulty, config, tiers) {
  const table = config?.policy?.difficultyTiers ?? [];
  const row = table.find((r) => !num(r.below) || difficulty < r.below);
  return resolveTier(row?.tier, tiers, config);
}

export function baselineTier(promptChars, config) {
  const b = config?.policy?.baseline ?? {};
  const tiers = candidateTiers(config);
  if (!tiers.length || !num(promptChars)) return null;
  const name = promptChars < (b.lightBelowChars ?? 200) ? 'light'
    : promptChars < (b.standardBelowChars ?? 800) ? 'standard'
    : 'deep';
  return resolveTier(name, tiers, config).name;
}

export function sessionRank(sessionModel, config) {
  if (typeof sessionModel !== 'string') return null;
  const m = sessionModel.toLowerCase();
  for (const [needle, rank] of Object.entries(config?.sessionModelRank ?? {})) {
    if (num(rank) && m.includes(needle.toLowerCase())) return rank;
  }
  return null;
}

// `minConfidence` is { taskKind, difficulty, strongerGain }; a plain number
// applies to all three. Five-level scores are read with lower confidence than a
// choice even on clear cases, hence separate defaults.
export function minConfidenceOf(config) {
  const m = config?.policy?.minConfidence;
  if (num(m)) return { taskKind: m, difficulty: m, strongerGain: m };
  return { taskKind: m?.taskKind ?? 0.6, difficulty: m?.difficulty ?? 0.5, strongerGain: m?.strongerGain ?? 0.6 };
}

export function decide({ signals, sessionModel, promptChars, config }) {
  const p = config?.policy ?? {};
  const baseline = baselineTier(promptChars, config);
  const min = minConfidenceOf(config);
  const readable = (value, confidence, threshold) => num(value) && num(confidence) && confidence >= threshold;

  // task_kind only drives the question rule and the per-kind floor. When it
  // cannot be read with confidence the kind is treated as unknown — both are
  // skipped and routing goes on difficulty alone — rather than discarding a
  // difficulty that was read fine. `kindUsed` records which happened.
  const kindUsed = Boolean(signals?.taskKind) && num(signals.taskKindConfidence) && signals.taskKindConfidence >= min.taskKind;
  const kind = kindUsed ? signals.taskKind : null;

  const none = (reason, tier = null) => ({ tier, action: 'none', reason, baselineTier: baseline, kindUsed });

  if (kind === 'question') return none('question');
  if (!readable(signals?.difficulty, signals?.difficultyConfidence, min.difficulty)) return none('unclear');

  const tiers = candidateTiers(config);
  if (!tiers.length) return none('no_tier');

  let tier = tierForDifficulty(signals.difficulty, config, tiers);

  // A confident, large gain lifts the tier by one step — to the next higher
  // rank among candidates, not the next name in the table.
  if (
    num(p.gainBump) && readable(signals.strongerGain, signals.strongerGainConfidence, min.strongerGain) &&
    signals.strongerGain >= p.gainBump
  ) {
    tier = tiers.find((t) => t.rank > tier.rank) ?? tier;
  }

  const floorName = kind ? p.minTierByKind?.[kind] : null;
  if (floorName) {
    const floor = resolveTier(floorName, tiers, config);
    if (floor.rank > tier.rank) tier = floor;
  }

  const rank = sessionRank(sessionModel, config);
  if (rank === null) return none('unknown_session_model', tier.name);

  if (tier.rank < rank) {
    // Unreadable context-dependence is treated as dependent: the cautious side.
    const threshold = p.contextDependent ?? 0.5;
    const dependent = !num(signals.contextDependent) || signals.contextDependent >= threshold;
    if (dependent) return none('context_dependent', tier.name);
    return { tier: tier.name, action: 'delegate', reason: 'lighter', baselineTier: baseline, kindUsed };
  }
  if (tier.rank > rank) return { tier: tier.name, action: 'consult', reason: 'heavier', baselineTier: baseline, kindUsed };
  return none('same_tier', tier.name);
}
