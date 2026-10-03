// jev-dispatch — the hint handed to the main agent (advise mode only).
//
// It is context, not an order: the main agent may disagree, and the wording
// leaves room to. It names the agent AND the model, because the model is a
// per-call override on the Agent tool while the effort lives in the agent's own
// definition. Returns null when there is nothing to say.

const PREFIX = '[jev-dispatch]';

export function adviceFor({ action, tier, signals }, config) {
  const t = config?.tiers?.[tier];
  if (!t || (action !== 'delegate' && action !== 'consult')) return null;

  const kind = signals?.taskKind ?? 'unknown';
  const level = typeof signals?.difficulty === 'number' ? ` (difficulty ${signals.difficulty.toFixed(1)}/4)` : '';
  const via = t.model
    ? `the Agent tool with subagent_type "${t.agent}" and model "${t.model}"`
    : `the Agent tool with subagent_type "${t.agent}"`;

  if (action === 'delegate') {
    return (
      `${PREFIX} This looks like a ${kind} task${level} that a lighter model can handle. ` +
      `Consider delegating it to ${via} with a self-contained brief. ` +
      `Verify what it returns before reporting the work as done.`
    );
  }
  return (
    `${PREFIX} This looks like a ${kind} task${level} where a stronger model would help. ` +
    `Keep working here, but before you start, consult \`${t.agent}\` on your plan ` +
    `using ${via}, with a self-contained summary. ` +
    `Ask it to review the result before you declare the work complete.`
  );
}

// What the main agent is told after a spawn was rewritten. Short on purpose:
// it is a notice that the model differs from the one it asked for, not advice.
export function spawnAdvice({ model, signals }) {
  const kind = signals?.taskKind ? `${signals.taskKind}, ` : '';
  const level = typeof signals?.difficulty === 'number' ? `difficulty ${signals.difficulty.toFixed(1)}` : 'difficulty unknown';
  return `${PREFIX} routed this subagent to ${model} (${kind}${level}).`;
}
