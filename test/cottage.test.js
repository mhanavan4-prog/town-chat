// Player housing (slice 2) — stepping into the cottage interior. Covers the
// enter/exit round-trip: entry from the town square sets the instanced room +
// ships the saved layout, entry is refused off the square / without an account,
// exit returns you to the public world, and editing furniture while inside
// pushes a live cottage_layout. Mirrors test/housing.test.js' harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-cottage-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    hasType(t) { return this.sent.some((m) => m.type === t); },
  };
}

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }

  // A signed-in player standing in the town square.
  const g = join('Cottager');
  g.p.accountKey = 'cottager';
  g.p.room = 'outside'; g.p.instance = ''; g.p.x = 500; g.p.y = 500;

  // Furnish something first so the entered layout isn't empty.
  h.homePlace(g.p, 'bed', 0, 0, 0);
  g.s.sent.length = 0;

  // ── Enter from the square ───────────────────────────────────────────────
  g.s.emit('message', JSON.stringify({ type: 'enter_cottage' }));
  const entered = g.s.lastOfType('cottage_entered');
  check('entering from the square is accepted', !!entered, g.s.sent.map((m) => m.type));
  check('the room becomes the instanced cottage', g.p.room === 'cottage' && g.p.instance === 'home_cottager', { room: g.p.room, inst: g.p.instance });
  check('you spawn at the cottage door', entered && entered.spawn && entered.spawn.x === h.COTTAGE_SPAWN.x && entered.spawn.y === h.COTTAGE_SPAWN.y);
  check('the entered message ships the saved layout', entered && Array.isArray(entered.pieces) && entered.pieces.some((p) => p.id === 'bed') && Array.isArray(entered.catalog));
  check('the return spot was remembered', g.p.cottageReturnX === 500 && g.p.cottageReturnY === 500);

  // ── Live refresh: placing furniture while inside pushes cottage_layout ────
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'home_place', pieceId: 'chair', x: 4, y: 4, rot: 0 }));
  check('editing inside the cottage pushes a live layout', g.s.hasType('cottage_layout'));
  const live = g.s.lastOfType('cottage_layout');
  check('the live layout includes the new piece', live && live.pieces.some((p) => p.id === 'chair'));

  // ── Exit back to the square ──────────────────────────────────────────────
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'exit_cottage' }));
  const exited = g.s.lastOfType('cottage_exited');
  check('exiting is accepted', !!exited);
  check('you return to the public world', g.p.room === 'outside' && g.p.instance === '');
  check('you land back where you entered', exited && exited.x === 500 && exited.y === 500);

  // ── Refusals ─────────────────────────────────────────────────────────────
  g.p.room = 'wilds'; g.p.instance = '';
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'enter_cottage' }));
  check('entry is refused when not on the square', !g.s.hasType('cottage_entered') && g.s.hasType('home_error'), g.s.sent.map((m) => m.type));
  check('a refused entry leaves the room unchanged', g.p.room === 'wilds');

  const guest = join('Drifter'); // no accountKey
  guest.p.room = 'outside'; guest.p.instance = '';
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'enter_cottage' }));
  check('a guest with no account cannot enter', !guest.s.hasType('cottage_entered') && guest.s.hasType('home_error'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
