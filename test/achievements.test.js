// Achievements / collection log — the permanent per-account trophy shelf.
// Tests the pure module directly (no server boot): catalog shape, the claim
// mechanic (idempotent, threshold-gated), the max-stat path for Delve depth,
// and the collection-log view the UI renders.
const ach = require('../lib/achievements');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ── Catalog is well-formed ──────────────────────────────────────────────────
check('there are achievements to earn', ach.ACHIEVEMENTS.length >= 18, ach.ACHIEVEMENTS.length);
check('TOTAL matches the catalog length', ach.TOTAL === ach.ACHIEVEMENTS.length, { TOTAL: ach.TOTAL });

const ids = new Set();
let badShape = null, dupe = null;
for (const a of ach.ACHIEVEMENTS) {
  if (ids.has(a.id)) dupe = a.id;
  ids.add(a.id);
  if (!a.id || !a.cat || !a.icon || !a.name || !a.desc || !a.stat || !(a.need > 0) || !(a.tier >= 1)) badShape = a.id || JSON.stringify(a);
}
check('every achievement is fully formed', !badShape, badShape);
check('achievement ids are unique', !dupe, dupe);

// Each ladder's thresholds strictly increase, so tier 2 can never be earnable
// before tier 1 on the same stat.
let badLadder = null;
for (const c of ach.CATEGORIES) {
  for (let i = 1; i < c.tiers.length; i++) if (!(c.tiers[i].need > c.tiers[i - 1].need)) badLadder = c.cat;
}
check('ladders escalate (tier thresholds strictly increase)', !badLadder, badLadder);

// ── A fresh account has earned nothing ──────────────────────────────────────
const acc = {};
check('a new account unlocks nothing', ach.evaluate(acc, 1000).length === 0);
check('the fresh log reports 0 / total', ach.logView(acc).unlocked === 0 && ach.logView(acc).total === ach.TOTAL);

// ── Crossing a threshold claims exactly that tier, once ──────────────────────
acc.monstersSlain = 25;
const first = ach.evaluate(acc, 2000);
check('reaching 25 kills claims Blooded', first.length === 1 && first[0].id === 'slayer_1', first.map(a => a.id));
check('the claim is stamped with the time', acc.achievements.slayer_1 === 2000, acc.achievements.slayer_1);
check('re-evaluating does not double-claim', ach.evaluate(acc, 3000).length === 0);

acc.monstersSlain = 250;
const second = ach.evaluate(acc, 4000);
check('reaching 250 kills claims the next tier only', second.length === 1 && second[0].id === 'slayer_2', second.map(a => a.id));

// A big jump can claim several tiers of DIFFERENT ladders at once.
acc.bossKills = 1; acc.harvests = 20;
const multi = ach.evaluate(acc, 5000).map(a => a.id).sort();
check('a mixed jump claims each newly-earned trophy', multi.join() === ['boss_1', 'forage_1'].join(), multi);

// ── Capstones broadcast; lower tiers do not ──────────────────────────────────
const capAcc = { monstersSlain: 1500 };
const cap = ach.evaluate(capAcc, 6000);
check('a tier-3 capstone is flagged for a town shout', cap.length === 3 && cap.find(a => a.id === 'slayer_3').broadcast === true, cap.map(a => [a.id, a.broadcast]));
check('tier-1 is not broadcast', cap.find(a => a.id === 'slayer_1').broadcast === false);

// ── Delve depth is a high-water mark, not a running count ─────────────────────
const dacc = {};
ach.noteMax(dacc, 'delveDeepest', 7);
check('noteMax records the depth reached', dacc.delveDeepest === 7, dacc.delveDeepest);
ach.noteMax(dacc, 'delveDeepest', 3); // a shallower later run must not lower it
check('a shallower run never lowers the mark', dacc.delveDeepest === 7, dacc.delveDeepest);
const delved = ach.evaluate(dacc, 7000).map(a => a.id).sort();
check('floor 7 claims both Threshold and Deep Walker', delved.join() === ['delve_1', 'delve_2'].join(), delved);

// ── The collection-log view the client renders ───────────────────────────────
const view = ach.logView(acc);
const blooded = view.achievements.find(a => a.id === 'slayer_1');
check('log entries carry display + progress', blooded && blooded.unlocked && blooded.have === 25 && blooded.pct === 1, blooded);
const reaper = view.achievements.find(a => a.id === 'slayer_3');
check('an unearned entry shows partial progress, capped at need', reaper && !reaper.unlocked && reaper.have === 250 && reaper.pct > 0 && reaper.pct < 1, reaper);
check('the log counts unlocked vs total', view.unlocked === Object.keys(acc.achievements).length && view.total === ach.TOTAL, { u: view.unlocked, t: view.total });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
