// The practice scarecrow by the town spawn: it takes a blow, never falls, pays a little XP five times, and is in reach
// only from beside it. Somewhere to learn the sword where nothing hits back.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-scarecrow-test-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; },
    allOfType(type) { return this.sent.filter((m) => m.type === type); } };
}
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks, wss = global.__wssInstances[0], T = h.PRACTICE_TARGET;
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('New'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'New', charId: 3 }));
  const p = h.players.get(s.lastOfType('init').id); p.accountKey = 'new'; s._isGuest = false;
  const strike = () => { p.lastStrikeAt = 0; s.emit('message', JSON.stringify({ type: 'strike', targetType: 'practice', targetId: T.id })); };
  check('it stands inside the spawn haven', Math.hypot(T.x - 1600, T.y - 1100) < 400);

  Object.assign(p, { x: T.x + 40, y: T.y, room: 'outside', isDead: false });
  const xp0 = h.getProgress(p).xp;
  strike();
  const r = s.lastOfType('attack_result');
  check('a blow lands, and says so', r && /Hit the practice scarecrow for \d+/.test(r.message) && /XP/.test(r.message), r);
  check('everyone nearby sees the number', s.allOfType('hit_fx').some((m) => m.targetType === 'practice' && m.dead === false));
  check('the first blow pays', h.getProgress(p).xp > xp0);
  for (let i = 0; i < 8; i++) strike();
  const xpA = h.getProgress(p).xp; strike();
  check('it teaches five times and then pays nothing', h.getProgress(p).practiceHits === T.lessons && h.getProgress(p).xp === xpA);
  check('it never falls', !s.allOfType('attack_result').some((m) => /Killed/.test(m.message)));

  const n0 = s.allOfType('attack_result').length;
  Object.assign(p, { x: T.x + 400, y: T.y }); strike();
  check('from across the square it is out of reach', s.allOfType('attack_result').length === n0 && /Too far/.test((s.lastOfType('attack_error') || {}).message || ''));
  Object.assign(p, { x: T.x + 40, y: T.y, room: 'wilds' }); strike();
  check('and it is not in the Wilds', s.allOfType('attack_result').length === n0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
