// Wassail the Old Tree: the practical half for the tree (RHS on biennial
// bearing, frost and pollination) and the night (shotgun certificate; the
// Highways Act on firing near a road; the fireworks curfew; NHS on
// hypothermia and alcohol); and the lore read from Hone (after the
// Gentleman's Magazine, 1791) and Lysons, with guns dated to 1890, since
// neither early record has them, and Carhampton's shotguns today.
const { CALLERS } = require('../data/callers.js');
const { YULE_RITES } = require('../data/yule.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'yule_wassail');
check('the old scene kept: the toast in the fork, the sons banging the pans, every other year', c && /put the toast in its fork, pour the cider at its roots/.test(c.resolution) && /banging the pans loudest/.test(c.resolution) && /every other year/.test(c.resolution));
check('the practical half: rub off half to three-quarters of the buds, or thin after the June drop; grass cleared, mulch, water, feed', /Then the practical half, which is the tree's and the night's/.test(c.resolution) && /rub off half to three-quarters of the fruit buds, leaving one or two to a spur, or thin the fruit after the June drop/.test(c.resolution) && /clear the grass from its foot, mulch it, water it in a dry spell, and feed it in early spring/.test(c.resolution));
check('…frost the commonest thief; a pollinating partner', /A late frost on the blossom is the commonest thief of a crop/.test(c.resolution) && /most apples want another apple nearby to pollinate them/.test(c.resolution));
check('…a shotgun certificate; firing near a road that endangers anyone; fireworks stop at eleven, no Twelfth Night exception', /a shotgun wants a shotgun certificate/.test(c.resolution) && /firing near a road so that anyone on it is hurt, held up or put in danger is an offence/.test(c.resolution) && /Fireworks stop at eleven at night, and Twelfth Night is no exception/.test(c.resolution));
check('…hypothermia signs, in and warm, a warm drink that isn\'t cider; cited', /shivering, pale cold skin, slurred speech or muddle/.test(c.resolution) && /a warm drink that isn't cider, since the NHS says not to give alcohol to someone that cold/.test(c.resolution) && /RHS, "Biennial bearing"/.test(c.source) && /Firearms Act 1968/.test(c.source) && /Highways Act 1980, s\. 161/.test(c.source) && /NHS, "Hypothermia"/.test(c.source));
check('the caller\'s lore: Hone\'s toast and his superstitious believers; guns by 1890, not "guns let off" as of old; Herrick', /"Here's to thee, old apple-tree"/.test(c.lore) && /"if they neglect this custom, the trees will bear no apples that year"/.test(c.lore) && /by 1890 "guns are often fired"/.test(c.lore) && !/guns let off/.test(c.lore) && /Wassail the trees, that they may bear/.test(c.lore) && /Hone/.test(c.source) && !/19th-century Devon and Somerset wassail records/.test(c.source));
const R = YULE_RITES.wassail;
check('the rite: Hone\'s toast and verse; guns by 1890; Carhampton\'s shotguns, Whimple revived 1993; the vague citation named', /"Here's to thee, old apple-tree,"/.test(R.lore) && /down to "sacks full, \/ And my pockets full too! Huzza!"/.test(R.lore) && !/ending "Hats full/.test(R.lore) && /by 1890 "guns are often fired"/.test(R.lore) && /"a rare survivor"/.test(R.lore) && /revival in 1993/.test(R.lore) && /Old Twelvey Night \(17 January\)/.test(R.lore) && /Hone/.test(R.source) && !/19th-century Devon and Somerset wassail records/.test(R.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
