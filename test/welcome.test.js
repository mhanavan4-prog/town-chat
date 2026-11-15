// A first-time player: somewhere safe to learn the sword, one line saying what to do next, a death that says it cost
// nothing, and a warning at the two doors that kill a low-level character at once.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the "what next" line, the door warnings and the gentle death', async () => {
  const n = await import('../client/newcomer.js');
  const fresh = { level: 1, struck: false, story: { active: false, complete: false, waiting: true, title: 'Ch 1' } };
  assert.strictEqual(n.newcomerNextStep(fresh).id, 'strike', 'first: land a blow');
  assert.match(n.newcomerNextStep({ ...fresh, touch: true }).text, /tap the sword/i);
  assert.match(n.newcomerNextStep(fresh).text, /press R/);
  const struck = { ...fresh, struck: true };
  assert.strictEqual(n.newcomerNextStep(struck).id, 'story'); assert.strictEqual(n.newcomerNextStep(struck).action, 'begin');
  assert.strictEqual(n.newcomerNextStep({ ...struck, story: { active: true } }), null, 'a chapter under way speaks for itself');
  assert.strictEqual(n.newcomerNextStep({ ...fresh, level: n.GUIDE_UNTIL_LEVEL }), null, 'and it stops');
  assert.ok(n.doorWarning('crypt', 1) && /Level 8/.test(n.doorWarning('crypt', 1).text));
  assert.strictEqual(n.doorWarning('crypt', 8), null);
  assert.ok(n.doorWarning('ember', 11)); assert.strictEqual(n.doorWarning('ember', 12), null);
  assert.strictEqual(n.doorWarning('bank', 1), null);
  assert.ok(n.gentleDeathLine(1, false)); assert.strictEqual(n.gentleDeathLine(1, true), null, 'a player does take something');
  assert.strictEqual(n.gentleDeathLine(n.GENTLE_DEATH_BELOW, false), null);
});

test('the client is wired to it', () => {
  const m = read('client/main.js');
  assert.match(m, /if \(!doorHeldBack\('crypt'\)\) enterCrypt\(\)/);
  assert.match(m, /if \(!doorHeldBack\('ember'\)\) enterEmberWastes\(\)/);
  assert.match(m, /ATTACKABLE_KINDS = new Set\(\[[^\]]*'practice'/);
  assert.match(read('public/index.html'), /id="ghostNote"/);
  // the scarecrow stands where the server says it does
  const srv = read('server.js').match(/PRACTICE_TARGET = \{ id: 'scarecrow', x: (\d+), y: (\d+)/);
  const cli = m.match(/PRACTICE_SPOT = \{ id: 'scarecrow', x: (\d+), y: (\d+)/);
  assert.ok(srv && cli); assert.deepStrictEqual([srv[1], srv[2]], [cli[1], cli[2]]);
});
