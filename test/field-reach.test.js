// Every find on the Ember field can be reached on foot. The barrows and the chapel are walled, and the long grave's
// wall (166 either way) was wider than the 170 you had to come within of its middle less your own width: three
// Episode IV chapters send you there and none could be finished. Found by playing them in the client.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { FINDS, FIELD, findReach } = require('../data/emberField');
const { STORYLINES } = require('../data/quests');
const scene = fs.readFileSync(path.join(__dirname, '..', 'client', 'ember-scene.js'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const lib = fs.readFileSync(path.join(__dirname, '..', 'lib', 'emberField.js'), 'utf8');

const walled = (f) => /barrow|chapel/.test(f.model);
const half = (f) => f.size * 0.32;
const clientRadius = (f) => Math.max(150, walled(f) ? Math.round(f.size * 0.32 * 1.42) + 40 : 0);
const BODY = 16;   // a player's own half-width against a wall

test('the client builds the wall and the offer the way this test thinks it does', () => {
  assert.match(scene, /if \(\/barrow\|chapel\/\.test\(f\.model\)\) \{ const h = f\.size \* 0\.32; scene\.userData\.walls\.push\(\{ x: f\.x - h, y: f\.y - h, w: h \* 2, h: h \* 2 \}\); \}/);
  assert.match(scene, /radius: Math\.max\(150, \/barrow\|chapel\/\.test\(f\.model\) \? Math\.round\(f\.size \* 0\.32 \* 1\.42\) \+ 40 : 0\) \}\);/);
});

test('standing against any side or corner of a walled find, it is offered and the server agrees', () => {
  for (const f of FINDS.filter(walled)) {
    const h = half(f) + BODY, side = h, corner = Math.hypot(h, h);
    assert.ok(side <= clientRadius(f), `${f.id}: offered at its side (${side.toFixed(0)} vs ${clientRadius(f)})`);
    assert.ok(corner <= clientRadius(f) + 6, `${f.id}: offered at its corner (${corner.toFixed(0)} vs ${clientRadius(f)})`);
    assert.ok(findReach(f) >= clientRadius(f) + 15, `${f.id}: the server reaches a little past where the client offers it`);
  }
});

test('the long grave, which was the one out of reach', () => {
  const f = FINDS.find((x) => x.id === 'long_grave');
  assert.ok(half(f) + BODY > FIELD.range, 'its wall alone put it past the plain range');
  assert.ok(findReach(f) > 280);
  const sends = [];
  for (const c of Object.keys(STORYLINES)) for (const ch of STORYLINES[c].chapters) if (ch.objective.room === 'field_long_grave') sends.push(ch.id);
  assert.deepStrictEqual(sends.sort(), ['b13', 'nec14', 'w15']);
});

test('an open find keeps the plain range, and no find is offered from absurdly far', () => {
  for (const f of FINDS.filter((x) => !walled(x))) assert.strictEqual(findReach(f), FIELD.range);
  for (const f of FINDS) assert.ok(findReach(f) <= 320, f.id);
});

test('both server checks use it', () => {
  assert.match(server, /Math\.hypot\(player\.x - f\.x, player\.y - f\.y\) <= findReach\(f\)\)/);
  assert.match(lib, /Math\.hypot\(player\.x - f\.x, player\.y - f\.y\) > findReach\(f\)\)/);
  assert.ok(!/FIELD\.range/.test(server) && !/FIELD\.range/.test(lib));
});
