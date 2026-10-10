// The Artificer's Workshop — a three-tier crafting tree. Guards catalog
// integrity (no dead ids), that the tree is genuinely tiered (each tier's
// inputs include the previous tier's outputs, and nothing is self-referential),
// that crafted gear never beats campaign-relic parity, and that the live
// workshop_craft flow consumes inputs, produces the output, chains up the tree,
// refuses an under-stocked craft, and feeds the Artificer achievement ladder.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-craft-');

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
  const h = global.__testHooks;
  const RECIPES = h.CRAFT_RECIPES, CAT = h.ITEM_CATALOG, EQUIP = h.EQUIP_STATS, CRAFT_EQUIP = h.CRAFT_EQUIP;
  const outputs = new Set(RECIPES.map(r => r.result));
  const byTier = t => RECIPES.filter(r => r.tier === t);

  // ── Catalog integrity ──
  const ids = new Set();
  let dupe = null, deadResult = null, deadIng = null, selfRef = null;
  for (const r of RECIPES) {
    if (ids.has(r.id)) dupe = r.id; ids.add(r.id);
    if (!CAT[r.result]) deadResult = r.result;
    for (const ing of r.ingredients) {
      if (!CAT[ing.id]) deadIng = ing.id;
      if (ing.id === r.result) selfRef = r.id;
    }
  }
  check('recipe ids are unique', !dupe, dupe);
  check('every result is a real catalog item', !deadResult, deadResult);
  check('every ingredient is a real catalog item', !deadIng, deadIng);
  check('no recipe consumes its own output', !selfRef, selfRef);
  check('there are three tiers of recipes', byTier(1).length && byTier(2).length && byTier(3).length,
    { t1: byTier(1).length, t2: byTier(2).length, t3: byTier(3).length });

  // ── The tree is genuinely tiered: inputs chain upward ──
  const t1out = new Set(byTier(1).map(r => r.result));
  const t2out = new Set(byTier(2).map(r => r.result));
  check('every Tier-2 recipe is built from a Tier-1 component',
    byTier(2).every(r => r.ingredients.some(i => t1out.has(i.id))), byTier(2).filter(r => !r.ingredients.some(i => t1out.has(i.id))).map(r => r.id));
  check('every Tier-3 recipe upgrades a Tier-2 item',
    byTier(3).every(r => r.ingredients.some(i => t2out.has(i.id))), byTier(3).filter(r => !r.ingredients.some(i => t2out.has(i.id))).map(r => r.id));
  check('Tier-1 recipes use only raw drops (no crafted inputs)',
    byTier(1).every(r => r.ingredients.every(i => !outputs.has(i.id))));

  // ── Balance: crafted gear is at or below relic parity in every stat ──
  // Ceiling = the strongest value of each stat among NON-crafted equipment.
  const craftedIds = new Set(Object.keys(CRAFT_EQUIP));
  const ceiling = {};
  for (const [id, stats] of Object.entries(EQUIP)) {
    if (craftedIds.has(id)) continue;
    for (const [k, v] of Object.entries(stats)) ceiling[k] = Math.max(ceiling[k] || 0, v);
  }
  let overpowered = null;
  for (const [id, stats] of Object.entries(CRAFT_EQUIP)) {
    for (const [k, v] of Object.entries(stats)) if (v > (ceiling[k] || 0) + 1e-9) overpowered = `${id}.${k} ${v} > ${ceiling[k]}`;
  }
  check('no crafted stat exceeds relic parity', !overpowered, overpowered);

  // ── Live craft flow ──
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Smith');
  connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Smith', charId: 3 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'smith'; s._isGuest = false;
  const inv = h.getInventory(p);

  function give(id, n) { h.addItemToAccount(inv, id, n); }
  function qty(id) { return h.countItemQty(inv, id); }
  function craft(rid) { s.emit('message', JSON.stringify({ type: 'workshop_craft', recipeId: rid })); }

  // Tier 1: cured_leather ← 3 fur_scrap + 1 animal_pelt
  give('fur_scrap', 3); give('animal_pelt', 1);
  craft('cured_leather');
  check('a Tier-1 craft produces the component', qty('cured_leather') === 1, qty('cured_leather'));
  check('the craft consumed its inputs', qty('fur_scrap') === 0 && qty('animal_pelt') === 0, { fur: qty('fur_scrap'), pelt: qty('animal_pelt') });

  // An under-stocked craft is refused and consumes nothing.
  const beforeErr = qty('cured_leather');
  craft('tempered_ingot'); // no ore/bone on hand
  check('an under-stocked craft is refused', s.lastOfType('workshop_craft_error') && qty('cured_leather') === beforeErr);

  // Chain up the tree to a Tier-2 piece using a crafted component.
  give('iron_ore', 4); give('bone_shard', 2);
  craft('tempered_ingot'); craft('tempered_ingot'); // need 2 for the cleaver
  give('fur_scrap', 3); give('animal_pelt', 1); craft('cured_leather'); // one more leather
  check('Tier-1 components stockpiled for the next tier', qty('tempered_ingot') === 2 && qty('cured_leather') === 2, { ingot: qty('tempered_ingot'), leather: qty('cured_leather') });
  craft('forged_cleaver'); // 2 tempered_ingot + 1 cured_leather
  check('a Tier-2 gear piece is forged from components', qty('forged_cleaver') === 1 && qty('tempered_ingot') === 0 && qty('cured_leather') === 1, { cleaver: qty('forged_cleaver'), ingot: qty('tempered_ingot'), leather: qty('cured_leather') });
  check('the forged piece is equippable', !!(h.EQUIP_STATS['forged_cleaver'] && CAT['forged_cleaver'].slot === 'weapon'));

  // ── Artificer achievement ladder fires after 5 crafts ──
  // 3 crafts so far (leather, ingot×2, leather, cleaver = 5 actually); craft two trivial more to be safe and assert the ladder.
  const prog = h.getProgress(p);
  check('itemsCrafted is tallied', prog.itemsCrafted >= 5, prog.itemsCrafted);
  const apprentice = s.sent.filter(m => m.type === 'achievement_unlocked' && m.ach && m.ach.id === 'craft_1');
  check('crafting 5 items unlocks Apprentice', apprentice.length === 1, apprentice.length);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
