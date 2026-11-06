// Threshold & Hearth — wards worked into your own cottage (blueprint B).
//
// The Hearth Witch's blurb promised a warded threshold and delivered a number.
// These checks hold the three real house-wards to their promises: a witch bottle
// can be made from things the town sells, is buried only at your own hearth,
// turns hostile curses (never your own buffs) and is SPENT after its charges;
// the daisy wheel and the concealed shoe are permanent, one each, and actually
// reduce the damage you take; a Hearth Witch works all three more strongly; and
// a visitor's view of the cottage carries the wards so the marks show.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wards-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const { WITCH_BOTTLE_PARTS, BOTTLE_CHARGES, BOTTLE_CHARGES_HEARTH, WARD_GUARD, WARD_GUARD_HEARTH, BOTTLE_TURN_GRACE_MS } = require('../data/wards');
const { POTION_RECIPES } = require('../data/gameConstants');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    say(s, { type: 'join', name: tag, charId: 0 });
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p };
  }
  const goHome = (p) => { p.room = 'cottage'; p.instance = 'home_' + p.accountKey; };
  const goOut = (p) => { p.room = 'outside'; p.instance = ''; };

  // ── The bottle can be made from what the town sells ──────────────────────
  const recipe = POTION_RECIPES.find((r) => r.result === 'witch_bottle');
  check("Hazel has a witch-bottle recipe", !!recipe);
  check('…from a jug, bent pins and iron nails', recipe && JSON.stringify(recipe.ingredients.map((i) => i.id).sort()) === JSON.stringify(WITCH_BOTTLE_PARTS.slice().sort()));
  const shopItems = new Set();
  for (const shop of Object.values(h.NPC_SHOPS || {})) for (const it of shop.items) shopItems.add(it.id);
  check('every part is for sale in town', WITCH_BOTTLE_PARTS.every((id) => shopItems.has(id)), WITCH_BOTTLE_PARTS.filter((id) => !shopItems.has(id)));
  check('the catalog knows the bottle and its parts', ['witch_bottle', ...WITCH_BOTTLE_PARTS].every((id) => h.ITEM_CATALOG[id]));

  const a = join('Householder', 'wards_a');
  const inv = h.getInventory(a.p);
  for (const id of WITCH_BOTTLE_PARTS) h.addItemToAccount(inv, id, 1);
  a.p.room = 'witch_cave';
  say(a.s, { type: 'witch_craft', recipeId: recipe.id });
  check("Hazel brews the parts into a witch bottle", h.countItemQty(inv, 'witch_bottle') === 1, a.s.lastOfType('witch_craft_error'));

  // ── Worked only at your own hearth ───────────────────────────────────────
  goOut(a.p);
  a.s.sent.length = 0;
  say(a.s, { type: 'bury_witch_bottle' });
  check('a bottle cannot be buried away from home', !!a.s.lastOfType('wards_error') && h.countItemQty(inv, 'witch_bottle') === 1);
  const v = join('Visitor', 'wards_v');
  h.addItemToAccount(h.getInventory(v.p), 'witch_bottle', 1);
  v.p.room = 'cottage'; v.p.instance = 'home_wards_a'; // standing in SOMEONE ELSE's cottage
  say(v.s, { type: 'bury_witch_bottle' });
  check("…nor under someone else's hearth", !!v.s.lastOfType('wards_error') && !(h.accounts.wards_a.wards && h.accounts.wards_a.wards.bottle));

  goHome(a.p);
  a.s.sent.length = 0;
  say(a.s, { type: 'bury_witch_bottle' });
  let ws = a.s.lastOfType('wards_state');
  check(`buried at home, it holds ${BOTTLE_CHARGES} curses`, ws && ws.bottle === 'buried' && ws.charges === BOTTLE_CHARGES && h.countItemQty(inv, 'witch_bottle') === 0, ws);
  say(a.s, { type: 'bury_witch_bottle' });
  check('only one bottle at a time', !!a.s.lastOfType('wards_error'));

  // ── It turns curses, spends, and breaks ──────────────────────────────────
  check('your own buffs are never touched', h.bottleTurnsCurse(a.p, 'speedboost') === false && h.accounts.wards_a.wards.bottle.charges === BOTTLE_CHARGES);
  check('a hostile curse is turned', h.bottleTurnsCurse(a.p, 'wither') === true && h.accounts.wards_a.wards.bottle.charges === BOTTLE_CHARGES - 1);
  check('for a breath after, the house holds without spending more', h.bottleTurnsCurse(a.p, 'toad') === true && h.accounts.wards_a.wards.bottle.charges === BOTTLE_CHARGES - 1);
  for (let i = 1; i < BOTTLE_CHARGES; i++) { a.p.bottleTurnUntil = 0; h.bottleTurnsCurse(a.p, 'stumble'); }
  const w = h.accounts.wards_a.wards;
  check('after its last curse the bottle is spent', w.bottle === null && w.bottleSpent === 1, w);
  a.p.bottleTurnUntil = 0;
  check('a spent bottle turns nothing', h.bottleTurnsCurse(a.p, 'wither') === false);
  say(a.s, { type: 'wards_state' });
  check('the house says so — bury another', a.s.lastOfType('wards_state').bottle === 'spent');

  // ── The daisy wheel and the shoe: permanent, and they guard ──────────────
  const guard0 = h.statContrib(a.p, 'guard');
  const dmg0 = h.incomingDamageMult(a.p);
  goOut(a.p);
  say(a.s, { type: 'scribe_hexafoil' });
  check('the daisy wheel is drawn at home, not in the square', !(h.accounts.wards_a.wards.hexafoil));
  goHome(a.p);
  say(a.s, { type: 'scribe_hexafoil' });
  check('scribed over your own door', !!h.accounts.wards_a.wards.hexafoil);
  check(`…and it guards: +${WARD_GUARD * 100}% damage resist`, Math.abs(h.statContrib(a.p, 'guard') - guard0 - WARD_GUARD) < 1e-9, { before: guard0, after: h.statContrib(a.p, 'guard') });
  check('…which you can feel: less damage taken', h.incomingDamageMult(a.p) < dmg0, { before: dmg0, after: h.incomingDamageMult(a.p) });
  a.s.sent.length = 0;
  say(a.s, { type: 'scribe_hexafoil' });
  check('one daisy wheel is enough', !!a.s.lastOfType('wards_error'));

  h.addItemToAccount(inv, 'glass_vial', 1);
  a.s.sent.length = 0;
  say(a.s, { type: 'conceal_shoe', itemId: 'glass_vial' });
  check('only a shoe can be concealed', !!a.s.lastOfType('wards_error') && !h.accounts.wards_a.wards.shoe);
  say(a.s, { type: 'conceal_shoe', itemId: 'leather_boots' });
  check("a shoe you don't have can't be hidden", !h.accounts.wards_a.wards.shoe);
  h.addItemToAccount(inv, 'leather_boots', 1);
  say(a.s, { type: 'wards_state' });
  check('the panel offers the worn shoes in your pack', (a.s.lastOfType('wards_state').feet || []).some((f) => f.itemId === 'leather_boots'));
  say(a.s, { type: 'conceal_shoe', itemId: 'leather_boots' });
  check('a worn shoe is hidden by the chimney, and gone from the pack', !!h.accounts.wards_a.wards.shoe && h.countItemQty(inv, 'leather_boots') === 0);
  check('two wards, twice the guard', Math.abs(h.wardContrib(a.p, 'guard') - 2 * WARD_GUARD) < 1e-9);

  // ── The Hearth Witch works them more strongly ────────────────────────────
  h.accounts.wards_a.witchPath = 'hearth';
  check(`a Hearth Witch's marks guard +${WARD_GUARD_HEARTH * 100}% each`, Math.abs(h.wardContrib(a.p, 'guard') - 2 * WARD_GUARD_HEARTH) < 1e-9);
  h.addItemToAccount(inv, 'witch_bottle', 1);
  say(a.s, { type: 'bury_witch_bottle' });
  check(`…and her bottle turns ${BOTTLE_CHARGES_HEARTH}`, h.accounts.wards_a.wards.bottle && h.accounts.wards_a.wards.bottle.charges === BOTTLE_CHARGES_HEARTH);

  // ── The marks show on the house — for visitors too ───────────────────────
  const vis = h.homeLayoutForKey ? h.homeLayoutForKey('wards_a') : null;
  check("a visitor's view carries the wards", vis && vis.wards && vis.wards.hexafoil === true && vis.wards.bottle === 'buried', vis && vis.wards);
  check('the concealed shoe is in the record but its kind is not shown to visitors', vis && vis.wards.shoe === true && !('itemId' in vis.wards));

  // ── A real curse path: a hex trap is turned by the bottle ────────────────
  if (h.groundTraps && h.tickGroundTraps) {
    a.p.bottleTurnUntil = 0; a.p.activeStatus = null;
    const before = h.accounts.wards_a.wards.bottle.charges;
    h.groundTraps.push({ room: a.p.room, x: a.p.x, y: a.p.y, radius: 50, statusType: 'stumble', statusDurationMs: 4000, expiresAt: Date.now() + 5000 });
    h.tickGroundTraps(Date.now());
    check('a hex trap under your feet is turned by the bottle', !(a.p.activeStatus && a.p.activeStatus.type === 'stumble') && h.accounts.wards_a.wards.bottle.charges === before - 1, { st: a.p.activeStatus, ch: h.accounts.wards_a.wards.bottle.charges });
    h.tickGroundTraps(Date.now());
    check('…and a lingering trap does not drain it tick by tick', h.accounts.wards_a.wards.bottle.charges === before - 1);
  }
  check('the grace window is short — a breath, not a shield', BOTTLE_TURN_GRACE_MS <= 15000);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
