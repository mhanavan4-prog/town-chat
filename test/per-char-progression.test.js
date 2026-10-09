// Per-character progression (xp/level/skillPoints are now per character, not a
// shared account pool) + the one-time migration that folds a legacy account
// pool onto the most-recently-played character. Runs against the real
// server.js via the exposed test hooks (getProgress / playerProgress).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-perchar-');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

require('../server.js');

setTimeout(() => {
  const { getProgress, playerProgress } = global.__testHooks;

  // ── 1. Characters level independently ──
  delete playerProgress['pct1'];
  const pA = { accountKey: 'pct1', charId: 4 };
  const pgA = getProgress(pA);
  pgA.level = 7; pgA.xp = 250; pgA.skillPoints = 4;
  const pB = { accountKey: 'pct1', charId: 0 };
  const pgB = getProgress(pB);
  check('a different character starts fresh at level 1', pgB.level === 1, pgB.level);
  check('the fresh character has 0 xp', pgB.xp === 0, pgB.xp);
  check('the played character kept its own level', getProgress(pA).level === 7);
  check('levels are stored per charId',
    playerProgress['pct1'].characters['4'].level === 7 && playerProgress['pct1'].characters['0'].level === 1,
    playerProgress['pct1'].characters);
  // Account-wide fields still shared across a player's characters:
  pgA.pickpocketSuccesses = 9;
  check('account-wide fields stay shared across characters', getProgress(pB).pickpocketSuccesses === 9);

  // ── 2. Migration of a legacy account-wide pool ──
  playerProgress['pctLegacy'] = {
    level: 5, xp: 120, skillPoints: 2,
    skills: { '4': { keen: 2 }, '0': { ward: 1 } },
    characters: { '4': { lastPlayedAt: 200 }, '0': { lastPlayedAt: 100 } },
    lastCharId: 4
  };
  getProgress({ accountKey: 'pctLegacy', charId: 4 }); // triggers migration
  const acc = playerProgress['pctLegacy'];
  check('primary (last-played) character keeps the level', acc.characters['4'].level === 5, acc.characters['4']);
  check('primary keeps the xp', acc.characters['4'].xp === 120);
  check('points spent on wiped trees are refunded to primary', acc.characters['4'].skillPoints === 3, acc.characters['4'].skillPoints); // 2 unspent + 1 refunded
  check('other existing character resets to level 1', acc.characters['0'].level === 1);
  check('other character has no unspent points', acc.characters['0'].skillPoints === 0);
  check('non-primary skill tree is wiped', Object.keys(acc.skills['0'] || {}).length === 0, acc.skills['0']);
  check('primary skill tree is kept', acc.skills['4'].keen === 2);
  check('legacy top-level pool fields are removed',
    acc.level === undefined && acc.xp === undefined && acc.skillPoints === undefined,
    { level: acc.level, xp: acc.xp, skillPoints: acc.skillPoints });
  check('migration is marked done (idempotent)', acc._charLeveled === true);

  // Re-running must not double-apply (idempotent).
  const before = JSON.stringify(acc.characters);
  getProgress({ accountKey: 'pctLegacy', charId: 0 });
  check('a second pass does not change the folded data', JSON.stringify(acc.characters) === before);

  // ── 3. Legacy account with no character records seeds the primary ──
  playerProgress['pctSeed'] = { level: 3, xp: 40, skillPoints: 1, lastCharId: 2 };
  getProgress({ accountKey: 'pctSeed', charId: 2 });
  const s = playerProgress['pctSeed'];
  check('a character-less legacy account seeds its pool onto lastCharId',
    !!s.characters['2'] && s.characters['2'].level === 3 && s.characters['2'].xp === 40, s.characters);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
