// Cross-surface coven voice — website voice-only clients (voice_hello) sharing
// one coven channel with in-game players. Verifies the generalized relay spans
// both the players map and the voiceClients map: presence, cross-surface peer
// notifications, bidirectional signal relay, coven gating, and disconnect
// cleanup. Runs against the real server.js handlers via mock sockets.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-voiceweb-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    allOfType(t) { return this.sent.filter((m) => m.type === t); },
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
    const acct = (u) => ({ username: u, salt: 'x', hash: 'x', color: '#b98aff', createdAt: Date.now(), over18: true });

    // Accounts + sessions for the web clients.
    h.accounts.alice = acct('Alice'); h.accounts.bob = acct('Bob'); h.accounts.cara = acct('Cara');
    h.sessions.set('tok-bob', 'bob'); h.sessions.set('tok-cara', 'cara');
    // Alice + Bob share a coven; Cara is in her own.
    h.covens.cv_test = { id: 'cv_test', name: 'Test Circle', sigil: '🌙', members: ['alice', 'bob'], leaderKey: 'alice', bank: { gold: 0, slots: [] }, log: [] };
    h.covenIndex.set('alice', 'cv_test'); h.covenIndex.set('bob', 'cv_test');
    h.covens.cv_solo = { id: 'cv_solo', name: 'Solo Circle', sigil: '⭐', members: ['cara'], leaderKey: 'cara', bank: { gold: 0, slots: [] }, log: [] };
    h.covenIndex.set('cara', 'cv_solo');

    // Alice joins as a real GAME player.
    const aSock = makeMockSocket('Alice'); connHandler(aSock);
    aSock.emit('message', JSON.stringify({ type: 'join', name: 'Alice', charId: 0 }));
    const aPlayer = h.players.get(aSock.lastOfType('init').id);
    aPlayer.accountKey = 'alice'; aSock._isGuest = false;

    // Bob joins as a WEBSITE voice-only client.
    const bSock = makeMockSocket('BobWeb'); connHandler(bSock);
    bSock.emit('message', JSON.stringify({ type: 'voice_hello', token: 'tok-bob' }));
    const hello = bSock.lastOfType('voice_hello_ok');
    check('web client gets voice_hello_ok', !!hello, bSock.sent);
    check('voice_hello_ok carries the coven', !!hello && hello.coven && hello.coven.name === 'Test Circle', hello && hello.coven);
    check('voice_hello_ok lists coven members', !!hello && hello.coven.members.length === 2);
    const bWebId = hello && hello.selfId;
    check('web client did NOT spawn a game player', !h.players.has(bWebId) && h.voiceClients.has(bWebId));

    // Bad token / covenless are refused.
    const xSock = makeMockSocket('NoAuth'); connHandler(xSock);
    xSock.emit('message', JSON.stringify({ type: 'voice_hello', token: 'garbage' }));
    check('a bad token is refused', !!xSock.lastOfType('voice_hello_error'));

    // ── Cross-surface join: game player + web client in one channel ──
    aSock.emit('message', JSON.stringify({ type: 'coven_voice_join' }));
    bSock.emit('message', JSON.stringify({ type: 'coven_voice_join' }));
    const bJoined = bSock.lastOfType('coven_voice_joined');
    check('web joiner sees the in-game player as a peer (cross-surface)',
      !!bJoined && bJoined.peers.some((pr) => pr.id === aPlayer.id), bJoined);
    check('the in-game player is told the web client joined (cross-surface)',
      !!aSock.lastOfType('coven_voice_peer_join') && aSock.lastOfType('coven_voice_peer_join').id === bWebId);
    check('roster shows both across surfaces', (aSock.lastOfType('coven_voice_roster').voice || []).length === 2);

    // ── Bidirectional signal relay web <-> game ──
    const aBefore = aSock.allOfType('coven_voice_signal').length;
    bSock.emit('message', JSON.stringify({ type: 'coven_voice_signal', toId: aPlayer.id, data: { sdp: 'OFFER' } }));
    const toA = aSock.lastOfType('coven_voice_signal');
    check('web→game signal is relayed', !!toA && toA.fromId === bWebId && toA.data.sdp === 'OFFER', toA);
    check('exactly one signal delivered to game', aSock.allOfType('coven_voice_signal').length === aBefore + 1);

    const bBefore = bSock.allOfType('coven_voice_signal').length;
    aSock.emit('message', JSON.stringify({ type: 'coven_voice_signal', toId: bWebId, data: { sdp: 'ANSWER' } }));
    const toB = bSock.lastOfType('coven_voice_signal');
    check('game→web signal is relayed', !!toB && toB.fromId === aPlayer.id && toB.data.sdp === 'ANSWER', toB);
    check('exactly one signal delivered to web', bSock.allOfType('coven_voice_signal').length === bBefore + 1);

    // ── Coven gating: a web client in another coven is isolated ──
    const cSock = makeMockSocket('CaraWeb'); connHandler(cSock);
    cSock.emit('message', JSON.stringify({ type: 'voice_hello', token: 'tok-cara' }));
    cSock.emit('message', JSON.stringify({ type: 'coven_voice_join' }));
    const cBefore = cSock.allOfType('coven_voice_signal').length;
    aSock.emit('message', JSON.stringify({ type: 'coven_voice_signal', toId: cSock.lastOfType('voice_hello_ok').selfId, data: { sdp: 'X' } }));
    check('a signal to another coven is dropped', cSock.allOfType('coven_voice_signal').length === cBefore);

    // ── Disconnect cleanup ──
    bSock.emit('close');
    check('web client removed from voiceClients on disconnect', !h.voiceClients.has(bWebId));
    check('game peer told the web client left', !!aSock.lastOfType('coven_voice_peer_leave') && aSock.lastOfType('coven_voice_peer_leave').id === bWebId);
    check('roster shrinks after web client leaves', (aSock.lastOfType('coven_voice_roster').voice || []).length === 1);
    // A signal aimed at the gone web client is dropped (participant cleaned up).
    const aAfter = aSock.allOfType('coven_voice_signal').length;
    aSock.emit('message', JSON.stringify({ type: 'coven_voice_signal', toId: bWebId, data: { sdp: 'Z' } }));
    check('no relay to a disconnected participant', aSock.allOfType('coven_voice_signal').length === aAfter);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) { console.error(e); process.exit(1); }
}, 250);
