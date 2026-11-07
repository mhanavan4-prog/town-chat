// Lore audit (herbs): every tea sits on the day of the planet Culpeper gives
// its herb, the Poison Path makes nothing to eat or drink, and the modern
// names and myths are labelled as such.
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { TEAS, PLANETS } = require('../data/teas.js');
const { CULPEPER_RULERS } = require('../data/practices.js');
const { GREEN_PATH_CATEGORIES } = require('../data/greenPath.js');
const { PLANT_CATALOG } = require('../data/world.js');
const { DAY_RITUAL } = require('../data/correspondences.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ── The teas follow Culpeper ──
const single = TEAS.filter((t) => t.day != null && !t.greater && t.herbs.length === 1);
const wrong = single.filter((t) => CULPEPER_RULERS[t.herbs[0].id] !== undefined && CULPEPER_RULERS[t.herbs[0].id] !== t.day).map((t) => t.id);
check('every one-herb tea is brewed on the day of its herb\'s planet in Culpeper', wrong.length === 0, wrong);
check('…St John\'s wort and rue on the Sun\'s day, comfrey on Saturn\'s, lavender on Mercury\'s, balm on Jupiter\'s', ['stjohnswort_tea', 'rue_tea'].every((id) => TEAS.find((t) => t.id === id).day === 0) && TEAS.find((t) => t.id === 'comfrey_tea').day === 6 && TEAS.find((t) => t.id === 'lavender_tea').day === 3 && TEAS.find((t) => t.id === 'lemonbalm_tea').day === 4);
check('the Moon\'s tea is the water-lily, which Culpeper gives the Moon', TEAS.find((t) => t.id === 'mugwort_tea').name === 'Water-Lily Tea' && TEAS.find((t) => t.id === 'mugwort_tea').day === 1);
const statOf = Object.fromEntries(PLANETS.map((p) => [p.day, p.stat]));
check('every tea carries its day\'s stat', TEAS.filter((t) => t.day != null).every((t) => t.stat === statOf[t.day]), TEAS.filter((t) => t.day != null && t.stat !== statOf[t.day]).map((t) => t.id));
check('all seven days still have a tea (the Witches\' Brew needs them)', [0, 1, 2, 3, 4, 5, 6].every((d) => TEAS.some((t) => t.day === d && !t.greater)));
check('no modern "courage" or "calling spirits" passed off on yarrow and wormwood', !TEAS.some((t) => /courage|calling of spirits/i.test(t.lore + t.name)));
check('Ostara, Litha and Mabon are named as 1970s names', ['ostara_tea', 'litha_tea', 'mabon_tea'].every((id) => /1970s/.test(TEAS.find((t) => t.id === id).lore)));
check('"Witches\' New Year" is called modern', /is modern/.test(TEAS.find((t) => t.id === 'samhain_tea').lore));
check('comfrey says it is not for drinking any more', /liver/.test(TEAS.find((t) => t.id === 'comfrey_tea').lore));

// ── The Poison Path makes nothing to eat or drink ──
const bane = GREEN_PATH_CATEGORIES.find((c) => c.id === 'baneful');
const brews = ['flying_ointment', 'henbane_smoke', 'mandrake_draught', 'wolfsbane_draught', 'datura_trance', 'hemlock_philter', 'foxglove_cordial', 'hellebore_ward', 'draught_of_the_green_path'];
check('no baneful make is called a draught, philter, cordial or smoke', brews.every((id) => !/draught|philter|cordial|smoke/i.test(PLANT_CATALOG[id].name)), brews.map((id) => PLANT_CATALOG[id].name));
check('foxglove never heals (digitalis is no home remedy)', PLANT_CATALOG.foxglove.effect !== 'heal' && PLANT_CATALOG.foxglove_cordial.effect !== 'heal');
check('wolfsbane is the wolf-slayer, not a 1941 film\'s shapeshifter herb', /wolf-slayer/.test(bane.plants.find((p) => p.id === 'wolfsbane').lore) && !JSON.stringify(GREEN_PATH_CATEGORIES).includes('shapeshifter'));
check('foxglove is the fox\'s glove, not "the folk\'s glove"', /foxes glofa/.test(bane.plants.find((p) => p.id === 'foxglove').lore));
check('"the Poison Path" is named as Pendell\'s modern term', /Pendell/.test(bane.lore));

// ── Correspondences ──
check('swiftness is Mercury\'s (Wednesday), not Venus\'s', DAY_RITUAL[3] === 'swiftness' && DAY_RITUAL[5] !== 'swiftness');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
