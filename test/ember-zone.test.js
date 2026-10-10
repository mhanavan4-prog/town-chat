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
  check('there are six wild ember creature types (+ the warlord boss)',
    Object.keys(h.EMBER_MOB_TYPES).filter(k => !h.EMBER_MOB_TYPES[k].boss).length === 6, Object.keys(h.EMBER_MOB_TYPES));
  check('the zone is well populated (40+ spawns)', h.emberMobs.length >= 40, h.emberMobs.length);
  check('every scatter spawn is a real non-boss type',
    h.EMBER_MOB_SPAWNS.every(s => h.EMBER_MOB_TYPES[s.type] && !h.EMBER_MOB_TYPES[s.type].boss));
  check('no creature spawns inside the arrival haven',
    h.EMBER_MOB_SPAWNS.every(s => Math.hypot(s.x - SPAWN.x, s.y - SPAWN.y) >= SAFE), 'a spawn is in the safe ring');

  // ── Named landmarks + clustered spawns ──
  check('the zone has named landmarks', h.EMBER_LANDMARKS.length >= 3, h.EMBER_LANDMARKS.length);
  check('exactly one landmark garrisons the warlord', h.EMBER_LANDMARKS.filter(l => l.warlord).length === 1);
  const throne = h.EMBER_LANDMARKS.find(l => l.warlord);
  const nearThrone = h.EMBER_MOB_SPAWNS.filter(s => Math.hypot(s.x - throne.x, s.y - throne.y) < throne.radius).length;
  check('mobs cluster around a landmark (not uniform scatter)', nearThrone >= 3, nearThrone);

  // ── The zone warlord ──
  const warlord = h.emberMobs.find(m => m.boss);
  check('a warlord boss garrisons the zone', !!warlord && h.EMBER_MOB_TYPES[warlord.mobType].boss === true);
  check('the warlord has a boss-sized health pool', warlord && h.EMBER_MOB_TYPES[warlord.mobType].maxHealth >= 1500, warlord && h.EMBER_MOB_TYPES[warlord.mobType].maxHealth);
  check('the warlord stands at its throne landmark', warlord && Math.hypot(warlord.spawnX - throne.x, warlord.spawnY - throne.y) < 1);
  check('the warlord respawns slower than common mobs', h.EMBER_BOSS_RESPAWN_MS > 90 * 1000);

  // ── Harvestable resource nodes ──
  check('the zone seeds resource nodes', h.EMBER_NODES.length >= 10, h.EMBER_NODES.length);
  check('every node is a real gatherable type', h.EMBER_NODES.every(n => h.EMBER_NODE_TYPES[n.type]));
  check('no node sits inside the arrival haven',
    h.EMBER_NODES.every(n => Math.hypot(n.x - SPAWN.x, n.y - SPAWN.y) >= SAFE - 100), 'a node is in the safe ring');
  { const now = Date.now(); check('nodes report as ready before being harvested', h.emberNodeStates(now).every(s => s.ready)); }
  check('node materials feed the crafting tree',
    h.CRAFT_RECIPES.some(r => r.ingredients.some(i => i.id === 'emberbloom')) &&
    h.CRAFT_RECIPES.some(r => r.ingredients.some(i => i.id === 'cinder_salt')));

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

  // ── Live harvest flow: stand on a ready node in the Wastes and gather it ──
  const G = join('Gatherer');
  const node = h.EMBER_NODES[0];
  G.p.room = 'ember_wastes'; G.p.x = node.x; G.p.y = node.y; G.p.isDead = false;
  const invBefore = h.countItemQty(h.getInventory(G.p), h.EMBER_NODE_TYPES[node.type].itemId);
  G.s.emit('message', JSON.stringify({ type: 'harvest_ember_node', nodeId: node.id }));
  const hr = G.s.lastOfType('harvest_result');
  check('harvesting a node reports a gather', !!hr && /Gathered/i.test(hr.message), hr);
  check('the gathered material lands in the pack', h.countItemQty(h.getInventory(G.p), h.EMBER_NODE_TYPES[node.type].itemId) > invBefore);
  check('the harvested node goes on cooldown', Date.now() < node.readyAt);
  // Too far away → refused.
  const node2 = h.EMBER_NODES.find(n => Math.hypot(n.x - node.x, n.y - node.y) > 500) || h.EMBER_NODES[1];
  G.p.x = node2.x + 5000; G.p.y = node2.y + 5000;
  const spent0 = h.countItemQty(h.getInventory(G.p), h.EMBER_NODE_TYPES[node2.type].itemId);
  G.s.emit('message', JSON.stringify({ type: 'harvest_ember_node', nodeId: node2.id }));
  check('a node out of reach cannot be gathered', h.countItemQty(h.getInventory(G.p), h.EMBER_NODE_TYPES[node2.type].itemId) === spent0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
