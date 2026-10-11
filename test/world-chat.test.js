// Unified world chat: a public player's message reaches EVERY player regardless
// of room (the global channel), while coven-moot chat stays private to the
// coven instance. Also the join backlog seeds a newcomer.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wchat-');

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
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, room) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    if (room) p.room = room;
    return { s, p };
  }

  const A = join('Ava', 'outside');     // town
  const B = join('Ben', 'wilds');       // a different room entirely
  B.s.sent.length = 0;
  A.s.emit('message', JSON.stringify({ type: 'chat', text: 'hello town!' }));
  const got = B.s.lastOfType('chat');
  check('a town message reaches a player in another room (global)', !!got && got.message.text === 'hello town!', got);
  check('world messages are tagged scope=world', got && got.message.scope === 'world');

  // ── Coven moot chat stays private to the coven instance ──
  const C = join('Cora', 'outside'); C.p.instance = 'coven_test';
  const D = join('Dex', 'outside');  // public, NOT in the coven
  const E = join('Eve', 'outside');  E.p.instance = 'coven_test'; // same coven
  D.s.sent.length = 0; E.s.sent.length = 0;
  C.s.emit('message', JSON.stringify({ type: 'chat', text: 'secret plans' }));
  const dGot = D.s.allOfType('chat').some(m => m.message.text === 'secret plans');
  const eGot = E.s.allOfType('chat').some(m => m.message.text === 'secret plans');
  check('coven chat does NOT leak to the public world', dGot === false);
  check('coven chat reaches a fellow coven member', eGot === true);
  check('coven chat is tagged scope=coven', E.s.lastOfType('chat') && E.s.lastOfType('chat').message.scope === 'coven');

  // ── A newcomer gets a world-chat backlog on join ──
  const F = join('Fin', 'outside');
  const init = F.s.lastOfType('init');
  check('init carries a world-chat backlog array', Array.isArray(init.worldChat));
  check('the backlog includes an earlier public line', init.worldChat.some(m => m.text === 'hello town!'), init.worldChat.map(m => m.text));
  check('the backlog excludes coven-private lines', !init.worldChat.some(m => m.text === 'secret plans'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
