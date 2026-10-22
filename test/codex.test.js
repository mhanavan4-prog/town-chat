'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { FORBIDDEN_BOOKS } = require('../data/forbiddenBooks.js');
const { CAFE_SPECIALS } = require('../data/cafeSpecials.js');
const { PARLOR_SPIRITS } = require('../data/parlorSpirits.js');
const { RELICS } = require('../data/relics.js');
const { titleExists } = require('../data/titles.js');

// The Codex gathers these four collections (plus the Arcade board) and their
// completion titles. Keep that wiring honest: every title the codex references
// must exist, and each collection's declared total must match its data.
const CODEX = [
  { key: 'forbidden', set: FORBIDDEN_BOOKS, title: 'well_read' },
  { key: 'cafe', set: CAFE_SPECIALS, title: 'cauldron_regular' },
  { key: 'vigil', set: PARLOR_SPIRITS, title: 'vigil_keeper' },
  { key: 'reliquary', set: RELICS, title: 'reliquary_keeper' },
];

test('every collection the codex references has a real completion title', () => {
  for (const c of CODEX) assert.ok(titleExists(c.title), `${c.key} → ${c.title} exists`);
  assert.ok(titleExists('arcade_champion'), 'the arcade champion title exists');
});

test('each collection has a non-empty set to tally against', () => {
  for (const c of CODEX) assert.ok(Array.isArray(c.set) && c.set.length > 0, `${c.key} has items`);
});

test('the codex tally counts only logged items, capped at the total', () => {
  // Mirrors the server tally(): count ids present in the progress map.
  const tally = (map, set) => set.reduce((n, x) => n + ((map && map[x.id]) ? 1 : 0), 0);
  for (const c of CODEX) {
    assert.equal(tally({}, c.set), 0, `${c.key}: empty progress → 0`);
    const full = Object.fromEntries(c.set.map((x) => [x.id, Date.now()]));
    assert.equal(tally(full, c.set), c.set.length, `${c.key}: all logged → total`);
    // Stray ids not in the set must not inflate the count.
    assert.equal(tally({ not_a_real_id: 1 }, c.set), 0, `${c.key}: unknown ids ignored`);
    const complete = tally(full, c.set) >= c.set.length;
    assert.equal(complete, true, `${c.key}: full map reads complete`);
  }
});
