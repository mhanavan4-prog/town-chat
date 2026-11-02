// Kitchen witchcraft — The Hearth Path. Teas organised by the seven planetary
// days; each day rules a stat, most teas brew from the Green Path herbs you grow,
// and brewing records the tea in the Almanac. Covers the catalogue shape, the
// day→stat correspondence, the garden→kettle herb link, and the live brew path
// (consume herbs, set the buff, record discovery, refuse without herbs).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-teas-');

const { TEAS, TEA_DAY_BONUS, PLANETS } = require('../data/teas.js');
const { GREEN_PATH_CATEGORIES } = require('../data/greenPath.js');

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

const VALID_STATS = new Set(['vitality', 'forage', 'power', 'swift', 'xp', 'leech', 'guard']);
const GP_HERBS = new Set(GREEN_PATH_CATEGORIES.flatMap((c) => c.plants.map((p) => p.id)));
const BANEFUL = new Set((GREEN_PATH_CATEGORIES.find((c) => c.id === 'baneful') || { plants: [] }).plants.map((p) => p.id));

// ── Pure data: the catalogue covers the week and keeps its correspondences ──
check('all seven planetary days are defined', PLANETS.length === 7 && PLANETS.every((p, i) => p.day === i));
check('every planetary day has at least one tea', PLANETS.every((p) => TEAS.some((t) => t.day === p.day)), TEAS.map((t) => t.day));
check('every tea buffs a real stat', TEAS.every((t) => VALID_STATS.has(t.stat)), TEAS.map((t) => t.stat));
check('each planetary tea carries its day’s correspondence (day → stat)', TEAS.filter((t) => t.day != null).every((t) => { const pl = PLANETS.find((p) => p.day === t.day); return pl && pl.stat === t.stat; }));
check('every tea has lore for the Almanac + a herb + a duration', TEAS.every((t) => t.lore && t.herbs.length && t.hours > 0));
check('no tea brews a baneful Poison-Path herb', !TEAS.some((t) => t.herbs.some((h) => BANEFUL.has(h.id))));
check('the expansion actually brews the herbs you grow', TEAS.filter((t) => t.herbs.some((h) => GP_HERBS.has(h.id))).length >= 8, TEAS.filter((t) => t.herbs.some((h) => GP_HERBS.has(h.id))).map((t) => t.id));
check('the four original teas survived the rewrite', ['hearthmoon_tea', 'mugwort_tea', 'gingerroot_tea', 'clovermint_tea'].every((id) => TEAS.some((t) => t.id === id)));

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

  const g = join('Brewer');
  g.p.accountKey = 'brewer';

  // The state ships planets + per-tea brewable/discovered + resolved herb names.
  const body = h.teaStateBody(g.p);
  check('tea_state ships the planetary metadata', Array.isArray(body.planets) && body.planets.length === 7);
  check('teas carry a canBrew flag + resolved herb names', body.teas.every((t) => typeof t.canBrew === 'boolean' && t.herbs.every((hh) => hh.name)));
  check('nothing is brewable or discovered on an empty larder', body.teas.every((t) => t.canBrew === false && t.discovered === false));

  // Pick a green-path tea and try to brew it with no herbs → refused.
  const gpTea = TEAS.find((t) => t.herbs.some((hh) => GP_HERBS.has(hh.id)));
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: gpTea.id }));
  check('brewing without the herb is refused', !!g.s.lastOfType('tea_error') && !g.s.sent.some((m) => m.type === 'tea_state' && m.active));

  // Grant the herbs, then brew.
  for (const ing of gpTea.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty + 1 }], g.p);
  const haveBefore = h.countItemQty(h.getInventory(g.p), gpTea.herbs[0].id);
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: gpTea.id }));
  check('a funded brew consumes the herb', h.countItemQty(h.getInventory(g.p), gpTea.herbs[0].id) === haveBefore - gpTea.herbs[0].qty);
  const after = h.teaStateBody(g.p);
  check('the sipped tea sets a live buff on its stat', after.active && after.active.id === gpTea.id && after.active.stat === gpTea.stat);
  check('brewing records the tea in the Almanac', after.teas.find((t) => t.id === gpTea.id).discovered === true);

  // Day bonus: a tea brewed ON its planetary day steeps ×TEA_DAY_BONUS longer.
  // (We can't pick the weekday, but the buff duration must be positive + bounded.)
  const dur = after.active.until - Date.now();
  const base = gpTea.hours * 3600000;
  check('the buff duration is the base, or the day-bonus multiple', dur > 0 && dur <= base * TEA_DAY_BONUS + 2000);

  // ── Greater brews + the capstone (slice 2) ─────────────────────────────────
  const greaters = TEAS.filter((t) => t.greater);
  check('there are greater, two-herb draughts', greaters.length >= 3 && greaters.every((t) => t.herbs.length >= 2));
  const cap = TEAS.find((t) => t.requires === 'allPlanets');
  check('the capstone exists, belongs to no single day', !!cap && cap.day == null);

  // Fresh brewer for the capstone gate.
  const m = join('Master'); m.p.accountKey = 'master';
  // The capstone is locked, and refused, before the collection is complete.
  const b0 = h.teaStateBody(m.p);
  check('the capstone starts locked', b0.teas.find((t) => t.id === cap.id).locked === true && b0.allPlanets === false);
  for (const ing of cap.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty }], m.p);
  m.s.sent.length = 0;
  m.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: cap.id }));
  check('brewing the capstone early is refused', !!m.s.lastOfType('tea_error') && h.teaStateBody(m.p).teas.find((t) => t.id === cap.id).discovered === false);

  // Steep one tea from each of the seven planetary days.
  const onePerDay = PLANETS.map((pl) => TEAS.find((t) => t.day === pl.day && !t.requires));
  for (const t of onePerDay) { for (const ing of t.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty }], m.p); m.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: t.id })); }
  const b1 = h.teaStateBody(m.p);
  check('brewing one per day completes the collection', b1.allPlanets === true && b1.daysBrewed === 7);
  check('the capstone is now unlocked', b1.teas.find((t) => t.id === cap.id).locked === false);

  // Now the capstone brews (herbs were granted above; re-grant in case a day-tea spent one).
  for (const ing of cap.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty }], m.p);
  m.s.sent.length = 0;
  m.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: cap.id }));
  check('the master brew can now be steeped', h.teaStateBody(m.p).teas.find((t) => t.id === cap.id).discovered === true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
