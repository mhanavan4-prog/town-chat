// Coven voice chat — the server is only a WebRTC signaling relay + presence
// tracker (audio is peer-to-peer). Verifies join presence, peer notifications,
// same-coven-gated signal relay, and leave/teardown — against the real
// server.js handlers via mock sockets.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-covenvoice-');

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
  const hooks = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  // Connect three sockets; A & B share a coven, C is in no coven.
  function join(tag) {
    const s = makeMockSocket(tag);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = hooks.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    return { s, p };
  }
  const A = join('Alice'), B = join('Bob'), C = join('Cara');

  // Put Alice + Bob in one coven directly (skip the invite dance).
  hooks.covens['cv_test'] = {
    id: 'cv_test', name: 'Test Circle', sigil: '🌙',
    members: ['alice', 'bob'], leaderKey: 'alice',
    bank: { gold: 0, slots: [] }, log: []
  };
  hooks.covenIndex.set('alice', 'cv_test');
  hooks.covenIndex.set('bob', 'cv_test');

  // ── Join voice ──
  A.s.emit('message', JSON.stringify({ type: 'coven_voice_join' }));
  check('first joiner gets coven_voice_joined with no peers yet',
    !!A.s.lastOfType('coven_voice_joined') && A.s.lastOfType('coven_voice_joined').peers.length === 0,
    A.s.lastOfType('coven_voice_joined'));
  check('joining sets voiceOn on the connection', A.p.voiceOn === true);

  B.s.emit('message', JSON.stringify({ type: 'coven_voice_join' }));
  check('second joiner sees the first as an existing peer',
    !!B.s.lastOfType('coven_voice_joined') && B.s.lastOfType('coven_voice_joined').peers.some(pr => pr.id === A.p.id),
    B.s.lastOfType('coven_voice_joined'));
  check('existing member is told a new peer joined',
    !!A.s.lastOfType('coven_voice_peer_join') && A.s.lastOfType('coven_voice_peer_join').id === B.p.id);
  check('both appear in the voice roster',
    (A.s.lastOfType('coven_voice_roster').voice || []).length === 2);

  // ── Signal relay (SDP/ICE) ──
  const beforeB = B.s.allOfType('coven_voice_signal').length;
  A.s.emit('message', JSON.stringify({ type: 'coven_voice_signal', toId: B.p.id, data: { sdp: 'OFFER' } }));
  const sig = B.s.lastOfType('coven_voice_signal');
  check('signal is relayed to the target peer', !!sig && sig.fromId === A.p.id && sig.data.sdp === 'OFFER', sig);
  check('exactly one signal was delivered', B.s.allOfType('coven_voice_signal').length === beforeB + 1);

  // ── Same-coven gating ──
  const cBefore = C.s.allOfType('coven_voice_signal').length;
  A.s.emit('message', JSON.stringify({ type: 'coven_voice_signal', toId: C.p.id, data: { sdp: 'X' } }));
  check('a signal to a non-coven / non-voice target is dropped',
    C.s.allOfType('coven_voice_signal').length === cBefore);

  // Cara (no coven) trying to join voice is refused.
  C.s.emit('message', JSON.stringify({ type: 'coven_voice_join' }));
  check('a covenless player cannot join voice',
    !!C.s.lastOfType('coven_voice_error') && C.p.voiceOn !== true);

  // ── Leave / teardown ──
  A.s.emit('message', JSON.stringify({ type: 'coven_voice_leave' }));
  check('leaving clears voiceOn', A.p.voiceOn === false);
  check('peers are told to tear the leaver down',
    !!B.s.lastOfType('coven_voice_peer_leave') && B.s.lastOfType('coven_voice_peer_leave').id === A.p.id);
  check('roster shrinks to just the remaining talker',
    (B.s.lastOfType('coven_voice_roster').voice || []).length === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
