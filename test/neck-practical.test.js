// Crying the Neck: the practical half for a harvest field (HSE on Safe Stop,
// children under thirteen, overhead lines and the fatality figures; NHS on
// heat exhaustion; consent for the kiss at the dairy door, Sexual Offences
// Act 2003); and the lore read from Hone's north Devon letter (1826, printed in vol. II, 1827) and
// Hunt: "we have ended", not Hunt's guess; no beam, which neither gives; and
// the Old Cornwall Societies' revival of 1928.
const { CALLERS } = require('../data/callers.js');
const { WHEEL_RITES } = require('../data/wheelRites.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'mabon_crying_the_neck');
check('the old scene kept: the cry rolling across the valley, the run, the supper; hung up in the farmhouse, no beam', c && /"The neck!" three times, long and slow, and then "We yen!"/.test(c.resolution) && /Then you run/.test(c.resolution) && /the neck is hung up in the farmhouse for next year/.test(c.resolution) && !/beam/.test(c.resolution));
check('the caller\'s lore: the harmonious tone, "we have ended" from the old man, the lawful kiss and the bucket, 1928; no "Hunt thought"', /"in a very prolonged and harmonious tone"/.test(c.lore) && /an old man said meant "we have ended"/.test(c.lore) && /"may lawfully kiss her"/.test(c.lore) && /"he is regularly soused with the contents of the bucket"/.test(c.lore) && /1928/.test(c.lore) && !/Hunt thought/.test(c.lore) && /vol\. II \(1827\), 31 August/.test(c.source));
const R = WHEEL_RITES.neck;
check('the rite: "we have ended" from the Devon correspondent; Hunt\'s "often remains"; declining in 1826, revived 1928', /told the Devon correspondent meant "we have ended"/.test(R.lore) && !/Hunt guessed/.test(R.lore) && /"where it often remains for three or four years" \(Hunt\)/.test(R.lore) && /"beginning to decline"/.test(R.lore) && /revived it in 1928/.test(R.lore) && /R\. A\. R\./.test(R.source) && /"The neck!" three times/.test(R.how));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
