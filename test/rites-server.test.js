// Coven Rites — server wiring (Session P). The engine is unit-tested in
// rites.test.js; this proves the glue in server.js: contributions bank through
// riteCredit, the upkeep gate blocks lapsed covens, completion pays gold to
// contributors' BANK (the offline-safe path) and mints the coven season buff.
//
// TC_SEASON pins the live sabbat to Samhain; TC_RITE_GATE_HOURS=0 collapses the
// real-time phase gates so the whole Rite can be driven in one tick.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-rites-srv-');
process.env.TC_SEASON = 'samhain';
process.env.TC_RITE_GATE_HOURS = '0';

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');
const srv = global.__testHooks;

function mkCoven(id, members, paidThroughAt) {
  srv.covens[id] = { id, name: id, sigil: '🕯️', leaderKey: members[0], members: members.slice(),
    bank: { gold: 0, slots: [] }, log: [], paidThroughAt };
  for (const k of members) srv.covenIndex.set(k, id);
  return srv.covens[id];
}
const P = (k) => ({ accountKey: k });

setTimeout(() => {
  try {
    const data = srv.rites.riteDataFor('samhain');
    check('Samhain rite data resolves', !!data && data.id === 'rite_samhain');

    // ── A coven in good standing can progress ───────────────────────────────
    const cv = mkCoven('good', ['a0', 'a1', 'a2'], Date.now() + 1e9);
    srv.ensureCovenRite(cv);
    check('ensureCovenRite builds a live Samhain rite', cv.rite && !cv.rite.none && cv.rite.seasonKey === 'samhain', cv.rite && cv.rite.seasonKey);
    check('member scale snapshot = roster size (3)', cv.rite.memberScale === 3, cv.rite.memberScale);

    const crowObj = data.phases[0].objectives[0], featherObj = data.phases[0].objectives[1];
    const crowT = srv.rites.targetFor(crowObj, 3), featherT = srv.rites.targetFor(featherObj, 3);

    // Upkeep gate: a lapsed coven earns nothing.
    const lapsed = mkCoven('lapsed', ['b0', 'b1'], Date.now() - 1000);
    srv.ensureCovenRite(lapsed);
    srv.riteCredit(P('b0'), 'kill_creature', 'gravewing_crow', crowT);
    check('lapsed-upkeep coven gets NO rite credit', (lapsed.rite.phases[0].progress.crows || 0) === 0, lapsed.rite.phases[0].progress);

    // Good coven banks contributions (two members, per-member cap enforced).
    srv.riteCredit(P('a0'), 'kill_creature', 'gravewing_crow', 9999);
    check('a single member cannot finish an objective alone', (cv.rite.phases[0].progress.crows || 0) < crowT, cv.rite.phases[0].progress.crows);
    srv.riteCredit(P('a1'), 'kill_creature', 'gravewing_crow', 9999);
    srv.riteCredit(P('a0'), 'harvest_specific', 'ravens_feather_plant', 9999);
    srv.riteCredit(P('a1'), 'harvest_specific', 'ravens_feather_plant', 9999);
    check('phase 0 (Gather the Offering) completes', cv.rite.phases[0].completedAt != null, cv.rite.phases[0]);

    // Phase 1 (candles): with gate 0 it's open; drive it via the engine so phase 2 opens.
    const candleT = srv.rites.candleTarget(data.phases[1], 3);
    for (let i = 0; i < candleT; i++) srv.rites.lightCandle(data, cv.rite, 'a' + i, Date.now());
    check('phase 1 (Light the Watch) completes at candle target', cv.rite.phases[1].completedAt != null, { candleT });

    // Phase 2 (veil): completing this via riteCredit should fire the server's
    // completion path — gold to bank + season buff.
    const hexObj = data.phases[2].objectives[0], hexT = srv.rites.targetFor(hexObj, 3);
    const reward = srv.rites.individualReward(data, cv.rite);
    const a2BankBefore = srv.ensureBankAccount('a2').balance;
    // Titles are stored on the account progress record — give two contributors
    // one before completion so the grant has somewhere to land.
    srv.getProgress({ accountKey: 'a0', charId: 1 });
    srv.getProgress({ accountKey: 'a1', charId: 1 });
    srv.riteCredit(P('a0'), 'kill_creature', 'fen_hexer', 9999);
    srv.riteCredit(P('a1'), 'kill_creature', 'fen_hexer', 9999);
    check('the whole Rite completes', cv.rite.completedAt != null);
    check('season buff minted on the coven record', srv.rites.activeSeasonBuff(cv, Date.now()) && srv.rites.activeSeasonBuff(cv, Date.now()).xpMult === 1.15);

    // Reward: gold paid to EVERY contributor's bank (works for offline members —
    // none of a0..a2 are "connected" here, so this is the offline path).
    check('contributor a0 was paid rite gold to the bank', srv.ensureBankAccount('a0').balance >= reward.gold, { bal: srv.ensureBankAccount('a0').balance, reward: reward.gold });
    check('a contributor who only lit a candle (a2) still got gold', srv.ensureBankAccount('a2').balance - a2BankBefore >= reward.gold, { delta: srv.ensureBankAccount('a2').balance - a2BankBefore, reward: reward.gold });

    // ── XP buff actually reaches grantXP for a completed-rite coven member ───
    // (global sabbat-day mult also 1.15 here, so assert the member gains at the
    //  blessed rate rather than the un-blessed base.)
    const member = { accountKey: 'a0', charId: 1, ws: { readyState: 1, send() {} } };
    const prog = srv.getProgress(member); const before = prog.xp;
    srv.grantXP(member, 100);
    check('XP lands boosted for a blessed coven member (>100)', srv.getProgress(member).xp - before >= 115, srv.getProgress(member).xp - before);

    // ── Titles: completion granted the honorific; it resolves via the catalog ─
    const tp = srv.titlesPayloadFor('a0');
    check('completing the Rite grants the title to a contributor', tp.earned.some(t => t.id === 'hollow_vigil'), tp.earned);
    check('the granted title resolves to its catalog name', tp.earned.some(t => t.name === 'Keeper of the Hollow Vigil'));
    check('no active title until one is chosen', tp.active === null, tp.active);

    // ── Parlor access perk: good-standing covens enter the lounge pass-free ──
    check('good-standing coven member enters the Parlor without a pass', srv.canEnterPassRoom(P('a0'), 'lounge') === true);
    check('the Arcade stays pass-only even for coven members', srv.canEnterPassRoom(P('a0'), 'arcade') === false);
    check('a lapsed-upkeep coven member is still barred from the Parlor', srv.canEnterPassRoom(P('b0'), 'lounge') === false);
    check('a player with no coven is barred from the Parlor', srv.canEnterPassRoom(P('nobody'), 'lounge') === false);

    // ── A sabbat with no authored rite → dormant marker ─────────────────────
    const cv2 = mkCoven('offseason', ['c0', 'c1'], Date.now() + 1e9);
    srv.rites.ensureRite(cv2, { key: '__none__', startsAt: Date.now(), endsAt: Date.now() + 1e9 }, 2, Date.now());
    check('a season with no authored rite yields a dormant (none) rite', cv2.rite.none === true);
  } catch (e) {
    check('test ran without throwing', false, String(e && e.stack || e));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
