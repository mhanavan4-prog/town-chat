'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { DYES, DYE_UNLOCKS, dyeUnlock, dyeHex } = require('../data/wardrobe.js');

const FINERY = ['obsidian', 'bone', 'oxblood', 'viridian', 'amethyst', 'pearl'];

test('the Finery line exists as real, gold-priced dyes', () => {
  for (const id of FINERY) {
    const d = DYES.find((x) => x.id === id);
    assert.ok(d, `${id} is in the dye palette`);
    assert.ok(d.label && d.label.length > 0, `${id} has a label`);
    assert.equal(typeof dyeHex(id), 'number', `${id} has a usable hex`);
    const u = dyeUnlock(id);
    assert.ok(u && typeof u.gold === 'number' && u.gold > 0, `${id} is priced in gold`);
    assert.ok(!u.ms, `${id} is NOT a moonstone dye (it's the gold sink)`);
  }
});

test('Finery prices are a meaningful sink and ordered sensibly', () => {
  const prices = FINERY.map((id) => DYE_UNLOCKS[id].gold);
  for (const p of prices) assert.ok(p >= 300, 'each Finery dye is a real gold cost');
  assert.ok(Math.max(...prices) <= 5000, 'but not absurd');
});

test('ownership gate: a gold dye is buyable until owned, then free to equip (simulated)', () => {
  // Mirrors dyeState(): a { gold } dye reads as "buygold" until its id is in the
  // account-wide dyesPurchased list, then "ok".
  const state = (owned, id) => {
    const u = dyeUnlock(id);
    if (!u || !u.gold) return 'n/a';
    return owned.indexOf(id) !== -1 ? 'ok' : 'buygold';
  };
  assert.equal(state([], 'amethyst'), 'buygold', 'unowned → must buy');
  assert.equal(state(['amethyst'], 'amethyst'), 'ok', 'owned → equippable');
});

test('Finery dyes do not collide with existing dye ids or hexes', () => {
  const ids = DYES.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'all dye ids unique');
  const hexes = DYES.filter((d) => d.hex != null).map((d) => d.hex);
  assert.equal(new Set(hexes).size, hexes.length, 'all dye hexes unique (distinct swatches)');
});
