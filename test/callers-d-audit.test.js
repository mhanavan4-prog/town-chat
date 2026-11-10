// Callers audit, Hallowe'en to Beltane (callers 25–36) and Black for the
// Burying: each correction was checked against its source, first- or
// second-hand; what could not be confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }

check('Hallowe\'en nuts: Burns quoted as the Kilmarnock text has it', /"thought to be a night when Witches, Devils, and other mischief-making beings, are all abroad on their baneful, midnight errands"/.test(by('hallowe_en_nuts').lore));

const ff = by('yule_first_foot');
check('first-foot: coal and salt and Simpson & Roud dropped, as in the Charm Book', !/coal and salt/.test(ff.lore) && !/salt on her table/.test(ff.resolution) && !/Simpson/.test(ff.source));

check('Yule log: Chambers in his own past tense', /Chambers gives the Christmas reason: "it was believed that the preservation of last year's Christmas log was a most effectual security to the house against fire"/.test(by('yule_log').lore) && !/By Chambers' day/.test(by('yule_log').lore));

const mb = by('mourning_black');
check('burying: Gerard\'s 1633 edition and Taylor\'s encyclopedia article cited', /ed\. T\. Johnson \(1633\), Book III ch\. 113, "Of the Alder Tree", spelling modernised/.test(mb.source) && /L\. Taylor, "Mourning Dress", Encyclopedia of Clothing and Fashion \(2005\)/.test(mb.source));



const sd = by('ostara_sun_dance');
check('sun dance: the Irish line is Hone\'s correspondent; unconfirmed child line dropped; Hone vol. I', /\(a correspondent in Hone, 1826\)/.test(sd.lore) && !/take more harm/.test(sd.resolution) && /Hone, The Every-Day Book, vol\. I \(1826\), 5 April/.test(sd.source));

test('callers 25–36 and the burying: audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
