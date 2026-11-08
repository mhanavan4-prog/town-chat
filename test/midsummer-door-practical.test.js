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
check('the practical half: the pill and the morning-after pill made less reliable; not with antidepressants, warfarin, epilepsy medicines; a pharmacist first', /Then the practical half/.test(c.resolution) && /it makes the contraceptive pill and the morning-after pill less reliable/.test(c.resolution) && /must not be taken with medicines for depression or anxiety, with warfarin or other blood thinners, or with medicines for epilepsy/.test(c.resolution) && /ask a pharmacist first/.test(c.resolution) && /MHRA/.test(c.source));
check('…sunburn; registered only for slight low mood, not depression; 111 or a GP; the Samaritans on 116 123', /can make the skin burn in strong sun/.test(c.resolution) && /registered only for slightly low mood and mild anxiety, not for depression/.test(c.resolution) && /ring 111 or talk to a GP/.test(c.resolution) && /116 123/.test(c.resolution) && /Samaritans/.test(c.source));
check('the lore: Stow\'s doors in the 1603 Survey, in his spelling, and his lamps; the bonfires\' reason his only one', /in the 1603 edition of his Survey of London/.test(c.lore) && /'shadowed with greene Birch, long Fennel, Saint Iohns wort, Orpin, white Lillies, and such like, garnished vpon with Garlands of beautifull flowers'/.test(c.lore) && /'Lampes of glasse, with oyle burning in them all the night'/.test(c.lore) && /'to purge the infection of the ayre'/.test(c.lore) && /\(1603\)/.test(c.source) && !/\(1598\)/.test(c.source));
check('…the evil spirits and witches later writers\' (fuga daemonum; Horwood\'s misreading); none of it Stow\'s', /Later writers had the wort hung up 'to drive away witches'/.test(c.lore) && /fuga daemonum/.test(c.lore) && /Horwood \(about 1919\) even put the witches in Stow, who never mentions them/.test(c.lore) && !/against evil spirits\. John Stow/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
