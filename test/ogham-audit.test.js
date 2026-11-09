// The Ogham, read against McManus and the Bríatharogam: ceirt's kenning is
// "shelter of a hind" (the "wild hind" is only a gloss); straif's is Morann's
// "strongest of reddening (dye)", not the Auraicept variant; nion's and onn's
// follow McManus ("establishing of peace", "wounder of horses"); muin's tree
// is the vine, without the untraced "bramble"; each source line says when the
// tree is the medieval glossators' and credits Calder's Auraicept wording.
const { OGHAM } = require('../data/ogham.js');
const { buildCharmBook } = require('../lib/charmBook.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const L = (k) => OGHAM.find((o) => o.key === k);
check('ceirt: "shelter of a hind"', L('ceirt').kenning === 'shelter of a hind');
check('straif: Morann\'s dye kenning, not the hedge of a stream', L('straif').kenning === 'strongest of reddening (dye)');
check('nion and onn as McManus reads them', L('nion').kenning === 'establishing of peace' && L('onn').kenning === 'wounder of horses');
check('muin: the vine, no bramble', L('muin').tree === 'Vine');
const ch = buildCharmBook({}, {}).chapters.find((c) => (c.key || c.id) === 'ogham');
const es = ch.entries || ch.items;
const src = (k) => es.find((e) => (e.id || e.key) === k).source;
check('the glossators\' tree named where it is not the original; not where it is', /the tree, gorse, is the medieval glossators'/.test(src('onn')) && /the tree, rowan, is the medieval glossators'/.test(src('luis')) && !/glossators'/.test(src('beith')) && !/glossators'/.test(src('idad')));
check('every letter credits Calder\'s Auraicept', es.length === 20 && es.every((e) => /G\. Calder, Auraicept na n-Éces, 1917/.test(e.source)));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
