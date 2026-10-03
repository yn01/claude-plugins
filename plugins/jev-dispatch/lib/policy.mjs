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

export function tierForDifficulty(difficulty, config, tiers, table = config?.policy?.difficultyTiers ?? []) {
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

/**
 * signals -> tier. Shared by the prompt hook (decide) and the spawn hook
 * (decideSpawn), so one threshold table, one gain bump and one per-kind floor
 * serve both.
 *
 * `overrides` is { difficultyTiers?, gainBump? }; see above.
 *
 * Returns { tier, kind, kindUsed, reason }: `tier` is the candidate tier object,
 * or null with `reason` ('unclear' | 'no_tier') when none could be chosen. `kind`
 * is the task kind when it was read confidently, else null.
 *
 * task_kind only drives the per-kind floor (and, in decide, the question rule).
 * When it cannot be read with confidence the kind is treated as unknown and
 * routing goes on difficulty alone, rather than discarding a difficulty that
 * was read fine. `kindUsed` records which happened.
 */
export function judgeTier(signals, config, overrides = {}) {
  const p = config?.policy ?? {};
  // A caller may bring its own threshold table and gain bump (the spawn hook
  // does: briefs are detailed, so their scores sit higher than prompts'). An
  // absent key falls back to policy; a present `gainBump: null` means no bump.
  const difficultyTiers = Array.isArray(overrides.difficultyTiers) ? overrides.difficultyTiers : p.difficultyTiers;
  const gainBump = 'gainBump' in overrides ? overrides.gainBump : p.gainBump;
  const min = minConfidenceOf(config);
  const readable = (value, confidence, threshold) => num(value) && num(confidence) && confidence >= threshold;

  const kindUsed = Boolean(signals?.taskKind) && num(signals.taskKindConfidence) && signals.taskKindConfidence >= min.taskKind;
  const kind = kindUsed ? signals.taskKind : null;
  const out = (tier, reason) => ({ tier, kind, kindUsed, reason });

  if (!readable(signals?.difficulty, signals?.difficultyConfidence, min.difficulty)) return out(null, 'unclear');

  const tiers = candidateTiers(config);
  if (!tiers.length) return out(null, 'no_tier');

  let tier = tierForDifficulty(signals.difficulty, config, tiers, difficultyTiers ?? []);

  // A confident, large gain lifts the tier by one step — to the next higher
  // rank among candidates, not the next name in the table.
  if (
    num(gainBump) && readable(signals.strongerGain, signals.strongerGainConfidence, min.strongerGain) &&
    signals.strongerGain >= gainBump
  ) {
    tier = tiers.find((t) => t.rank > tier.rank) ?? tier;
  }

  const floorName = kind ? p.minTierByKind?.[kind] : null;
  if (floorName) {
    const floor = resolveTier(floorName, tiers, config);
    if (floor.rank > tier.rank) tier = floor;
  }
  return out(tier, null);
}

export function decide({ signals, sessionModel, promptChars, config }) {
  const p = config?.policy ?? {};
  const baseline = baselineTier(promptChars, config);
  const j = judgeTier(signals, config);
  const none = (reason, tier = null) => ({ tier, action: 'none', reason, baselineTier: baseline, kindUsed: j.kindUsed });

  if (j.kind === 'question') return none('question');
  if (j.reason) return none(j.reason);
  const tier = j.tier;
  const kindUsed = j.kindUsed;

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

/**
 * Which model a subagent should be launched on.
 *
 * `requestedModel` is what the main agent asked for, or null when it did not
 * say — then the subagent runs on its definition's model or inherits the
 * session's, and `sessionModel` stands in for the comparison. Models are
 * compared by rank (sessionModelRank, substring match), so "opus" and "fable"
 * are the same step and nothing is rewritten between them.
 *
 * `spawn.maxTier` caps the tier before comparison; a capped result carries
 * ":capped" on its reason. Nothing is rewritten when a rank cannot be told.
 *
 * Returns { tier, model, action: 'route'|'keep'|'none', direction: 'up'|'down'|null,
 *           reason, kindUsed }.
 */
export function decideSpawn({ signals, requestedModel, sessionModel, config }) {
  // Spawn-only thresholds. Detailed briefs score high on difficulty and gain
  // almost uniformly, so the prompt table would send most of them to the top
  // tier; `spawn.difficultyTiers` and `spawn.gainBump` correct for that.
  // minConfidence and minTierByKind stay shared.
  const sp = config?.spawn ?? {};
  const overrides = {};
  if (Array.isArray(sp.difficultyTiers)) overrides.difficultyTiers = sp.difficultyTiers;
  if (Object.hasOwn(sp, 'gainBump')) overrides.gainBump = sp.gainBump;
  const j = judgeTier(signals, config, overrides);
  const none = (reason, extra = {}) =>
    ({ tier: null, model: null, action: 'none', direction: null, reason, kindUsed: j.kindUsed, ...extra });

  if (j.reason) return none(j.reason);
  let tier = j.tier;

  let capped = false;
  const capName = config?.spawn?.maxTier;
  // A cap rounds DOWN: a disabled cap tier means the nearest candidate below
  // it, and a name that is not a configured tier is no cap at all — never the
  // lowest tier, which is where resolveTier() would send an unknown name.
  const capRank = capName ? config?.tiers?.[capName]?.rank : undefined;
  if (num(capRank) && tier.rank > capRank) {
    const below = candidateTiers(config).filter((t) => t.rank <= capRank);
    const cap = below[below.length - 1];
    if (cap) { tier = cap; capped = true; }
  }
  const suffix = capped ? ':capped' : '';
  const result = (action, direction, reason) =>
    ({ tier: tier.name, model: tier.model || null, action, direction, reason: reason + suffix, kindUsed: j.kindUsed });

  const targetRank = tier.model ? sessionRank(tier.model, config) : null;
  const requested = typeof requestedModel === 'string' && requestedModel.trim() ? requestedModel.trim() : null;
  const currentRank = sessionRank(requested ?? sessionModel, config);
  if (targetRank === null || currentRank === null) {
    return result('none', null, 'unknown_model');
  }

  if (targetRank === currentRank || (requested && requested.toLowerCase() === tier.model.toLowerCase())) {
    return result('keep', null, 'same_model');
  }
  return targetRank > currentRank ? result('route', 'up', 'heavier') : result('route', 'down', 'lighter');
}
