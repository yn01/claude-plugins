// jev-gate — minimal Jev (TypeSafe System One) client.
//
// POST https://api.typesafe.ai/v1/systemone
//   { state, model, questions: { id: { type, instructions, criteria } } }
// -> { model, answers: { id: { type: "noul", noul: 0.95 } }, usage: {...} }
//
// A Noul answer carries a probability and NOTHING else — there is no
// `confidence` field on a Noul, unlike Choice and Score. All branching here is
// therefore on the probability alone.
//
// This client never throws. Every failure path — missing key, network error,
// timeout, non-2xx, unparseable body — resolves to { ok: false, reason }, and
// the caller lets the agent through. A judge that is down must not stop work.

export async function ask({ endpoint, apiKey, model, state, questions, timeoutMs = 2000 }) {
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

    const body = await res.json();
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

// Reads a Noul probability out of an answers map. Returns null when the answer
// is absent or not a number, so callers can distinguish "0.0" from "no answer".
export function noul(answers, id) {
  const v = answers?.[id]?.noul;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
