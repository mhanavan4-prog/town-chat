// Crowd-adaptive player broadcast: a normal room streams positions every tick
// (full roster on join/leave, deltas otherwise); a crowded channel drops to
// HALF cadence to free the world-tick budget, but still sends the FULL roster
// (no one is ever culled from view) and always emits on a membership change.
// Drives the real broadcastPlayerState() tick synchronously via a test hook.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-aoi-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    countOfType(t) { return this.sent.filter(m => m.type === t).length; },
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
  check('crowd threshold is exposed', typeof h.CROWD_THRESHOLD === 'number', h.CROWD_THRESHOLD);

  // ── Crowded channel (> threshold) in town, including a far player ──
  const N = h.CROWD_THRESHOLD + 5;
  const crowd = [];
  for (let i = 0; i < N; i++) crowd.push(join('crowd' + i));
  for (let i = 0; i < N - 1; i++) { const p = crowd[i].p; p.room = 'outside'; p.x = 400 + (i % 10) * 15; p.y = 400 + Math.floor(i / 10) * 15; }
  const loner = crowd[N - 1]; loner.p.room = 'outside'; loner.p.x = 3200; loner.p.y = 2100; // far across town

  // Tick 1 — membership just changed → the crowded channel MUST emit, full roster.
  for (const c of crowd) c.s.sent.length = 0;
  h.broadcastPlayerState();
  const member = crowd[0];
  const got = member.lastReceived = member.s.lastOfType('state');
  check('a crowded player receives a frame on the membership-change tick', !!got);
  const ids = new Set((got.players || []).map(p => p.id));
  check('the crowded frame is the FULL roster (nobody culled)', ids.size === N, { got: ids.size, want: N });
  check('a far player is still included (no view culling)', ids.has(loner.p.id));

  // Ticks 2 & 3 — no membership change → half cadence: exactly ONE emit across the two.
  let emits = 0;
  for (let t = 0; t < 2; t++) {
    for (const c of crowd) c.s.sent.length = 0;
    h.broadcastPlayerState();
    if (member.s.countOfType('state') > 0) emits++;
  }
  check('a crowded channel runs at half cadence (1 emit per 2 idle ticks)', emits === 1, emits);

  // ── Normal channel (≤ threshold): streams every tick ──
  const small = [];
  for (let i = 0; i < 6; i++) { const j = join('wild' + i); j.p.room = 'wilds'; j.p.x = 500 + i * 1500; j.p.y = 500; small.push(j); }
  for (const s of small) s.s.sent.length = 0;
  h.broadcastPlayerState(); // membership change for the wilds channel → full roster
  const smIds = new Set((small[0].s.lastOfType('state').players || []).map(p => p.id));
  check('a normal room sends the full roster regardless of distance', small.every(s => smIds.has(s.p.id)), smIds.size);
  // A move on the next tick is delivered immediately (no half-cadence skip).
  small[1].p.x += 50;
  for (const s of small) s.s.sent.length = 0;
  h.broadcastPlayerState();
  const moved = small[0].s.lastOfType('state');
  check('a normal room streams a move on the very next tick', !!moved && moved.players.some(p => p.id === small[1].p.id), moved && moved.players.map(p => p.id));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
