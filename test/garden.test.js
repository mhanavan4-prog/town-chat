// Green-witch gardening (data/garden.js) — the moon-tier yield and the
// plant→grow→harvest loop the server enforces.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { GARDEN_PLOTS, GARDEN_GROW_MS, PLANTABLE_HERBS, MOON_YIELD, moonTierAtPlant } = require('../data/garden.js');
const { PLANT_CATALOG } = require('../data/world.js');

// ── Config + data ─────────────────────────────────────────────────────────────
check('there are garden beds', GARDEN_PLOTS >= 1, GARDEN_PLOTS);
check('a crop takes real time to grow', GARDEN_GROW_MS > 0);
check('every plantable herb is a real harvestable', PLANTABLE_HERBS.every((id) => PLANT_CATALOG[id]), PLANTABLE_HERBS);
check('you always net a gain (lowest yield > 1 sown)', Math.min(...Object.values(MOON_YIELD)) >= 2, MOON_YIELD);

// ── Moon tier at planting sets the yield ──────────────────────────────────────
check('full moon → the best tier', moonTierAtPlant({ key: 'full', isFull: true }) === 'full');
check('a waxing phase → the waxing tier', moonTierAtPlant({ key: 'waxing_gibbous', isFull: false }) === 'waxing');
check('a waning phase → the base tier', moonTierAtPlant({ key: 'waning_gibbous', isFull: false }) === 'other');
check('full moon out-yields waxing out-yields other', MOON_YIELD.full > MOON_YIELD.waxing && MOON_YIELD.waxing > MOON_YIELD.other, MOON_YIELD);

// ── The grow gate (mirror of the harvest handler) ────────────────────────────
function isReady(plantedAt, now) { return (now - plantedAt) >= GARDEN_GROW_MS; }
const t0 = 1000000;
check('a fresh bed is not ready', !isReady(t0, t0 + 1000));
check('a bed is not ready one tick early', !isReady(t0, t0 + GARDEN_GROW_MS - 1));
check('a bed is ready at maturity', isReady(t0, t0 + GARDEN_GROW_MS));

// Planting one and harvesting the tier yield is a net gain.
const sown = 1, reaped = MOON_YIELD.waxing;
check('sowing 1 under a waxing moon reaps more than sown', reaped - sown >= 2, { sown, reaped });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
