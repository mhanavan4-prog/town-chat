// Seamless guest -> account carry-over: the adoption guard (lib/guestClaim.js).
// Pure-logic unit test, no server boot. The one invariant that matters here is
// that an account which already has character progress is NEVER overwritten.
const { adoptGuestInto, accountHasProgress } = require('../lib/guestClaim');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// A guest who has been playing: one character with real progress + some items.
function guestState() {
  return {
    progress: { characters: { c1: { level: 7, xp: 1420, quests: { q_intro: 'done' } } }, gold: 33 },
    inventory: { c1: [{ id: 'herb', n: 4 }] },
  };
}

// 1. Adopt into a brand-new (empty) account -> carries everything over.
{
  const playerProgress = {};
  const inventories = {};
  const g = guestState();
  const r = adoptGuestInto({ playerProgress, inventories, accountKey: 'acct:new', guestProgress: g.progress, guestInventory: g.inventory });
  check('adopt: reports changed', r.ok && r.changed && !r.already, r);
  check('adopt: progress now under account', playerProgress['acct:new'] && playerProgress['acct:new'].characters.c1.level === 7);
  check('adopt: inventory now under account', inventories['acct:new'] && inventories['acct:new'].c1[0].id === 'herb');
}

// 2. Account that ALREADY has progress is left completely untouched.
{
  const existing = { characters: { hero: { level: 40 } }, gold: 9999 };
  const playerProgress = { 'acct:old': existing };
  const inventories = { 'acct:old': [{ id: 'legendary' }] };
  const g = guestState();
  const r = adoptGuestInto({ playerProgress, inventories, accountKey: 'acct:old', guestProgress: g.progress, guestInventory: g.inventory });
  check('guard: reports already, not changed', r.ok && r.already && !r.changed, r);
  check('guard: existing progress untouched', playerProgress['acct:old'] === existing && playerProgress['acct:old'].characters.hero.level === 40);
  check('guard: existing inventory untouched', inventories['acct:old'][0].id === 'legendary');
}

// 3. An account key that exists but has an empty characters map counts as brand-new.
{
  const playerProgress = { 'acct:fresh': { characters: {} } };
  const inventories = {};
  const g = guestState();
  const r = adoptGuestInto({ playerProgress, inventories, accountKey: 'acct:fresh', guestProgress: g.progress, guestInventory: g.inventory });
  check('empty-characters account is adoptable', r.ok && r.changed, r);
  check('empty-characters account received progress', playerProgress['acct:fresh'].characters.c1.level === 7);
}

// 4. Bad input is refused.
{
  check('no accountKey -> not ok', adoptGuestInto({ playerProgress: {}, accountKey: '' }).ok === false);
  check('no stores -> not ok', adoptGuestInto({ accountKey: 'x' }).ok === false);
}

// 5. accountHasProgress helper.
{
  check('hasProgress: null -> false', accountHasProgress(null) === false);
  check('hasProgress: empty characters -> false', accountHasProgress({ characters: {} }) === false);
  check('hasProgress: with a character -> true', accountHasProgress({ characters: { a: {} } }) === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
