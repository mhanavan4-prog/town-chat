// Werewolf "Hunter's Read" — a close-range swipe that returns a benign
// in-world rap sheet (kills/deaths/notoriety, veterancy, combat read).
// Confirms it's built from game state only, respects range, and alerts prey.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-rapsheet-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const hooks = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, charId) {
    const s = makeMockSocket(tag);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
    const p = hooks.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    return { s, p };
  }

  const A = join('Alpha', 1);   // Werewolf — the hunter
  const Prey = join('Prey', 2); // Mystic — the quarry

  // Seed the quarry's in-world record (all benign, all about the character).
  const tp = hooks.getProgress(Prey.p);
  tp.monstersSlain = 142; tp.deaths = 9; tp.pickpocketSuccesses = 3; tp.timesSnapped = 7;
  tp.loginStreak = 6; tp.bestLoginStreak = 11; tp.level = 12;
  hooks.accounts['prey'] = Object.assign(hooks.accounts['prey'] || {}, { createdAt: Date.now() - 14 * 86400000 });
  hooks.ensureBankAccount('prey').balance = 600; // → "a comfortable vault"
  Prey.p.health = 50; // ~half health → hpPct around 50

  // Stand on top of the quarry (distance 0) and swipe.
  A.p.x = Prey.p.x; A.p.y = Prey.p.y;
  A.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'hunters_read', targetId: Prey.p.id }));

  const res = A.s.lastOfType('attack_result');
  const rs = res && res.rapSheet;
  check('the hunter gets a rap sheet back', !!rs, res);
  check('notoriety is read from game state (kills/deaths/pockets/photos)',
    rs && rs.kills === 142 && rs.deaths === 9 && rs.pickpockets === 3 && rs.snapped === 7, rs);
  check('veterancy: account age in days + login streak',
    rs && rs.ageDays === 14 && rs.streak === 6 && rs.bestStreak === 11, rs && { ageDays: rs.ageDays, streak: rs.streak, best: rs.bestStreak });
  check('combat read: class + level + a health %', rs && rs.className === 'Mystic' && rs.level === 12 && typeof rs.hpPct === 'number', rs);
  check('wealth shows as a coarse tier, never an exact balance', rs && rs.wealth === 'a comfortable vault', rs && rs.wealth);
  check('nothing identifying leaks (no ip/email/account fields)',
    rs && !('ip' in rs) && !('email' in rs) && !('account' in rs) && !('accountKey' in rs), rs && Object.keys(rs));
  check('the quarry feels the swipe (attack_hit)', !!Prey.s.lastOfType('attack_hit'), Prey.s.lastOfType('attack_hit'));

  // Out of range → refused (werewolf must get close to swipe).
  const B = join('Beta', 1);
  Prey.p.x = B.p.x + 5000; // far away
  B.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'hunters_read', targetId: Prey.p.id }));
  check('a swipe from too far is refused', /Too far/.test((B.s.lastOfType('attack_error') || {}).message || ''), B.s.lastOfType('attack_error'));
  check('no rap sheet is returned on a missed swipe', !(B.s.lastOfType('attack_result') && B.s.lastOfType('attack_result').rapSheet), B.s.lastOfType('attack_result'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
