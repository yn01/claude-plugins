// jev-toolscope — prompts that are not worth a judgement.
//
// Settled in code, before Jev is asked: a one-word reply, a slash command or a
// machine-generated message has no task to scope, and every call costs latency on the user's keystroke.
// Returns the reason a prompt is skipped, or null when it should be judged.

export function skipReason(prompt, skip = {}) {
  const text = typeof prompt === 'string' ? prompt.trim() : '';
  if (!text) return 'empty';
  // Machine-generated messages arrive on this event too — subagent hand-backs,
  // background-task notices, injected reminders. They are not the user's
  // request and have nothing to scope. Checked before the slash rule: some
  // start with "<" and none with "/", but order must not depend on that.
  // Case-sensitive, and only at the very start: a sentence that merely quotes
  // a tag is a real prompt.
  const prefixes = Array.isArray(skip.systemPrefixes) ? skip.systemPrefixes : [];
  if (prefixes.some((p) => typeof p === 'string' && p && text.startsWith(p))) return 'system_message';
  // A command name, not an absolute path: "/model sonnet" skips, "/Users/me/a.js fails" does not.
  if (/^\/[A-Za-z][\w:.-]*(\s|$)/.test(text)) return 'slash_command';
  if (text.length < (skip.minChars ?? 0)) return 'too_short';

  for (const source of Array.isArray(skip.skipPatterns) ? skip.skipPatterns : []) {
    try {
      if (new RegExp(source, 'i').test(text)) return 'pattern';
    } catch {
      // a bad pattern in a config file must not break scoping
    }
  }
  return null;
}
