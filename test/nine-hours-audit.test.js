// The Nine Herbs and the planetary hours, read against their sources: the
// serpent line belongs to Stiðe, and attorlaðe gets its own "Flee now"; fille
// is flagged uncertain; deadly nightshade is not Culpeper's (his Saturnine
// nightshade is the common one); the hours lore quotes Dio and calls the hour
// count one of his two reasons, with sunrise as the game's reckoning, not his.
const { NINE_HERBS } = require('../data/nineHerbs.js');
const { CULPEPER_RULERS } = require('../data/practices.js');
const { buildCharmBook } = require('../lib/charmBook.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const by = (id) => NINE_HERBS.find((h) => h.id === id);
check('the serpent line is Stiðe\'s; attorlaðe\'s is "Flee now"', /fought against the serpent/.test(by('nettle').line) && !/serpent/.test(by('betony').line) && /^Flee now, Venom-loather, the lesser from the greater, the greater from the lesser/.test(by('betony').line));
check('fille flagged uncertain', by('chervil').uncertain === true);
check('no belladonna among Culpeper\'s rulers', !('belladonna' in CULPEPER_RULERS) && CULPEPER_RULERS.henbane === 6);
const book = buildCharmBook({}, {});
const hours = book.chapters.find((c) => (c.key || c.id) === 'hours');
const es = hours.entries || hours.items;
const sat = es.find((e) => (e.id || e.key) === 'saturn');
check('the hours lore: Dio quoted, one of his two reasons; no "which is how"; both Culpeper books', es.length === 7 && es.every((e) => /"each day will receive its appropriate god": one of the two reasons he gives/.test(e.lore) && !/which is how/.test(e.lore) && /The English Physitian \(1652\) and The Complete Herbal \(1653\)/.test(e.source)));
check('Saturn\'s herbs no longer name Belladonna', !/Belladonna/.test(sat.lore) && /Henbane/.test(sat.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
