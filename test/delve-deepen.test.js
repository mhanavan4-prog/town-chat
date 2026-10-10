// Deepened Weekly Delve — expanded mod + boon pools. Guards that every entry
// speaks only effect keys the engine actually reads, so a typo can't ship a
// dead boon/mod, and that the weekly draw still works over the bigger pool.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-delve-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const MODS = h.DELVE_MODS, BOONS = h.DELVE_BOONS;

  // Effect keys the engine reads (delveModVal / delveBoonContrib / purse / mending).
  const MOD_KEYS = new Set(['name', 'icon', 'desc', 'mobSpd', 'mobHp', 'mobDmg', 'goldMult', 'playerPower', 'playerTakenMult', 'extraKills', 'noMend', 'boonChoices']);
  const STAT_KEYS = new Set(['power', 'guard', 'vitality', 'haste', 'swift', 'leech']);
  const BOON_KEYS = new Set(['name', 'icon', 'desc', 'stats', 'mending', 'healNow', 'goldBonus']);

  check('the mod pool grew (>= 14)', Object.keys(MODS).length >= 14, Object.keys(MODS).length);
  check('the boon pool grew (>= 18)', Object.keys(BOONS).length >= 18, Object.keys(BOONS).length);

  let badMod = null;
  for (const [id, m] of Object.entries(MODS)) {
    for (const k of Object.keys(m)) if (!MOD_KEYS.has(k)) { badMod = `${id}.${k}`; break; }
    if (!m.name || !m.icon || !m.desc) badMod = `${id} missing label`;
    if (badMod) break;
  }
  check('every mod uses only engine-read keys + a full label', !badMod, badMod);

  let badBoon = null;
  for (const [id, b] of Object.entries(BOONS)) {
    for (const k of Object.keys(b)) if (!BOON_KEYS.has(k)) { badBoon = `${id}.${k}`; break; }
    if (b.stats) for (const sk of Object.keys(b.stats)) if (!STAT_KEYS.has(sk)) { badBoon = `${id}.stats.${sk}`; break; }
    if (!b.name || !b.icon || !b.desc) badBoon = `${id} missing label`;
    if (badBoon) break;
  }
  check('every boon uses only valid stat/effect keys + a full label', !badBoon, badBoon);

  // The weekly draw still returns two distinct mods and rotates over the pool.
  const WEEK = 7 * 24 * 3600 * 1000, base = Date.UTC(2026, 2, 2);
  const w = h.weeklyDelveMods(base);
  check('weekly delve draws two distinct mods', w.length === 2 && w[0] !== w[1] && MODS[w[0]] && MODS[w[1]], w);
  const seen = new Set();
  for (let i = 0; i < 16; i++) seen.add(h.weeklyDelveMods(base + i * WEEK).slice().sort().join('+'));
  check('weekly delve mods rotate across the bigger pool', seen.size >= 5, seen.size);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
