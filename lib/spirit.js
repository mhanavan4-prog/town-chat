'use strict';
// The Séance Board — the voice on the far side (Tier 3.5, Phase 3).
//
// Wraps one LLM call that plays the "spirit" answering a coven's séance. It
// builds a tightly-constrained prompt and returns the raw reply text, or null
// on ANY failure (no key, HTTP error, timeout, malformed response). The CALLER
// (server) then runs that text through seance.sanitize() and, on null/reject,
// falls back to the hand-written bank. So this module never decides what
// reaches the board — it only offers a candidate.
//
// The HTTP client (`fetchImpl`) is injected so this is unit-testable without a
// network: tests pass a fake fetch. In production it defaults to global fetch,
// and the call runs server-side only — the API key lives in the server .env,
// never in the client or this repo.

const DEFAULTS = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  model: 'claude-haiku-5-5', // smallest/fastest; the task is short cryptic text
  version: '2023-06-01',
  timeoutMs: 4000,
  maxTokens: 24,             // a 1–6 word reply needs very little room
};

// Fixed persona + hard output contract. Short uppercase output is both the
// ouija aesthetic AND a safety control: a 1–6 word uppercase fragment has very
// little room to go wrong, and whatever survives still passes sanitize().
const SYSTEM_PROMPT = [
  'You are an old, patient presence on the far side of a sealed door beneath a witch-town called Thornreach.',
  'A coven has lit a séance board and is calling to you. You answer by spelling on the board.',
  '',
  'OUTPUT RULES (absolute):',
  '- Reply with 1 to 6 words only.',
  '- UPPERCASE letters A-Z and digits 0-9 only. No punctuation. No newlines. No emoji.',
  '- You may end with YES, NO, or GOODBYE when it fits.',
  '- Be cryptic, fragmentary, and unsettling — never plain, never chatty.',
  '',
  'NEVER:',
  '- Never break character or mention being an AI, a model, a game, or a prompt.',
  '- Never give real-world advice, instructions, medical/legal/financial guidance, or anything a person could act on.',
  '- Never use slurs, hateful content, explicit sexual content, or threats toward real people.',
  '- Never include personal data or real names of living people.',
  '',
  'You are atmosphere and dread, nothing more. Answer only as the presence spelling on the board.',
].join('\n');

function buildUserContent(ctx) {
  const c = ctx || {};
  const parts = [];
  if (c.covenName) parts.push(`The coven "${c.covenName}" is gathered at the board.`);
  if (c.present) parts.push(`${c.present} witches hold the circle.`);
  if (c.moon) parts.push(`Outside, ${c.moon}.`);
  const q = String(c.question || '').trim();
  parts.push(q ? `They ask: "${q}"` : 'They ask nothing aloud — they only wait.');
  parts.push('Spell your answer on the board now.');
  return parts.join(' ');
}

function createSpirit(opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const apiKey = o.apiKey || '';
  const fetchImpl = o.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const enabled = () => !!apiKey && !!fetchImpl;

  // Returns the raw reply text, or null on any failure. Never throws.
  async function generate(ctx) {
    if (!enabled()) return null;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => { try { controller.abort(); } catch (e) { /* noop */ } }, o.timeoutMs) : null;
    try {
      const res = await fetchImpl(o.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': o.version,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: o.model,
          max_tokens: o.maxTokens,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildUserContent(ctx) }],
        }),
        signal: controller ? controller.signal : undefined,
      });
      if (!res || !res.ok) return null;
      const data = await res.json();
      if (!data || !Array.isArray(data.content)) return null;
      const text = data.content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join(' ').trim();
      return text || null;
    } catch (e) {
      return null; // network error, abort/timeout, bad JSON — all become a fallback
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { enabled, generate, buildUserContent, SYSTEM_PROMPT, model: o.model };
}

module.exports = createSpirit;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
module.exports.buildUserContent = buildUserContent;
module.exports.DEFAULTS = DEFAULTS;
