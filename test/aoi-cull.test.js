// Area-of-interest cull (AOI_RADIUS): in a CROWDED room the high-frequency
// player-state stream sends each player only itself + others within AOI range.
// Near players see each other; far ones are culled from this fast stream (they
// still refresh via the separate 1.6s full-instance roster, not exercised here).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-aoicull-');
process.env.AOI_RADIUS = '1400'; // must be set before the server module reads it

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, bufferedAmount: 0, sent: [], _handlers: {}, _tag: tag,
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
  try {
    const h = global.__testHooks;
    const wss = global.__wssInstances[0];
    const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
    function join(tag) {
      const s = makeMockSocket(tag); connHandler(s);
      s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
      const p = h.players.get(s.lastOfType('init').id);
      return { s, p };
    }
    // Enough players to trip crowd mode (>CROWD_THRESHOLD), which is where AOI
    // applies. 32 filler bodies clustered at spawn, plus our three probes.
    const spawn = { x: 1600, y: 1100 };
    for (let i = 0; i < 32; i++) { const f = join('F' + i); f.p.room = 'outside'; f.p.x = spawn.x + (i % 8) * 5; f.p.y = spawn.y + i; }
    const A = join('Alice');    A.p.room = 'outside'; A.p.x = 1600; A.p.y = 1100;
    const B = join('Bob');      B.p.room = 'outside'; B.p.x = 1620; B.p.y = 1100; // 20u from A — near
    const C = join('Carol');    C.p.room = 'outside'; C.p.x = 3100; C.p.y = 2000; // ~1749u from A — far

    check('crowd mode active (>threshold)', h.players.size > h.CROWD_THRESHOLD, { n: h.players.size, thr: h.CROWD_THRESHOLD });

    // Clear any init/backlog sends, then drive one broadcast tick. All just
    // joined, so membership changed → a crowded channel emits this tick.
    for (const s of [A.s, B.s, C.s]) s.sent.length = 0;
    h.broadcastPlayerState();

    const aState = A.s.lastOfType('state');
    check('Alice receives a state snapshot', !!aState, aState);
    const aIds = new Set((aState ? aState.players : []).map(p => p.id));
    check('Alice sees herself (own health/status stays live)', aIds.has(A.p.id));
    check('Alice sees nearby Bob (20u away)', aIds.has(B.p.id));
    check('Alice does NOT see far Carol (~1749u away) on the fast stream', !aIds.has(C.p.id), [...aIds].length);

    const cState = C.s.lastOfType('state');
    const cIds = new Set((cState ? cState.players : []).map(p => p.id));
    check('Carol sees herself', cIds.has(C.p.id));
    check('Carol does NOT see far Alice on the fast stream', !cIds.has(A.p.id));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) { console.error(e); process.exit(1); }
}, 300);
