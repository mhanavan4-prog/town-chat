'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { RELICS } = require('../data/relics.js');
const { titleExists, titleName } = require('../data/titles.js');

test('the reliquary catalogue is real and well-formed', () => {
  assert.ok(RELICS.length >= 6, 'enough relics to be a collection');
  const ids = RELICS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique (inspections keyed by id)');
  for (const r of RELICS) {
    assert.ok(r.id && typeof r.id === 'string', 'relic has an id');
    assert.ok(r.name && r.name.trim().length > 0, `${r.id} has a name`);
    assert.ok(r.room && r.room.trim().length > 0, `${r.id} names the room it waits in`);
    assert.ok(r.text && r.text.trim().length >= 80, `${r.id} has a real lore card`);
  }
});

test('relic ids match the pedestals wired into the furniture', () => {
  // These are the relicIds pushed as kiosks in client/furniture.js — the set
  // must line up or an in-world relic would have no card (or vice-versa).
  const wired = [
    'scrying_orb', 'star_grimoire', 'starforged_blade', 'moon_relic',
    'phantom_lantern', 'spirit_bell', 'bound_spirit', 'seance_planchette',
  ].sort();
  assert.deepEqual(RELICS.map((r) => r.id).sort(), wired);
});

test('the completion title exists and resolves', () => {
  assert.ok(titleExists('reliquary_keeper'));
  assert.ok(titleName('reliquary_keeper') && titleName('reliquary_keeper').length > 0);
});

test('inspect-logging and completion behave (simulated handler logic)', () => {
  const seen = {};
  const inspect = (id) => { let first = false; if (!seen[id]) { seen[id] = Date.now(); first = true; } return first; };
  const complete = () => RELICS.every((r) => seen[r.id]);

  assert.equal(inspect(RELICS[0].id), true, 'first inspection logs');
  assert.equal(inspect(RELICS[0].id), false, 're-inspecting does not re-log');
  assert.equal(complete(), false, 'not complete with one relic');

  let completions = 0;
  for (const r of RELICS) { if (inspect(r.id) && complete()) completions++; }
  assert.equal(complete(), true, 'all relics inspected → complete');
  assert.equal(completions, 1, 'completion fires exactly once, on the final relic');
});
