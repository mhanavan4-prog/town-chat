// A first-time player: somewhere safe to learn the sword, one line saying what to do next, a death that says it cost
// nothing, and a warning at the two doors that kill a low-level character at once.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('one guide: the First Step in hand as a line on a phone, the door warnings and the gentle death', async () => {
  const n = await import('../client/newcomer.js');
  const steps = [{ id: 'struck', label: 'Strike the practice scarecrow', icon: '🌾', done: false }, { id: 'talked', label: 'Speak with a townsperson', icon: '💬', done: false },
    { id: 'story', label: 'Begin your story', icon: '📜', done: false }];
  const first = n.newcomerNextStep({ steps, touch: true });
  assert.strictEqual(first.id, 'struck'); assert.match(first.text, /tap the sword/i); assert.match(first.title, /First Steps · 0\/3/);
  assert.match(n.newcomerNextStep({ steps, touch: false }).text, /press R/);
  assert.strictEqual(n.newcomerNextStep({ steps, touch: false, card: true }), null, 'a desktop shows the card, not a second guide');
  steps[0].done = true; steps[1].done = true;
  const story = n.newcomerNextStep({ steps, touch: true });
  assert.strictEqual(story.id, 'story'); assert.strictEqual(story.action, 'begin'); assert.match(story.title, /2\/3/);
  assert.strictEqual(n.newcomerNextStep({ steps, done: true }), null, 'and it stops when First Steps is done');
  assert.strictEqual(n.newcomerNextStep({ steps: null }), null, 'a veteran never had it');
  for (const id of ['struck', 'talked', 'ability', 'story', 'killed', 'harvested']) assert.ok(n.firstStepHint(id, true) && n.firstStepHint(id, false), id);
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
  assert.match(m, /setUnlockToast\(w\.text, \{ always: true, level: 'important' \}\);/, 'the warning shows whatever the notice settings (they are off by default)');
  assert.ok(!/opens at Level \$\{[^`]*`\)/.test(m), 'so does every "opens at Level N" answer to a tap');
  assert.match(m, /if \(!doorHeldBack\('ember'\)\) enterEmberWastes\(\)/);
  assert.match(m, /ATTACKABLE_KINDS = new Set\(\[[^\]]*'practice'/);
  assert.match(read('public/index.html'), /id="ghostNote"/);
  // the server's steps and the hints are the same six
  const ids = [...read('server.js').match(/const FIRST_STEPS = \[([\s\S]*?)\];/)[1].matchAll(/id: '(\w+)'/g)].map((x) => x[1]);
  assert.deepStrictEqual(ids, ['struck', 'talked', 'ability', 'story', 'killed', 'harvested']);
  assert.match(read('server.js'), /noteFirstStep\(player, 'struck'\);/); assert.match(read('server.js'), /noteFirstStep\(player, 'story'\);/);
  // the scarecrow stands where the server says it does
  const srv = read('server.js').match(/PRACTICE_TARGET = \{ id: 'scarecrow', x: (\d+), y: (\d+)/);
  const cli = m.match(/PRACTICE_SPOT = \{ id: 'scarecrow', x: (\d+), y: (\d+)/);
  assert.ok(srv && cli); assert.deepStrictEqual([srv[1], srv[2]], [cli[1], cli[2]]);
});
