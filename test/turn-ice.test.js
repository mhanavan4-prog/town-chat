// TURN / ICE config. With TURN env configured, the server must hand voice
// clients a STUN server plus a TURN relay with short-lived coturn REST
// credentials (username "<expiry>:thornreach", credential = base64 HMAC-SHA1).
// Delivered over the authenticated voice channel (voice_hello_ok).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-turn-');
process.env.TURN_URLS = 'turn:turn.example.com:3478,turns:turn.example.com:5349';
process.env.TURN_SECRET = 'test-shared-secret';
process.env.TURN_TTL = '3600';

const crypto = require('crypto');
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); },
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

    // Direct: buildIceConfig produces STUN + a valid TURN entry.
    const ice = h.buildIceConfig();
    check('ice has servers', ice && Array.isArray(ice.iceServers) && ice.iceServers.length >= 2, ice);
    const turn = (ice.iceServers || []).find((s) => String(s.urls).includes('turn'));
    check('a TURN server is present', !!turn, ice.iceServers);
    check('TURN carries both urls', turn && Array.isArray(turn.urls) && turn.urls.length === 2, turn && turn.urls);
    const m = turn && /^(\d+):thornreach$/.exec(turn.username || '');
    check('username is "<expiry>:thornreach"', !!m, turn && turn.username);
    const expiry = m && parseInt(m[1], 10);
    check('expiry is in the future (~TTL)', expiry && expiry > Math.floor(Date.now() / 1000) && expiry <= Math.floor(Date.now() / 1000) + 3600 + 5, expiry);
    const expected = crypto.createHmac('sha1', 'test-shared-secret').update(turn.username).digest('base64');
    check('credential is HMAC-SHA1(secret, username) base64', turn && turn.credential === expected, { got: turn && turn.credential, expected });

    // Delivered to a website voice client over the authenticated handshake.
    const acct = { username: 'Alice', salt: 'x', hash: 'x', color: '#b98aff', createdAt: Date.now(), over18: true };
    h.accounts.alice = acct; h.sessions.set('tok-alice', 'alice');
    h.covens.cv1 = { id: 'cv1', name: 'Circle', sigil: '🌙', members: ['alice'], leaderKey: 'alice', bank: { gold: 0, slots: [] }, log: [] };
    h.covenIndex.set('alice', 'cv1');
    const s = makeMockSocket('AliceWeb'); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'voice_hello', token: 'tok-alice' }));
    const hello = s.lastOfType('voice_hello_ok');
    check('voice_hello_ok includes ice', !!(hello && hello.ice && hello.ice.iceServers && hello.ice.iceServers.length >= 2), hello && hello.ice);
    s.emit('message', JSON.stringify({ type: 'coven_voice_join' }));
    const joined = s.lastOfType('coven_voice_joined');
    check('coven_voice_joined includes ice', !!(joined && joined.ice && joined.ice.iceServers), joined && joined.ice);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) { console.error(e); process.exit(1); }
}, 250);
