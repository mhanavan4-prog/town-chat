// Ability rework (Session O): the former cosmetic "gimmick" abilities now do
// real things — reversed controls, a brief root, the wolfmark vulnerability,
// and the bloodcurse (bleed-on-attack that heals the caster). Plus the
// Shadow Claws fix (was shielding the enemy) and heralds_muster no longer
// self-marks the Knight with the vulnerability.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ability-rework-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket() {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}

require('../server.js');
const srv = global.__testHooks;

setTimeout(() => {
  try {
    const A = srv.ATTACK_CATALOGS;
    // ── Catalog remap: no cosmetic-only statuses left on these ──
    check('Feral Haze → reversed', A[1].feral_haze.statusType === 'reversed');
    check('Snarl → rooted', A[1].snarl.statusType === 'rooted');
    check('Bone Crunch → bloodcurse', A[1].bone_crunch.statusType === 'bloodcurse');
    check('Shadow Claws → bloodcurse (not pumpkin-shielding the enemy)', A[1].shadow_claws.statusType === 'bloodcurse');
    check('Wolf Mark → wolfmark', A[1].wolf_mark.statusType === 'wolfmark');
    check('Haunting → reversed', A[2].haunting.statusType === 'reversed');
    check('Challenge → wolfmark', A[3].challenge.statusType === 'wolfmark');
    check("Herald's Muster self-marker is NOT the wolfmark debuff", A[3].heralds_muster.statusType !== 'wolfmark');

    // ── wolfmark is now a real vulnerability (+30% damage taken) ──
    check('wolfmark in VULNERABLE_STATUSES', srv.VULNERABLE_STATUSES.has('wolfmark'));
    const marked = { activeStatus: { type: 'wolfmark', expiresAt: Date.now() + 10000 } };
    const clean = { activeStatus: null };
    check('a wolfmarked target takes 1.3× damage', Math.abs(srv.vulnerableMult(marked) - 1.3) < 1e-9, srv.vulnerableMult(marked));
    check('an unmarked target takes normal damage', srv.vulnerableMult(clean) === 1);

    // ── Bloodcurse end-to-end: a cursed attacker bleeds on a hit, caster heals ──
    const wss = global.__wssInstances[0];
    const conn = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
    const join = (name, charId) => { const s = makeMockSocket(); conn(s); s.emit('message', JSON.stringify({ type: 'join', name, charId })); return { s, id: s.lastOfType('init').id }; };

    const victim = join('Victim', 1);   // the cursed attacker
    const curser = join('Curser', 1);   // who laid the curse (gets healed)
    const foe = join('Foe', 1);         // whom the cursed victim attacks

    const V = srv.players.get(victim.id), C = srv.players.get(curser.id), F = srv.players.get(foe.id);
    // Put the fight in the open-PvP Ember Wastes, all on the same spot, far from spawn.
    for (const p of [V, F]) { p.room = 'ember_wastes'; p.x = 50000; p.y = 50000; }
    C.room = 'ember_wastes'; C.x = 49000; C.y = 49000; // curser elsewhere, just needs to exist + be hurt
    C.health = 10; // below max so the drain-heal is observable
    const vBefore = V.health, cBefore = C.health, fBefore = F.health;
    // Lay the curse on the victim (as if Bone Crunch landed), crediting the curser.
    V.activeStatus = { type: 'bloodcurse', expiresAt: Date.now() + 10000, casterId: C.id };

    // Victim strikes the foe → foe takes damage, victim bleeds, curser heals.
    victim.s.emit('message', JSON.stringify({ type: 'strike', targetId: foe.id, targetType: 'player' }));

    check('the struck foe took damage', F.health < fBefore, { before: fBefore, after: F.health });
    check('the cursed attacker bled from their own blow', V.health < vBefore, { before: vBefore, after: V.health });
    check('the curse cannot drop the attacker below 1 HP', V.health >= 1, V.health);
    check('the drained blood healed the curser', C.health > cBefore, { before: cBefore, after: C.health });
  } catch (e) {
    check('test ran without throwing', false, String(e && e.stack || e));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
