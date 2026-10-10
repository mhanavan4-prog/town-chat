// Weekly dungeon affixes / keystones — a seeded pair of modifiers per week
// that make the four tiers play differently, with threat + reward multipliers.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-affix-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const WEEK = 7 * 24 * 3600 * 1000;
  const base = Date.UTC(2026, 2, 2); // an arbitrary Monday-ish anchor

  // ── A week draws exactly two distinct affixes, deterministically ──
  const wk = h.weeklyDungeonAffixes(base);
  check('a week draws exactly two affixes', Array.isArray(wk) && wk.length === 2, wk);
  check('the two affixes are distinct', wk[0].id !== wk[1].id, wk.map(a => a.id));
  check('each affix is well-formed (id/name/icon/kind/desc)',
    wk.every(a => a.id && a.name && a.icon && (a.kind === 'threat' || a.kind === 'reward') && a.desc), wk);
  check('weekly draw is deterministic', h.weeklyDungeonAffixes(base).map(a => a.id).join() === wk.map(a => a.id).join());

  // ── The pairing rotates across weeks ──
  const seen = new Set();
  for (let i = 0; i < 12; i++) seen.add(h.weeklyDungeonAffixes(base + i * WEEK).map(a => a.id).sort().join('+'));
  check('affix pairs rotate across weeks (not a fixed pair)', seen.size >= 3, [...seen]);

  // ── dungeonAffix() combines the current week's picks correctly ──
  const live = h.weeklyDungeonAffixes(Date.now());
  const exp = { dmgMul: 1, hitCdMul: 1, goldMul: 1, lootExtraRolls: 0 };
  for (const a of live) { if (a.dmgMul) exp.dmgMul *= a.dmgMul; if (a.hitCdMul) exp.hitCdMul *= a.hitCdMul; if (a.goldMul) exp.goldMul *= a.goldMul; if (a.lootExtraRolls) exp.lootExtraRolls += a.lootExtraRolls; }
  const af = h.dungeonAffix();
  check('dungeonAffix() combines the week into multipliers',
    af.dmgMul === exp.dmgMul && af.hitCdMul === exp.hitCdMul && af.goldMul === exp.goldMul && af.lootExtraRolls === exp.lootExtraRolls, { af, exp });
  check('multipliers never nullify the dungeon (dmg >= 1, hitCd <= 1)', af.dmgMul >= 1 && af.hitCdMul <= 1 && af.goldMul >= 1, af);

  // ── Reward affixes applied to a kill's loot ──
  const t = { tier: 1, pendingLoot: [{ kind: 'gold', amount: 100 }] };
  h.applyDungeonLootAffix(t, { xp: 10 });
  const gold = t.pendingLoot.find(d => d.kind === 'gold');
  check('gold haul is scaled by the week’s gold multiplier', gold && gold.amount === Math.max(1, Math.round(100 * exp.goldMul)), { gold, goldMul: exp.goldMul });
  check('an extra-loot week adds at least the original gold entry (no crash)', t.pendingLoot.length >= 1, t.pendingLoot.length);

  // ── Public view is display-safe (no raw multipliers leaked as behavior) ──
  const pub = h.dungeonAffixPublic();
  check('public affixes carry name + description for the UI', pub.length === 2 && pub.every(a => a.name && a.desc && a.icon), pub);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
