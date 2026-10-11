// Open-launch moderation (Session O): content filter, registration cap, and
// player reports. Proves the launch-critical rules, including the pass-room
// policy — the language filter guards the FREE world chat but NOT the paid,
// room-scoped lounge/arcade channel.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');

process.env.DATA_DIR = fs.mkdtempSync(os.tmpdir() + '/tc-moderation-');
const PORT = 38231;
process.env.PORT = String(PORT);
delete process.env.TOWN_PASSWORD; // open join (no passcode) for the WS path

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket() {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    allOfType(t) { return this.sent.filter(m => m.type === t); }
  };
}
function post(path, body) {
  return new Promise((resolve, reject) => {
    const d = JSON.stringify(body);
    const req = http.request({ host: 'localhost', port: PORT, path, method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d) } },
      (rp) => { let b = ''; rp.on('data', c => b += c); rp.on('end', () => resolve({ status: rp.statusCode, body: b ? JSON.parse(b) : null })); });
    req.on('error', reject); req.write(d); req.end();
  });
}

require('../server.js');
const srv = global.__testHooks;

setTimeout(async () => {
  try {
    // ── Registration: name filter + per-IP hard cap ──
    const slurName = await post('/api/register', { username: 'nigger', password: 'xxxx', over18: true });
    check('slur username is rejected (400)', slurName.status === 400, slurName.status);

    let okCount = 0, capped = 0;
    for (let i = 0; i < 8; i++) {
      const r = await post('/api/register', { username: 'Villager' + i, password: 'xxxx', over18: true });
      if (r.status === 200) okCount++;
      else if (r.status === 429) capped++;
    }
    check('per-IP cap allows a reasonable number then blocks', okCount === 6 && capped === 2, { okCount, capped });

    // ── WS chat: FREE world channel is filtered ──
    const wss = global.__wssInstances[0];
    const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

    const alice = makeMockSocket(); connHandler(alice);
    alice.emit('message', JSON.stringify({ type: 'join', name: 'Alice' }));
    const bob = makeMockSocket(); connHandler(bob);
    bob.emit('message', JSON.stringify({ type: 'join', name: 'Bob' }));
    const bobId = bob.lastOfType('init').id;

    const beforeAlice = alice.sent.length;
    bob.emit('message', JSON.stringify({ type: 'chat', text: 'you are a faggot' }));
    const gotSlur = alice.sent.slice(beforeAlice).some(m => m.type === 'chat' && m.message.text.includes('faggot'));
    check('free-world slur is NOT delivered', !gotSlur);
    check('sender gets a soft notice the message was blocked', bob.allOfType('announce_soft').some(m => /language filter/i.test(m.message)));

    const beforeAlice2 = alice.sent.length;
    bob.emit('message', JSON.stringify({ type: 'chat', text: 'good evening town' }));
    check('a clean free-world line IS delivered', alice.sent.slice(beforeAlice2).some(m => m.type === 'chat' && m.message.text === 'good evening town'));

    // ── WS chat: PASS room (lounge) is a room-scoped channel, NOT filtered ──
    const carol = makeMockSocket(); connHandler(carol);
    carol.emit('message', JSON.stringify({ type: 'join', name: 'Carol' }));
    const carolId = carol.lastOfType('init').id;
    srv.players.get(carolId).passUntil = Date.now() + 3600000; // grant a town pass
    carol.emit('message', JSON.stringify({ type: 'move', x: 0, y: 0, room: 'lounge' }));
    check('pass-holder reached the locked lounge', srv.players.get(carolId).room === 'lounge', srv.players.get(carolId).room);

    const beforeCarol = carol.sent.length, beforeAlice3 = alice.sent.length;
    carol.emit('message', JSON.stringify({ type: 'chat', text: 'this faggot word is not filtered here' }));
    const carolEcho = carol.sent.slice(beforeCarol).filter(m => m.type === 'chat');
    check('pass-room slur IS delivered in the pass room (unfiltered)', carolEcho.some(m => m.message.text.includes('faggot')));
    check('pass-room chat is tagged scope=pass', carolEcho.some(m => m.message.scope === 'pass'));
    check('pass-room chat does NOT leak to the free world', !alice.sent.slice(beforeAlice3).some(m => m.type === 'chat' && m.message.text.includes('faggot')));

    // ── Player report files an audit entry + acks the reporter ──
    const beforeAliceR = alice.sent.length;
    alice.emit('message', JSON.stringify({ type: 'report', targetId: bobId, targetName: 'Bob', reason: 'Harassment' }));
    check('reporter gets an acknowledgement', alice.sent.slice(beforeAliceR).some(m => m.type === 'announce_soft' && /report/i.test(m.message)));
  } catch (e) {
    check('test ran without throwing', false, String(e && e.stack || e));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 500);
