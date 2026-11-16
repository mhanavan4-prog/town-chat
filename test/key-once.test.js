// One press of Escape is one press (client/key-once.js), even when the browser does not mark the repeats.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('a held key counts once, however its repeats are marked', async () => {
  const { createPressOnce } = await import('../client/key-once.js');
  let t = 1000; const k = createPressOnce(() => t);
  assert.strictEqual(k.repeat('Escape', false), false, 'the press');
  for (const dt of [500, 40, 40, 40, 40]) { t += dt; assert.strictEqual(k.repeat('Escape', false), true, 'an unmarked repeat'); }
  t += 30; k.up('Escape');
  t += 60; assert.strictEqual(k.repeat('Escape', false), false, 'a second press straight after letting go');
});

test('a marked repeat is always a repeat, and a lost keyup does not jam the key', async () => {
  const { createPressOnce, PRESS_QUIET_MS } = await import('../client/key-once.js');
  let t = 0; const k = createPressOnce(() => t);
  assert.strictEqual(k.repeat('Escape', true), true);
  t += PRESS_QUIET_MS + 1; assert.strictEqual(k.repeat('Escape', false), false, 'silent long enough: a new press');
  t += 10; k.clear(); assert.strictEqual(k.repeat('Escape', false), false, 'after the window lost focus');
  assert.ok(PRESS_QUIET_MS > 500, 'longer than the wait before a held key starts repeating');
});

test('the guard hears Escape before the rest, and lets made-up Escapes through', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  assert.match(main, /e\.key === 'Escape' && e\.isTrusted && _escOnce\.repeat\('Escape', e\.repeat\)\) \{ e\.stopImmediatePropagation\(\);/);
  assert.match(main, /_escOnce\.up\('Escape'\); \}, true\);/);
});
