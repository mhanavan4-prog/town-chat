// Gear durability (Tier 3.5) — the gentle version. The server's helpers are
// inline, so this mirrors their logic against the real item data: only
// high-tier gear is tracked, it only dulls (never breaks), and the dulled
// penalty + repair cost behave as specified.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const LEGENDARY_CATALOG = require('../data/legendaryCatalog.js');
const { CRAFT_EQUIP } = require('../data/craftingTree.js');

const DURA_MAX = 100, DURA_DECAY = 0.5, DURA_DULL_FACTOR = 0.8, DURA_REPAIR_PER_POINT = 1;
function isHighTierItem(itemId) { return !!(itemId && (LEGENDARY_CATALOG[itemId] || CRAFT_EQUIP[itemId] || itemId === 'bloodmoon_circlet')); }
function durabilityFactor(edge, itemId) { return (isHighTierItem(itemId) && edge <= 0) ? DURA_DULL_FACTOR : 1; }

// ── Only high-tier gear is tracked ────────────────────────────────────────────
const aLegendary = Object.keys(LEGENDARY_CATALOG)[0];
const aCraft = Object.keys(CRAFT_EQUIP)[0];
check('a legendary is high-tier', isHighTierItem(aLegendary), aLegendary);
check('a crafted item is high-tier', isHighTierItem(aCraft), aCraft);
check('the Bloodmoon Circlet is high-tier', isHighTierItem('bloodmoon_circlet'));
check('a starter item is NOT high-tier', !isHighTierItem('iron_sword'));
check('the witch robe is NOT high-tier', !isHighTierItem('witch_robe'));

// ── It only dulls, never below zero ───────────────────────────────────────────
let edge = 3;
for (let i = 0; i < 20; i++) edge = Math.max(0, Math.round((edge - DURA_DECAY) * 10) / 10);
check('decay floors at zero (never negative, never "broken")', edge === 0, edge);

// ── The dulled penalty applies only at zero, only to high-tier ───────────────
check('full-edge high-tier gear is at full strength', durabilityFactor(DURA_MAX, aLegendary) === 1);
check('a worn-but-not-dulled item is still full strength', durabilityFactor(40, aLegendary) === 1);
check('a fully-dulled high-tier item drops to the penalty factor', durabilityFactor(0, aLegendary) === DURA_DULL_FACTOR);
check('a starter item never takes the penalty', durabilityFactor(0, 'iron_sword') === 1);

// ── Repair cost: sum of missing edge, with a full-moon discount ──────────────
function repairCost(edges, fullMoon) {
  let pts = 0; for (const e of edges) pts += Math.max(0, DURA_MAX - e);
  let cost = pts * DURA_REPAIR_PER_POINT;
  if (fullMoon) cost = Math.round(cost * 0.8);
  return Math.round(cost);
}
check('all-sharp gear costs nothing to repair', repairCost([100, 100], false) === 0);
check('repair cost is the missing edge', repairCost([60, 90], false) === 50, repairCost([60, 90], false));
check('a full moon discounts repair 20%', repairCost([0, 100], true) === 80, repairCost([0, 100], true));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
