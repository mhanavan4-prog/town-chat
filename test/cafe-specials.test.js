'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { CAFE_SPECIALS } = require('../data/cafeSpecials.js');
const { titleExists, titleName } = require('../data/titles.js');

test('the café menu is a real, well-formed catalogue', () => {
  assert.ok(CAFE_SPECIALS.length >= 7, 'enough specials for a multi-day rotation');
  const ids = CAFE_SPECIALS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique (tastes are keyed by id, never index)');
  for (const s of CAFE_SPECIALS) {
    assert.ok(s.id && typeof s.id === 'string', 'special has an id');
    assert.ok(s.name && s.name.trim().length > 0, `${s.id} has a name`);
    assert.ok(s.desc && s.desc.trim().length > 0, `${s.id} has a menu description`);
    assert.ok(s.taste && s.taste.trim().length >= 40, `${s.id} has a serving line`);
  }
});

test('the daily date-seed rotates through every special exactly once per cycle', () => {
  const len = CAFE_SPECIALS.length;
  const seen = new Map();
  for (let day = 0; day < len; day++) {
    const s = CAFE_SPECIALS[day % len];
    seen.set(s.id, (seen.get(s.id) || 0) + 1);
  }
  assert.equal(seen.size, len, 'every special appears within one cycle');
  for (const [, count] of seen) assert.equal(count, 1, 'each special appears exactly once per cycle');
});

test('the completion title exists and resolves', () => {
  assert.ok(titleExists('cauldron_regular'), 'the Regular at the Cauldron title is defined');
  assert.ok(titleName('cauldron_regular') && titleName('cauldron_regular').length > 0, 'it has a display name');
});

test('taste-logging and completion behave (simulated handler logic)', () => {
  const tasted = {};
  const logTaste = (id) => { let first = false; if (!tasted[id]) { tasted[id] = Date.now(); first = true; } return first; };
  const complete = () => CAFE_SPECIALS.every((s) => tasted[s.id]);

  assert.equal(logTaste(CAFE_SPECIALS[0].id), true, 'first taste logs');
  assert.equal(logTaste(CAFE_SPECIALS[0].id), false, 're-ordering the same special does not re-log');
  assert.equal(complete(), false, 'not complete with one special');

  let completionsFired = 0;
  for (const s of CAFE_SPECIALS) {
    const first = logTaste(s.id);
    if (first && complete()) completionsFired++;
  }
  assert.equal(complete(), true, 'all specials tasted → complete');
  assert.equal(completionsFired, 1, 'completion fires exactly once, on the final special');
});
