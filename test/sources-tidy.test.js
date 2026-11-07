// The Sources page folds every citation of one work into one entry: editions
// and volumes (Henderson 1866 and 1879, Hone's two volumes, Stow's two
// editions, the Golden Bough and its abridgement), a person's undated note,
// and a paper's or museum's separate items. A guard keeps it that way: no two
// works on the page may share an author's surname and title.
const { buildCharmBook } = require('../lib/charmBook.js');
const { buildSources, firstYear, personOf, titleOf, nameKey } = require('../lib/sources.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

check('a year is a year: "p. 161" and "Cod. 136" are not; "(725)", "c. 950", "c. AD 200" and "423 BC" are', firstYear('National Folklore Collection, Schools\' Collection, vol. 0583, p. 161') === '' && firstYear('Merseburg, Domstiftsbibliothek Cod. 136 (10th c.)') === '' && firstYear('Bede, De temporum ratione ch. 15 (725)') === '725' && firstYear('compiled by Cild for its owner, Bald, Bald\'s Leechbook (c. 950)') === '950' && firstYear('Cassius Dio, Roman History 37.18–19 (c. AD 200)') === '200' && firstYear('Aristophanes, Clouds (423 BC)') === '423');
check('a title is what follows the name, if it starts like one', titleOf('W. Henderson, Notes on the Folk-Lore of the Northern Counties (1879), ch. 5') === titleOf('William Henderson, Notes on the Folk-Lore of the Northern Counties of England and the Borders (1866; 1879 ed.), ch. 5') && titleOf('A. Carmichael, notes') === '' && personOf('Kelso Chronicle (10 July 1863)') === null);

const src = buildSources(buildCharmBook({ acct: {}, prog: {}, seasonKey: null }).chapters);
const works = (re) => src.works.filter((w) => w.entries.length && re.test(w.sortKey));
const one = (re, min) => { const ws = works(re); return ws.length === 1 && ws[0].entries.length >= (min || 1); };
check('Henderson\'s Notes, 1866 and the 1879 edition, are one work (L. Henderson of 2009 is another)', one(/^henderson\|1866$/, 4) && works(/^henderson\|2009$/).length === 1);
check('Hone\'s two volumes are one Every-Day Book', one(/^hone\|/, 12) && !src.works.some((w) => /Every-Day Book, vol\. II/.test(w.cite) && w.sortKey !== 'hone|1826'));
check('Stow\'s Survey, 1598 and 1603, is one', one(/^stow\|/, 3));
check('the Golden Bough and its abridgement are one; Balder the Beautiful is its own', one(/^frazer\|1890$/, 6) && works(/^frazer\|1913$/).length === 1);
check('Grimm\'s Deutsche Mythologie and its English Teutonic Mythology are one', one(/^grimm\|/, 2));
check('Lacnunga is one, its charm against a stitch included', one(/^lacnunga\|/, 10));
check('Carmichael\'s undated notes join Carmina Gadelica', one(/^carmichael\|/, 6));
check('Agrippa\'s Three Books and his De occulta philosophia are one', one(/^agrippa\|/, 2));
check('the Schools\' Collection, and Notes and Queries, are one each', one(/^national folklore collection, schools' collection\|/, 3) && one(/^notes and queries\|/, 3));

// The guard: no two works by one author with one title, and no paper, museum or archive twice.
const seen = new Map();
const dupes = [];
for (const w of src.works) {
  const p = personOf(w.cite);
  const t = titleOf(w.cite);
  const k = p ? (t ? `${p}|${t}` : null) : `np|${nameKey(w.cite)}`;
  if (!k) continue;
  if (seen.has(k)) dupes.push([seen.get(k), w.cite]); else seen.set(k, w.cite);
}
check('no work appears twice on the Sources page', dupes.length === 0, dupes);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
