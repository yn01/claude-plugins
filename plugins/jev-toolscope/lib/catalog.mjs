// jev-toolscope — which MCP tools exist, and which of them this session has.
//
// No hook is told the session's tool list, so it is assembled from two places:
//
//   scan        <data dir>/catalog.json, written by /jev-toolscope:scan. Names,
//               descriptions and server instructions for the stdio servers in
//               ~/.claude.json and <project>/.mcp.json. Stable, but only as
//               fresh as the last scan, and blind to HTTP servers, plugin
//               servers and claude.ai connectors.
//   transcript  the session transcript. When tool search defers MCP tools,
//               Claude Code records the deferred tool names it announces as
//               `deferred_tools_delta` attachments. That record is Claude
//               Code's internal storage, not a documented interface: it is read
//               defensively, and when it yields nothing the scan alone is used.
//
// The transcript says what is live in this session; the scan says what each
// tool does. mergeCatalog() joins them. The transcript also gives the agent's
// last reply, which a short user reply ("yes, do it") is judged against.

import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';

/** "mcp__<server>__<tool>" -> { server, tool }, or null for anything else. */
export function splitToolName(name) {
  if (typeof name !== 'string' || !name.startsWith('mcp__')) return null;
  const rest = name.slice(5);
  const i = rest.indexOf('__');
  if (i <= 0 || i === rest.length - 2) return null;
  return { server: rest.slice(0, i), tool: rest.slice(i + 2) };
}

// Claude Code turns a configured server name into the tool-name prefix by
// replacing every character outside [A-Za-z0-9_-] with "_".
export const normalizeServer = (name) => String(name).replace(/[^A-Za-z0-9_-]/g, '_');

export const fullName = (server, tool) => `mcp__${normalizeServer(server)}__${tool}`;

export function readCatalog(path) {
  try {
    const c = JSON.parse(readFileSync(path, 'utf8'));
    return c && typeof c === 'object' && c.servers && typeof c.servers === 'object' ? c : null;
  } catch {
    return null;
  }
}

// --- transcript ------------------------------------------------------------

/**
 * Apply one transcript row to the live set. Returns true when the row was a
 * deferred-tools record, so the caller can tell "no record seen" apart from
 * "records seen, none of them MCP".
 */
export function applyTranscriptRow(row, live) {
  const a = row?.attachment ?? null;
  if (!a || a.type !== 'deferred_tools_delta') return false;
  const names = (key) => (Array.isArray(a[key]) ? a[key].filter((n) => typeof n === 'string') : []);
  for (const n of names('removedNames')) live.delete(n);
  for (const n of [...names('addedNames'), ...names('readdedNames')]) {
    if (n.startsWith('mcp__')) live.add(n);
  }
  return true;
}

// How much of the agent's last reply is kept. A short user reply ("yes",
// "go ahead") answers its end, where the offer or question usually is.
const ASSISTANT_TAIL = 2000;

const textOf = (content) =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n')
      : '';

/**
 * Track the agent's last reply. A user row that is a message (not a tool
 * result) starts a new turn and clears it; assistant text rows in a turn are
 * joined. Subagent (sidechain) rows are ignored.
 */
export function applyMessageRow(row, state) {
  if (row?.isSidechain === true) return;
  const content = row?.message?.content;
  if (row?.type === 'user') {
    const isToolResult = Array.isArray(content) && content.some((b) => b?.type === 'tool_result');
    if (!isToolResult) state.lastAssistant = '';
  } else if (row?.type === 'assistant') {
    const text = textOf(content).trim();
    if (text) state.lastAssistant = `${state.lastAssistant ? `${state.lastAssistant}\n` : ''}${text}`.slice(-ASSISTANT_TAIL);
  }
}

/**
 * Read the transcript from `cursor.offset` on and fold new rows into the
 * cursor: the live MCP tool names, and the agent's last reply. Only whole
 * lines are consumed; a half-written last line is left for the next call. A
 * transcript shorter than the saved offset (rewritten, or a different file) is
 * read again from the start.
 *
 *   cursor: { path, offset, live: string[], sawDelta, lastAssistant } | null
 *   -> the next cursor, or the old one unchanged when the file cannot be read
 */
export function readTranscript(transcriptPath, cursor) {
  if (typeof transcriptPath !== 'string' || !transcriptPath) return cursor ?? null;

  const same = cursor && cursor.path === transcriptPath;
  let offset = same && Number.isInteger(cursor.offset) ? cursor.offset : 0;
  const live = new Set(same && Array.isArray(cursor.live) ? cursor.live : []);
  let sawDelta = same ? Boolean(cursor.sawDelta) : false;
  const msg = { lastAssistant: same && typeof cursor.lastAssistant === 'string' ? cursor.lastAssistant : '' };
  const out = () => ({ path: transcriptPath, offset, live: [...live], sawDelta, lastAssistant: msg.lastAssistant });

  let fd;
  try {
    fd = openSync(transcriptPath, 'r');
    const size = fstatSync(fd).size;
    if (size < offset) {
      offset = 0;
      live.clear();
      sawDelta = false;
      msg.lastAssistant = '';
    }
    if (size === offset) return out();

    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    const end = buf.lastIndexOf(0x0a);
    if (end < 0) return out();

    for (const line of buf.subarray(0, end).toString('utf8').split('\n')) {
      // Cheap pre-filter: only tool records and message rows are parsed.
      const isDelta = line.includes('deferred_tools_delta');
      if (!isDelta && !line.includes('"type":"assistant"') && !line.includes('"type":"user"')) continue;
      try {
        const row = JSON.parse(line);
        if (isDelta && applyTranscriptRow(row, live)) sawDelta = true;
        else applyMessageRow(row, msg);
      } catch {
        // a malformed row is skipped, never fatal
      }
    }
    offset += end + 1;
    return out();
  } catch {
    return cursor ?? null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

// --- merge -----------------------------------------------------------------

// A server from the scan applies to this session when it was configured for
// every project (user scope) or for this project.
function serverApplies(entry, cwd) {
  const projects = Array.isArray(entry?.projects) ? entry.projects : null;
  return !projects || projects.length === 0 || projects.includes(cwd);
}

/**
 * Join the scan and the live set into the tools to judge.
 *
 *   -> { source, tools: [{ name, server, tool, description }], servers: { server: instructions } }
 *
 * source: "scan+transcript" | "transcript-only" | "scan-only" | "none"
 *
 * With a live set, it is authoritative: a scanned tool that is not live is not
 * connected in this session and is dropped; a live tool the scan never saw is
 * judged by its name alone. Without one, every applicable scanned tool is used.
 */
export function mergeCatalog(catalog, liveNames, cwd) {
  const described = new Map();
  const servers = {};
  for (const [server, entry] of Object.entries(catalog?.servers ?? {})) {
    if (!serverApplies(entry, cwd)) continue;
    const key = normalizeServer(server);
    if (typeof entry?.instructions === 'string' && entry.instructions) servers[key] = entry.instructions;
    for (const t of Array.isArray(entry?.tools) ? entry.tools : []) {
      if (typeof t?.name !== 'string') continue;
      described.set(fullName(server, t.name), {
        server: key,
        tool: t.name,
        description: typeof t.description === 'string' ? t.description : '',
      });
    }
  }

  const live = Array.isArray(liveNames) ? liveNames.filter((n) => splitToolName(n)) : [];

  if (live.length) {
    const tools = [...new Set(live)].sort().map((name) => {
      const d = described.get(name);
      if (d) return { name, ...d };
      const { server, tool } = splitToolName(name);
      return { name, server, tool, description: '' };
    });
    const anyDescribed = tools.some((t) => described.has(t.name));
    for (const s of Object.keys(servers)) if (!tools.some((t) => t.server === s)) delete servers[s];
    return { source: anyDescribed ? 'scan+transcript' : 'transcript-only', tools, servers };
  }

  const tools = [...described.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, d]) => ({ name, ...d }));
  return { source: tools.length ? 'scan-only' : 'none', tools, servers };
}
