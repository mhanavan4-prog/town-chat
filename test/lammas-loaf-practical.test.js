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
check('the practical half: the stones more than the cat; gaps stopped, spilt grain swept, dry and cool, 14.5 per cent', /Then the practical half, and it's the stones that earn their keep more than the cat/.test(c.resolution) && /so that rats and mice couldn't climb in/.test(c.resolution) && /Stop every gap in the store before the harvest goes in, sweep up spilt grain/.test(c.resolution) && /above 14\.5 per cent moisture/.test(c.resolution));
check('…poison only in tamper-proof boxes, checked as the label says, the dead cleared for the owl, kestrel, cat and dog; no permanent bait but where the code allows', /tamper-proof bait box, checked as often as the label says/.test(c.resolution) && /the barn owl, the kestrel, the cat and the dog will eat what the poison kills/.test(c.resolution) && /no bait left down for good, except where the code allows it because the rats keep coming back/.test(c.resolution));
check('…leptospirosis: plasters, protective clothing, washing, the doctor told; farmer\'s lung and an FFP3 respirator', /leptospirosis: cover cuts with waterproof plasters, wear protective clothing/.test(c.resolution) && /he tells the doctor he works among rats/.test(c.resolution) && /farmer's lung, so a proper FFP3 respirator/.test(c.resolution));
check('…cited: Historic England, AHDB, CRRU, NHS 111 Wales, HSE', /Historic England/.test(c.source) && /AHDB/.test(c.source) && /CRRU UK/.test(c.source) && /NHS 111 Wales, "Leptospirosis"/.test(c.source) && /HSE/.test(c.source));
check('the lore: the Pater Noster sticks crosswise, the prayers against the mice, the consecrated bread, paraphrased (the quotations unconfirmed); Parker named', /two four-edged sticks, each written with a Pater Noster, laid crosswise on the barn floor/.test(c.lore) && /four pieces of bread consecrated on Lammas Day crumbled at the four corners of the barn/.test(c.lore) && !/gecryme|hallowed bread/.test(c.lore) && /Parker/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
