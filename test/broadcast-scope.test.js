// 📡 Broadcast scoping (bandwidth) — the 70ms position 'state' and the 150ms
// 'wildlife_state' are now ROOM-SCOPED (each player only receives their own
// room's players/mobs), with a low-rate GLOBAL 'state' reconciliation so
// cross-room presence (counts, rosters) stays correct. This guards that the
// scoping actually isolates rooms AND that the global reconciliation still
// reunites everyone.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-bcast-test-');

function makeMockSocket(label) {
  return {
    label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    allOfType(t) { return this.sent.filter(m => m.type === t); }
  };
}
let pass = 0, fail = 0;
const check = (n, c, x) => { if (c) { pass++; console.log('PASS -', n); } else { fail++; console.log('FAIL -', n, x != null ? JSON.stringify(x) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

require('../server.js');

setTimeout(async () => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const hooks = global.__testHooks;
  const join = (name) => {
    const s = makeMockSocket(name);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name, charId: 0 }));
    const id = s.lastOfType('init').id;
    return { s, id, p: hooks.players.get(id) };
  };

  const A = join('Alice'), B = join('Bob'), C = join('Cara');
  A.p.room = 'outside'; C.p.room = 'outside'; B.p.room = 'wilds';
  A.s.sent.length = 0; B.s.sent.length = 0; C.s.sent.length = 0;

  // A few room ticks (70ms) + a wildlife tick (150ms), but well under the
  // 1600ms global reconciliation — so this window is purely room-scoped.
  await sleep(260);

  const aState = A.s.lastOfType('state');
  check('room-scoped state: town player sees room-mate (Cara), not the Wilds player (Bob)',
    !!aState && aState.players.some(p => p.id === C.id) && !aState.players.some(p => p.id === B.id),
    aState && aState.players.map(p => p.name));
  const bState = B.s.lastOfType('state');
  check('room-scoped state: Wilds player does not receive town players',
    !!bState && !bState.players.some(p => p.id === A.id));

  const aW = A.s.lastOfType('wildlife_state');
  check('town player gets NO Wilds critters (animals2 empty)', !!aW && aW.animals2.length === 0, aW && aW.animals2.length);
  const bW = B.s.lastOfType('wildlife_state');
  check('Wilds player gets NO town mobs (mobs empty)', !!bW && bW.mobs.length === 0, bW && bW.mobs.length);

  // After the global reconciliation fires (1600ms), a full-roster 'state' tick
  // reaches Alice carrying Bob. The real client merges every 'state' (add/update
  // only — removal is 'player_left'), so Bob then persists in its roster even
  // though the faster room ticks that follow never mention him. We mirror that
  // "did any tick carry Bob" check rather than reading just the latest tick.
  await sleep(1900);
  const sawBob = A.s.allOfType('state').some(st => st.players.some(p => p.id === B.id));
  check('global reconciliation: a full-roster state tick reaches the town player carrying the Wilds player', sawBob);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
