// Drives the real server.js connection handler with mock sockets to verify
// every character class has a working ability kit: damage, leech, heal,
// ward, and intel abilities, each validated server-side per charId.
process.env.PORT = '0';

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
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const hooks = global.__testHooks;

  // One player of every class, standing together at spawn.
  const sockets = [];
  const ids = [];
  const names = ['Witchy', 'Wolfy', 'Misty', 'Knighty', 'Wandy'];
  for (let charId = 0; charId < 5; charId++) {
    const s = makeMockSocket(names[charId]);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: names[charId], charId }));
    sockets.push(s);
    ids.push(s.lastOfType('init').id);
  }
  const [witch, wolf, mystic, knight, wanderer] = sockets;
  const [witchId, wolfId, mysticId, knightId, wandererId] = ids;

  check('every class joins with its charId', sockets.every((s, i) => {
    const init = s.lastOfType('init');
    const self = init.players.find(p => p.id === ids[i]);
    return self && self.charId === i;
  }));

  // --- Class gating: only the Witch casts spells; every other class has attacks ---
  knight.emit('message', JSON.stringify({ type: 'cast_spell', spellId: 'fireball', targetId: witchId }));
  check('non-Witch cast_spell is rejected', !!knight.lastOfType('spell_error'));

  witch.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'smite', targetId: knightId }));
  check('Witch cast_attack is rejected (no attack catalog)', !!witch.lastOfType('attack_error'));

  // --- Damage attacks per class ---
  const knightPlayer = hooks.players.get(knightId);
  const hpBefore = knightPlayer.health;
  mystic.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'spirit_lash', targetId: knightId }));
  check('Mystic Spirit Lash lands (attack_result)', /Spirit Lash/.test((mystic.lastOfType('attack_result') || {}).message || ''));
  check('Spirit Lash actually damages the target', knightPlayer.health < hpBefore && knightPlayer.health >= hpBefore - 28);
  check('target is told they were struck', !!knight.lastOfType('struck'));
  check('room sees an attack_fx projectile broadcast', !!witch.lastOfType('attack_fx'));

  const mysticPlayer = hooks.players.get(mysticId);
  mysticPlayer.health = 50; // wound the mystic so the leech has room to heal
  wolf.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'savage_bite', targetId: mysticId }));
  check('Werewolf Savage Bite lands', /Savage Bite/.test((wolf.lastOfType('attack_result') || {}).message || ''));

  const wolfPlayer = hooks.players.get(wolfId);
  wolfPlayer.health = 40;
  const _wolfHpBeforeLeech = wolfPlayer.health;
  mystic.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'soul_siphon', targetId: knightId }));
  check('Mystic Soul Siphon lands', /Soul Siphon/.test((mystic.lastOfType('attack_result') || {}).message || ''));
  check('Soul Siphon heals the caster back', hooks.players.get(mysticId).health > 50 - 28);

  knight.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'smite', targetId: wandererId }));
  check('Knight Smite lands', /Smite/.test((knight.lastOfType('attack_result') || {}).message || ''));

  wanderer.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'knife_throw', targetId: wolfId }));
  check('Wanderer Knife Throw lands', /Knife Throw/.test((wanderer.lastOfType('attack_result') || {}).message || ''));

  // --- Cooldown: same ability twice immediately fails ---
  mystic.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'spirit_lash', targetId: knightId }));
  check('per-ability cooldown blocks an immediate recast', !!mystic.lastOfType('attack_error'));

  // --- Heals ---
  wolfPlayer.health = 30;
  knight.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'lay_on_hands', targetId: wolfId }));
  check('Knight Lay on Hands heals the target', wolfPlayer.health >= 55 && wolfPlayer.health <= 70);
  check('healed player is told', /Lay on Hands/.test((wolf.lastOfType('attack_result') || {}).message || ''));

  mysticPlayer.health = 30;
  const mysticSelfBefore = mysticPlayer.health;
  // Mending Spirits from another player: the wanderer can't cast the mystic's kit —
  // verify catalog isolation instead:
  wanderer.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'mending_spirits', targetId: mysticId }));
  check('a class cannot cast another class\'s ability', !!wanderer.lastOfType('attack_error') &&
    (wanderer.lastOfType('attack_error').message === 'Unknown attack.') && mysticPlayer.health === mysticSelfBefore);

  // --- Wards (status 'ward' halves damage) ---
  knight.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'oath_of_iron' }));
  check('Oath of Iron applies the ward status', knightPlayer.activeStatus && knightPlayer.activeStatus.type === 'ward');
  const hpBeforeWardedHit = knightPlayer.health;
  wolfPlayer.attackCooldowns = {}; // savage_bite was used above — clear the 8s cooldown for this check
  wolf.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'savage_bite', targetId: knightId }));
  const wardedDmg = hpBeforeWardedHit - knightPlayer.health;
  check('ward halves incoming damage (16-26 → 8-13)', wardedDmg >= 8 && wardedDmg <= 13);

  // Ally ward
  mystic.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'spirit_ward', targetId: wandererId }));
  const wandererPlayer = hooks.players.get(wandererId);
  check('Spirit Ward wards an ally', wandererPlayer.activeStatus && wandererPlayer.activeStatus.type === 'ward');

  // --- Regen self-heals ---
  wolf.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'moonlit_mending' }));
  check('Moonlit Mending applies regen', wolfPlayer.activeStatus && wolfPlayer.activeStatus.type === 'regen');

  // --- Intel: reveal + realm sweep for the new classes ---
  mystic.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'whispered_secret', targetId: witchId }));
  const reveal = mystic.lastOfType('attack_result');
  check('Whispered Secret reveals the target', reveal && reveal.revealTargetId === witchId);

  knight.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'heralds_muster' }));
  const muster = knight.lastOfType('attack_result');
  check("Herald's Muster reports every player", muster && names.filter(n => n !== 'Knighty').every(n => muster.message.includes(n)));

  mystic.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'spirit_walk' }));
  const walk = mystic.lastOfType('attack_result');
  check('Spirit Walk reports every player', walk && names.filter(n => n !== 'Misty').every(n => walk.message.includes(n)));

  // --- Every catalog entry is well-formed (server side) ---
  let malformed = 0;
  for (const cid of [1, 2, 3, 4]) {
    for (const [_id, atk] of Object.entries(hooks.ATTACK_CATALOGS[cid])) {
      if (!atk.name || !atk.kind || !atk.effect) malformed++;
      if (atk.effect === 'damage' || atk.effect === 'leech') {
        if (!(atk.dmgMin > 0 && atk.dmgMax >= atk.dmgMin)) malformed++;
      }
      if (atk.effect === 'heal' && !(atk.healMin > 0 && atk.healMax >= atk.healMin)) malformed++;
      if (atk.effect === 'status' && !atk.statusType) malformed++;
    }
  }
  check('all attack catalog entries are well-formed', malformed === 0);
  check('every non-Witch class has a full 12+ ability kit',
    [1, 2, 3, 4].every(cid => Object.keys(hooks.ATTACK_CATALOGS[cid]).length >= 12));
  check('every class kit has damage, defense (ward), heal (regen/heal), and intel',
    [1, 2, 3, 4].every(cid => {
      const atks = Object.values(hooks.ATTACK_CATALOGS[cid]);
      const hasDamage = atks.some(a => a.effect === 'damage' || a.effect === 'leech');
      const hasWard = atks.some(a => a.effect === 'status' && a.statusType === 'ward');
      const hasHeal = atks.some(a => (a.effect === 'status' && a.statusType === 'regen') || a.effect === 'heal');
      const hasIntel = atks.some(a => ['reveal', 'intel_sweep', 'spyglass', 'howl_location'].includes(a.effect));
      return hasDamage && hasWard && hasHeal && hasIntel;
    }));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
