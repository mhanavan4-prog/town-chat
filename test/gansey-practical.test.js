// The brown gansey: a practical half on gathering lichens and dyeing at home
// (the British Lichen Society, 2024; the Wildlife and Countryside Act and
// NatureScot; the Royal Society of Chemistry and the Crafts Council), and the
// lore put right: the 1941 source is a Scots dictionary correspondent from
// Angus (Ags.17), not "Angus"; the fishermen were "averse", not forbidden;
// Carmichael's 1873 notebook has the sinking and the stones' revenge; and
// heather with alum dyes yellow, iron makes it green.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const g = CALLERS.find((x) => x.id === 'brown_gansey');
check('the heather pot: yellow with alum, moss-green only after an iron bath; the crotal gansey stays home', g && g.steps[0].item === 'heather_sprig' && /with alum the heather gives a bright yellow, and a dip in an iron bath after darkens it to moss-green/.test(g.resolution) && /stays home for the peat-cutting/.test(g.resolution));
check('the lore: Martin\'s crostil; the Spectator\'s crottle; no mordant; Carmichael\'s sinking and the stones\' revenge', /'another coarser scurf called crostil\. It is of a dark colour'/.test(g.lore) && /'a lichen from the rocks a rich brown, known as crottle'/.test(g.lore) && /needed no mordant/.test(g.lore) && /'never wear cloth made from it as it sinks if they fall out'/.test(g.lore) && /'revenge'/.test(g.lore) && /A\. Carmichael, notes/.test(g.source));
check('…the dictionary\'s 1941 correspondent (Ags.17), "averse", not forbidden; heather yellow with alum', /'a superstition among fishermen on the West Coast that crottal seeks its native rocks'/.test(g.lore) && /'were therefore averse to wearing garments dyed with crottal or to taking on board anyone so clad'/.test(g.lore) && !/they would not wear/.test(g.lore) && /Ags\.17, 1941/.test(g.source) && !/\(Angus, 1941\)/.test(g.source) && /Heather gives yellow with alum, and green with iron/.test(g.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
