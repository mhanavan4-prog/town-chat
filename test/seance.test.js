'use strict';
const test = require('node:test');
const assert = require('node:assert');
const s = require('../lib/seance.js');

test('normalizeMessage strips to board charset and collapses space', () => {
  assert.equal(s.normalizeMessage("  who's there?  "), 'WHOS THERE');
  assert.equal(s.normalizeMessage('Five  Hands\tNo\nMore'), 'FIVE HANDS NO MORE');
  assert.equal(s.normalizeMessage(null), '');
  assert.equal(s.normalizeMessage(42), '42');
});

test('sanitize returns clean message, null on empty, caps length', () => {
  assert.equal(s.sanitize('the door holds'), 'THE DOOR HOLDS');
  assert.equal(s.sanitize('!!!'), null);
  assert.equal(s.sanitize(''), null);
  const long = s.sanitize('A'.repeat(80), { maxChars: 10 });
  assert.equal(long.length, 10);
});

test('sanitize rejects a blocklisted term (space-insensitive)', () => {
  assert.equal(s.sanitize('a BADWORD here', { blocklist: ['badword'] }), null);
  assert.equal(s.sanitize('b a d w o r d', { blocklist: ['badword'] }), null);
  assert.equal(s.sanitize('safe message', { blocklist: ['badword'] }), 'SAFE MESSAGE');
});

test('buildSteps: YES / NO slide to one spot, no GOODBYE tail', () => {
  const yes = s.buildSteps('yes');
  assert.deepEqual(yes.steps, [{ kind: 'word', glyph: 'YES', char: 'YES' }]);
  assert.equal(yes.closed, false);
  const no = s.buildSteps('No!');
  assert.equal(no.steps.length, 1);
  assert.equal(no.steps[0].glyph, 'NO');
});

test('buildSteps: a message spells out then closes on GOODBYE', () => {
  const r = s.buildSteps('hi there');
  const glyphs = r.steps.filter((x) => x.kind === 'glyph').map((x) => x.glyph).join('');
  assert.equal(glyphs, 'HITHERE');
  assert.ok(r.steps.some((x) => x.kind === 'space'));
  const last = r.steps[r.steps.length - 1];
  assert.equal(last.glyph, 'GOODBYE');
  assert.equal(last.close, true);
  assert.equal(r.closed, true);
});

test('scheduleFor gives strictly increasing times and flags repeats', () => {
  const { steps } = s.buildSteps('BOO');
  const sched = s.scheduleFor(steps);
  for (let i = 1; i < sched.length; i++) {
    assert.ok(sched[i].atMs > sched[i - 1].atMs, 'times must increase');
  }
  // the second O is a repeat of the first O -> flagged, and takes longer
  const os = sched.filter((x) => x.glyph === 'O');
  assert.equal(os.length, 2);
  assert.equal(os[1].repeat, true);
});

test('pickAnswer is deterministic under a seeded rng and stays in the bank', () => {
  const first = s.pickAnswer({ rng: () => 0 });
  assert.equal(first, s.FALLBACK_LINES[0]);
  const last = s.pickAnswer({ rng: () => 0.9999 });
  assert.equal(last, s.FALLBACK_LINES[s.FALLBACK_LINES.length - 1]);
  assert.ok(s.FALLBACK_LINES.includes(s.pickAnswer({ rng: () => 0.5 })));
});

test('canStart passes only when every gate is satisfied', () => {
  const base = {
    enabled: true, inCoven: true, inManor: true, active: false,
    membersPresent: 2, minMembers: 2, gold: 100, offeringCost: 25,
    lastAt: 0, now: 1_000_000, cooldownMs: 1000,
  };
  assert.deepEqual(s.canStart(base), { ok: true });
});

test('canStart reports each failure reason', () => {
  const base = {
    enabled: true, inCoven: true, inManor: true, active: false,
    membersPresent: 3, minMembers: 2, gold: 100, offeringCost: 25,
    lastAt: 0, now: 1_000_000, cooldownMs: 1000,
  };
  assert.equal(s.canStart({ ...base, enabled: false }).reason, 'disabled');
  assert.equal(s.canStart({ ...base, inCoven: false }).reason, 'not_in_coven');
  assert.equal(s.canStart({ ...base, inManor: false }).reason, 'not_in_manor');
  assert.equal(s.canStart({ ...base, active: true }).reason, 'already_active');
  assert.equal(s.canStart({ ...base, membersPresent: 1 }).reason, 'need_members');
  assert.equal(s.canStart({ ...base, gold: 0 }).reason, 'cannot_afford');

  const cd = s.canStart({ ...base, lastAt: 999_500, now: 1_000_000, cooldownMs: 1000 });
  assert.equal(cd.reason, 'cooldown');
  assert.equal(cd.retryMs, 500);
});
