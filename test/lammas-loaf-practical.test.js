// The Lammas loaf's practical half: staddle stones (Historic England), a
// proofed, clean, dry, cool store (AHDB), bait only in tamper-proof boxes with
// the dead cleared for the owls' sake (CRRU UK), leptospirosis (NHS 111 Wales)
// and farmer's lung (HSE), with the cat given no more credit than the sources
// give it; and the barn charm as the Vitellius psalter has it: the Pater
// Noster sticks, the prayers against the mice, and the bread in the corners.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'lughnasadh_lammas_loaf');
check('the old scene kept: the loaf crumbled in four corners, the cat and the staddle stones, never sure which to thank', c && /crumble the loaf into the four corners of the barn/.test(c.resolution) && /staddle stones/.test(c.resolution) && /he is never sure which to thank/.test(c.resolution));
check('the lore: the Pater Noster sticks crosswise, the prayers against the mice, the consecrated bread, paraphrased (the quotations unconfirmed); Parker named', /two four-edged sticks, each written with a Pater Noster, laid crosswise on the barn floor/.test(c.lore) && /four pieces of bread consecrated on Lammas Day crumbled at the four corners of the barn/.test(c.lore) && !/gecryme|hallowed bread/.test(c.lore) && /Parker/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
