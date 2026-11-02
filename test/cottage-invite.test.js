// Player housing — the general cottage invite flow. Anyone online (no coven
// needed) can be invited to tour your cottage: they get a prompt, accept to
// enter your instance and see your layout, decline to pass. Covers the send →
// receive → accept/enter path, decline, expiry, and that leaving returns you to
// where you were (town or Wilds). Mirrors test/housing.test.js' harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-cinvite-');

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
  function town(g) { g.p.room = 'outside'; g.p.instance = ''; }

  // Two strangers — deliberately NOT in a coven together.
  const host = join('Host'); host.p.accountKey = 'host'; town(host);
  const guest = join('Guest'); guest.p.accountKey = 'guest'; town(guest);
  h.homePlace(host.p, 'bed', 0, 0, 0);

  // ── Send → receive ─────────────────────────────────────────────────────────
  guest.s.sent.length = 0; host.s.sent.length = 0;
  host.s.emit('message', JSON.stringify({ type: 'cottage_invite', targetId: guest.p.id }));
  check('the host gets a "sent" confirmation', host.s.hasType('cottage_invite_sent'));
  const recv = guest.s.lastOfType('cottage_invite_received');
  check('the target receives the invite with the host name', recv && recv.fromName === 'Host', recv);

  // ── Accept → enter the host's instance, see their layout (no coven!) ───────
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'cottage_invite_accept' }));
  const entered = guest.s.lastOfType('cottage_entered');
  check('accepting drops you into the host’s cottage', !!entered && entered.visiting === true && entered.host === 'host');
  check('you land in the host’s instance', guest.p.room === 'cottage' && guest.p.instance === 'home_host');
  check('you see the host’s furniture', entered && entered.pieces.some((p) => p.id === 'bed'));

  // ── Leaving returns you to town (you accepted from town) ──────────────────
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'exit_cottage' }));
  const exited = guest.s.lastOfType('cottage_exited');
  check('leaving returns you to the town square', exited && exited.room === 'outside' && guest.p.room === 'outside');

  // ── Accept is a one-shot: the invite is consumed ──────────────────────────
  town(guest); guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'cottage_invite_accept' }));
  check('a consumed invite can’t be re-accepted', !guest.s.hasType('cottage_entered') && guest.s.hasType('home_error'));

  // ── Accepting from the Wilds returns you to the Wilds ─────────────────────
  host.s.emit('message', JSON.stringify({ type: 'cottage_invite', targetId: guest.p.id }));
  guest.p.room = 'wilds'; guest.p.instance = ''; guest.p.x = 5000; guest.p.y = 5000;
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'cottage_invite_accept' }));
  check('you can accept from the Wilds', guest.s.hasType('cottage_entered') && guest.p.room === 'cottage');
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'exit_cottage' }));
  const exitedW = guest.s.lastOfType('cottage_exited');
  check('leaving returns you to the Wilds you came from', exitedW && exitedW.room === 'wilds' && guest.p.room === 'wilds' && exitedW.x === 5000);

  // ── Decline tells the host ─────────────────────────────────────────────────
  town(guest);
  host.s.emit('message', JSON.stringify({ type: 'cottage_invite', targetId: guest.p.id }));
  host.s.sent.length = 0; guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'cottage_invite_decline' }));
  check('declining notifies the host', host.s.hasType('toast'));
  check('a declined invite can’t then be accepted', (() => { guest.s.sent.length = 0; guest.s.emit('message', JSON.stringify({ type: 'cottage_invite_accept' })); return !guest.s.hasType('cottage_entered'); })());

  // ── Expiry is enforced ─────────────────────────────────────────────────────
  host.s.emit('message', JSON.stringify({ type: 'cottage_invite', targetId: guest.p.id }));
  const inv = h.cottageInvites.get(guest.p.id);
  if (inv) inv.expiresAt = Date.now() - 1; // force-expire
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'cottage_invite_accept' }));
  check('an expired invite is refused', !guest.s.hasType('cottage_entered') && guest.s.hasType('home_error'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
