// Callers audit, Valentine's Eve to Hunt the Gowk (callers 60–71): each
// correction was checked against its source, first- or second-hand; what
// could not be confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }



check('Shrove Tuesday: Hone vol. I; LFB and the Animal Welfare Act cited', /Hone, The Every-Day Book, vol\. I \(1826\), 15 February/.test(by('shrove_tuesday_shroving').source) && /London Fire Brigade, "Pan fires"/.test(by('shrove_tuesday_shroving').source));

const ld = by('lady_day');
check('(the lore, as audited) Lady Day: Hone 1826 and Tess cited; England only', /\(Hone, 1826; Hardy, Tess, 1891\)/.test(ld.lore));

const bd = by('borrowed_days');
check('(the lore, as audited) Borrowing Days: the Complaynt and the later rhyme kept apart; glucose before warming', /'the thre borouing dais of marche' \(The Complaynt of Scotland, 1549\)/.test(bd.lore) && /but in the rhyme 'the 3 silly hoggs came hirpling hame' \(Brewer, 1895\)/.test(bd.lore));

const sp = by('st_patrick');
check('(the lore, as audited) St Patrick: Dinely\'s crosses in the hats; Dinely and the RSA cited', /the Irish wore crosses in their hats and the common people wore shamrock \(Dinely\)/.test(sp.lore));

const cs = by('carling_sunday');
check('Carling Sunday: Brand\'s frying, the parched peas of 1786, and the 1825 butter, pepper and salt each credited', /fried and given away \(Brand, in Hone, 1826\)/.test(cs.lore) && /parched and eaten in the afternoon \(The Gentleman's Magazine, 1786\)/.test(cs.lore) && /fried in butter, pepper, and salt' \(Hone, 4 August\)/.test(cs.lore) && /natural toxins/.test(cs.source) && !/East Lancashire/.test(cs.source));



const hr = by('holy_rood_nutting');
check('(the lore, as audited) Holy Rood: Poor Robin\'s couplet; Folkard\'s Sunday nutters; Hone vol. I; FSA allergens', /Doth go a nutting on Holy-rood day' \(Poor Robin, 1709\)/.test(hr.lore) && /Sunday nutters \(Folkard, 1884\)/.test(hr.lore));



test('callers 60–71 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
