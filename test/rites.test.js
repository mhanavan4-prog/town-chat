// Coven Rites engine (lib/rites.js) — the pure lifecycle logic, driven with an
// injected clock so the real-time phase gates and the season boundary are
// deterministic. Covers every anti-exploit rule we promised: member scaling,
// per-member caps (co-op forced), distinct-contributor minimums, gated phases,
// the candle phase, completion + season buff, active-phase-only crediting,
// expiry + consolation, and rotation at the sabbat boundary.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { RITES, RITE_MEMBER_FLOOR, RITE_MEMBER_CAP, RITE_CONSOLATION_FRACTION } = require('../data/rites.js');
const { SABBATS } = require('../data/seasons.js');
const seasonEffects = (k) => { const s = SABBATS.find(x => x.key === k); return s ? s.effects : {}; };
const R = require('../lib/rites.js')({ RITES, RITE_MEMBER_FLOOR, RITE_MEMBER_CAP, RITE_CONSOLATION_FRACTION, seasonEffects });

const HOUR = 3600 * 1000;
const T0 = Date.UTC(2026, 9, 31);                 // a Samhain start
const SEASON = { key: 'samhain', startsAt: T0, endsAt: T0 + 45 * 24 * HOUR };
const GATE = (RITES.samhain.phases[1].gateHours) * HOUR; // real configured gate

function freshCoven(members) { return { id: 'c1', members: members.slice(), rite: undefined }; }
function keys(n) { return Array.from({ length: n }, (_, i) => 'm' + i); }

// ── Scaling + clamp ─────────────────────────────────────────────────────────
check('member scale clamps to the floor', R.clampScale(1) === RITE_MEMBER_FLOOR, R.clampScale(1));
check('member scale clamps to the cap', R.clampScale(99) === RITE_MEMBER_CAP, R.clampScale(99));
const crowObj = RITES.samhain.phases[0].objectives[0];
check('a bigger coven gets a bigger target', R.targetFor(crowObj, 8) > R.targetFor(crowObj, 2),
  { s2: R.targetFor(crowObj, 2), s8: R.targetFor(crowObj, 8) });

// ── A 3-member coven runs the whole Rite ────────────────────────────────────
const cv = freshCoven(keys(3));
let now = T0 + 60000;
const ens = R.ensureRite(cv, SEASON, cv.members.length, now);
check('ensureRite builds a Samhain rite', ens.rite && ens.rite.riteId === 'rite_samhain' && !ens.rite.none);
check('member scale snapshotted at start (3)', cv.rite.memberScale === 3, cv.rite.memberScale);
check('phase 0 opens immediately', R.phaseUnlocked(cv.rite, 0, now));
check('phase 1 starts locked (gated)', !R.phaseUnlocked(cv.rite, 1, now));

const data = RITES.samhain;
const crowT = R.targetFor(crowObj, 3), featherObj = RITES.samhain.phases[0].objectives[1];
const featherT = R.targetFor(featherObj, 3);

// One member tries to solo the crows — the per-member cap must stop them short.
const solo = R.contribute(data, cv.rite, 'm0', 'kill_creature', 'gravewing_crow', crowT, now);
check('per-member cap blocks a solo clear (banked < target)', solo.credited < crowT, { credited: solo.credited, target: crowT });
check('one member can bank at most ~half', solo.credited <= Math.ceil(crowT * 0.5), { credited: solo.credited });

// A later-phase creature is ignored while phase 0 is active (no pre-farming).
const prefarm = R.contribute(data, cv.rite, 'm0', 'kill_creature', 'fen_hexer', 50, now);
check('cannot pre-farm a later phase objective', prefarm.credited === 0);

// A second member finishes the crows; both plug away at feathers to clear phase 0.
R.contribute(data, cv.rite, 'm1', 'kill_creature', 'gravewing_crow', crowT, now);
check('crows objective reaches target with 2 members', (cv.rite.phases[0].progress.crows || 0) >= crowT, cv.rite.phases[0].progress.crows);
R.contribute(data, cv.rite, 'm0', 'harvest_specific', 'ravens_feather_plant', featherT, now);
const fDone = R.contribute(data, cv.rite, 'm1', 'harvest_specific', 'ravens_feather_plant', featherT, now);
check('phase 0 completes once both objectives + 2 contributors met', cv.rite.phases[0].completedAt != null);
check('phase 0 completion was reported', fDone.phaseCompleted === true);

// ── Gating: phase 1 only opens GATE ms after phase 0 completed ──────────────
check('phase 1 still locked right after phase 0 done', !R.phaseUnlocked(cv.rite, 1, now + 1000));
now = cv.rite.phases[0].completedAt + GATE + 1000;
R.refreshUnlocks(data, cv.rite, now);
check('phase 1 unlocks after the attunement gate', R.phaseUnlocked(cv.rite, 1, now));

// ── Candle phase: distinct contributors, no double-dipping ──────────────────
const candleT = R.candleTarget(data.phases[1], cv.rite.memberScale);
const c1 = R.lightCandle(data, cv.rite, 'm0', now);
check('a candle lights', c1.lit === true && c1.count === 1);
const c1again = R.lightCandle(data, cv.rite, 'm0', now);
check('the same member cannot light twice', c1again.lit === false && c1again.already === true);
check('phase 1 not complete with one candle', !cv.rite.phases[1].completedAt);
let lastCandle;
for (let i = 1; i < candleT; i++) lastCandle = R.lightCandle(data, cv.rite, 'm' + i, now);
check('phase 1 completes at the candle target', cv.rite.phases[1].completedAt != null, { target: candleT });

// ── Hold the Veil → whole Rite completes → season buff minted ───────────────
now = cv.rite.phases[1].completedAt + GATE + 1000;
R.refreshUnlocks(data, cv.rite, now);
check('phase 2 unlocks after its gate', R.phaseUnlocked(cv.rite, 2, now));
const hexObj = data.phases[2].objectives[0], hexT = R.targetFor(hexObj, cv.rite.memberScale);
R.contribute(data, cv.rite, 'm0', 'kill_creature', 'fen_hexer', hexT, now);
const vDone = R.contribute(data, cv.rite, 'm1', 'kill_creature', 'fen_hexer', hexT, now);
check('final phase completes', cv.rite.phases[2].completedAt != null);
check('Rite reports completion', vDone.riteCompleted === true);
check('Rite marked completed', cv.rite.completedAt != null);
check('season buff minted on completion', cv.rite.seasonBuff && cv.rite.seasonBuff.effects.xpMult === seasonEffects('samhain').xpMult);
check('active season buff readable for the rest of the season', R.activeSeasonBuff(cv, now) && R.activeSeasonBuff(cv, now).xpMult === 1.15);
check('season buff expires with the season', R.activeSeasonBuff(cv, SEASON.endsAt + 1) === null);

// ── Expiry + consolation on an unfinished Rite ──────────────────────────────
const cv2 = freshCoven(keys(4));
let t2 = T0 + 1000;
R.ensureRite(cv2, SEASON, cv2.members.length, t2);
const cObj = data.phases[0].objectives[0], cT = R.targetFor(cObj, cv2.rite.memberScale);
R.contribute(data, cv2.rite, 'm0', 'kill_creature', 'gravewing_crow', 999, t2);
R.contribute(data, cv2.rite, 'm1', 'kill_creature', 'gravewing_crow', 999, t2);  // some progress, phase not finished
const exp = R.expireIfEnded(data, cv2.rite, SEASON.endsAt + 1);
check('an unfinished Rite expires at season end', exp.expired === true && cv2.rite.expiredAt != null);
check('contributors get a consolation grant', exp.consolation.length >= 1, exp.consolation);
check('non-contributors get nothing (only bankers listed)', exp.consolation.every(c => c.key === 'm0' || c.key === 'm1'), exp.consolation);
const expAgain = R.expireIfEnded(data, cv2.rite, SEASON.endsAt + 2);
check('consolation is idempotent (not paid twice)', expAgain.consolation.length === 0);

// ── Rotation at the sabbat boundary ─────────────────────────────────────────
const nextSeason = { key: 'yule', startsAt: SEASON.endsAt, endsAt: SEASON.endsAt + 40 * 24 * HOUR };
const rot = R.ensureRite(cv2, nextSeason, cv2.members.length, SEASON.endsAt + 5);
check('ensureRite rotates when the sabbat turns over', rot.rotated === true);
check('rotation hands back the previous rite for consolation', rot.prevRite != null);
check('a sabbat with no authored rite becomes a dormant marker', cv2.rite.none === true, cv2.rite);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
