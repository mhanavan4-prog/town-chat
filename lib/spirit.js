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
// network: tests pass a fake fetch. In production it defaults to a native-https
// client (below) that opens a FRESH, non-pooled connection per call — NOT global
// fetch. Global fetch (undici) keeps an idle keep-alive socket to the API alive
// between séances (30 min apart); the VPS silently drops that idle socket, and
// the next call hangs on the dead connection until it times out — which is
// exactly how the live board kept falling back while a fresh process always
// worked. Séances are far too infrequent to benefit from connection reuse, so a
// one-shot connection removes the failure mode entirely. The call runs
// server-side only — the API key lives in the server .env, never in this repo.

const https = require('https');
const dns = require('dns');

// Cached DNS so the séance never waits on getaddrinfo. getaddrinfo runs on the
// libuv thread pool (default 4 threads) shared with the server's file writes,
// WebSocket compression and password hashing. On a busy long-lived server the
// pool is saturated, so a cold DNS lookup can queue for SECONDS — measured at 6s
// on the box, past the request timeout, which is why every live séance fell back
// while a fresh process (idle pool) always resolved instantly. We resolve once,
// cache the address, and serve it immediately on later calls (refreshing in the
// background when stale) so DNS leaves the hot path entirely.
const DNS_TTL_MS = 5 * 60 * 1000;
const dnsCache = Object.create(null); // hostname -> { address, family, at }

function cachedLookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const refresh = () => dns.lookup(hostname, { family: 4 }, (err, address, family) => {
    if (!err && address) dnsCache[hostname] = { address, family, at: Date.now() };
  });
  const hit = dnsCache[hostname];
  if (hit) {
    if (Date.now() - hit.at >= DNS_TTL_MS) refresh(); // stale: serve now, refresh behind it
    cb(null, hit.address, hit.family);
    return;
  }
  // cold (first call, normally at startup while the pool is idle): resolve once
  dns.lookup(hostname, { family: 4 }, (err, address, family) => {
    if (!err && address) dnsCache[hostname] = { address, family, at: Date.now() };
    cb(err, address, family);
  });
}

// Prime the cache now, while the pool is idle, so no séance ever hits a cold lookup.
function prewarmDns(endpoint) {
  try { cachedLookup(new URL(endpoint).hostname, {}, () => {}); } catch (e) { /* noop */ }
}

// Minimal fetch-shaped POST over a brand-new, non-pooled HTTPS connection
// (`agent: false` → a one-off socket, closed after the response). Returns the
// same { ok, status, json() } shape the rest of the module and the tests expect.
function httpsPost(url, opts) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { reject(e); return; }
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: (opts && opts.method) || 'GET',
      headers: (opts && opts.headers) || {},
      agent: false, // never reuse a connection — no stale keep-alive socket to hang on
      lookup: cachedLookup, // cached/pre-warmed DNS, off the hot path
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => JSON.parse(text),
        });
      });
    });
    req.on('error', (err) => {
      // Drop the cached address on a real connection failure (bad/rotated IP) so
      // the retry re-resolves — but NOT on an abort/timeout, so the warm cache
      // survives and DNS stays off the hot path.
      const code = err && err.code;
      if (code && /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ECONNRESET/.test(code)) {
        try { delete dnsCache[u.hostname]; } catch (e) { /* noop */ }
      }
      reject(err);
    });
    if (opts && opts.signal) {
      const sig = opts.signal;
      if (sig.aborted) { req.destroy(new Error('aborted')); }
      else sig.addEventListener('abort', () => { try { req.destroy(new Error('aborted')); } catch (e) { /* noop */ } });
    }
    if (opts && opts.body) req.write(opts.body);
    req.end();
  });
}

const DEFAULTS = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  // (see prewarmDns below — the cache is primed for this host at module load)
  model: 'claude-haiku-5-5', // smallest/fastest; the task is short cryptic text
  version: '2023-06-01',
  // Per-ATTEMPT timeout. Healthy calls from the VPS run ~1.5–4s; a long-idle
  // keep-alive socket (séances are 30 min apart) can go stale and hang far
  // longer. So the first attempt is cut at 8s and `retries` gives a second
  // attempt on a FRESH socket, which self-heals the stall. The old single-shot
  // path turned any transient hiccup into a silent fallback. Ops can tune the
  // per-attempt cap with SEANCE_TIMEOUT_MS without a redeploy.
  timeoutMs: 8000,
  retries: 1,                // one extra attempt on a stall / 5xx / 429 / network error
  maxTokens: 64,             // a 1–6 word reply, with headroom so it isn't chopped mid-word
};

// Prime the DNS cache for the séance endpoint at module load, while the libuv
// pool is still idle, so the first real séance never pays a cold getaddrinfo.
prewarmDns(DEFAULTS.endpoint);

// HTTP statuses worth a second try (transient): request timeout, conflict,
// too-early, rate limit, and the 5xx family (incl. Anthropic's 529 overloaded).
// A 400/401/403 is a real request/auth problem — retrying it just wastes a call.
const RETRYABLE_HTTP = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

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
  'ANSWER THEIR QUESTION:',
  '- Let your answer clearly respond to what the coven actually asked — in riddle and fragment, but about THEIR question, not something unrelated.',
  '- You are given WORLD FACTS that are true in this world right now (the night, the moon, the season). If they ask about the moon, the night or day, or the season, answer from those facts — truthfully, but as an omen, never as a plain number or date.',
  '- For anything of the waking outside world (real dates, real places, real advice), you know nothing useful — stay vague and give them only dread.',
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
  if (c.solo) {
    // A single seeker at the old Hagstone in the town square — no coven, no
    // circle. The board still answers, but the framing is solitary.
    parts.push(c.seekerName
      ? `A lone seeker, "${c.seekerName}", stands alone at the old Hagstone in the town square — no coven, no circle, just one soul and the stone.`
      : 'A lone seeker stands alone at the old Hagstone in the town square — no coven, no circle, just one soul and the stone.');
  } else {
    if (c.covenName) parts.push(`The coven "${c.covenName}" is gathered at the board.`);
    if (c.present) parts.push(`${c.present} witches hold the circle.`);
  }
  if (c.facts) parts.push(`WORLD FACTS, true right now: ${c.facts}`);
  else if (c.moon) parts.push(`Outside, ${c.moon}.`);
  const q = String(c.question || '').trim();
  parts.push(q ? `They ask: "${q}" — let your answer echo what they ask.` : 'They ask nothing aloud — they only wait.');
  if (c.secret) {
    parts.push(`You carry a true omen to let slip — reveal it only as a cryptic fragment, never plainly: ${c.secret}`);
  }
  parts.push('Spell your answer on the board now.');
  return parts.join(' ');
}

function createSpirit(opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const apiKey = o.apiKey || '';
  // Default to the native-https client (fresh connection per call). Tests inject
  // their own fetch-shaped stub via o.fetchImpl, bypassing the network entirely.
  const fetchImpl = o.fetchImpl || httpsPost;
  const enabled = () => !!apiKey && !!fetchImpl;

  // Why the last generate() returned null (or null on success). Exposed so the
  // caller can log the cause in the ops audit — a silent fallback with no
  // reason is exactly what hid the production timeout. Values: 'disabled',
  // 'timeout', 'http_<status>', 'empty', 'error:<message>'.
  let lastError = null;
  const attempts = 1 + Math.max(0, o.retries | 0);

  // One HTTP attempt. Returns { text } on success, or { retry, err } where
  // retry says whether a second attempt is worth making. Never throws.
  async function attempt(body) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timedOut = false;
    const timer = controller ? setTimeout(() => { timedOut = true; try { controller.abort(); } catch (e) { /* noop */ } }, o.timeoutMs) : null;
    try {
      const res = await fetchImpl(o.endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': o.version,
          'content-type': 'application/json',
        },
        body,
        signal: controller ? controller.signal : undefined,
      });
      if (!res || !res.ok) {
        const status = res ? res.status : 'none';
        return { err: 'http_' + status, retry: res ? RETRYABLE_HTTP.has(res.status) : true };
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.content)) return { err: 'empty', retry: false };
      const text = data.content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join(' ').trim();
      if (!text) return { err: 'empty', retry: false };
      return { text };
    } catch (e) {
      // abort/timeout and network errors are transient — worth a fresh socket
      return { err: timedOut ? 'timeout' : ('error:' + ((e && e.message) || 'unknown')), retry: true };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Returns the raw reply text, or null on failure. Retries once (on a fresh
  // connection, since an aborted request drops its socket) for a stalled call,
  // a 5xx/429, or a network error — so a single transient hiccup no longer
  // dumps the séance straight to the fallback bank. Never throws.
  async function generate(ctx) {
    if (!enabled()) { lastError = 'disabled'; return null; }
    const body = JSON.stringify({
      model: o.model,
      max_tokens: o.maxTokens,
      // Extended thinking OFF. claude-haiku-5-5 otherwise sometimes opens with a
      // thinking block that eats the whole (small) token budget before any text
      // is emitted — the response comes back with only a `thinking` block and no
      // `text`, which read as "empty" and dumped every séance to the fallback
      // bank. The board wants a terse cryptic line, not reasoning, so disable it.
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserContent(ctx) }],
    });
    for (let i = 1; i <= attempts; i++) {
      const r = await attempt(body);
      if (r.text) { lastError = null; return r.text; }
      lastError = r.err;
      if (!r.retry || i >= attempts) return null;
    }
    return null;
  }

  return { enabled, generate, buildUserContent, SYSTEM_PROMPT, model: o.model, timeoutMs: o.timeoutMs, attempts, lastError: () => lastError };
}

module.exports = createSpirit;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
module.exports.buildUserContent = buildUserContent;
module.exports.DEFAULTS = DEFAULTS;
module.exports.httpsPost = httpsPost; // the default native-https transport (fresh connection per call)
