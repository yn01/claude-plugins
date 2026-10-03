// jev-dispatch — prompts that are not worth a judgement.
//
// Settled in code, before Jev is asked: a one-word reply or a slash command has
// no task to route, and every call costs latency on the user's keystroke.
// Returns the reason a prompt is skipped, or null when it should be judged.

export function skipReason(prompt, skip = {}) {
  const text = typeof prompt === 'string' ? prompt.trim() : '';
  if (!text) return 'empty';
  // A command name, not an absolute path: "/model sonnet" skips, "/Users/me/a.js fails" does not.
  if (/^\/[A-Za-z][\w:.-]*(\s|$)/.test(text)) return 'slash_command';
  if (text.length < (skip.minChars ?? 0)) return 'too_short';

  for (const source of Array.isArray(skip.skipPatterns) ? skip.skipPatterns : []) {
    try {
      if (new RegExp(source, 'i').test(text)) return 'pattern';
    } catch {
      // a bad pattern in a config file must not break routing
    }
  }
  return null;
}
