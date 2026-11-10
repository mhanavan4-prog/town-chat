// Callers audit, Beltane to St Agnes' Eve (callers 37–48): each correction
// below was checked against its source, first- or second-hand; what could
// not be confirmed was left out or paraphrased.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }

const beltane = by('beltane_cake');
check('beltane: Cairngorms byelaw is fires and barbecues, leave in writing', /fires and barbecues are banned from April to September/.test(beltane.resolution) && /leave in writing/.test(beltane.resolution));
check('beltane: fox advice only what the sheep code says', /disposed of without delay/.test(beltane.resolution) && !/in-bye|draw the fox in|takes first/.test(beltane.resolution));

const stj = by('litha_st_johns_door');
check('St John\'s Eve: interactions as the NHS lists them, no warfarin or HIV', /antidepressants, blood-thinners or epilepsy medicines/.test(stj.resolution) && !/warfarin|HIV/.test(stj.resolution));

const lammas = by('lughnasadh_lammas_loaf');
check('Lammas: the unconfirmed quotations paraphrased, Parker credited', !/gecryme|hallowed bread|so that mice do not harm/.test(lammas.lore) && /as E\. Parker translates it/.test(lammas.source) && !/Jolly/.test(lammas.source));
check('Lammas: 14.5% is a food-safety threshold; bait checks per label; permanent baiting only where the code allows', /food-safety risk rises above 14\.5 per cent/.test(lammas.resolution) && /checked as often as the label says/.test(lammas.resolution) && /except where the code allows it/.test(lammas.resolution));

check('Bilberry Sunday: 999 or 112 and ask for Mountain Rescue', /ring 999 or 112 and ask for Mountain Rescue/.test(by('lughnasadh_bilberry_sunday').resolution));

check('Crying the Neck: the Devon letter is in Hone vol. II (1827)', /a north Devon letter in Hone, 1827/.test(by('mabon_crying_the_neck').lore));

const br = by('mabon_michaelmas_brambles');
check('brambles: after Old Michaelmas Day; Folkard\'s late autumn; Sexton cited', /abroad after Old Michaelmas Day/.test(br.lore) && /late in the autumn/.test(br.lore) && /R\. Sexton, RTÉ Brainstorm \(2025\)/.test(br.source));
check('brambles: the FSA\'s low-to-the-ground advice, not dog height', /not low down where animals may have fouled it/.test(br.resolution) && !/height a dog can reach/.test(br.resolution));

const well = by('cream_of_the_well');
check('cream of the well: 999 for suspected hypothermia; Mowat in the source', /If you think it's hypothermia, ring 999/.test(well.resolution) && /J\. Mowat, Old-Lore Miscellany \(1921\)/.test(well.source));

const cal = by('calennig_children');
check('calennig: the quotation credited to Museum Wales; bread and cheese only from the verse', /\(Museum Wales\)\./.test(cal.lore) && !/T\. M\. Owen;/.test(cal.lore) && !/always as welcome as a coin/.test(cal.resolution));

check('St Agnes\' Eve: Aubrey as Hone quotes him, Hone vol. I and Keats in the source', /Aubrey, Miscellanies \(1696\), as Hone quotes it · W\. Hone, The Every-Day Book, vol\. I \(1826\), 20 January · J\. Keats/.test(by('st_agnes_eve').source));

test('callers 37–48 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
