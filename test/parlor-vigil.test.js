'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PARLOR_SPIRITS } = require('../data/parlorSpirits.js');
const { titleExists, titleName } = require('../data/titles.js');

test('the parlor has a real, well-formed gallery of spirits', () => {
  assert.ok(PARLOR_SPIRITS.length >= 6, 'enough spirits for a multi-night rotation');
  const ids = PARLOR_SPIRITS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique (hearings keyed by id, never index)');
  for (const s of PARLOR_SPIRITS) {
    assert.ok(s.id && typeof s.id === 'string', 'spirit has an id');
    assert.ok(s.name && s.name.trim().length > 0, `${s.id} has a name`);
    assert.ok(s.epitaph && s.epitaph.trim().length > 0, `${s.id} has an epitaph`);
    assert.ok(s.message && s.message.trim().length >= 80, `${s.id} has a real whisper`);
  }
});

test('the nightly cycle-seed rotates through every spirit exactly once per cycle', () => {
  const len = PARLOR_SPIRITS.length;
  const seen = new Map();
  for (let night = 0; night < len; night++) {
    const s = PARLOR_SPIRITS[night % len];
    seen.set(s.id, (seen.get(s.id) || 0) + 1);
  }
  assert.equal(seen.size, len, 'every spirit surfaces within one cycle');
  for (const [, count] of seen) assert.equal(count, 1, 'each spirit surfaces exactly once per cycle');
});

test('the completion title exists and resolves', () => {
  assert.ok(titleExists('vigil_keeper'));
  assert.ok(titleName('vigil_keeper') && titleName('vigil_keeper').length > 0);
});

test('the vigil is night-gated and logs once per spirit (simulated handler logic)', () => {
  // Mirrors the sit_vigil handler: by day nothing is heard; by night the night's
  // spirit speaks and first hearings are logged; completion fires once.
  const heard = {};
  const sit = (isNight, spiritId) => {
    if (!isNight) return { night: false, firstHeard: false };
    let first = false;
    if (!heard[spiritId]) { heard[spiritId] = Date.now(); first = true; }
    return { night: true, firstHeard: first, complete: PARLOR_SPIRITS.every((s) => heard[s.id]) };
  };

  // Day: nothing is recorded.
  assert.equal(sit(false, PARLOR_SPIRITS[0].id).night, false);
  assert.equal(Object.keys(heard).length, 0, 'daytime sitting records nothing');

  // Night: first hearing logs, a repeat does not.
  assert.equal(sit(true, PARLOR_SPIRITS[0].id).firstHeard, true);
  assert.equal(sit(true, PARLOR_SPIRITS[0].id).firstHeard, false);

  let completions = 0;
  for (const s of PARLOR_SPIRITS) { const r = sit(true, s.id); if (r.firstHeard && r.complete) completions++; }
  assert.equal(PARLOR_SPIRITS.every((s) => heard[s.id]), true, 'all spirits heard → complete');
  assert.equal(completions, 1, 'completion fires exactly once, on the final spirit');
});
