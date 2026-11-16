// The Wastes' own pieces stand on their own ground line, with their footings, mounds and cuts buried
// (client/main.js staticInstance seat 'ground'; client/ember-scene.js groundSeat).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('only the Wastes pieces are seated on their own ground', () => {
  const src = read('client/ember-scene.js');
  const m = src.match(/function groundSeat\(key\) \{ (return [^}]*) \}/);
  assert.ok(m, 'groundSeat is defined');
  const groundSeat = new Function('key', m[1]);
  assert.strictEqual(groundSeat('em_barrow'), 'ground');
  assert.strictEqual(groundSeat('ruin_pillar'), undefined);
  assert.strictEqual(groundSeat(undefined), undefined);
});

test('a ground-seated model buries what is below its ground, and is sized by what stands above it', () => {
  const m = read('client/main.js');
  assert.match(m, /const sunk = seat === 'ground' \? Math\.max\(0, -t\.minY\) : 0;/);
  assert.match(m, /const native = mode === 'height' \? t\.size\.y - sunk : /);
  assert.match(m, /inst\.position\.y = \(sunk \? 0 : -t\.minY\) \* s;/);
});

test('every Wastes placement of a field piece, a town piece or a scatter piece asks for it', () => {
  const s = read('client/ember-scene.js');
  assert.ok((s.match(/groundSeat\(/g) || []).length >= 7);
  assert.match(s, /KK\.staticInstance\(f\.model, f\.size, 'fit', groundSeat\(f\.model\)\)/);
  assert.match(s, /KK\.staticInstance\(key, size, mode, groundSeat\(key\)\)/);
});
