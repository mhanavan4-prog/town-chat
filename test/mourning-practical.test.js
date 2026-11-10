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
check('the practical half: the widow\'s Funeral Expenses Payment, its benefits, what it pays, six months; Scotland\'s Funeral Support Payment', /Then the practical half/.test(c.resolution) && /her mother, as the widow, may get a Funeral Expenses Payment if she's on Universal Credit, Pension Credit, Housing Benefit or income-related ESA/.test(c.resolution) && /burial or cremation fees and up to £1,000 more, though not usually the whole cost/.test(c.resolution) && /within six months of the funeral/.test(c.resolution) && /Funeral Support Payment/.test(c.resolution) && /GOV\.UK/.test(c.source));
check('…Bereavement Support Payment, three months; no funeral director needed; the council\'s simple funeral when no one arranges it; the copperas kept from children', /Bereavement Support Payment too, best claimed within three months/.test(c.resolution) && /arranged without a funeral director/.test(c.resolution) && /if there's no one to arrange it, the council or health authority will arrange a simple one/.test(c.resolution) && /copperas away from children; it's harmful if swallowed/.test(c.resolution) && /Citizens Advice/.test(c.source));
check('the lore: Gerard\'s poor country dyers; Lightfoot\'s copperas black; the black stripes in homemade tartan; Joyce\'s Irish alder brown and bog black', /'The bark is much used of poor country dyers, for the dying of coarse cloth, caps, hose, and such like into a black colour, whereunto it serveth very well'/.test(c.lore) && /'The Highlanders dye their yarn of a black colour, by boiling it with the bark mixed with copperas'/.test(c.lore) && /'the black stripes in homemade tartan'/.test(c.lore) && /'ground or foundation colour of reddish brown'/.test(c.lore) && /iron-rich mud of bog pools/.test(c.lore));
check('…the bleeding tree a later telling; mourning dye only as Taylor has it; record, with real sources', /later tellings made it a tree that bled/.test(c.lore) && /'Many dyed and altered garments'/.test(c.lore) && !/a good black/.test(c.lore) && c.tier === 'record' && /Lightfoot/.test(c.source) && !/Traditional household dyeing/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
