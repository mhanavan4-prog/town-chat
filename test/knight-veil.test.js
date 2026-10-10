// Knight "Guardian's Veil" — an AoE ward that blanks the Werewolf's covert
// attacks (Hunter's Read, Rapid Swipe, Scent Trail) for everyone it covers.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-veil-');

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
  const hooks = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag, charId, x, y) {
    const s = makeMockSocket(tag);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
    const p = hooks.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    p.x = x; p.y = y;
    return { s, p };
  }

  // Knight + a sheltered villager (within 200 of the knight), the wolf, and a
  // villager standing outside the veil (300 from the knight, but within read
  // range of the wolf) as the control.
  const K = join('Knight', 3, 1000, 1000);
  const V1 = join('Sheltered', 0, 1050, 1000); // inside the veil
  const W = join('Wolf', 1, 1100, 1000);        // caster of the covert attacks
  const V2 = join('Exposed', 0, 1300, 1000);    // outside the veil, still readable

  // Raise the veil (AoE, no target).
  K.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'guardians_veil' }));
  const nowMs = Date.now();
  check('the sheltered villager is veiled', V1.p.veiledUntil > nowMs, V1.p.veiledUntil);
  check('the knight shelters under their own veil', K.p.veiledUntil > nowMs, K.p.veiledUntil);
  check('a villager outside the radius is NOT veiled', !(V2.p.veiledUntil > nowMs), V2.p.veiledUntil);
  check('the sheltered villager is told the veil rose', V1.s.allOfType('attack_hit').some(m => m.effect === 'veil'), V1.s.allOfType('attack_hit'));

  // Hunter's Read is blanked on the veiled villager…
  W.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'hunters_read', targetId: V1.p.id }));
  const r1 = W.s.lastOfType('attack_result');
  check('Hunter’s Read returns no rap sheet against a veiled target', !!r1 && !r1.rapSheet && /Veil|crumbles/.test(r1.message), r1);
  check('the veiled target learns the read broke', V1.s.allOfType('attack_hit').some(m => m.effect === 'veil_held'), V1.s.allOfType('attack_hit'));

  // …but still works on the exposed villager (proves the veil is the cause).
  W.p.attackCooldowns = {}; // clear the per-attack cooldown from the read above
  W.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'hunters_read', targetId: V2.p.id }));
  const r2 = W.s.lastOfType('attack_result');
  check('Hunter’s Read still works on an unveiled target', !!r2 && !!r2.rapSheet, r2);

  // Rapid Swipe is blanked too.
  W.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'rapid_swipe', targetId: V1.p.id }));
  check('Rapid Swipe is sealed out by the veil', /Veil|sealed/.test((W.s.lastOfType('attack_result') || {}).message || ''), W.s.lastOfType('attack_result'));

  // Scent Trail is blanked — and never even pings the target for consent.
  const howlBefore = V1.s.allOfType('howl_consent_request').length;
  W.s.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'scent_trail', targetId: V1.p.id }));
  check('Scent Trail is sealed out by the veil', /Veil|sealed/.test((W.s.lastOfType('attack_result') || {}).message || ''), W.s.lastOfType('attack_result'));
  check('a veiled target is never even asked to howl', V1.s.allOfType('howl_consent_request').length === howlBefore, V1.s.allOfType('howl_consent_request').length);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
