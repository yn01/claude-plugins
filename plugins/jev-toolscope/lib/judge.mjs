// jev-toolscope — the judging backend, behind one seam.
//
// v1 has exactly one backend: Jev (TypeSafe System One).
//
// POST https://api.typesafe.ai/v1/systemone
//   { state, model, questions: { id: { type, instructions, criteria } } }
// -> { model, answers: { id: { type, ... } }, usage: {...} }
//
// A different backend only has to expose the same `ask()` shape and the three
// readers below; decide() takes `ask` as a parameter for that reason, and so do
// the tests.
//
// ask() never throws. Every failure path — missing key, network error, timeout,
// non-2xx, unparseable body — resolves to { ok: false, reason }, and the caller
// lets the prompt through untouched. A judge that is down must not stop work.

export async function ask({ endpoint, apiKey, model, state, questions, timeoutMs = 3000 }) {
  if (!apiKey) return { ok: false, reason: 'no_api_key' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state, model, questions }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}`, latencyMs: Date.now() - startedAt };
    }

    let body;
    try {
      body = await res.json();
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      return { ok: false, reason: 'bad_json', latencyMs: Date.now() - startedAt };
    }
    return {
      ok: true,
      answers: body?.answers ?? {},
      model: body?.model,
      usage: body?.usage,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    const reason = err?.name === 'AbortError' ? 'timeout' : 'network_error';
    return { ok: false, reason, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Choice and Score both carry a `confidence`. When it is absent the best
// probability stands in for it — the same quantity, read off the distribution.
function confidenceFrom(answer) {
  if (isNum(answer?.confidence)) return answer.confidence;
  const ps = Object.values(answer?.probabilities ?? {}).filter(isNum);
  return ps.length ? Math.max(...ps) : null;
}

/** { key, confidence, probabilities } — or null when absent or malformed. */
export function choice(answers, id) {
  const a = answers?.[id];
  if (typeof a?.choice !== 'string') return null;
  return { key: a.choice, confidence: confidenceFrom(a), probabilities: a.probabilities ?? null };
}

/** { score, confidence, probabilities } — or null when absent or malformed. */
export function score(answers, id) {
  const a = answers?.[id];
  if (!isNum(a?.score)) return null;
  return { score: a.score, confidence: confidenceFrom(a), probabilities: a.probabilities ?? null };
}

// A Noul answer carries a probability and nothing else. null distinguishes
// "no answer" from 0.0.
export function noul(answers, id) {
  const v = answers?.[id]?.noul;
  return isNum(v) ? v : null;
}
