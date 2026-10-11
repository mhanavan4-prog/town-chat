// Coven monthly upkeep (Session O): the active→grace→disband lifecycle, the
// "no bonus free days" payment rule, and the annual-reset anti-exploit (a coven
// can't ride the grace window to a free month every cycle).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-coven-upkeep-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');
const srv = global.__testHooks;

const DAY = 24 * 3600 * 1000;
let seq = 0;
function makeCoven(fields) {
  const id = 'cv_test_' + (++seq);
  srv.covens[id] = Object.assign({
    id, name: 'Testers ' + seq, nameLower: 'testers ' + seq, sigil: '🕯️',
    leaderKey: 'leader' + seq, members: ['leader' + seq],
    bank: { gold: 0, slots: [] }, log: [], table: null,
    graceStartedAt: 0, graceEndsAt: 0, graceUsedAt: 0
  }, fields);
  return srv.covens[id];
}

setTimeout(() => {
  try {
    const now = Date.now();

    // 1. Active coven survives a sweep untouched.
    const active = makeCoven({ paidThroughAt: now + 10 * DAY });
    srv.tickCovenUpkeep();
    check('active coven survives', !!srv.covens[active.id] && !srv.covens[active.id].graceEndsAt);

    // 2. Lapsed + grace-eligible → grace begins (coven stays alive).
    const lapsed = makeCoven({ paidThroughAt: now - DAY });
    srv.tickCovenUpkeep();
    check('lapsed coven enters grace (not disbanded)', !!srv.covens[lapsed.id]);
    check('grace window + graceUsedAt stamped', srv.covens[lapsed.id].graceEndsAt > now && srv.covens[lapsed.id].graceUsedAt > 0);

    // 3. Paying during grace = fresh 30 days, NO bonus free days, grace cleared.
    applyAndCheckNoBonus(lapsed.id);

    // 4. Grace expired unpaid → disband.
    const dying = makeCoven({ paidThroughAt: now - 40 * DAY, graceStartedAt: now - 31 * DAY, graceEndsAt: now - DAY, graceUsedAt: now - 31 * DAY });
    srv.tickCovenUpkeep();
    check('grace expired unpaid → coven disbanded', !srv.covens[dying.id]);

    // 5. Anti-exploit: lapses again while grace was used THIS year → immediate disband (no 2nd free window).
    const repeat = makeCoven({ paidThroughAt: now - DAY, graceStartedAt: 0, graceEndsAt: 0, graceUsedAt: now - 30 * DAY });
    srv.tickCovenUpkeep();
    check('second lapse within the year → immediate disband (no 2nd grace)', !srv.covens[repeat.id]);

    // 6. Annual reset: grace used > 1 year ago → eligible again.
    const reset = makeCoven({ paidThroughAt: now - DAY, graceStartedAt: 0, graceEndsAt: 0, graceUsedAt: now - 400 * DAY });
    srv.tickCovenUpkeep();
    check('grace used over a year ago → eligible, new grace granted', !!srv.covens[reset.id] && srv.covens[reset.id].graceEndsAt > now);
  } catch (e) {
    check('test ran without throwing', false, String(e && e.stack || e));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);

function applyAndCheckNoBonus(id) {
  const cv = srv.covens[id];
  const before = Date.now();
  srv.applyCovenUpkeepPayment(cv);
  const expected = before + srv.COVEN_UPKEEP_PERIOD_MS;
  // Fresh 30 days from NOW (grace days not credited): within a small tolerance.
  check('pay during grace → ~30 days from now (no bonus days)', Math.abs(cv.paidThroughAt - expected) < 5000, { paidThroughAt: cv.paidThroughAt, expected });
  check('pay clears the grace window', !cv.graceEndsAt && !cv.graceStartedAt);
  check('pay does NOT reset graceUsedAt (annual clock keeps running)', cv.graceUsedAt > 0);
}
