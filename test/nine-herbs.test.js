// The Nine Herbs Charm (blueprint proposal G) — the Cottage Garden's capstone.
//
// Holds: the nine are the Lacnunga's nine; the salve needs exactly those, one
// each; all nine can actually be grown (the seven new ones come in Mother
// Yarrow's packet once the Cottage Garden chapters are done — once); none of
// them scatter wild; adding them did not renumber any existing Wilds decor;
// and brewing the salve recites the charm.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-nine-');

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

const { NINE_HERBS, WODEN_LINES, NEW_GARDEN_HERBS, LACNUNGA_SEEDS_PER_HERB, NINE_HERBS_LORE } = require('../data/nineHerbs');
const { POTION_RECIPES } = require('../data/gameConstants');
const { PLANTABLE_HERBS } = require('../data/garden');
const { PLANT_CATALOG } = require('../data/world');
const { GREEN_PATH_CATEGORIES } = require('../data/greenPath');

// ── The nine ─────────────────────────────────────────────────────────────
check('nine herbs', NINE_HERBS.length === 9);
check("the Lacnunga's nine, by their Old English names", NINE_HERBS.map((h) => h.oe).join(',') === 'Mucgwyrt,Wegbrade,Stune,Stiðe,Attorlaðe,Mægðe,Wergulu,Fille,Finule');
check('uncertain identifications are flagged, not hidden (fille too: chervil, or thyme)', NINE_HERBS.filter((h) => h.uncertain).map((h) => h.oe).sort().join(',') === ['Attorlaðe', 'Fille', 'Stiðe', 'Stune', 'Wergulu'].sort().join(','));
check("Woden's nine glory-twigs are in the recital", WODEN_LINES.some((l) => /Woden/.test(l) && /nine glory-twigs/.test(l)));
check('the lore names the manuscript', /Harley MS 585/.test(NINE_HERBS_LORE.source));
const recipe = POTION_RECIPES.find((r) => r.result === 'nine_herbs_salve');
check('Hazel has the salve recipe', !!recipe);
check('…one each of exactly the nine', recipe && recipe.ingredients.length === 9 && recipe.ingredients.every((i) => i.qty === 1) && NINE_HERBS.every((h) => recipe.ingredients.some((i) => i.id === h.id)));
check('all nine can be grown in a garden bed', NINE_HERBS.every((h) => PLANTABLE_HERBS.includes(h.id)), NINE_HERBS.filter((h) => !PLANTABLE_HERBS.includes(h.id)).map((h) => h.id));
const gpIds = new Set(GREEN_PATH_CATEGORIES.flatMap((c) => c.plants.map((p) => p.id)));
check('all nine are Green Path plants (Almanac pages)', NINE_HERBS.every((h) => gpIds.has(h.id)));
const keys = Object.keys(PLANT_CATALOG);
const lastOld = keys.indexOf('draught_of_the_green_path');
check('the new herbs were appended — no existing Wilds decor id renumbers', NEW_GARDEN_HERBS.every((id) => keys.indexOf(id) > lastOld), NEW_GARDEN_HERBS.map((id) => keys.indexOf(id)));

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

  // Never wild-scattered.
  const wild = new Set(((h.WORLD2 && h.WORLD2.natureDecor) || []).map((d) => d.type));
  check('none of the new herbs grow wild in the Wilds', h.WORLD2 && NEW_GARDEN_HERBS.every((id) => !wild.has(id)) && !wild.has('nine_herbs_salve'));

  // ── Mother Yarrow's packet ───────────────────────────────────────────────
  const a = join('Gardener', 'nine_a');
  const inv = h.getInventory(a.p);
  say(a.s, { type: 'garden_state' });
  check('no packet before the Cottage Garden chapters are done', NEW_GARDEN_HERBS.every((id) => h.countItemQty(inv, id) === 0));
  h.getProgress(a.p).greenPath = { chapter: 3, progress: 0 };
  say(a.s, { type: 'garden_state' });
  check(`after them, ${LACNUNGA_SEEDS_PER_HERB} of each of the seven new herbs`, NEW_GARDEN_HERBS.every((id) => h.countItemQty(inv, id) === LACNUNGA_SEEDS_PER_HERB), NEW_GARDEN_HERBS.map((id) => [id, h.countItemQty(inv, id)]));
  say(a.s, { type: 'garden_state' });
  check('…once', NEW_GARDEN_HERBS.every((id) => h.countItemQty(inv, id) === LACNUNGA_SEEDS_PER_HERB));

  // A full pack keeps the packet for later rather than losing it.
  const f = join('FullPack', 'nine_f');
  const finv = h.getInventory(f.p);
  for (let i = 0; i < finv.slots.length; i++) if (!finv.slots[i]) finv.slots[i] = { itemId: 'glass_vial', qty: 1 };
  h.getProgress(f.p).greenPath = { chapter: 3, progress: 0 };
  f.s.sent.length = 0;
  say(f.s, { type: 'garden_state' });
  check('a full pack: the packet waits, and you are told why', !h.accounts.nine_f.lacnungaGiven && /clear some room/.test((f.s.lastOfType('toast') || {}).message || ''));
  for (let i = 0; i < 8; i++) finv.slots[i] = null;
  say(f.s, { type: 'garden_state' });
  check('…and arrives once there is room', h.accounts.nine_f.lacnungaGiven === true && NEW_GARDEN_HERBS.every((id) => h.countItemQty(finv, id) === LACNUNGA_SEEDS_PER_HERB));

  // ── The salve, recited ───────────────────────────────────────────────────
  a.p.room = 'witch_cave';
  a.s.sent.length = 0;
  say(a.s, { type: 'witch_craft', recipeId: recipe.id });
  check('without mugwort and chamomile the charm is incomplete', !!a.s.lastOfType('witch_craft_error') && h.countItemQty(inv, 'nine_herbs_salve') === 0);
  h.addItemToAccount(inv, 'mugwort', 1); h.addItemToAccount(inv, 'chamomile', 1);
  a.s.sent.length = 0;
  say(a.s, { type: 'witch_craft', recipeId: recipe.id });
  const r = a.s.lastOfType('witch_craft_result');
  check('with all nine, Hazel makes the salve', h.countItemQty(inv, 'nine_herbs_salve') === 1, a.s.lastOfType('witch_craft_error'));
  check('…and the charm is recited: nine herb lines and Woden', r && r.recital && r.recital.herbs.length === 9 && r.recital.woden.length === WODEN_LINES.length, r && r.recital);
  check('one of each herb was used', NINE_HERBS.every((x) => h.countItemQty(inv, x.id) === (NEW_GARDEN_HERBS.includes(x.id) ? LACNUNGA_SEEDS_PER_HERB - 1 : 0)));

  // Other brews do not recite.
  h.addItemToAccount(inv, 'chamomile', 2);
  a.s.sent.length = 0;
  say(a.s, { type: 'witch_craft', recipeId: 'chamomile_tisane' });
  check('an ordinary brew is not a recital', a.s.lastOfType('witch_craft_result') && !a.s.lastOfType('witch_craft_result').recital);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
