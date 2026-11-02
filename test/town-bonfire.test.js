// The Town Bonfire — a town-wide seasonal goal. The whole town (coven or not)
// feeds a shared bonfire with grown/foraged herbs; at the target it LIGHTS and
// everyone online shares a blessing. Covers offering (spends herbs, advances the
// shared bar, records the giver), the offer gate (real herbs only), lighting at
// the target (blessing + lit flag + a town-feed shout), the already-lit refusal,
// and the season roll resetting the fire.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-bonfire-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

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
  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; }
    return { s, p };
  }
  const invCount = (p, id) => { const inv = h.getInventory(p); let n = 0; for (const it of (inv.slots || inv)) if (it && it.itemId === id) n += (it.qty || 1); return n; };
  const HERB = 'chamomile';

  const a = join('Giver', 'bonf_a');
  h.ensureTownBonfire();

  // ── State shape: a fresh, unlit fire tied to the live season ────────────────
  const st0 = h.townBonfireState(a.p);
  check('the bonfire starts unlit with a target', st0.lit === false && st0.target === h.BONFIRE_TARGET && st0.progress === 0);
  check('state names the season', typeof st0.seasonName === 'string' && st0.seasonName.length > 0);

  // ── Offer gate: only real grown herbs feed it ───────────────────────────────
  a.s.emit('message', JSON.stringify({ type: 'bonfire_offer', herb: 'not_a_herb', qty: 5 }));
  check('offering a non-herb is refused', h.getTownBonfire().progress === 0);

  // ── Feed it: spends herbs, advances the shared bar, records the giver ────────
  h.grantLoot([{ kind: 'item', itemId: HERB, qty: 30 }], a.p);
  const before = invCount(a.p, HERB);
  a.s.emit('message', JSON.stringify({ type: 'bonfire_offer', herb: HERB, qty: 12 }));
  check('feeding the fire spends the herbs', invCount(a.p, HERB) === before - 12, { before, after: invCount(a.p, HERB) });
  check('the shared progress climbs', h.getTownBonfire().progress === 12);
  check('the giver is credited', h.townBonfireState(a.p).youGave === 12 && h.townBonfireState(a.p).givers === 1);
  check('an offer broadcasts progress to everyone', a.s.lastOfType('town_bonfire_progress') && a.s.lastOfType('town_bonfire_progress').progress === 12);
  check('a single offer is capped', (() => { a.s.emit('message', JSON.stringify({ type: 'bonfire_offer', herb: HERB, qty: 9999 })); return h.getTownBonfire().progress <= 12 + 50; })());

  // ── Lighting: everyone online is blessed; the fire reads lit ────────────────
  const b = join('Bystander', 'bonf_b'); // online, never fed it — still blessed
  const bXp = h.getProgress(b.p).xp || 0;
  h.getTownBonfire().progress = h.BONFIRE_TARGET - 1; // poised one short
  h.grantLoot([{ kind: 'item', itemId: HERB, qty: 5 }], a.p);
  a.s.emit('message', JSON.stringify({ type: 'bonfire_offer', herb: HERB, qty: 5 }));
  check('reaching the target lights the fire', h.getTownBonfire().lit === true);
  check('lighting blesses an online bystander (XP granted)', (h.getProgress(b.p).xp || 0) > bXp, { before: bXp, after: h.getProgress(b.p).xp });
  check('lighting shouts to the Town Crier', (h.__testHooks ? true : true) && h.townfeed.recent(5).some((x) => /Bonfire/i.test(x.text)));
  check('the final broadcast says lit', a.s.lastOfType('town_bonfire_progress').lit === true);

  // ── Already lit: further offers are turned away ─────────────────────────────
  h.grantLoot([{ kind: 'item', itemId: HERB, qty: 5 }], a.p);
  const heldLit = invCount(a.p, HERB);
  a.s.emit('message', JSON.stringify({ type: 'bonfire_offer', herb: HERB, qty: 5 }));
  check('a lit fire takes no more herbs', invCount(a.p, HERB) === heldLit && /already blazes/i.test((a.s.lastOfType('toast') || {}).message || ''));

  // ── The wheel turns: a fresh, unlit fire ────────────────────────────────────
  h.getTownBonfire().seasonKey = '__stale__'; // force a season mismatch
  const rolled = h.townBonfireState(a.p);
  check('a new season rolls a fresh, unlit fire', rolled.lit === false && rolled.progress === 0 && h.getTownBonfire().seasonKey !== '__stale__');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
