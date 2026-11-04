// The derived-stat stack (buff-slot audit, roadmap #5). Locks the invariants the
// audit comment above statContrib() promises: the eight contributors ADD (two
// buffs on one stat stack, never overwrite), each lands only on its own stat,
// timed slots read 0 once expired, and the ceilings that actually matter live at
// the point of use (haste 70% cooldown cap, incoming-damage 75% floor). Driven
// through the public statContrib / playerMaxHealth / abilityCooldownFor /
// incomingDamageMult so a future refactor can't quietly change any of it.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-buffstack-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const approx = (a, b) => Math.abs(a - b) < 1e-9;

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const far = Date.now() + 3600000;

  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p, a: h.accounts[key] };
  }

  const { statContrib, playerMaxHealth, abilityCooldownFor, incomingDamageMult, outgoingDamageMult } = h;

  // ── Additivity + no overwrite: stack three slots on one stat ───────────────
  const w = join('Witch', 'bs_witch');
  const basePower = statContrib(w.p, 'power');
  w.a.teaBuff = { stat: 'power', amount: 0.12, until: far };
  check('a tea buff adds exactly its amount', approx(statContrib(w.p, 'power'), basePower + 0.12), statContrib(w.p, 'power'));
  w.a.ancestorBuff = { stat: 'power', amount: 0.10, until: far };
  check('a second buff on the SAME stat stacks (no overwrite)', approx(statContrib(w.p, 'power'), basePower + 0.22), statContrib(w.p, 'power'));
  w.a.ritual = { stat: 'power', amount: 0.05, until: far };
  check('a ritual blessing stacks on top of both', approx(statContrib(w.p, 'power'), basePower + 0.27), statContrib(w.p, 'power'));
  check('outgoingDamageMult reads the full summed power', approx(outgoingDamageMult(w.p), 1 + basePower + 0.27));

  // ── Independence across stats: a swift buff doesn't touch power ────────────
  const baseSwift = statContrib(w.p, 'swift');
  w.a.witchPath = 'sea'; // Sea Witch → swift +0.08
  check('a path buff lands on its own stat', approx(statContrib(w.p, 'swift'), baseSwift + 0.08), statContrib(w.p, 'swift'));
  check('and does not leak into another stat', approx(statContrib(w.p, 'power'), basePower + 0.27));

  // ── Familiar vitality flows through to max health ──────────────────────────
  const baseHp = playerMaxHealth(w.p);
  w.a.familiar = 'toad'; // Toad → vitality +25
  check('a familiar vitality buff raises max health by its amount', playerMaxHealth(w.p) === baseHp + 25, playerMaxHealth(w.p));

  // ── Timed slots read 0 once expired ────────────────────────────────────────
  w.a.ancestorBuff = null; w.a.ritual = null;
  w.a.teaBuff = { stat: 'power', amount: 0.5, until: Date.now() - 1000 };
  check('an expired timed buff contributes nothing', approx(statContrib(w.p, 'power'), basePower), statContrib(w.p, 'power'));

  // ── Use-caps: the ceilings that actually matter live at the point of use ───
  const c = join('Capper', 'bs_cap');
  c.a.ritual = { stat: 'haste', amount: 5, until: far }; // absurd haste
  check('haste is capped at 70% faster cooldowns', abilityCooldownFor(c.p, 1000) === 300, abilityCooldownFor(c.p, 1000));
  c.a.ritual = { stat: 'guard', amount: 5, until: far }; // absurd guard (single ritual slot — replaces haste)
  check('incoming damage floors at 25% (75% max resist)', approx(incomingDamageMult(c.p), 0.25), incomingDamageMult(c.p));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
