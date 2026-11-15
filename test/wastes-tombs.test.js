// The tombs of the Ember Wastes are doors, as the Wilds' are: the same crypt lies under both, and you come up where
// you went down.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-tombs-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks, wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('T'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Tombwalker', charId: 5 }));
  const p = h.players.get(s.lastOfType('init').id);
  const say = (m) => s.emit('message', JSON.stringify(m));

  Object.assign(p, { room: 'ember_wastes', x: 14853, y: 7830, isDead: false });
  say({ type: 'enter_crypt' });
  check('a tomb in the Wastes goes down into the crypt', p.room === 'crypt' && !!s.lastOfType('crypt_entered'));
  say({ type: 'move', x: 300, y: 300, room: 'ember_wastes' });
  check('and a stale step from above does not pull her back up', p.room === 'crypt');
  say({ type: 'exit_crypt' });
  const out = s.lastOfType('crypt_exited');
  check('she comes up where she went down, in the Wastes', p.room === 'ember_wastes' && p.x === 14853 && p.y === 7830 && out.room === 'ember_wastes' && out.x === 14853, out);
  check('and nothing is left over', p.cryptReturnRoom == null && p.cryptReturnX == null);

  Object.assign(p, { room: 'wilds', x: 3000, y: 5000 });
  say({ type: 'enter_crypt' }); say({ type: 'exit_crypt' });
  const out2 = s.lastOfType('crypt_exited');
  check('the Wilds\' tombs are as they were', p.room === 'wilds' && p.x === 3000 && out2.room === 'wilds');

  Object.assign(p, { room: 'outside', x: 1600, y: 1100 }); s.sent.length = 0;
  say({ type: 'enter_crypt' });
  check('there is no way down from the town', p.room === 'outside' && !s.lastOfType('crypt_entered'));

  const sc = fs.readFileSync(path.join(__dirname, '..', 'client/ember-scene.js'), 'utf8'), main = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8');
  check('each tomb in the Wastes is a door, solid, and named', /tombKiosks\.push\(\{ x: tx, z: tz, portal: 'crypt_enter', radius: 105 \}\);/.test(sc) && /tombWalls\.push\(/.test(sc) && /A tomb: the crypt/.test(sc) && /\.\.\.folkKiosks, \.\.\.tombKiosks\]/.test(sc));
  check('and the client comes up in the right place', /if \(back === 'ember_wastes'\) swapToEmberMap\(\); else swapToWildsMap\(\);/.test(main));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
