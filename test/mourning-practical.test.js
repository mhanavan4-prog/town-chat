// The mourning black: a practical half (GOV.UK on the Funeral Expenses
// Payment and Bereavement Support Payment; mygov.scot on the Funeral Support
// Payment; Citizens Advice on arranging a funeral; the RSC on iron sulphate),
// and the lore put right: alder black with copperas (Gerard; Lightfoot, 1777;
// Fergusson, 1878), alder brown under bog-iron black in Ireland (Joyce, 1906);
// the "bleeding" tree called a later telling; near black, not "a good black".
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'mourning_black');
check('alder bark: reddish brown, then iron (copperas, or rusty iron) for near black, in a pan kept for it', c && c.steps[0].item === 'alder_bark' && /Boil the bark and it gives a reddish brown; put iron to it, a little copperas from the druggist, or rusty iron/.test(c.resolution) && /near black/.test(c.resolution) && /an old pan kept for it/.test(c.resolution));
check('the lore: Gerard\'s poor country dyers; Lightfoot\'s copperas black; the black stripes in homemade tartan; Joyce\'s Irish alder brown and bog black', /'The bark is much used of poor country dyers, for the dying of coarse cloth, caps, hose, and such like into a black colour, whereunto it serveth very well'/.test(c.lore) && /'The Highlanders dye their yarn of a black colour, by boiling it with the bark mixed with copperas'/.test(c.lore) && /'the black stripes in homemade tartan'/.test(c.lore) && /'ground or foundation colour of reddish brown'/.test(c.lore) && /iron-rich mud of bog pools/.test(c.lore));
check('…the bleeding tree a later telling; mourning dye only as Taylor has it; record, with real sources', /later tellings made it a tree that bled/.test(c.lore) && /'Many dyed and altered garments'/.test(c.lore) && !/a good black/.test(c.lore) && c.tier === 'record' && /Lightfoot/.test(c.source) && !/Traditional household dyeing/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
