// jev-gate — the completion decision contract.
//
// Versioned separately from the harness on purpose. The questions, the state
// they read, the thresholds and the routing are one replaceable unit; the hook
// wiring, fail-open paths, journal and storage around it are not. Every verdict
// records `contract`, so rows from different generations never get pooled.
//
// completion@2 is a rewrite, not an edit of @1. What forced it:
//
// "JEV-as-a-Judge" (Li et al., CMU, 2026) measures where a decision-only judge
// keeps pace and where it does not. It is level with a reasoning judge
// "wherever the verdict can be read off the text", and falls behind "wherever
// the judge must derive or check a result" — code −12.9, math −14.3, logic
// −27.6. Its operating table puts *difficult correctness* under "Escalate".
//
// @1's `evidence_covers_claim` asked whether a set of commands exercised the
// work a message claimed. That is tracing, not reading, and it landed squarely
// in the weak zone: across 29 real decisive verdicts every value fell below
// 0.3 and every one blocked. Three rewordings did not move it, because the
// wording was never the problem.
//
// @2 asks Jev only what can be read off the message, and hands every check to
// code. The block condition is no longer a judgement about coverage; it is a
// contradiction between what the message asserts and what the transcript
// records — which code can settle exactly.
//
// completion@3 keeps @2's questions and thresholds and changes one route. In
// Shadow, every `claimed_done_nothing_ran` recorded under @2 came from a
// subagent whose job needs no check: a Plan agent designing, a reviewer
// reviewing, a doc-manager editing docs. The doc-manager had edited files —
// work had plainly happened — yet the reason said nothing had. So file edits
// now count as work for that branch. They do not count as verification: a
// message that says a check passed still needs the check in the log, exactly
// as in @2. Routing changed, so the id changed; @2 rows carry no `editCount`
// and are not pooled with these.

export const id = 'completion@3';

// All three are read-off-the-text questions, phrased positively — jev-1.13
// reads negations at face value, so anything absent is computed in code.
export const questions = {
  // Carried over from @1 unchanged. Measured 17/18 on real messages, the
  // strongest of the three, and squarely a read-off question.
  claims_done: {
    type: 'noul',
    instructions: 'The final_message reports that something has been completed.',
    criteria: {
      true: 'It announces a finished action — merged, pushed, fixed, migrated, verified, opened.',
      false: 'It describes work still under way, or names something it is about to do.',
    },
  },

  // Replaces evidence_covers_claim. Not "did the runs cover the work" — that
  // needs tracing — but "does the message say a check passed", which is on the
  // page. Whether such a check actually ran is a fact code already holds, and
  // the gap between the two is the thing worth catching.
  claims_verified: {
    type: 'noul',
    instructions:
      'The final_message asserts that a test, build, lint or type-check has passed.',
    criteria: {
      true: 'It states that such a check ran and succeeded.',
      false: 'It makes no claim about a check, or reports one as failing or still to be run.',
    },
  },

  blocked_on_user: {
    type: 'noul',
    instructions:
      'The final_message stops because it needs a decision or information that only the user can give.',
    criteria: {
      true: 'It asks a question whose answer is required before the work can continue, or it is waiting for approval of a destructive action.',
      false: 'It summarises progress and names a next step without taking it, offers to continue, or lists choices that do not block the work.',
    },
  },
};

export const defaultThresholds = {
  claimsDone: 0.5,
  claimsVerified: 0.5,
  blockedOnUser: 0.5,
  // Below this, the deciding answer is treated as "cannot tell" rather than as
  // a weak yes or no. The paper measures accuracy by confidence band: 55% below
  // 0.6, 69% in [0.7,0.8), 89% in [0.95,0.99). Acting on a coin flip is how a
  // gate earns distrust.
  minConfidence: 0.7,
};

/**
 * A Noul returns one probability. The paper uses q = max_k p_k as the
 * confidence of every judge, and reports a Spearman correlation of 0.958–0.999
 * between that and JEV's own native confidence — so for a yes/no question it is
 * simply how far the answer sits from the coin flip.
 */
export const confidenceOf = (p) => (typeof p === 'number' ? Math.max(p, 1 - p) : null);

/**
 * Turn three probabilities and the facts into one verdict. No network, no
 * randomness, no clock — so a row in the journal can be replayed against a
 * later version of this function and the two answers compared.
 *
 * facts: { ranVerification, editedFiles, workThisTurn }
 * Returns { verdict, reason, deciding, confidence, message }
 */
export function decide({ answers, facts, thresholds }) {
  const t = { ...defaultThresholds, ...(thresholds ?? {}) };
  const { claims_done: done, claims_verified: verified, blocked_on_user: blocked } = answers;

  const claimsDone = done >= t.claimsDone;
  const claimsVerified = verified >= t.claimsVerified;

  // An assertion that a check passed, with no such check in the log, is a
  // contradiction rather than a matter of degree — the strongest signal this
  // gate can raise, and the one the playbook asks for: check the evidence
  // before accepting the report.
  if (claimsVerified && !facts.ranVerification) {
    return withConfidence(verified, t, {
      verdict: 'block',
      reason: 'claimed_check_never_ran',
      deciding: 'claims_verified',
      message:
        'jev-gate: this message states that a check passed, but no test, build, lint or ' +
        'type-check appears in this session.\nRun it and report its real output, or drop the claim.',
    });
  }

  // Completion claimed with nothing run and nothing edited behind it. Weaker
  // than the above — the work may not have needed a check — so it is said, not
  // enforced.
  if (claimsDone && !facts.ranVerification && !facts.editedFiles) {
    return withConfidence(done, t, {
      verdict: 'unverified',
      reason: 'claimed_done_nothing_ran',
      deciding: 'claims_done',
      message:
        'jev-gate: completion reported with no test, build, lint or type-check in this session.',
    });
  }

  // Files were edited and no check was claimed. Edits are work, not evidence:
  // this passes only because the message asserts nothing a check would back,
  // and the claimed_check_never_ran branch above has already had its say.
  if (claimsDone && !facts.ranVerification) {
    return { verdict: 'pass', reason: 'claim_backed_by_edits', deciding: 'claims_done', confidence: confidenceOf(done) };
  }

  if (claimsDone) {
    return { verdict: 'pass', reason: 'claim_backed_by_a_run', deciding: 'claims_done', confidence: confidenceOf(done) };
  }

  // Nothing claimed. Either something outside is genuinely awaited, or the turn
  // stopped to report on work nothing was blocking.
  if (blocked >= t.blockedOnUser) {
    return { verdict: 'pass', reason: 'waiting_on_someone', deciding: 'blocked_on_user', confidence: confidenceOf(blocked) };
  }
  if (facts.workThisTurn) {
    return withConfidence(blocked, t, {
      verdict: 'stopped_early',
      reason: 'paused_to_report',
      deciding: 'blocked_on_user',
      message:
        'jev-gate: this looks like a pause to report rather than a stop that needs you. ' +
        'If the next step does not need the user, take it instead of describing it.',
    });
  }
  return { verdict: 'pass', reason: 'no_claim_no_work', deciding: null, confidence: confidenceOf(blocked) };
}

// A verdict the model is not sure of becomes `unclear` — which here means the
// answer could not be read confidently, not that the underlying property was
// half true. Downgrading rather than escalating keeps this a one-model gate.
function withConfidence(p, t, outcome) {
  const confidence = confidenceOf(p);
  if (confidence !== null && confidence < t.minConfidence) {
    return {
      verdict: 'unclear',
      reason: `low_confidence:${outcome.reason}`,
      deciding: outcome.deciding,
      confidence,
      message: `jev-gate: ${outcome.message.replace(/^jev-gate: /, '')} (read with low confidence, ${confidence.toFixed(2)})`,
    };
  }
  return { ...outcome, confidence };
}
