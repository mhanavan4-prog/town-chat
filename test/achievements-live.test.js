// Achievements — live server wiring. Confirms the engine helper claims a
// trophy through the real getProgress proxy, pushes the unlock to the player,
// serves the collection log on request, and shouts a capstone to the town.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ach-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    allOfType(t) { return this.sent.filter(m => m.type === t); },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, charId) {
    const s = makeMockSocket(tag);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    return { s, p };
  }

  const A = join('Achiever', 1);
  const B = join('Bystander', 2);

  // Below the first Slayer threshold — nothing should fire yet.
  const prog = h.getProgress(A.p);
  prog.monstersSlain = 24;
  h.checkAchievements(A.p);
  check('no trophy before the threshold', A.s.lastOfType('achievement_unlocked') === null);

  // Cross 25 — Blooded should land as a private toast.
  prog.monstersSlain = 25;
  h.checkAchievements(A.p);
  const unlock = A.s.lastOfType('achievement_unlocked');
  check('crossing the threshold pushes an unlock', unlock && unlock.ach && unlock.ach.id === 'slayer_1', unlock);
  check('the unlock carries progress-to-total', unlock && unlock.unlocked >= 1 && unlock.total === h.achievementsMod.TOTAL, unlock && { u: unlock.unlocked, t: unlock.total });
  check('a lower tier is not shouted to the town', B.s.allOfType('announce').every(m => !/trophy/.test(m.message || '')));

  // Re-running must not re-award.
  const before = A.s.allOfType('achievement_unlocked').length;
  h.checkAchievements(A.p);
  check('a claimed trophy never re-fires', A.s.allOfType('achievement_unlocked').length === before);

  // The collection log request returns the full shelf with the one unlocked.
  A.s.emit('message', JSON.stringify({ type: 'achievements_state' }));
  const log = A.s.lastOfType('achievements_state');
  check('the collection log is served on request', log && Array.isArray(log.achievements) && log.total === h.achievementsMod.TOTAL, log && log.total);
  check('the log marks Blooded as earned', log && log.achievements.find(a => a.id === 'slayer_1' && a.unlocked), null);

  // A capstone shouts to the whole town (Bystander hears it).
  prog.monstersSlain = 1500;
  h.checkAchievements(A.p);
  const shout = B.s.allOfType('announce').find(m => /Reaper of Thornreach/.test(m.message || ''));
  check('a capstone is shouted to the town', !!shout, B.s.allOfType('announce').map(m => m.message));

  // The Delve high-water path claims the Delver ladder.
  h.noteDelveDepth(A.p, 7);
  const delveLog = (() => { A.s.emit('message', JSON.stringify({ type: 'achievements_state' })); return A.s.lastOfType('achievements_state'); })();
  const delver = delveLog.achievements.filter(a => (a.id === 'delve_1' || a.id === 'delve_2') && a.unlocked).length;
  check('reaching Delve floor 7 claims both depth trophies', delver === 2, delver);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
