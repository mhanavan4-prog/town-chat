// The becalmed skipper: a practical half (HM Coastguard, "Onboard safety";
// the RNLI; the MCA's MGN 588 (F) on lifejackets for fishers; the Met Office's
// inshore waters forecast) and the lore put right: Higden's Manx "thre knottes
// of threde" (Trevisa's English, as Coulton and Moore quote it), the graded
// winds as Finland's (Frazer, 1890, from Olaus Magnus), Macbeth, and Scott's
// Bessie Millie (Lockhart, 1837). No "cord", and no Calf of Man.
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'becalmed');
check('the wind in three knots of thread, none loosed; a woman in the Island, not the Calf', c && c.steps[0].item === 'wind_cord_3' && /three knots of thread/.test(c.steps[0].label) && /a woman in the Island/.test(c.plea) && !/Calf of Man/.test(c.plea + c.lore) && /Nobody looses the third/.test(c.resolution));
check('the practical half: the inshore forecast, the Isle of Man\'s own area; lifejackets on deck, required since 2018, four times likelier to survive', /Then the practical half/.test(c.resolution) && /inshore waters forecast before you sail; the Isle of Man has its own area/.test(c.resolution) && /on a UK fishing boat it's been required since 2018/.test(c.resolution) && /four times more likely to survive/.test(c.resolution) && /MGN 588/.test(c.source));
check('…tell someone ashore; a means of calling for help and a beacon; Mayday on 16 or 999 for the Coastguard; Float to Live', /Tell someone ashore where you're going and when you'll be back/.test(c.resolution) && /personal locator beacon/.test(c.resolution) && /send a Mayday on Channel 16, or ring 999 and ask for the Coastguard/.test(c.resolution) && /Float to Live: head back with the ears under/.test(c.resolution) && /HM Coastguard/.test(c.source));
check('the lore: Higden\'s Man in Trevisa\'s English; Finland\'s graded knots from Olaus Magnus; Lewis, Man, Shetland as Frazer has them', /'wommen there sellith schipmen wynde, as it were i-closed under thre knottes of threde; so that the more wynd he wol have, he wil unknette the mo knottes\.'/.test(c.lore) && /In Finland, as Frazer gives it from Olaus Magnus/.test(c.lore) && /'if they undid the first knot, a moderate wind sprang up; if the second, it blew half a gale; if the third, a hurricane\.'/.test(c.lore) && /'Shetland seamen still buy winds from old women who claim to rule the storms'/.test(c.lore) && !/a cord with three knots/.test(c.lore) && /Higden/.test(c.source));
check('…Macbeth\'s witches in the Folio; Scott\'s Bessie Millie, her sixpence and kettle, and her charm that failed', /'Ile giue thee a Winde\.' 'Th'art kinde'/.test(c.lore) && /Bessy Millie, 'upwards of ninety'/.test(c.lore) && /'and she boils her kettle to procure a favourable gale'/.test(c.lore) && /'Bessy Millie's charm has failed us\.'/.test(c.lore) && /Lockhart/.test(c.source) && c.tier === 'record');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
