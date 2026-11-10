// The midsummer door: a practical half on St John's wort as a remedy (the
// MHRA's Drug Safety Update on contraceptives; a registered herbal leaflet on
// its other interactions, the sun, and low mood; NHS and the Samaritans), and
// the lore put right: Stow's doors are in the 1603 Survey, not 1598, and he
// gives no reason for them; the evil spirits and witches are later writers'.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'midsummer_door');
check('the wort over the lintel; the dog back, the pipe found', c && c.steps[0].item === 'st_johns_wort' && /St John's wort over the lintel/.test(c.resolution) && /finds his pipe behind the settle/.test(c.resolution));
check('the lore: Stow\'s doors in the 1603 Survey, in his spelling, and his lamps; the bonfires\' reason his only one', /in the 1603 edition of his Survey of London/.test(c.lore) && /'shadowed with greene Birch, long Fennel, Saint Iohns wort, Orpin, white Lillies, and such like, garnished vpon with Garlands of beautifull flowers'/.test(c.lore) && /'Lampes of glasse, with oyle burning in them all the night'/.test(c.lore) && /'to purge the infection of the ayre'/.test(c.lore) && /\(1603\)/.test(c.source) && !/\(1598\)/.test(c.source));
check('…the evil spirits and witches later writers\' (fuga daemonum; Horwood\'s misreading); none of it Stow\'s', /Later writers had the wort hung up 'to drive away witches'/.test(c.lore) && /fuga daemonum/.test(c.lore) && /Horwood \(about 1919\) even put the witches in Stow, who never mentions them/.test(c.lore) && !/against evil spirits\. John Stow/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
