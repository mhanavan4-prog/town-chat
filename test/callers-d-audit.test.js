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
check('first-foot: Age Scotland Monday to Friday, nine to five', /0800 12 44 222, Monday to Friday, nine to five/.test(ff.resolution) && !/weekday mornings/.test(ff.resolution));
check('first-foot: coal and salt and Simpson & Roud dropped, as in the Charm Book', !/coal and salt/.test(ff.lore) && !/salt on her table/.test(ff.resolution) && !/Simpson/.test(ff.source));
check('first-foot: the two-week rule credited to nhs.uk', /NHS, "Grief after bereavement or loss"/.test(ff.source));

check('Yule log: Chambers in his own past tense', /Chambers gives the Christmas reason: "it was believed that the preservation of last year's Christmas log was a most effectual security to the house against fire"/.test(by('yule_log').lore) && !/By Chambers' day/.test(by('yule_log').lore));

const mb = by('mourning_black');
check('burying: a simple funeral when no one arranges it; no unsourced pan rule', /if there's no one to arrange it, the council or health authority will arrange a simple one/.test(mb.resolution) && !/no one can pay/.test(mb.resolution) && !/pan for dyeing only/.test(mb.resolution));
check('burying: Gerard\'s 1633 edition and Taylor\'s encyclopedia article cited', /ed\. T\. Johnson \(1633\), Book III ch\. 113, "Of the Alder Tree", spelling modernised/.test(mb.source) && /L\. Taylor, "Mourning Dress", Encyclopedia of Clothing and Fashion \(2005\)/.test(mb.source));

const w = by('yule_wassail');
check('wassail: bud thinning only; within fifty feet of a road; Carhampton sources', !/June drop/.test(w.resolution) && /within fifty feet of the middle of a road/.test(w.resolution) && /West Somerset Free Press \(January 2026\), Carhampton/.test(w.source) && /Calendar Customs, "Carhampton Wassailing"/.test(w.source));

const pe = by('ostara_pace_eggs');
check('pace eggs: gorse flowers safe only in small amounts; Hone vol. I', /the flowers are safe only in small amounts/.test(pe.resolution) && /Wild Food UK, "Gorse"/.test(pe.source) && /Hone, The Every-Day Book, vol\. I \(1826\), 5 April/.test(pe.source));

const sd = by('ostara_sun_dance');
check('sun dance: the Irish line is Hone\'s correspondent; unconfirmed child line dropped; Hone vol. I', /\(a correspondent in Hone, 1826\)/.test(sd.lore) && !/take more harm/.test(sd.resolution) && /Hone, The Every-Day Book, vol\. I \(1826\), 5 April/.test(sd.source));

test('callers 25–36 and the burying: audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
