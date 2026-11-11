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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
