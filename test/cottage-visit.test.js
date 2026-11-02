// Player housing (slice 3b) — visiting a covenmate's cottage. A covenmate can
// step into your instanced cottage and see YOUR layout (read-only); a host
// rearranging updates live for everyone standing in it; non-covenmates and the
// coven-less are refused. Mirrors test/housing.test.js' harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-cvisit-');

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

  const host = join('Host'); host.p.accountKey = 'host'; town(host);
  const guest = join('Guest'); guest.p.accountKey = 'visitor'; town(guest);

  // Put both in one coven (host is members[0], visitor members[1]).
  h.covens['c1'] = { id: 'c1', name: 'Test Coven', members: ['host', 'visitor'], leaderKey: 'host' };
  h.covenIndex.set('host', 'c1'); h.covenIndex.set('visitor', 'c1');

  // The host furnishes their cottage.
  h.homePlace(host.p, 'bed', 0, 0, 0);
  h.homePlace(host.p, 'cauldron', 4, 4, 0);

  // ── The visit list: a covenmate shows up, you don't ────────────────────────
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'cottage_visit_list' }));
  const list = guest.s.lastOfType('cottage_visit_list');
  check('the visit list names the covenmate', list && list.members.length === 1 && list.members[0].name === 'host' && list.members[0].idx === 0, list && list.members);
  check('the visit list excludes yourself', list && !list.members.some((m) => m.name === 'Guest'));

  // ── Visiting: you enter the host's instance and see THEIR layout ──────────
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'visit_cottage', idx: 0 }));
  const entered = guest.s.lastOfType('cottage_entered');
  check('visiting is accepted', !!entered, guest.s.sent.map((m) => m.type));
  check('it flags you as a visitor + names the host', entered && entered.visiting === true && entered.host === 'host');
  check('you land in the host’s instance', guest.p.room === 'cottage' && guest.p.instance === 'home_host', { room: guest.p.room, inst: guest.p.instance });
  check('you see the HOST’s furniture, not your own', entered && entered.pieces.some((p) => p.id === 'bed') && entered.pieces.some((p) => p.id === 'cauldron'));

  // ── Live: the host rearranges → the visitor's view updates ─────────────────
  // (The host is still in town; editing from anywhere updates their cottage for
  // whoever is standing in it.)
  guest.s.sent.length = 0;
  host.s.emit('message', JSON.stringify({ type: 'home_place', pieceId: 'chair', x: 6, y: 6, rot: 0 }));
  const live = guest.s.lastOfType('cottage_layout');
  check('a host edit pushes the new layout to the visitor', !!live && live.pieces.some((p) => p.id === 'chair'), guest.s.sent.map((m) => m.type));

  // ── The visitor editing THEIR OWN home must not repaint the host's room ────
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'home_place', pieceId: 'rug', x: 0, y: 0, rot: 0 }));
  check('your own edit while visiting does NOT change the host’s room you see', !guest.s.hasType('cottage_layout'), guest.s.sent.map((m) => m.type));
  check('your own edit still updates your editor (home_state)', guest.s.hasType('home_state'));

  // ── Leaving returns you to the public world ────────────────────────────────
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'exit_cottage' }));
  check('leaving a visit returns you to town', guest.s.hasType('cottage_exited') && guest.p.room === 'outside' && guest.p.instance === '');

  // ── Refusals: no coven, and a bogus index ──────────────────────────────────
  const loner = join('Loner'); loner.p.accountKey = 'loner'; town(loner);
  loner.s.sent.length = 0;
  loner.s.emit('message', JSON.stringify({ type: 'visit_cottage', idx: 0 }));
  check('the coven-less cannot visit', !loner.s.hasType('cottage_entered') && loner.s.hasType('home_error'));

  town(guest);
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'visit_cottage', idx: 9 }));
  check('a bogus member index is refused', !guest.s.hasType('cottage_entered') && guest.s.hasType('home_error'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
