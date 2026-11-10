// The dream of him: Nell a grown woman now (two-and-twenty), a practical half
// (the EMA's yarrow monograph on allergy and pregnancy; NHS on nosebleeds),
// and the lore put right: the Irish nine sprigs, the right-foot stocking and
// the silence (c. 1850); Donegal's sod (Kinahan, 1884, as Vickery gives him);
// Halliwell's flannel and his eastern-counties nose charm (1849); Davies on the
// cunning folk. No "nine leaves in Ulster" as a period record (that is 1991).
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'dream_of_him');
check('Nell is a grown woman of two-and-twenty; no secret kept from her mother', c && /two-and-twenty/.test(c.plea) && !/mustn't know/.test(c.plea));
check('the charm as recorded: after sunset on May Eve, nine sprigs, the right-foot stocking, not a word spoken', /After sunset on May Eve she gathers nine sprigs of yarrow, puts them in her right-foot stocking under the pillow, and says not a word between the picking and the sleeping/.test(c.resolution) && c.steps[0].item === 'yarrow');
check('the lore: the Irish May Eve charm, its rhyme, the stocking and the broken charm; Donegal\'s sod via Vickery', /'after sunset on May Eve'/.test(c.lore) && /'nine sprigs of the plant'/.test(c.lore) && /'Good morrow, good morrow, fair yarrow; \/ And thrice good morrow to thee; \/ Come tell me before to-morrow \/ Who my true love shall be'/.test(c.lore) && /'The yarrow is brought home, put into the right-foot stocking, placed under the pillow'/.test(c.lore) && /'if the girl opens her lips to speak after she has pulled the yarrow, the charm is broken'/.test(c.lore) && /Kinahan, as Vickery gives him/.test(c.lore) && !/in Ulster/.test(c.lore));
check('…Halliwell\'s Venus\' tree and his eastern-counties nose charm; Davies\'s cunning folk; no "steady earner", no Suffolk', /'Thou pretty herb of Venus' tree, \/ Thy true name it is yarrow'/.test(c.lore) && /in the eastern counties you tickled the inside of your nose with a leaf: 'Yarroway, yarroway, bear a white blow, \/ If my love love me, my nose will bleed now\.'/.test(c.lore) && /'told fortunes, identified thieves, induced love, and much else besides'/.test(c.lore) && !/steady earner|Suffolk/.test(c.lore) && /Halliwell/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
