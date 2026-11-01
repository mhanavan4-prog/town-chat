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

  // ── 6. Bonus point sources: Tome of Insight recipe (chapters are tested via story) ──
  const CT = require('../data/craftingTree');
  const tome = CT.CRAFT_RECIPES.find(r => r.id === 'tome_insight');
  check('Tome of Insight is a real craftable recipe', !!tome && tome.result === 'tome_insight');
  check('Tome yields a real catalog item', !!CT.CRAFT_ITEMS.tome_insight);
  check('Tome is gated behind the rarest mats', !!tome && ['dragon_scale', 'bloodmoon_shard', 'hollow_shard'].every(id => tome.ingredients.some(i => i.id === id)));
  check('Tome is not gold-purchased (crafted from mats, not bought)', !!tome && !tome.gold);
  check('Tome stays out of the Tier-1/2/3 chain rules', !!tome && tome.tier === 4);

  // ── 7. More pact combat behaviors (Wounded Fury, Last Stand) ──
  const { activePactBehavior, pactOutgoingDamage, pactIncomingDamage } = global.__testHooks;
  // Data: the two marquee pacts carry their behavior blocks.
  const bmSkill = S.SKILL_CATALOG[1].find((s) => s.id === 'wolf_k_bloodmoon');
  const jgSkill = S.SKILL_CATALOG[3].find((s) => s.id === 'knight_k_juggernaut');
  check('Bloodmoon Beast carries a Wounded Fury behavior', !!bmSkill.behavior && bmSkill.behavior.woundedFury > 0, bmSkill.behavior);
  check('Juggernaut carries a Last Stand behavior', !!jgSkill.behavior && jgSkill.behavior.lastStand > 0, jgSkill.behavior);

  // Wounded Fury (attacker-side): +35% damage scaling with missing health.
  delete playerProgress['bmT'];
  playerProgress['bmT'] = { _charLeveled: true, _skillEconV2: true, characters: { '1': { level: 10 } }, skills: { '1': { wolf_k_bloodmoon: 1 } } };
  const bm = { accountKey: 'bmT', charId: 1, health: 10, isDead: false }; // maxHP 100, 10% → +31.5%
  check('a sworn pact exposes its behavior block', !!activePactBehavior(bm) && activePactBehavior(bm).woundedFury === 0.35);
  check('Wounded Fury scales damage up at low HP', pactOutgoingDamage(bm, 100) === 132, pactOutgoingDamage(bm, 100)); // 100 * 1.315
  bm.health = 100;
  check('Wounded Fury is nil at full HP', pactOutgoingDamage(bm, 100) === 100, pactOutgoingDamage(bm, 100));

  // Last Stand (victim-side): −35% damage below 30% HP (maxHP 155 via +55 vit).
  delete playerProgress['jgT'];
  playerProgress['jgT'] = { _charLeveled: true, _skillEconV2: true, characters: { '3': { level: 10 } }, skills: { '3': { knight_k_juggernaut: 1 } } };
  const jg = { accountKey: 'jgT', charId: 3, health: 40, isDead: false }; // 40/155 = 0.26 < 0.3
  check('Last Stand cuts damage below the threshold', pactIncomingDamage(jg, 100) === 65, pactIncomingDamage(jg, 100));
  jg.health = 150; // 0.97 > 0.3
  check('Last Stand does nothing above the threshold', pactIncomingDamage(jg, 100) === 100, pactIncomingDamage(jg, 100));

  // Plaguelord — Festering Vigor (a tick behavior): data + resolver.
  const plSkill = S.SKILL_CATALOG[5].find((s) => s.id === 'necro_k_plague');
  check('Plaguelord carries a Festering Vigor behavior', !!plSkill.behavior && plSkill.behavior.combatRegen > 0, plSkill.behavior);
  delete playerProgress['plT'];
  playerProgress['plT'] = { _charLeveled: true, _skillEconV2: true, characters: { '5': { level: 10 } }, skills: { '5': { necro_k_plague: 1 } } };
  const pl = { accountKey: 'plT', charId: 5, health: 10, isDead: false };
  check('a sworn Plaguelord exposes its combat-regen behavior', !!activePactBehavior(pl) && activePactBehavior(pl).combatRegen === 2);

  // Completeness: EVERY keystone pact across all six classes now carries a
  // valid behavior (one of the four known hooks) with display text.
  const BEHAVIOR_KINDS = ['onKillHealPct', 'woundedFury', 'lastStand', 'combatRegen', 'onHitDot'];
  let missing = [];
  for (let c = 0; c < 6; c++) {
    for (const s of S.SKILL_CATALOG[c]) {
      if (s.tier !== 'keystone') continue;
      const ok = s.behavior && s.behavior.text && BEHAVIOR_KINDS.some((k) => s.behavior[k] != null);
      if (!ok) missing.push(s.id);
    }
  }
  check('every keystone pact has a valid, named behavior', missing.length === 0, missing);

  // ── 8. Enemy damage-over-time (Cinderburn): registry + tick lifecycle ──
  const { registerPactDot, tickPactDots, activeDots } = global.__testHooks;
  const pyreSkill = S.SKILL_CATALOG[0].find((s) => s.id === 'witch_k_pyre');
  check('Pyre Witch carries an onHitDot (Cinderburn) behavior', !!pyreSkill.behavior && pyreSkill.behavior.onHitDot && pyreSkill.behavior.onHitDot.dps > 0, pyreSkill.behavior);
  delete playerProgress['pyT'];
  playerProgress['pyT'] = { _charLeveled: true, _skillEconV2: true, characters: { '0': { level: 10 } }, skills: { '0': { witch_k_pyre: 1 } } };
  const pyre = { id: 'pyreP', accountKey: 'pyT', charId: 0, health: 100, isDead: false };
  activeDots.clear();
  registerPactDot(pyre, 'mob', 'm1', { ok: true, dead: false });
  check('a landed hit registers a burn on the target', activeDots.has('mob|m1') && activeDots.get('mob|m1').dps === 5, [...activeDots.keys()]);
  registerPactDot(pyre, 'mob', 'm2', { ok: true, dead: true }); // a killing blow leaves no burn
  check('a fatal hit does not register a burn', !activeDots.has('mob|m2'));
  const noDot = { id: 'plainP', accountKey: 'noPactC', charId: 0, health: 100 };
  registerPactDot(noDot, 'mob', 'm3', { ok: true, dead: false });
  check('a hit from a pactless attacker registers no burn', !activeDots.has('mob|m3'));
  // Tick lifecycle: an expired burn, and one whose owner is offline, both drop.
  activeDots.set('mob|m4', { dps: 5, until: Date.now() - 1, byId: 'pyreP', byAcct: 'pyT', targetType: 'mob', targetId: 'm4', acc: 0 });
  activeDots.set('mob|m5', { dps: 5, until: Date.now() + 9999, byId: 'ghostOwner', byAcct: 'x', targetType: 'mob', targetId: 'm5', acc: 0 });
  tickPactDots(Date.now(), 0.15);
  check('an expired burn is dropped on tick', !activeDots.has('mob|m4'));
  check('a burn whose owner is offline is dropped on tick', !activeDots.has('mob|m5'));
  activeDots.clear();

  // A player with no pact is untouched by both hooks.
  delete playerProgress['noPactC'];
  playerProgress['noPactC'] = { _charLeveled: true, _skillEconV2: true, characters: { '1': { level: 10 } }, skills: { '1': {} } };
  const np = { accountKey: 'noPactC', charId: 1, health: 10, isDead: false };
  check('no pact → neither damage hook fires', pactOutgoingDamage(np, 100) === 100 && pactIncomingDamage(np, 100) === 100);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
