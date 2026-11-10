// The white heather: a practical half (NatureScot on uprooting wild plants and
// on foraging; the National Records of Scotland on marriage notices), and the
// lore put right from the Queen's own words (Leaves from the Journal, 1868, for
// 29 September 1855; her memorandum; More Leaves, as Wallace quotes it, 1903),
// the bride's luck (All the Year Round, via Wallace; The Graphic, 1885), and
// the street sellers. No "traveller", and no unread Roud.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'white_heather');
check('the charm and the cup stand; the heather pressed in her Bible', c && c.steps[0].item === 'white_heather_charm' && /a ring near the rim/.test(c.resolution) && /pressed in her Bible for forty years/.test(c.resolution));
check('the lore: the Queen\'s "No Highlander would pass by it"; the Balmoral betrothal of 1855 and its "emblem of good luck"; the memorandum; fashioned, not invented', /'No Highlander would pass by it without picking it, for it is considered to bring good luck,'/.test(c.lore) && /'picked a piece of white heather, \(the emblem of "good luck,"\) which he gave to her'/.test(c.lore) && /'some white heather, which he said was good luck'/.test(c.lore) && /She made it fashionable; she didn't invent it/.test(c.lore) && /Leaves from the Journal/.test(c.source));
check('…the rash bride without it; Princess Beatrice\'s bonnet, 1885; the street sellers; no traveller, no Roud', /'in some parts of Scotland she would be thought a rash bride who went to church without it'/.test(c.lore) && /'was trimmed with white Scotch heather - which flower in Scotland is considered an omen of good fortune'/.test(c.lore) && /often by Romani women/.test(c.lore) && !/traveller/.test(c.lore) && !/Roud/.test(c.source) && c.tier === 'record');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
