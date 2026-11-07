// Kitchen witchcraft — The Hearth Path. Teas organised by the seven planetary
// days; each day rules a stat, most teas brew from the Green Path herbs you grow,
// and brewing records the tea in the Almanac. Covers the catalogue shape, the
// day→stat correspondence, the garden→kettle herb link, and the live brew path
// (consume herbs, set the buff, record discovery, refuse without herbs).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-teas-');

const { TEAS, TEA_DAY_BONUS, PLANETS, HEARTH_PATH } = require('../data/teas.js');
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
  h.getProgress(g.p).hearthPath = { chapter: HEARTH_PATH.length, progress: 0 }; // path done — no questline rewards skew the brew-mechanics checks below

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

  // Day bonus: a tea brewed ON its planetary day steeps ×TEA_DAY_BONUS longer,
  // and one brewed in its planet's own HOUR ×TEA_HOUR_BONUS more (they stack).
  // (We can't pick the weekday or the hour, but the buff must be positive and
  // no longer than both bonuses together; this failed on the rare brew that
  // landed on its planet's day AND hour.)
  const dur = after.active.until - Date.now();
  const base = gpTea.hours * 3600000;
  check('the buff duration is the base, or the day- and hour-bonus multiple', dur > 0 && dur <= base * TEA_DAY_BONUS * h.TEA_HOUR_BONUS + 2000, { dur, base });

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

  // ── Sabbat teas — the Wheel of the Year (slice 3) ──────────────────────────
  const sabbatTeas = TEAS.filter((t) => t.sabbat);
  check('there is a brew for all eight sabbats', sabbatTeas.length === 8 && new Set(sabbatTeas.map((t) => t.sabbat)).size === 8);
  const sb = join('Seasonal'); sb.p.accountKey = 'seasonal';
  const bs = h.teaStateBody(sb.p);
  check('the state ships the live season + the sabbats map', !!bs.season && bs.sabbats && Object.keys(bs.sabbats).length === 8);
  const inKey = bs.season;
  check('exactly the live sabbat’s brew is in season; the rest are locked', bs.teas.filter((t) => t.sabbat).every((t) => (t.sabbat === inKey) ? (t.locked === false && t.inSeason === true) : (t.locked === true && t.inSeason === false)));

  // An out-of-season sabbat tea is refused even with its herb in hand.
  const offTea = sabbatTeas.find((t) => t.sabbat !== inKey);
  for (const ing of offTea.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty }], sb.p);
  sb.s.sent.length = 0;
  sb.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: offTea.id }));
  check('an out-of-season sabbat brew is refused', !!sb.s.lastOfType('tea_error') && h.teaStateBody(sb.p).teas.find((t) => t.id === offTea.id).discovered === false);

  // The in-season one steeps.
  const onTea = sabbatTeas.find((t) => t.sabbat === inKey);
  for (const ing of onTea.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty }], sb.p);
  sb.s.sent.length = 0;
  sb.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: onTea.id }));
  check('the live sabbat’s brew steeps + records', h.teaStateBody(sb.p).teas.find((t) => t.id === onTea.id).discovered === true);

  // ── The Hearth Path questline (slice 4) ────────────────────────────────────
  check('the Hearth Path has chapters with valid objectives', HEARTH_PATH.length >= 6 && HEARTH_PATH.every((c) => c.title && c.objective && ['brew', 'brew_greater', 'brew_sabbat', 'brew_capstone', 'planets'].includes(c.objective.type)));
  const pw = join('Pathwalker'); pw.p.accountKey = 'pathwalker';
  h.getProgress(pw.p).level = 20; // clear every chapter's level gate for the test
  const hp0 = h.teaStateBody(pw.p).hearthPath;
  check('a fresh account starts at chapter 1', hp0 && hp0.chapter === 0 && hp0.title === HEARTH_PATH[0].title);

  // Chapter 1: brew any tea → advances.
  h.grantLoot([{ kind: 'item', itemId: 'healing_herb', qty: 1 }], pw.p);
  pw.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: 'hearthmoon_tea' }));
  check('brewing advances the first chapter', h.teaStateBody(pw.p).hearthPath.chapter === 1);

  // The 'planets' objective reports distinct-day progress (not a flat tick).
  h.getProgress(pw.p).hearthPath = { chapter: HEARTH_PATH.findIndex((c) => c.objective.type === 'planets' && c.objective.target === 3), progress: 0 };
  // brew teas under three different planets
  for (const id of ['chamomile_tea', 'lavender_tea', 'yarrow_tea']) { const t = TEAS.find((x) => x.id === id); for (const ing of t.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty }], pw.p); pw.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: id })); }
  check('the planets objective clears on three distinct days', h.teaStateBody(pw.p).hearthPath.chapter > HEARTH_PATH.findIndex((c) => c.objective.type === 'planets' && c.objective.target === 3));

  // A 'brew_greater' chapter only advances on a greater draught.
  h.getProgress(pw.p).hearthPath = { chapter: HEARTH_PATH.findIndex((c) => c.objective.type === 'brew_greater'), progress: 0 };
  const gi = HEARTH_PATH.findIndex((c) => c.objective.type === 'brew_greater');
  h.grantLoot([{ kind: 'item', itemId: 'healing_herb', qty: 1 }], pw.p);
  pw.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: 'hearthmoon_tea' })); // a plain tea
  check('a plain brew does not advance a greater-draught chapter', h.teaStateBody(pw.p).hearthPath.chapter === gi);
  const greater = TEAS.find((t) => t.greater);
  for (const ing of greater.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty }], pw.p);
  pw.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: greater.id }));
  check('a greater draught advances the greater chapter', h.teaStateBody(pw.p).hearthPath.chapter === gi + 1);

  // The finale: brewing the capstone completes the path + earns the Hearthfire aura.
  const capI = HEARTH_PATH.findIndex((c) => c.objective.type === 'brew_capstone');
  const cap2 = TEAS.find((t) => t.requires === 'allPlanets');
  for (const t of PLANETS.map((pl) => TEAS.find((x) => x.day === pl.day && !x.requires))) { for (const ing of t.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty }], pw.p); pw.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: t.id })); }
  h.getProgress(pw.p).hearthPath = { chapter: capI, progress: 0 };
  for (const ing of cap2.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty }], pw.p);
  pw.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: cap2.id }));
  check('brewing the capstone completes the Hearth Path', h.teaStateBody(pw.p).hearthPath.done === true);
  check('completing the path earns the Hearthfire aura', (h.getProgress(pw.p).auraUnlocks || []).includes('hearthfire'));

  // Level gate: a below-level account can't advance a gated chapter.
  const rook = join('Rookie'); rook.p.accountKey = 'rookie'; h.getProgress(rook.p).level = 1;
  h.getProgress(rook.p).hearthPath = { chapter: HEARTH_PATH.findIndex((c) => (c.requiresLevel || 1) > 1), progress: 0 };
  const gatedI = HEARTH_PATH.findIndex((c) => (c.requiresLevel || 1) > 1);
  h.grantLoot([{ kind: 'item', itemId: 'healing_herb', qty: 1 }], rook.p);
  rook.s.emit('message', JSON.stringify({ type: 'brew_tea', teaId: 'hearthmoon_tea' }));
  check('a below-level account cannot advance a gated chapter', h.teaStateBody(rook.p).hearthPath.chapter === gatedI);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
