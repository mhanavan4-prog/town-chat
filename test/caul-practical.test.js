// The caul: a practical half for a lad going to sea (RNLI, "Float to Live";
// the MCA and the RNLI's lifejacket guidance for fishing; the Fishermen's
// Mission), and the lore filled out from the advertisements (Morning Post,
// 1779; Morning Advertiser, 1837; The Times, 1848, as Adkins transcribes
// them), Grose as Thiselton Dyer quotes him (1881), and the rest of Dickens's
// joke. The caul is "a piece of" the amniotic membrane.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'the_caul');
check('the oilskin stays; the practical half: a lifejacket worn on deck, the cylinder checked monthly, serviced yearly', c && /goes to buy the oilskin/.test(c.resolution) && /Then the practical half/.test(c.resolution) && /A lifejacket, worn on deck at all times/.test(c.resolution) && /gas cylinder checked for tightness every month, and the jacket serviced every year/.test(c.resolution) && /MCA/.test(c.source));
check('…cold water shock all year; Float to Live in the RNLI\'s words; 999 or 112 for the Coastguard; the Fishermen\'s Mission', /cold enough for it all year/.test(c.resolution) && /tilt your head back with your ears under, relax and try to breathe normally, and move your hands and feet to stay afloat; it's fine if your legs sink/.test(c.resolution) && /999 or 112 and ask for the Coastguard/.test(c.resolution) && /Fishermen's Mission keeps a 24-hour emergency and welfare line on 0800 634 1020/.test(c.resolution) && /RNLI/.test(c.source));
check('the lore: "a piece of" the membrane; the advertisements of 1779, 1837 and 1848', /a piece of the amniotic membrane/.test(c.lore) && /'To the gentlemen of the Navy, and others going long voyages to sea\. To be disposed of, a child's caul'/.test(c.lore) && /'PRESERVATION at SEA\.- To be SOLD a CAUL, on moderate terms'/.test(c.lore) && /'was afloat with its late owner 30 years in all the perils of a seaman's life'/.test(c.lore) && /The Times \(8 May 1848\)/.test(c.source));
check('…Grose\'s firm and crisp, by way of Thiselton Dyer; the rest of Dickens\'s joke: never drowned, ninety-two, a bridge', /'If alive and well, it is firm and crisp; if dead or sick, relaxed and flaccid'/.test(c.lore) && /Thiselton Dyer/.test(c.source) && /'was never drowned, but died triumphantly in bed, at ninety-two'/.test(c.lore) && /'except upon a bridge'/.test(c.lore));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
