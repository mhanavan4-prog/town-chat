// Callers audit, Beltane to St Agnes' Eve (callers 37–48): each correction
// below was checked against its source, first- or second-hand; what could
// not be confirmed was left out or paraphrased.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }



const lammas = by('lughnasadh_lammas_loaf');
check('Lammas: the unconfirmed quotations paraphrased, Parker credited', !/gecryme|hallowed bread|so that mice do not harm/.test(lammas.lore) && /as E\. Parker translates it/.test(lammas.source) && !/Jolly/.test(lammas.source));


check('Crying the Neck: the Devon letter is in Hone vol. II (1827)', /a north Devon letter in Hone, 1827/.test(by('mabon_crying_the_neck').lore));

const br = by('mabon_michaelmas_brambles');
check('brambles: after Old Michaelmas Day; Folkard\'s late autumn; Sexton cited', /abroad after Old Michaelmas Day/.test(br.lore) && /late in the autumn/.test(br.lore) && /R\. Sexton, RTÉ Brainstorm \(2025\)/.test(br.source));


const cal = by('calennig_children');
check('calennig: the quotation credited to Museum Wales; bread and cheese only from the verse', /\(Museum Wales\)\./.test(cal.lore) && !/T\. M\. Owen;/.test(cal.lore) && !/always as welcome as a coin/.test(cal.resolution));

check('St Agnes\' Eve: Aubrey as Hone quotes him, Hone vol. I and Keats in the source', /Aubrey, Miscellanies \(1696\), as Hone quotes it · W\. Hone, The Every-Day Book, vol\. I \(1826\), 20 January · J\. Keats/.test(by('st_agnes_eve').source));

test('callers 37–48 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
