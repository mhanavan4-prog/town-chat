// Town pulse (liveness): the "N in town" headcount must be TOWN-WIDE, not the
// room-local AOI. The bug it replaces counted only players sharing your room,
// so three people in three rooms each saw "1 in town". This drives the real
// handlers with mock sockets and asserts townPulsePayload() counts everyone in
// the world regardless of room, excludes load-test bots, and reports joins-today.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-pulse-');

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
  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: charId || 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    return { s, p };
  }

  try {
    check('townPulsePayload is exposed', typeof h.townPulsePayload === 'function');

    // One player alone.
    const a = join('alice');
    a.p.room = 'outside';
    check('one player -> inTown 1', h.townPulsePayload().inTown === 1, h.townPulsePayload());

    // A second player in a DIFFERENT room. The old room-local counter would
    // still say 1 for each of them; the town-wide count must be 2.
    const b = join('bob');
    b.p.room = 'apothecary'; // deliberately not the same room as alice
    check('two players in different rooms -> inTown 2', h.townPulsePayload().inTown === 2, h.townPulsePayload());

    // A third, also elsewhere.
    const c = join('cleo');
    c.p.room = 'witch_cave';
    check('three players across three rooms -> inTown 3', h.townPulsePayload().inTown === 3, h.townPulsePayload());

    // A load-test bot must NOT inflate the headcount.
    const botSock = makeMockSocket('bot'); connHandler(botSock);
    botSock.emit('message', JSON.stringify({ type: 'join', name: 'bot', charId: 0 }));
    const botInit = botSock.lastOfType('init');
    if (botInit) { const bp = h.players.get(botInit.id); if (bp) bp._synthetic = true; }
    check('load-test bot is excluded from inTown', h.townPulsePayload().inTown === 3, h.townPulsePayload());

    // Per-room breakdown: where those players actually are, for the "head over"
    // nudge. alice=outside, bob=apothecary, cleo=witch_cave; the bot is excluded.
    {
      const rooms = h.townPulsePayload().rooms || {};
      check('rooms: outside has 1', rooms.outside === 1, rooms);
      check('rooms: apothecary has 1', rooms.apothecary === 1, rooms);
      check('rooms: witch_cave has 1', rooms.witch_cave === 1, rooms);
    }

    // A player inside a coven's private instance counts toward inTown but must
    // NOT appear in rooms — pointing a stranger into a private world is wrong.
    const d = join('dar');
    d.p.room = 'outside'; d.p.instance = 'coven_test';
    {
      const pay = h.townPulsePayload();
      check('coven-instance player counts in inTown', pay.inTown === 4, pay.inTown);
      check('coven-instance player NOT in public rooms', (pay.rooms.outside || 0) === 1, pay.rooms);
    }

    // today = fresh joins recorded today (the 3 real joins; the forced-synthetic
    // bot joined before we flagged it, so today may include it — we only assert
    // the field exists and is a number >= the real joins).
    const p = h.townPulsePayload();
    check('payload carries a numeric today', typeof p.today === 'number' && p.today >= 3, p.today);
    check('payload type is town_pulse', p.type === 'town_pulse', p.type);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}, 300);
