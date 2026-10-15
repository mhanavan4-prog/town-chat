// Per-room activity instrumentation (Session N, PR 3): room.enter / room.visit /
// room.dwellms counters that reveal which chat-room buildings get used and for
// how long. In-process mock-socket harness (same as world-liveness.test.js).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-rooms-');

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
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const A = h.analytics;
  const today = () => A.data[A.day()] || {};
  const n = (m) => today()[m] || 0;
  const has = (m) => Object.prototype.hasOwnProperty.call(today(), m);

  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }
  const move = (s, room) => s.emit('message', JSON.stringify({ type: 'move', x: 100, y: 100, room }));

  const a = join('Walker');

  // Walk into the café.
  const e0 = n('room.enter.cafe');
  move(a.s, 'cafe');
  check('entering a building bumps room.enter', n('room.enter.cafe') === e0 + 1, n('room.enter.cafe'));
  check('the player is tracked as inside that building', a.p.buildingRoom === 'cafe', a.p.buildingRoom);

  // Walk straight into another building — closes out the café visit, opens the library.
  const cv0 = n('room.visit.cafe'), le0 = n('room.enter.library');
  move(a.s, 'library');
  check('leaving one building for another records the first as a visit', n('room.visit.cafe') === cv0 + 1, n('room.visit.cafe'));
  check('café dwell time is recorded', has('room.dwellms.cafe'));
  check('entering the second building bumps its enter', n('room.enter.library') === le0 + 1, n('room.enter.library'));
  check('the player is now tracked inside the library', a.p.buildingRoom === 'library', a.p.buildingRoom);

  // Explicit "Leave" out to the open town.
  const lv0 = n('room.visit.library');
  a.s.emit('message', JSON.stringify({ type: 'leave_room', room: 'library' }));
  check('leaving to outside records the library visit', n('room.visit.library') === lv0 + 1, n('room.visit.library'));
  check('the player is no longer inside any building', !a.p.buildingRoom, a.p.buildingRoom);
  check('the player is back outside', a.p.room === 'outside', a.p.room);

  // A visit that ends by disconnecting inside a building still counts.
  const c = join('Ghost');
  move(c.s, 'cafe');
  const dv0 = n('room.visit.cafe');
  c.s.emit('close', 1000);
  check('disconnecting inside a building still records the visit', n('room.visit.cafe') === dv0 + 1, n('room.visit.cafe'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
