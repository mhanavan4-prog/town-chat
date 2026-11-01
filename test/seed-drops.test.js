// Green Path — rare seed drops. Hunting the Wilds drops Hedge & Wild herb
// cuttings (Mugwort, Yarrow) you can then grow and brew. Covers the data wiring
// (drops on every Wilds pool, none on town/dungeon; recipes; plantability; drop-
// only via NON_WILD) and the live roll → grant path (label resolves, lands in
// the account). Mirrors test/wardrobe.test.js' harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-seeddrops-');

const { LOOT_TABLES, POTION_RECIPES, WILDS_SEED_DROPS, WILDS_SEED_DROP_MOBS,
  HEDGE_SEED_DROPS, HEDGE_SEED_DROP_MOBS, BANE_SEED_DROPS, BANE_SEED_DROP_MOBS } = require('../data/gameConstants.js');
const { PLANTABLE_HERBS } = require('../data/garden.js');
const { PLANT_CATALOG } = require('../data/world.js');

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

// ── Pure data: the drops are wired to the right tables ───────────────────────
const SEED_IDS = WILDS_SEED_DROPS.map((d) => d.itemId);
check('the two Hedge seeds drop: mugwort + yarrow', SEED_IDS.includes('mugwort') && SEED_IDS.includes('yarrow'), SEED_IDS);
check('seed drop odds are low (rare feels rare)', WILDS_SEED_DROPS.every((d) => d.chance > 0 && d.chance <= 0.05), WILDS_SEED_DROPS);
check('every Wilds mob pool carries both seed drops', WILDS_SEED_DROP_MOBS.every((m) => SEED_IDS.every((id) => (LOOT_TABLES[m] || []).some((d) => d.itemId === id))));
check('town mobs never drop any seed tier', !(LOOT_TABLES.town_mob || []).some((d) => /mugwort|yarrow|vervain|belladonna/.test(d.itemId || '')));
check('the common Mugwort/Yarrow tier stays out of the dungeons', ['dungeon_t1', 'dungeon_t2', 'dungeon_t3', 'dungeon_t4'].every((t) => !(LOOT_TABLES[t] || []).some((d) => SEED_IDS.includes(d.itemId))));

// ── Tiered drops: Hedge from tough mobs/low dungeons, Poison from elites/deep ──
const HEDGE_IDS = HEDGE_SEED_DROPS.map((d) => d.itemId);
const BANE_IDS = BANE_SEED_DROPS.map((d) => d.itemId);
check('the five Hedge herbs are the tier-2 drops', ['vervain', 'wormwood', 'rue', 'st_johns_wort', 'rowan_berry'].every((id) => HEDGE_IDS.includes(id)));
check('the eight baneful herbs are the tier-3 drops', ['belladonna', 'henbane', 'mandrake', 'wolfsbane', 'datura', 'hemlock', 'foxglove', 'black_hellebore'].every((id) => BANE_IDS.includes(id)));
check('rarity climbs: hedge rarer than common, bane rarer than hedge', (() => {
  const common = Math.max(...WILDS_SEED_DROPS.map((d) => d.chance));
  const hedge = Math.max(...HEDGE_SEED_DROPS.map((d) => d.chance));
  const bane = Math.max(...BANE_SEED_DROPS.map((d) => d.chance));
  return hedge < common && bane < hedge;
})());
check('Hedge herbs drop from the tough night mobs + low dungeons', HEDGE_SEED_DROP_MOBS.every((m) => HEDGE_IDS.every((id) => (LOOT_TABLES[m] || []).some((d) => d.itemId === id))));
check('Poison herbs drop from elites + the deep dungeon floors', BANE_SEED_DROP_MOBS.every((m) => BANE_IDS.every((id) => (LOOT_TABLES[m] || []).some((d) => d.itemId === id))));
check('a common Wilds mob drops only the tier-1 seeds (no hedge/bane)', !(LOOT_TABLES.shade_stalker || []).some((d) => HEDGE_IDS.includes(d.itemId) || BANE_IDS.includes(d.itemId)));
check('tier placement is exclusive: a low dungeon has hedge but not bane', (LOOT_TABLES.dungeon_t2 || []).some((d) => HEDGE_IDS.includes(d.itemId)) && !(LOOT_TABLES.dungeon_t2 || []).some((d) => BANE_IDS.includes(d.itemId)));

// ── Pure data: the herbs exist, are plantable, and brew ──────────────────────
check('mugwort & yarrow exist in the plant catalog with real names', PLANT_CATALOG.mugwort && PLANT_CATALOG.mugwort.name === 'Mugwort' && PLANT_CATALOG.yarrow && PLANT_CATALOG.yarrow.name === 'Yarrow');
check('both seeds are plantable (grow more once found)', PLANTABLE_HERBS.includes('mugwort') && PLANTABLE_HERBS.includes('yarrow'));
check('each herb anchors a brew recipe', (() => {
  const r = POTION_RECIPES;
  const yarrow = r.find((x) => x.result === 'yarrow_salve');
  const mug = r.find((x) => x.result === 'mugwort_draught');
  return yarrow && yarrow.ingredients.some((i) => i.id === 'yarrow') &&
    mug && mug.ingredients.some((i) => i.id === 'mugwort');
})());
check('the brew results exist in the catalog too', PLANT_CATALOG.yarrow_salve && PLANT_CATALOG.mugwort_draught);

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  // Raw herbs resolve a name/icon in the shipped item catalog (so a dropped
  // seed never renders as "?") — PLANT_CATALOG is merged into ITEM_CATALOG at boot.
  check('dropped seeds resolve a real label (not "?")', (() => {
    const m = h.ITEM_CATALOG.mugwort, y = h.ITEM_CATALOG.yarrow;
    return m && m.name === 'Mugwort' && y && y.name === 'Yarrow';
  })());

  // Force every drop to pass, then roll a representative Wilds table and confirm
  // the seeds come out.
  const realRandom = Math.random;
  Math.random = () => 0; // 0 <= chance for every entry → everything drops
  let pending;
  try { pending = h.rollPendingLoot(h.LOOT_TABLES.bramble_boar); } finally { Math.random = realRandom; }
  const droppedIds = pending.filter((p) => p.kind === 'item').map((p) => p.itemId);
  check('rolling a Wilds mob can yield both seeds', droppedIds.includes('mugwort') && droppedIds.includes('yarrow'), droppedIds);

  // Grant the rolled loot to a real account and confirm it lands + labels.
  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }
  const hunter = join('Hunter');
  hunter.p.accountKey = 'hunter';
  const before = h.countItemQty(h.getInventory(hunter.p), 'mugwort');
  const earned = h.grantLoot([{ kind: 'item', itemId: 'mugwort', qty: 1 }, { kind: 'item', itemId: 'yarrow', qty: 2 }], hunter.p);
  check('granted seeds land in the account', h.countItemQty(h.getInventory(hunter.p), 'mugwort') === before + 1 && h.countItemQty(h.getInventory(hunter.p), 'yarrow') === 2);
  check('the loot toast names the herbs, not "?"', earned.some((s) => s.includes('Mugwort')) && earned.some((s) => s.includes('Yarrow')), earned);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
