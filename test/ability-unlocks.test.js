// Abilities open as you level (data/abilityUnlocks.js): three to begin with, the rest one at a time, the whole kit by
// level 18; and Pickpocket is a skill every class can learn at level 4. Levels and XP are untouched.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-unlocks-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; },
    allOfType(type) { return this.sent.filter((m) => m.type === type); } };
}
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const main = read('client/main.js'), server = read('server.js');
const { abilityUnlockLevels, abilitiesOpenedBetween, UNLOCK_START, UNLOCK_LAST } = require('../data/abilityUnlocks');

// the rule by itself
const ids = (n) => Array.from({ length: n }, (_, i) => 'a' + i);
for (const n of [6, 12, 13, 15, 16]) {
  const lv = abilityUnlockLevels(ids(n), {}), seq = ids(n).map((id) => lv[id]);
  check(`a kit of ${n}: three at level 1, the next at 2, never more than two levels between, all by ${UNLOCK_LAST}`,
    seq.slice(0, 3).every((l) => l === 1) && seq[3] === 2 && seq.every((l, i) => i === 0 || (l >= seq[i - 1] && l - seq[i - 1] <= 2)) && seq[n - 1] <= UNLOCK_LAST && UNLOCK_START === 3, seq);
}
check('a big kit ends at 18 exactly; a small one is complete early', abilityUnlockLevels(ids(16), {}).a15 === 18 && abilityUnlockLevels(ids(12), {}).a11 === 18 && abilityUnlockLevels(ids(6), {}).a5 === 6);
{ const cat = { a0: {}, a1: {}, pp: { unlockLevel: 4 }, a2: {}, a3: {} }, lv = abilityUnlockLevels(['a0', 'a1', 'pp', 'a2', 'a3'], cat);
  check('an ability with a level of its own keeps it, and takes no place in the sequence', lv.pp === 4 && lv.a2 === 1 && lv.a3 === 2);
  check('what a level opens', String(abilitiesOpenedBetween(lv, 1, 2)) === 'a3' && String(abilitiesOpenedBetween(lv, 3, 4)) === 'pp' && abilitiesOpenedBetween(lv, 4, 20).length === 0); }

// the client
check('the bar, the phone wheel, the loadout and the number keys all go through one list, and that list holds back what is locked', /const all = defaultAbilityOrder\(myActionCatalog\)\.filter\(abilityOpen\);/.test(main) && /if \(myActionCatalog\[id\] && abilityOpen\(id\) && !seen\.has\(id\)\)/.test(main));
check('the levels come from the server; until it has said, nothing is held back', /function abilityOpen\(id\) \{ return !myAbilityUnlocks \|\| \(\(me && me\.level\) \|\| 1\) >= \(myAbilityUnlocks\[id\] \|\| 1\); \}/.test(main) && /if \(msg\.type === 'ability_unlocks'\) \{\s*myAbilityUnlocks = msg\.levels \|\| null;/.test(main) && /ws\.send\(JSON\.stringify\(\{ type: 'ability_unlocks' \}\)\)/.test(main));
check('the bar shows what is coming next and when', /lock\.className = 'hotbarSlot hotbarLocked'/.test(main) && /lv\.textContent = 'Lv ' \+ nx\.level;/.test(main));
check('every class has Pickpocket on the client too, with the Wanderer keeping Sleight of Hand', /for \(const _cat of \[WEREWOLF_ATTACK_CATALOG, MYSTIC_ATTACK_CATALOG, KNIGHT_ATTACK_CATALOG, NECROMANCER_ATTACK_CATALOG, SPELL_CATALOG\]\) _cat\.pickpocket = PICKPOCKET_ALL;/.test(main) && /pickpocket: A_SLEIGHT_OF_HAND/.test(read('client/ui-icons.js')));
check('levelling itself is not touched: the rule only reads the level', !/XP_THRESHOLDS|prog\.xp|skillPoints/.test(read('data/abilityUnlocks.js').replace(/\/\/.*$/gm, '')));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks, wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
    const p = h.players.get(s.lastOfType('init').id); p.accountKey = tag.toLowerCase(); s._isGuest = false;
    Object.assign(p, { x: 1000, y: 1000, room: 'outside', isDead: false });
    return { s, p };
  }
  const say = (P, m) => P.s.emit('message', JSON.stringify(m));
  const setLevel = (P, n) => { h.getProgress(P.p).level = n; };
  const K = join('Sir', 3), W = join('Hex', 0), V = join('Mark', 4);

  say(K, { type: 'ability_unlocks' });
  const lv = K.s.lastOfType('ability_unlocks');
  check('the server tells a knight when each art opens: three now, and the last by 18', lv && lv.level === 1 && Object.values(lv.levels).filter((l) => l === 1).length === 3 && Math.max(...Object.values(lv.levels)) === 18 && lv.levels.pickpocket === 4);
  const open1 = Object.keys(lv.levels).filter((id) => lv.levels[id] === 1), later = Object.keys(lv.levels).find((id) => lv.levels[id] === 6);
  check('a knight leads with something that does damage', open1[0] === 'smite', open1);

  say(K, { type: 'cast_attack', attackId: later });
  check('at level 1 an art that opens at 6 is refused, and says when', new RegExp('🔒 .* opens at Level 6\\.').test(K.s.lastOfType('attack_error').message));
  const before = K.s.allOfType('attack_error').length;
  K.p.attackCooldowns = {}; setLevel(K, 6); say(K, { type: 'cast_attack', attackId: later });
  const errs = K.s.allOfType('attack_error').slice(before).filter((e) => /opens at Level/.test(e.message));
  check('at level 6 it is not refused for its level', errs.length === 0, errs);

  // level-up tells you
  setLevel(K, 1); K.p.attackCooldowns = {};
  const xpTo = (n) => { const prog = h.getProgress(K.p); prog.xp = 0; h.grantXP ? h.grantXP(K.p, 1) : null; return prog; };
  check('(the hooks expose grantXP)', typeof h.grantXP === 'function');
  if (typeof h.grantXP === 'function') {
    const prog = h.getProgress(K.p); prog.level = 1; prog.xp = 0; const toasts0 = K.s.allOfType('toast').length;
    h.grantXP(K.p, 100000);
    const news = K.s.allOfType('toast').slice(toasts0).filter((t) => /New ability: /.test(t.message));
    check('rising through the levels names each new ability as it comes, and the bar is told', prog.level > 1 && news.length === Object.values(lv.levels).filter((l) => l > 1 && l <= prog.level).length && K.s.lastOfType('ability_unlocks').level === prog.level, [prog.level, news.length]);
    check('levelling is as it was: one skill point a level', prog.skillPoints >= prog.level - 1);
  }

  // pickpocket for everyone
  setLevel(K, 3); K.p.attackCooldowns = {};
  say(K, { type: 'cast_attack', attackId: 'pickpocket', targetId: V.p.id });
  check('a knight cannot pick a pocket before level 4', /Pickpocket opens at Level 4/.test(K.s.lastOfType('attack_error').message));
  setLevel(K, 4); const r0 = K.s.sent.length;
  say(K, { type: 'cast_attack', attackId: 'pickpocket', targetId: V.p.id });
  const after = K.s.sent.slice(r0);
  check('at level 4 he can: the attempt is made (a result or a caught message, not a level lock)', after.length > 0 && !after.some((m) => m.type === 'attack_error' && /opens at Level|Unknown attack/.test(m.message)), after.map((m) => m.type + ':' + (m.message || '')).slice(0, 4));
  check('a knight\'s is less sure than the Wanderer\'s own', /stealChance: 0\.25, unlockLevel: 4/.test(server) && /sleight_of_hand:\s+\{ name: 'Sleight of Hand',\s+kind: 'targeted', effect: 'pickpocket', stealChance: 0\.35 \}/.test(server));

  setLevel(W, 4); const w0 = W.s.sent.length;
  say(W, { type: 'cast_spell', spellId: 'pickpocket', targetId: V.p.id });
  const wAfter = W.s.sent.slice(w0);
  check('the Witch casts hers from the Spellbook, and it runs the same code', wAfter.length > 0 && !wAfter.some((m) => /Only the Witch|Unknown|opens at Level|no attacks/.test(m.message || '')), wAfter.map((m) => m.type + ':' + (m.message || '')).slice(0, 4));
  setLevel(W, 2); W.p.attackCooldowns = {};
  say(W, { type: 'cast_spell', spellId: 'pickpocket', targetId: V.p.id });
  check('and is refused before level 4 like anyone', /Pickpocket opens at Level 4/.test(W.s.lastOfType('spell_error').message));

  say(V, { type: 'ability_unlocks' });
  check('the Wanderer has Sleight of Hand in his own order and no second pickpocket', V.s.lastOfType('ability_unlocks').levels.sleight_of_hand >= 2 && !('pickpocket' in V.s.lastOfType('ability_unlocks').levels));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
