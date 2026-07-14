// Drives the real server.js connection handler with mock sockets so we can
// verify join/move/room-detection/chat-scoping logic without real networking.
process.env.PORT = '0'; // avoid clashing with anything; real http.listen still binds locally
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-harness-test-');

function makeMockSocket(label) {
  return {
    label,
    OPEN: 1,
    readyState: 1,
    sent: [],
    _handlers: {},
    on(event, cb) { this._handlers[event] = cb; },
    send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) {
      for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i];
      return null;
    },
    allOfType(type) { return this.sent.filter(m => m.type === type); }
  };
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name); }
}

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  // The server registers a real ws.WebSocketServer (an EventEmitter), so the
  // connection handler is read back through the emitter API; the _handlers
  // form is kept for compatibility with a mocked ws module, if one is used.
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  check('server registered a connection handler', typeof connHandler === 'function');

  // --- Alice joins ---
  const alice = makeMockSocket('alice');
  connHandler(alice);
  alice.emit('message', JSON.stringify({ type: 'join', name: 'Alice' }));
  const aliceInit = alice.lastOfType('init');
  check('alice receives init', !!aliceInit);
  check('alice spawns at world.spawn', aliceInit && aliceInit.players[0].x === aliceInit.world.spawn.x);
  const aliceId = aliceInit ? aliceInit.id : null;

  // --- Bob joins, should see alice in init snapshot, alice should be told bob joined ---
  const bob = makeMockSocket('bob');
  connHandler(bob);
  bob.emit('message', JSON.stringify({ type: 'join', name: 'Bob' }));
  const bobInit = bob.lastOfType('init');
  check('bob sees alice in init snapshot', bobInit && bobInit.players.some(p => p.name === 'Alice'));
  check('alice notified of bob joining', !!alice.lastOfType('player_joined'));
  const _bobId = bobInit.id;

  // --- Both move into the cafe room ---
  const world = aliceInit.world;
  const cafe = world.buildings.find(b => b.id === 'cafe');
  const cafeX = cafe.x + cafe.w / 2, cafeY = cafe.y + cafe.h / 2;
  alice.emit('message', JSON.stringify({ type: 'move', x: cafeX, y: cafeY, room: 'cafe' }));
  bob.emit('message', JSON.stringify({ type: 'move', x: cafeX + 5, y: cafeY, room: 'cafe' }));

  // --- Carol joins and stays outside ---
  const carol = makeMockSocket('carol');
  connHandler(carol);
  carol.emit('message', JSON.stringify({ type: 'join', name: 'Carol' }));

  const beforeAlice = alice.sent.length;
  const beforeCarol = carol.sent.length;

  // --- Alice chats — should reach Bob (same room) but NOT Carol (outside) ---
  alice.emit('message', JSON.stringify({ type: 'chat', text: 'Hi from the cafe!' }));

  const bobChats = bob.allOfType('chat');
  check('bob (same room) receives the chat message', bobChats.some(m => m.message.text === 'Hi from the cafe!'));
  const aliceChats = alice.sent.slice(beforeAlice).filter(m => m.type === 'chat');
  check('alice (sender) also receives her own room-scoped message (echo)', aliceChats.some(m => m.message.text === 'Hi from the cafe!'));
  const carolChats = carol.sent.slice(beforeCarol).filter(m => m.type === 'chat');
  check('carol (outside / different room) does NOT receive the cafe message', carolChats.length === 0);

  // --- Carol chats outside — alice/bob (in cafe) should not get it ---
  const beforeAlice2 = alice.sent.length;
  carol.emit('message', JSON.stringify({ type: 'chat', text: 'Hello town square' }));
  const aliceChats2 = alice.sent.slice(beforeAlice2).filter(m => m.type === 'chat');
  check('alice (in cafe) does not receive outside chat', aliceChats2.length === 0);

  // --- XSS / length sanitization ---
  carol.emit('message', JSON.stringify({ type: 'chat', text: '<script>alert(1)</script>' + 'x'.repeat(500) }));
  const carolOwnChat = carol.allOfType('chat').slice(-1)[0];
  check('chat text strips angle brackets', carolOwnChat && !carolOwnChat.message.text.includes('<'));
  check('chat text capped at 240 chars', carolOwnChat && carolOwnChat.message.text.length <= 240);

  // --- Wrong passcode rejection (only meaningful if TOWN_PASSWORD set — simulate separately) ---

  // --- Disconnect cleanup ---
  const beforeBob = bob.sent.length;
  alice.emit('close');
  const bobLeftMsgs = bob.sent.slice(beforeBob).filter(m => m.type === 'player_left' && m.id === aliceId);
  check('other players notified when alice disconnects', bobLeftMsgs.length === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
