// Lore audit (the Wheel and the dead): no "dumb supper" passed off as an old
// rite for the dead, no Tolkien barrow-wights, no bale-fire for Beltane, no
// Lugh-fire, and the modern names called modern.
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const { SABBATS } = require('../data/seasons.js');
const RITES = read('data/rites.js'), ANC = read('data/ancestors.js'), CLIENT = read('client/main.js'), INDEX = read('public/index.html');
const LANDING = read('public/landing.html'), GUISES = read('data/guises.js'), QUESTS = read('data/quests.js'), TITLES = read('data/titles.js'), CREATURES = read('data/creatures.js'), SERVER = read('server.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ── The dead ──
check('the Ancestor Altar is the Irish and Breton November Eve custom', /Ireland and Brittany did on November Eve/.test(ANC));
check('…and says "dumb supper" is a love divination\'s name, borrowed', /borrowing the name of an old love divination/.test(ANC));
check('the town register no longer calls it "The Dumb Supper"', !/The Dumb Supper — places set/.test(CLIENT) && !/the dumb supper —/.test(LANDING));
check('the sun-herbs are gathered on St John\'s Eve, not at noon', /sun-herbs on St John\\'s Eve/.test(ANC) && !/midsummer noon/.test(ANC));

// ── Samhain ──
check('Samhain\'s epithet is the start of winter, not the Witches\' New Year', SABBATS.find((s) => s.key === 'samhain').epithet === 'the Start of Winter' && /e: 'the Start of Winter'/.test(CLIENT));
check('the Samhain rite speaks of the sídhe / hollow hills, as the Irish tales do', /hollow hills stand open, as the old Irish tales have it/.test(RITES));

// ── Beltane and Lughnasadh ──
check('no "bale-fire" (a funeral pyre) at Beltane', !/bale-fire/i.test(RITES) && !/bale-fire/i.test(TITLES), (RITES + TITLES).match(/[^\n]*bale-fire[^\n]*/gi));
check('the Beltane fires follow Cormac\'s Glossary', /Cormac's Glossary/.test(RITES));
check('no Lugh-fire (MacNeill records hills, first fruits and games, not bonfires)', !/Lugh-fire/i.test(RITES));

// ── Creatures and guises ──
check('no Tolkien barrow-wights: they are draugar, the Norse mound-dead', !/barrow-wight|Barrow Wight/i.test(RITES + QUESTS + CREATURES + SERVER) && /name: 'Draugr'/.test(CREATURES) && /Norse sagas/.test(QUESTS));
check('the mummers\' devil belongs to the English play, not a "Samhain play"', !/Samhain play/.test(GUISES) && /English mummers/.test(GUISES));
check('the antlered hunter is Herne, not a "wild Samhain night"', !/wild Samhain night/.test(GUISES) && /Herne/.test(GUISES));
check('guising is dated, and the fooling-the-dead reason called a later explanation', /recorded in Scotland and Ireland from the 1800s/.test(CLIENT) && /later explanation/.test(CLIENT));

// ── The book ──
check('the reference book is a Commonplace Book, not a "Book of Shadows" (Gardner\'s 1950s term)', /📖 Commonplace Book/.test(INDEX) && !/>📖 Book of Shadows</.test(INDEX));

// ── The landing page ──
// "Callers at the Door" names how many there are; keep it true as callers are added.
{
  const { CALLERS } = require('../data/callers.js');
  const m = LANDING.match(/<h3>Callers at the Door<\/h3><p>[^<]*Each of the (\d+)/);
  check('the landing page\'s count of callers matches the game', m && Number(m[1]) === CALLERS.length, { page: m && m[1], game: CALLERS.length });
  check('…and its examples are real callers (the churn, the lost ring, the wakeful child)', ['butter_wont_come', 'stolen_ring', 'sleepless_child'].every((id) => CALLERS.some((c) => c.id === id)) && /butter that won't come, a ring gone missing, a child who won't settle/.test(LANDING));
}

// The old ways on the landing page: each card names only what the game has.
{
  const card = (title) => { const m = LANDING.match(new RegExp('<h3>' + title.replace(/[?]/g, '\\?') + '</h3><p>([^<]*)</p>')); return m ? m[1] : ''; };
  const places = card('Old Places in the Wilds');
  const { TROY_TOWN } = require('../data/troyTown.js');
  const { CLOOTIE_WELL, CLOOTIE_ROUNDS } = require('../data/clootie.js');
  const { MEN_AN_TOL, MEN_TIMES } = require('../data/menAnTol.js');
  const { COUNTLESS } = require('../data/countlessStones.js');
  check('the four old places on the page are all in the Wilds: the maze, the well, the holed stone, the ring', !!(places && TROY_TOWN && CLOOTIE_WELL && MEN_AN_TOL && COUNTLESS));
  check('…three times round the well and nine times through the stone, as the game counts them', /three times sunways/.test(places) && CLOOTIE_ROUNDS === 3 && /nine times against the sun/.test(places) && MEN_TIMES === 9);
  const wards = card('Wards of the House');
  const { WARDS, BOTTLE_PLACES } = require('../data/wards.js');
  check('the wards card names three the game has: the bottle (as Blagrave advised, 1671, under the hearth), the daisy wheel, the shoe', /Blagrave advised in 1671/.test(wards) && /Blagrave/.test(WARDS.bottle.source) && /1671/.test(WARDS.bottle.source) && !!BOTTLE_PLACES.hearth && !!WARDS.hexafoil && !!WARDS.shoe && /by the chimney/.test(WARDS.shoe.where));
  const { SHEAF_FORMS, SHEAF_PLAIT_SEASONS } = require('../data/lastSheaf.js');
  check('…and the last sheaf, plaited at harvest, in the three forms the game has', /At harvest, plait the last sheaf too, a neck, a kern baby or a Maiden/.test(wards) && JSON.stringify(Object.keys(SHEAF_FORMS)) === '["neck","kern","maiden"]' && SHEAF_PLAIT_SEASONS.includes('lughnasadh') && !!WARDS.sheaf);
  const { rowanProblem, horseshoeProblem, hagstoneProblem, HAGSTONE_PLACES } = require('../data/wards.js');
  check('…the rowan cross, the found horseshoe and the hag stone, each as the game has them (no knot; found, not bought; holed by nature; at the bed head)', /Bind a rowan cross with red thread and never knot it/.test(wards) && /knot/.test(rowanProblem({ way: 'scots', tool: 'hand', finish: 'knot' })) && /nail up a horseshoe you found \(never one you bought\)/.test(wards) && !!WARDS.horseshoe && /finds/.test(WARDS.horseshoe.lore) && /hang a stone holed by nature at the head of your bed/.test(wards) && /naturally/.test(hagstoneProblem({ stone: 'bored', place: 'bed' })) && !!HAGSTONE_PLACES.bed && horseshoeProblem({ place: 'over', up: 'points_up' }) === null);
  const myth = card('Myth or Record?');
  const { MYTH_SETS } = require('../data/mythOrRecord.js');
  const n = MYTH_SETS.reduce((a, set) => a + set.items.length, 0);
  const m = myth.match(/the (\d+) things/);
  check('the Myth or Record card counts the questions truly', m && Number(m[1]) === n, { page: m && m[1], game: n });
  const ids = MYTH_SETS.flatMap((set) => set.items);
  check('…and its two examples are in it, both answered myth', ['nine_million', 'burned_in_england'].every((id) => { const q = ids.find((x) => x.id === id); return q && q.answer === 'myth'; }));
  check('the Guising card names the Moot, as the guise list has it', /the Moot, a lit turnip/.test(card('Guising')) && /turnip:\s*\{ name: 'The Moot'/.test(GUISES));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
