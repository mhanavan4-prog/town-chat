'use strict';
const test = require('node:test');
const assert = require('node:assert');
const createSpirit = require('../lib/spirit.js');

const goodBody = (text) => ({ ok: true, json: async () => ({ content: [{ type: 'text', text }] }) });

test('defaults to the native-https transport, not global fetch (no stale keep-alive socket)', () => {
  // The production bug was global fetch (undici) reusing a dead idle socket. The
  // default transport must be the one-shot native-https client. A spirit with a
  // key but no injected fetchImpl is enabled, which means it fell back to a real
  // default transport (httpsPost), not a missing one.
  assert.equal(typeof createSpirit.httpsPost, 'function');
  assert.equal(createSpirit({ apiKey: 'k' }).enabled(), true);
});

test('disabled without an api key — never calls fetch', async () => {
  let called = false;
  const s = createSpirit({ apiKey: '', fetchImpl: async () => { called = true; return goodBody('X'); } });
  assert.equal(s.enabled(), false);
  assert.equal(await s.generate({ question: 'hi' }), null);
  assert.equal(called, false);
});

test('enabled with a key; returns the model text, trimmed and joined', async () => {
  const s = createSpirit({ apiKey: 'k', fetchImpl: async () => goodBody('  THE DOOR  HOLDS  ') });
  assert.equal(s.enabled(), true);
  assert.equal(await s.generate({ question: 'who' }), 'THE DOOR  HOLDS');
});

test('sends the right endpoint, headers and body', async () => {
  let cap = null;
  const s = createSpirit({ apiKey: 'secret', model: 'claude-haiku-5-5', fetchImpl: async (url, opts) => { cap = { url, opts }; return goodBody('SOON'); } });
  await s.generate({ covenName: 'Night Hags', present: 3, question: 'are you there' });
  assert.equal(cap.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(cap.opts.headers['x-api-key'], 'secret');
  assert.equal(cap.opts.headers['anthropic-version'], '2023-06-01');
  assert.equal(cap.opts.headers['content-type'], 'application/json');
  const body = JSON.parse(cap.opts.body);
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.deepEqual(body.thinking, { type: 'disabled' }, 'extended thinking is disabled so the token budget goes to the answer');
  assert.ok(body.max_tokens > 0 && body.max_tokens <= 64);
  assert.ok(/presence/i.test(body.system));
  assert.equal(body.messages[0].role, 'user');
  assert.ok(/Night Hags/.test(body.messages[0].content));
  assert.ok(/are you there/.test(body.messages[0].content));
});

test('HTTP error → null', async () => {
  const s = createSpirit({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
  assert.equal(await s.generate({}), null);
});

test('malformed response (no content array) → null', async () => {
  const s = createSpirit({ apiKey: 'k', fetchImpl: async () => ({ ok: true, json: async () => ({ hello: 'world' }) }) });
  assert.equal(await s.generate({}), null);
});

test('a fetch that throws → null (never propagates)', async () => {
  const s = createSpirit({ apiKey: 'k', fetchImpl: async () => { throw new Error('network down'); } });
  assert.equal(await s.generate({}), null);
});

test('a slow call is aborted by the timeout → null', async () => {
  const s = createSpirit({
    apiKey: 'k', timeoutMs: 20,
    fetchImpl: (url, opts) => new Promise((resolve, reject) => {
      // respects the abort signal the module wires up
      if (opts.signal) opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  });
  assert.equal(await s.generate({}), null);
});

test('lastError records WHY a generate returned null (so a fallback is diagnosable)', async () => {
  const off = createSpirit({ apiKey: '' });
  await off.generate({});
  assert.equal(off.lastError(), 'disabled');

  const http = createSpirit({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) });
  await http.generate({});
  assert.equal(http.lastError(), 'http_429');

  const ok = createSpirit({ apiKey: 'k', fetchImpl: async () => goodBody('SOON') });
  await ok.generate({});
  assert.equal(ok.lastError(), null, 'null on success');

  const slow = createSpirit({
    apiKey: 'k', timeoutMs: 20,
    fetchImpl: (url, opts) => new Promise((resolve, reject) => {
      if (opts.signal) opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  });
  await slow.generate({});
  assert.equal(slow.lastError(), 'timeout');
});

test('retries once on a stalled call and then succeeds (fresh attempt)', async () => {
  let n = 0;
  const s = createSpirit({
    apiKey: 'k', timeoutMs: 20, retries: 1,
    fetchImpl: (url, opts) => {
      n++;
      if (n === 1) return new Promise((resolve, reject) => { if (opts.signal) opts.signal.addEventListener('abort', () => reject(new Error('aborted'))); });
      return goodBody('SOON');
    },
  });
  assert.equal(await s.generate({}), 'SOON');
  assert.equal(n, 2, 'made a second attempt after the first stalled');
  assert.equal(s.lastError(), null);
});

test('retries a 429 but NOT a 400', async () => {
  let n429 = 0;
  const s429 = createSpirit({ apiKey: 'k', retries: 1, fetchImpl: async () => { n429++; return { ok: false, status: 429, json: async () => ({}) }; } });
  assert.equal(await s429.generate({}), null);
  assert.equal(n429, 2, '429 is retried');

  let n400 = 0;
  const s400 = createSpirit({ apiKey: 'k', retries: 1, fetchImpl: async () => { n400++; return { ok: false, status: 400, json: async () => ({}) }; } });
  assert.equal(await s400.generate({}), null);
  assert.equal(n400, 1, '400 is not retried');
  assert.equal(s400.lastError(), 'http_400');
});

test('retries are exhausted → null with the last reason', async () => {
  let n = 0;
  const s = createSpirit({ apiKey: 'k', retries: 1, fetchImpl: async () => { n++; return { ok: false, status: 503, json: async () => ({}) }; } });
  assert.equal(await s.generate({}), null);
  assert.equal(n, 2, 'tried 1 + 1 retry');
  assert.equal(s.lastError(), 'http_503');
});

test('buildUserContent frames the coven, moon and question', () => {
  const c = createSpirit.buildUserContent({ covenName: 'Hags', present: 2, moon: 'the moon is thin', question: 'who are you' });
  assert.ok(/Hags/.test(c));
  assert.ok(/2 witches/.test(c));
  assert.ok(/moon is thin/.test(c));
  assert.ok(/who are you/.test(c));
  const silent = createSpirit.buildUserContent({ covenName: 'Hags' });
  assert.ok(/ask nothing/i.test(silent));
});

test('buildUserContent frames a solo Hagstone seeker, not a coven', () => {
  // The solo taste (roadmap #5) must not describe a gathered coven or a circle
  // of witches — it is one seeker at the stone. The question still threads
  // through, and world facts still apply.
  const c = createSpirit.buildUserContent({ solo: true, seekerName: 'Vesper', question: 'who are you', facts: 'it is night' });
  assert.ok(/lone seeker/i.test(c), 'framed as a lone seeker');
  assert.ok(/Vesper/.test(c), 'the seeker name threads through');
  assert.ok(!/is gathered at the board/i.test(c), 'not framed as a gathered coven');
  assert.ok(!/witches hold the circle/i.test(c), 'no circle of witches');
  assert.ok(/who are you/.test(c) && /WORLD FACTS/i.test(c), 'question + world facts still present');
  // Nameless solo seeker still works.
  const anon = createSpirit.buildUserContent({ solo: true });
  assert.ok(/lone seeker/i.test(anon) && !/is gathered at the board/i.test(anon));
});

test('buildUserContent passes world facts and tells the spirit to echo the question', () => {
  const facts = 'it is night; the next blood moon (the full moon) rises in about 3 nights';
  const c = createSpirit.buildUserContent({ facts, question: 'when is the next full moon' });
  assert.ok(/WORLD FACTS/i.test(c), 'facts are injected');
  assert.ok(/blood moon/i.test(c), 'the real game fact is present');
  assert.ok(/echo what they ask/i.test(c), 'the spirit is told to answer the question');
  // facts win over the plain moon line when both are present
  const both = createSpirit.buildUserContent({ facts, moon: 'the moon is thin' });
  assert.ok(/WORLD FACTS/i.test(both) && !/moon is thin/.test(both));
});

test('the system prompt tells the spirit to answer the world truthfully but cryptically', () => {
  const sys = createSpirit.SYSTEM_PROMPT;
  assert.ok(/WORLD FACTS/i.test(sys), 'it is told it has world facts');
  assert.ok(/moon|season/i.test(sys), 'it knows it can answer about the moon/season');
  assert.ok(/outside world/i.test(sys), 'but stays vague about the real world');
});
