// A plain strike is voiced by its swing and its hit. It used to be voiced a third time, as whatever ability was
// cast last (or a spell's shimmer if none had been): the server answers a strike with an attack_result, and the
// client played the last ability's sound for every attack_result.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-strike-sound-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const main = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8');
check('the client plays an ability\'s sound only for an ability\'s result', /if \(!msg\.strike && typeof playSfx === 'function'\) playSfx\(sfxForAbility\(lastCastAtk, lastCastId\)\);/.test(main));
check('a strike still has its swing, and its blow when it lands', /playSfx\('swing'\); \/\/ weapon whoosh on the swing/.test(main) && /playSfx\(msg\.dead \? 'kill' : meleeHitSfx\(\)\); \/\/ my blow landed/.test(main));
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('w'); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', name: 'Roadkeeper', charId: 4 }));
  const p = h.players.get(s.lastOfType('init').id);
  for (const m of h.emberMobs) if (!m.boss) { m.dead = true; m.respawnAt = Date.now() + 1e9; }
  const mob = h.emberMobs.find((m) => !m.boss);
  Object.assign(mob, { dead: false, health: 5000, x: 9000, y: 9000 });
  Object.assign(p, { room: 'ember_wastes', x: 9000, y: 9030, isDead: false });
  s.sent.length = 0;
  s.emit('message', JSON.stringify({ type: 'strike', targetType: 'ember_mob', targetId: mob.id }));
  const res = s.lastOfType('attack_result');
  check('the server marks a strike\'s answer as a strike', res && res.strike === true, res);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
