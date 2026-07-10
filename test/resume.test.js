// Live-resume + duplicate-prevention coverage, in the same mock-socket
// style as harness.test.js. The scenarios locked in here:
//
//  1. Every join's init carries a resumeToken; a dropped socket can rejoin
//     with it and be rebuilt as the same character in the same spot.
//  2. THE CHECKOUT DUPLICATE: checkout_departure stashes the player while
//     they're still connected, and the old socket's close can lag behind
//     the Stripe redirect — a fast checkout return then joins while the
//     pre-checkout self is still in the players map. The resume join must
//     kick the lingering twin, not stand a copy of the character next to
//     themselves.
//  3. The old socket's late close after being kicked must be a no-op (no
//     second player_left, no stash resurrecting the kicked entry).
process.env.PORT = '0';

function makeMockSocket(label) {
  return {
    label,
    OPEN: 1,
    readyState: 1,
    sent: [],
    closed: false,
    _handlers: {},
    on(event, cb) { this._handlers[event] = cb; },
    send(data) { this.sent.push(JSON.parse(data)); },
    close() { this.closed = true; },
    terminate() { this.closed = true; },
    ping() {},
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
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  // ── 1. Plain disconnect → resume with the init token ──────────────────
  const a1 = makeMockSocket('a1');
  connHandler(a1);
  a1.emit('message', JSON.stringify({ type: 'join', name: 'Mike' }));
  const init1 = a1.lastOfType('init');
  check('init carries a live resumeToken', init1 && typeof init1.resumeToken === 'string' && init1.resumeToken.length > 10);

  // Walk somewhere distinctive, then drop the socket.
  a1.emit('message', JSON.stringify({ type: 'move', x: 900, y: 1900, room: 'outside' }));
  a1.emit('close');

  const a2 = makeMockSocket('a2');
  connHandler(a2);
  a2.emit('message', JSON.stringify({ type: 'join', resumeToken: init1.resumeToken }));
  const init2 = a2.lastOfType('init');
  check('resume join is accepted after a disconnect', !!init2 && init2.resumed === true);
  const me2 = init2 && init2.players.find(p => p.id === init2.id);
  check('resumed at the same spot with the same name', me2 && me2.name === 'Mike' && me2.x === 900 && me2.y === 1900);
  check('exactly one copy of the character exists', init2 && init2.players.filter(p => p.name === 'Mike').length === 1);
  check('a fresh resumeToken is issued on resume', init2 && init2.resumeToken && init2.resumeToken !== init1.resumeToken);

  // ── 2. The checkout duplicate: old socket still open when the return joins ──
  a2.emit('message', JSON.stringify({ type: 'checkout_departure' }));
  const tokenMsg = a2.lastOfType('resume_token');
  check('checkout_departure hands back a stash token', tokenMsg && typeof tokenMsg.token === 'string');

  // NOTE: a2 is NOT closed — this is the lagging-close race.
  const witness = makeMockSocket('witness');
  connHandler(witness);
  witness.emit('message', JSON.stringify({ type: 'join', name: 'Witness' }));

  const a3 = makeMockSocket('a3');
  connHandler(a3);
  a3.emit('message', JSON.stringify({ type: 'join', resumeToken: tokenMsg.token }));
  const init3 = a3.lastOfType('init');
  check('checkout-return resume is accepted', !!init3 && init3.resumed === true);
  const mikes = init3 ? init3.players.filter(p => p.name === 'Mike') : [];
  check('NO duplicate: exactly one Mike in the world after the return', mikes.length === 1);
  check('the lingering pre-checkout socket was told to close', a2.closed === true);
  check('bystanders saw the old copy leave', witness.allOfType('player_left').some(m => m.id === init2.id));

  // ── 3. The kicked socket's late close is a no-op ───────────────────────
  const leftBefore = witness.allOfType('player_left').length;
  a2.emit('close'); // the proxy finally delivers the old close
  const leftAfter = witness.allOfType('player_left').length;
  check('late close of the kicked socket emits no second player_left', leftAfter === leftBefore);
  const stillMikes = witness.lastOfType('state');
  // (state ticks flow constantly; the last one must contain exactly one Mike)
  check('state tick still shows exactly one Mike', !stillMikes || stillMikes.players.filter(p => p.name === 'Mike').length === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
