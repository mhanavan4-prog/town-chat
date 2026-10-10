// The Necromancer (charId 5) and the undead it raises. Confirms the class is
// registered, that the summon abilities raise owned minions (level-gated by
// tier), that a minion fights THROUGH the owner's applyDamage (so kills credit
// the owner and PvP rules apply), that the active cap and necro-rank scaling
// hold, and that minions crumble when cleared.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-necro-');

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

  // ── Class registration ──
  check('three summon tiers exist', Object.keys(h.SUMMON_TYPES).join() === 'skeleton,bone_knight,grave_wight');
  check('the Necromancer has a full attack kit', Object.keys(h.NECROMANCER_ATTACK_CATALOG).length >= 6);
  check('the three summons are level-gated in ascending order',
    h.SUMMON_TYPES.skeleton.requiresLevel < h.SUMMON_TYPES.bone_knight.requiresLevel &&
    h.SUMMON_TYPES.bone_knight.requiresLevel < h.SUMMON_TYPES.grave_wight.requiresLevel);

  // ── necro-rank scaling: rank empowers health and damage ──
  const s0 = h.summonStats('skeleton', 1, 0), s3 = h.summonStats('skeleton', 1, 3);
  check('ritual rank empowers the undead (more hp + damage)', s3.maxHealth > s0.maxHealth && s3.dmgMax > s0.dmgMax, { s0, s3 });
  const lvl10 = h.summonStats('skeleton', 10, 0);
  check('higher caster level also strengthens summons', lvl10.maxHealth > s0.maxHealth);

  // ── Join as a Necromancer ──
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false; p.health = 500;
    return { s, p };
  }
  const N = join('Mortis', 5);
  check('a player can join as a Necromancer', N.p.charId === 5);

  // ── Raising undead (via the real cast_attack path) ──
  N.p.room = 'wilds'; N.p.x = 4000; N.p.y = 4000;
  N.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'raise_skeleton', targetId: null }));
  check('Raise Skeleton reports the undead clawing up', /claws its way up/.test((N.s.lastOfType('attack_result') || {}).message || ''));
  check('a minion now exists, owned by the Necromancer, rising', h.minions.some(m => m.ownerId === N.p.id && !m.dead && m.risenAt > Date.now()), h.minions.length);

  // Tier gate: a level-1 necromancer can't raise a Grave Wight (requires 13).
  N.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'raise_wight', targetId: null }));
  check('a high-tier summon is refused below its level', /Level 13/.test((N.s.lastOfType('attack_error') || {}).message || ''), N.s.lastOfType('attack_error'));

  // ── The undead fights through the owner (PvP, so kills credit the owner) ──
  const E = join('Prey', 1); E.p.room = 'wilds'; E.p.x = 4000; E.p.y = 4000; E.p.health = 500;
  h.startDuel(N.p, E.p); // the owner may fight E, so the minion may too
  const mn = h.minions.find(m => m.ownerId === N.p.id && !m.dead);
  mn.x = E.p.x; mn.y = E.p.y; mn.risenAt = Date.now() - 1; mn.lastHitAt = 0; // in range, risen, ready
  const before = E.p.health;
  h.tickMinions(0.2);
  check('a risen undead strikes the owner\'s foe through applyDamage', E.p.health < before, { before, after: E.p.health });

  // ── Active cap: a fresh necromancer holds at most 2; the oldest crumbles ──
  const C = join('Capper', 5); C.p.room = 'wilds'; C.p.x = 200; C.p.y = 200;
  h.raiseUndead(C.p, 'skeleton'); h.raiseUndead(C.p, 'skeleton'); h.raiseUndead(C.p, 'skeleton');
  check('the active-minion cap holds at 2 for a base Necromancer', h.ownerMinions(C.p.id).length === 2, h.ownerMinions(C.p.id).length);

  // ── Cleanup ──
  h.clearMinions(C.p.id);
  check('clearing crumbles all of an owner\'s undead', h.ownerMinions(C.p.id).length === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
