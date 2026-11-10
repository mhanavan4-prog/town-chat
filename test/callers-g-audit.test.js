// Callers audit, Valentine's Eve to Hunt the Gowk (callers 60–71): each
// correction was checked against its source, first- or second-hand; what
// could not be confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }

const v = by('valentines_eve');
check('Valentine\'s Eve: the salt against the NHS limit; no unsourced dream claim; Hone vol. I', /6 grams, about a level teaspoon/.test(v.resolution) && !/broken sleep/.test(v.resolution) && /Hone, The Every-Day Book, vol\. I \(1826\), 14 February/.test(v.source));

const d = by('st_david');
check('St David: s. 28\'s racial group; the CPS statement and Henry V cited', /a racial group includes nationality and national origins/.test(d.resolution) && /public statement on prosecuting racist and religious hate crime/.test(d.source) && /Henry V, First Folio \(1623\)/.test(d.source));

check('Shrove Tuesday: Hone vol. I; LFB and the Animal Welfare Act cited', /Hone, The Every-Day Book, vol\. I \(1826\), 15 February/.test(by('shrove_tuesday_shroving').source) && /London Fire Brigade, "Pan fires"/.test(by('shrove_tuesday_shroving').source));

const ld = by('lady_day');
check('Lady Day: Hone 1826 and Tess cited; England only', /\(Hone, 1826; Hardy, Tess, 1891\)/.test(ld.lore) && /Tess of the d'Urbervilles/.test(ld.source) && /renting in England now/.test(ld.resolution));

const bd = by('borrowed_days');
check('Borrowing Days: the Complaynt and the later rhyme kept apart; glucose before warming', /'the thre borouing dais of marche' \(The Complaynt of Scotland, 1549\)/.test(bd.lore) && /but in the rhyme 'the 3 silly hoggs came hirpling hame' \(Brewer, 1895\)/.test(bd.lore) && /glucose injection before it is warmed/.test(bd.resolution) && /Dictionary of the Older Scottish Tongue/.test(bd.source));

const sp = by('st_patrick');
check('St Patrick: Dinely\'s crosses in the hats; Dinely and the RSA cited', /the Irish wore crosses in their hats and the common people wore shamrock \(Dinely\)/.test(sp.lore) && /T\. Dinely \(1681\)/.test(sp.source) && /"Using the roads in Ireland" \(2023\)/.test(sp.source) && /no more than 11 standard drinks/.test(sp.resolution));

const cs = by('carling_sunday');
check('Carling Sunday: Brand\'s frying, the parched peas of 1786, and the 1825 butter, pepper and salt each credited', /fried and given away \(Brand, in Hone, 1826\)/.test(cs.lore) && /parched and eaten in the afternoon \(The Gentleman's Magazine, 1786\)/.test(cs.lore) && /fried in butter, pepper, and salt' \(Hone, 4 August\)/.test(cs.lore) && /natural toxins/.test(cs.source) && !/East Lancashire/.test(cs.source));

const ms = by('mothering_sunday_simnel');
check('Mothering Sunday: no unsourced servants\' hours; Cruse; Chambers for Shrewsbury', !/sixteen hours/.test(ms.resolution) && /Cruse Bereavement Support is free on 0808 808 1677/.test(ms.resolution) && /Chambers, The Book of Days \(1864\), Mid-Lent Sunday/.test(ms.source));

const mg = by('michaelmas_goose');
check('Michaelmas goose: the FSA\'s thickest part of the leg; thaw in the fridge; The Mirror and the NHS cited', /pierce the thickest part of the leg, and/.test(mg.resolution) && /thaw it in the fridge/.test(mg.resolution) && /The Mirror of Literature, no\. 568/.test(mg.source) && /NHS, "Burns and scalds"/.test(mg.source));

const hr = by('holy_rood_nutting');
check('Holy Rood: Poor Robin\'s couplet; Folkard\'s Sunday nutters; Hone vol. I; FSA allergens', /Doth go a nutting on Holy-rood day' \(Poor Robin, 1709\)/.test(hr.lore) && /Sunday nutters \(Folkard, 1884\)/.test(hr.lore) && /Hone, The Every-Day Book, vol\. I \(1826\), 14 September/.test(hr.source) && /fourteen foods that most often cause allergies/.test(hr.resolution) && /Theft Act 1968/.test(hr.source));

check('Easter lifting: freedom and capacity; no unsourced feet-first advice', /freedom and capacity to choose/.test(by('lifting').resolution) && !/feet first/.test(by('lifting').resolution));

check('Hunt the Gowk: the noon rule is English', /as the old English rule has it/.test(by('hunt_the_gowk').resolution));

test('callers 60–71 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
