// Wanderer rework — Deep Meditation (immunity + no-attack), Nightwatch Cloak
// (invisibility), Featherlight Pack (evasion), Shadow Owls (big damage + swarm),
// Heavy Pack (damage + root). Driven end-to-end through cast_attack / strike.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wander-');

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
  const hooks = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, charId) {
    const s = makeMockSocket(tag);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
    const p = hooks.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    p.x = 1000; p.y = 1000; p.room = 'outside';
    return { s, p };
  }
  const cast = (who, attackId, targetId) => who.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId, targetId }));

  const W = join('Rover', 4);  // Wanderer
  const T = join('Quarry', 0); // a target to hit
  const A = join('Fang', 1);   // a werewolf attacker
  const now = () => Date.now();

  // ── Deep Meditation: total immunity + can't attack while it holds ──
  cast(W, 'deep_meditation');
  check('Deep Meditation grants immunity (invulnUntil set)', W.p.invulnUntil > now(), W.p.invulnUntil);
  cast(W, 'knife_throw', T.p.id);
  check('a meditating Wanderer can’t cast attacks', /meditation/.test((W.s.lastOfType('attack_error') || {}).message || ''), W.s.lastOfType('attack_error'));
  W.s.emit('message', JSON.stringify({ type: 'strike', targetType: 'player', targetId: T.p.id }));
  check('a meditating Wanderer can’t strike either', /meditation/.test((W.s.lastOfType('attack_error') || {}).message || ''), W.s.lastOfType('attack_error'));
  const whpBefore = W.p.health;
  cast(A, 'savage_bite', W.p.id);
  check('attacks against a meditating player do nothing', W.p.health === whpBefore && /meditation|glances off/.test((A.s.lastOfType('attack_error') || {}).message || ''), { hp: W.p.health, err: A.s.lastOfType('attack_error') });

  // Lift the trance so the Wanderer can act for the rest of the tests.
  W.p.invulnUntil = 0; W.p.activeStatus = null;

  // ── Nightwatch Cloak: invisibility ──
  cast(W, 'nightwatch_cloak');
  check('Nightwatch Cloak turns the Wanderer invisible (invisibleUntil set)', W.p.invisibleUntil > now(), W.p.invisibleUntil);

  // ── Featherlight Pack: evasion (attacks miss) ──
  cast(W, 'featherlight_pack');
  check('Featherlight Pack grants evasion (evasionUntil set)', W.p.evasionUntil > now(), W.p.evasionUntil);
  const whp2 = W.p.health;
  A.p.attackCooldowns = {}; // clear the savage_bite cooldown from the immunity test
  cast(A, 'savage_bite', W.p.id);
  check('attacks slip past a featherlight Wanderer', W.p.health === whp2 && /slips the blow|echo/.test((A.s.lastOfType('attack_error') || {}).message || ''), { hp: W.p.health, err: A.s.lastOfType('attack_error') });

  // ── Shadow Owls: real damage + the swarm visual ──
  // (Base is 22–38, but applyDamage adds the attacker's offense stat on top,
  // so assert a meaningful drop rather than an exact band. High starting HP
  // keeps the target alive through both hits for the root check below.)
  T.p.health = 300; T.p.activeStatus = null;
  cast(W, 'shadow_owls', T.p.id);
  check('Shadow Owls deal real damage', T.p.health < 300 && T.p.health >= 250, T.p.health);
  check('Shadow Owls leave the swarm circling (bats status)', T.p.activeStatus && T.p.activeStatus.type === 'bats', T.p.activeStatus);

  // ── Heavy Pack: damage + root ──
  const thpBefore = T.p.health;
  cast(W, 'heavy_pack', T.p.id);
  check('Heavy Pack deals damage', T.p.health < thpBefore, { before: thpBefore, after: T.p.health });
  check('Heavy Pack roots the target in place (rooted status)', T.p.activeStatus && T.p.activeStatus.type === 'rooted', T.p.activeStatus);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
