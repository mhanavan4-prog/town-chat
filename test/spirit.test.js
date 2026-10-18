'use strict';
const test = require('node:test');
const assert = require('node:assert');
const createSpirit = require('../lib/spirit.js');

const goodBody = (text) => ({ ok: true, json: async () => ({ content: [{ type: 'text', text }] }) });

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

test('buildUserContent frames the coven, moon and question', () => {
  const c = createSpirit.buildUserContent({ covenName: 'Hags', present: 2, moon: 'the moon is thin', question: 'who are you' });
  assert.ok(/Hags/.test(c));
  assert.ok(/2 witches/.test(c));
  assert.ok(/moon is thin/.test(c));
  assert.ok(/who are you/.test(c));
  const silent = createSpirit.buildUserContent({ covenName: 'Hags' });
  assert.ok(/ask nothing/i.test(silent));
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
