// Moon water (Tier 3.5) — the glass-vial → moon-water → Moonwell Draught chain.
// Asserts the data wiring and the full-moon brew gate (the handler brews a
// `requiresMoon:'full'` recipe only when the live phase charges moon water).
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const ITEM_CATALOG = require('../data/itemCatalog.js');
const { PLANT_CATALOG } = require('../data/world.js');
const { POTION_RECIPES } = require('../data/gameConstants.js');
const SELL_VALUES = require('../data/sellValues.js');
const { MOON_PHASES, FULL_MOON_INDEX } = require('../data/moon.js');
const { SABBATS } = require('../data/seasons.js');

// ── Items exist ───────────────────────────────────────────────────────────────
check('glass_vial item defined', !!ITEM_CATALOG.glass_vial, ITEM_CATALOG.glass_vial);
check('moon_water item defined', !!ITEM_CATALOG.moon_water, ITEM_CATALOG.moon_water);
check('moonwell_draught is a usable potion (heals 120)',
  PLANT_CATALOG.moonwell_draught && PLANT_CATALOG.moonwell_draught.effect === 'heal' && PLANT_CATALOG.moonwell_draught.amount === 120,
  PLANT_CATALOG.moonwell_draught);

// ── Recipes wired ─────────────────────────────────────────────────────────────
const moonWaterRecipe = POTION_RECIPES.find(r => r.id === 'moon_water');
const moonwellRecipe = POTION_RECIPES.find(r => r.id === 'moonwell_draught');
check('moon_water recipe exists', !!moonWaterRecipe);
check('moon_water recipe is full-moon gated', moonWaterRecipe && moonWaterRecipe.requiresMoon === 'full', moonWaterRecipe && moonWaterRecipe.requiresMoon);
check('moon_water recipe consumes a glass vial', !!(moonWaterRecipe && moonWaterRecipe.ingredients.find(i => i.id === 'glass_vial')));
check('moonwell recipe consumes moon water', !!(moonwellRecipe && moonwellRecipe.ingredients.find(i => i.id === 'moon_water')));

// ── Economy ───────────────────────────────────────────────────────────────────
check('moon water sells for a meaningful price', SELL_VALUES.moon_water >= 15, SELL_VALUES.moon_water);
check('glass vial has a (small) sell value', SELL_VALUES.glass_vial > 0, SELL_VALUES.glass_vial);

// ── The gate: full moon charges, other phases do not ──────────────────────────
const CYCLE_MS = 40 * 60 * 1000, DAY_MS = 20 * 60 * 1000, LUNAR_MONTH_MS = 20 * 3600 * 1000;
const cal = require('../lib/calendar.js')({
  CYCLE_MS, DAY_MS,
  LEGENDARY_EPOCH: Date.UTC(2026, 0, 5), LEGENDARY_WEEK_MS: 7 * 24 * 3600 * 1000,
  legendaryWeekIndex: (now) => Math.floor((now - Date.UTC(2026, 0, 5)) / (7 * 24 * 3600 * 1000)),
  SABBATS, MOON_PHASES, FULL_MOON_INDEX, LUNAR_MONTH_MS
});
// The exact predicate the server handler uses: recipe.requiresMoon === 'full'
// is allowed iff moonPhaseWindow(now).chargesMoonWater.
function canBrewMoonWater(now) { return cal.moonPhaseWindow(now).chargesMoonWater; }

const PHASE_MS = LUNAR_MONTH_MS / MOON_PHASES.length;
let fullNow = null, nonFullNow = null;
for (let w = 0; w < 10000 && (fullNow === null || nonFullNow === null); w++) {
  const t = w * PHASE_MS + 1000;
  const m = cal.moonPhaseWindow(t);
  if (m.index === FULL_MOON_INDEX && !m.isBlood && fullNow === null) fullNow = t;
  if (m.index !== FULL_MOON_INDEX && !m.isBlood && nonFullNow === null) nonFullNow = t;
}
check('moon water CAN be brewed at the full moon', canBrewMoonWater(fullNow) === true);
check('moon water CANNOT be brewed off the full moon', canBrewMoonWater(nonFullNow) === false);
// A blood moon is a full moon for charging.
check('moon water CAN be brewed on a blood-moon night', canBrewMoonWater(DAY_MS + 1000) === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
