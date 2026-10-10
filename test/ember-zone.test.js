// The Ember Wastes as a full open zone, plus the PvP policy that governs it:
// open free-for-all inside the Wastes (but never in the spawn haven),
// consent-only ("invitation to battle") everywhere else including the Wilds.
// Also the trapped-when-the-portal-closes exit and the battle-invite handshake.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ember-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const SPAWN = h.EMBER_SPAWN, SAFE = h.EMBER_SAFE_RADIUS;

  // ── Zone is a full, large, populated map ──
  check('the zone is twice the Wilds (20000²)', h.EMBER_WORLD_DIMS.width === 20000 && h.EMBER_WORLD_DIMS.height === 20000);
  check('there are six ember creature types', Object.keys(h.EMBER_MOB_TYPES).length === 6, Object.keys(h.EMBER_MOB_TYPES));
  check('the zone is well populated (40+ spawns)', h.emberMobs.length >= 40, h.emberMobs.length);
  check('every spawn is a real type', h.EMBER_MOB_SPAWNS.every(s => h.EMBER_MOB_TYPES[s.type]));
  check('no creature spawns inside the arrival haven',
    h.EMBER_MOB_SPAWNS.every(s => Math.hypot(s.x - SPAWN.x, s.y - SPAWN.y) >= SAFE), 'a spawn is in the safe ring');

  // ── PvP policy matrix (pure, on plain player-shaped objects) ──
  const inEmberOpen = (id) => ({ id, room: 'ember_wastes', x: 5000, y: 5000 });   // far from spawn
  const inEmberSafe = (id) => ({ id, room: 'ember_wastes', x: SPAWN.x, y: SPAWN.y }); // in the haven
  const inWilds     = (id) => ({ id, room: 'wilds', x: 5000, y: 5000 });
  check('PvP is open in the Wastes (outside the haven)', h.pvpAllowed(inEmberOpen('a'), inEmberOpen('b')) === true);
  check('PvP is blocked when the attacker is in the spawn haven', h.pvpAllowed(inEmberSafe('a'), inEmberOpen('b')) === false);
  check('PvP is blocked when the target is in the spawn haven', h.pvpAllowed(inEmberOpen('a'), inEmberSafe('b')) === false);
  check('PvP is blocked in the Wilds without a battle invitation', h.pvpAllowed(inWilds('a'), inWilds('b')) === false);
  { const a = inWilds('da'), b = inWilds('db'); h.startDuel(a, b);
    check('an accepted battle invitation opens PvP in the Wilds', h.pvpAllowed(a, b) === true && h.hasActiveDuel(a, b) === true); }

  // ── Live wiring: applyDamage honors the policy ──
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 1 }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false; p.health = 500;
    return { s, p };
  }
  const A = join('Aggro'), B = join('Target');

  // Wilds, no duel → the strike is refused as pvpBlocked.
  A.p.room = B.p.room = 'wilds'; A.p.x = B.p.x = 4000; A.p.y = B.p.y = 4000;
  let r = h.applyDamage(A.p, 'player', B.p.id, 20, 9999);
  check('a Wilds strike with no invitation is refused', r.ok === false && r.pvpBlocked === true, r);
  check('the refusal leaves the target unharmed', B.p.health === 500, B.p.health);

  // Same pair, now duelling → the strike lands.
  h.startDuel(A.p, B.p);
  r = h.applyDamage(A.p, 'player', B.p.id, 20, 9999);
  check('once both accept, the strike lands', r.ok === true && B.p.health < 500, { r, hp: B.p.health });

  // Ember Wastes, outside the haven → open, lands with no invitation.
  A.p.room = B.p.room = 'ember_wastes'; A.p.x = B.p.x = 5000; A.p.y = B.p.y = 5000; B.p.health = 500;
  r = h.applyDamage(A.p, 'player', B.p.id, 20, 9999);
  check('in the open Wastes PvP needs no invitation', r.ok === true && B.p.health < 500, { r, hp: B.p.health });

  // Target steps into the spawn haven → safe, strike refused. Attacker stands
  // just outside the ring (within reach) so range isn't what blocks the hit.
  B.p.x = SPAWN.x; B.p.y = SPAWN.y; B.p.health = 500;
  A.p.x = SPAWN.x; A.p.y = SPAWN.y - (SAFE + 100);
  r = h.applyDamage(A.p, 'player', B.p.id, 20, 9999);
  check('the spawn haven protects a player in the Wastes', r.ok === false && r.pvpBlocked === true && B.p.health === 500, r);

  // ── Trapped when the portal is closed ──
  check('the portal is closed by default (no torches lit)', h.templePortalOpen() === false);
  const C = join('Trapped'); C.p.room = 'ember_wastes'; C.p.x = 5000; C.p.y = 5000;
  C.s.emit('message', JSON.stringify({ type: 'exit_ember_wastes' }));
  const err = C.s.lastOfType('ember_wastes_error');
  check('a closed portal traps the player in the Wastes', !!err && /trapped/i.test(err.message), err);
  check('the player stays in the Wastes', C.p.room === 'ember_wastes');

  // ── Battle-invite handshake over the socket (in the Wilds) ──
  const X = join('Challenger'), Y = join('Challenged');
  X.p.room = Y.p.room = 'wilds'; X.p.x = Y.p.x = 100; X.p.y = Y.p.y = 100;
  X.s.emit('message', JSON.stringify({ type: 'pvp_invite', targetId: Y.p.id }));
  check('the challenge reaches the target as a prompt', Y.s.lastOfType('pvp_invited') && Y.s.lastOfType('pvp_invited').fromId === X.p.id);
  Y.s.emit('message', JSON.stringify({ type: 'pvp_invite_respond', accept: true }));
  check('accepting starts the duel for both', X.s.lastOfType('pvp_duel_started') && Y.s.lastOfType('pvp_duel_started'));
  check('the duel is now active between them', h.hasActiveDuel(X.p, Y.p) === true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
