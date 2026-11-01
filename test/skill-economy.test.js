// Escalating-cost skill economy (scarcity): deeper ranks cost more points, so a
// class tree can never be fully filled within the level cap — every point is a
// choice. Also covers the one-time boot respec that fairly refunds pre-deploy
// allocations. Runs against the real server.js via the exposed test hooks.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-skillecon-');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

const S = require('../data/skills');
require('../server.js');

setTimeout(() => {
  const { migrateSkillEconomy, getProgress, playerProgress } = global.__testHooks;

  // ── 1. Rank costs escalate; keystones are a flat cost ──
  const core = { id: 'x' };               // no tier → core skill
  const key = { tier: 'keystone' };
  check('rank 1 costs 1', S.skillRankCost(core, 1) === 1);
  check('rank 2 costs 2', S.skillRankCost(core, 2) === 2);
  check('rank 3 costs 3', S.skillRankCost(core, 3) === 3);
  check('maxing a core skill costs 6', S.skillSpentCost(core, 3) === 6, S.skillSpentCost(core, 3));
  check('keystone is a flat cost', S.skillRankCost(key, 1) === S.KEYSTONE_COST);
  check('keystone spent cost matches', S.skillSpentCost(key, 1) === S.KEYSTONE_COST);

  // ── 2. Scarcity: a tree cannot be fully filled within the level cap ──
  // A character earns ~19 skill points for life (1/level, cap at level 20).
  const LIFETIME_POINTS = 19;
  const tree = S.SKILL_CATALOG[5]; // Necromancer
  let full = 0;
  for (const s of tree) { if (s.tier === 'keystone') continue; full += S.skillSpentCost(s, s.maxRank || 3); }
  full += S.KEYSTONE_COST; // plus one sworn pact
  check('completing a class tree costs far more than a lifetime of points', full > LIFETIME_POINTS, { full, LIFETIME_POINTS });

  // ── 3. Boot respec refunds pre-deploy ranks (1/rank) and clears, idempotently ──
  delete playerProgress['econT'];
  playerProgress['econT'] = {
    _charLeveled: true, // skip the unrelated legacy fold
    characters: { '5': { level: 10, xp: 0, skillPoints: 2 } },
    skills: { '5': { necro_power: 3, necro_leech: 1 } } // 4 ranks, old cost = 4
  };
  migrateSkillEconomy(playerProgress['econT']);
  const a = playerProgress['econT'];
  check('spent ranks refunded 1-per-rank to the pool', a.characters['5'].skillPoints === 6, a.characters['5'].skillPoints); // 2 unspent + 4 refunded
  check('skill tree cleared for a fair re-spend', Object.keys(a.skills['5']).length === 0, a.skills['5']);
  check('economy-migration flag is set', a._skillEconV2 === true);
  const before = JSON.stringify(a.characters);
  migrateSkillEconomy(a);
  check('a second pass does not double-refund (idempotent)', JSON.stringify(a.characters) === before && Object.keys(a.skills['5']).length === 0);

  // ── 4. A brand-new account is born already migrated (never wiped on restart) ──
  delete playerProgress['freshT'];
  getProgress({ accountKey: 'freshT', charId: 5 });
  check('new accounts are stamped _skillEconV2 at creation', playerProgress['freshT']._skillEconV2 === true, playerProgress['freshT']._skillEconV2);

  // ── 5. Combat hook: the Pale Reaper pact heals on kill (behavior, not a stat) ──
  const { hasPact, pactOnKill, playerMaxHealth } = global.__testHooks;
  delete playerProgress['reaperT'];
  playerProgress['reaperT'] = { _charLeveled: true, _skillEconV2: true, characters: { '5': { level: 10, xp: 0, skillPoints: 0 } }, skills: { '5': { necro_k_reaper: 1 } } };
  const reaper = { accountKey: 'reaperT', charId: 5, health: 10, isDead: false };
  check('a sworn Reaper is detected by hasPact', hasPact(reaper, 'necro_k_reaper') === true);
  const cap = playerMaxHealth(reaper);
  pactOnKill(reaper);
  check('Reaper heals 20% of max HP on a kill', reaper.health === Math.min(cap, 10 + Math.round(cap * 0.20)), { health: reaper.health, cap });
  // A dead Reaper does not resurrect off a kill credited in the same frame.
  const deadReaper = { accountKey: 'reaperT', charId: 5, health: 0, isDead: true };
  pactOnKill(deadReaper);
  check('a dead Reaper is not healed by the hook', deadReaper.health === 0);
  // A Lich WITHOUT the pact gets no on-kill heal.
  delete playerProgress['noReaperT'];
  playerProgress['noReaperT'] = { _charLeveled: true, _skillEconV2: true, characters: { '5': { level: 10 } }, skills: { '5': {} } };
  const plain = { accountKey: 'noReaperT', charId: 5, health: 10, isDead: false };
  pactOnKill(plain);
  check('no pact → no on-kill heal', plain.health === 10, plain.health);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
