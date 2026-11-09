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
check('the practical half: farming\'s death rate; Safe Stop before a jammed machine; no child under thirteen on a tractor or combine', /Then the practical half, for a harvest field/.test(c.resolution) && /Farming kills more workers for its size than any other trade in Britain/.test(c.resolution) && /handbrake on, controls in neutral, engine off, key out, and wait for everything to stop turning/.test(c.resolution) && /No child under thirteen rides on or drives a tractor or a combine/.test(c.resolution));
check('…overhead lines: clear of them; touched, stay in and ring 105, or jump clear', /stay in the cab and ring 105/.test(c.resolution) && /jump clear without touching it and the ground at once/.test(c.resolution));
check('…heat exhaustion: its signs, shade, water, sponged and fanned; 999 after half an hour, hot dry skin or confusion', /tiredness, a headache, dizziness, cramps or a great thirst is heat exhaustion/.test(c.resolution) && /into the shade, clothes loosened, water, skin sponged and fanned/.test(c.resolution) && /no better in half an hour, or the skin is hot and dry, or they're confused, ring 999/.test(c.resolution));
check('…the kiss is Loveday\'s to give; without agreement it can be sexual assault; cited', /the kiss at the dairy door is Loveday's to give: kissing someone who hasn't agreed can be sexual assault/.test(c.resolution) && /HSE, "Safe use of machinery"/.test(c.source) && /NHS, "Heat exhaustion and heatstroke"/.test(c.source) && /Sexual Offences Act 2003, ss\. 3, 74/.test(c.source));
check('the caller\'s lore: the harmonious tone, "we have ended" from the old man, the lawful kiss and the bucket, 1928; no "Hunt thought"', /"in a very prolonged and harmonious tone"/.test(c.lore) && /an old man said meant "we have ended"/.test(c.lore) && /"may lawfully kiss her"/.test(c.lore) && /"he is regularly soused with the contents of the bucket"/.test(c.lore) && /1928/.test(c.lore) && !/Hunt thought/.test(c.lore) && /vol\. II \(1827\), 31 August/.test(c.source));
const R = WHEEL_RITES.neck;
check('the rite: "we have ended" from the Devon correspondent; Hunt\'s "often remains"; declining in 1826, revived 1928', /told the Devon correspondent meant "we have ended"/.test(R.lore) && !/Hunt guessed/.test(R.lore) && /"where it often remains for three or four years" \(Hunt\)/.test(R.lore) && /"beginning to decline"/.test(R.lore) && /revived it in 1928/.test(R.lore) && /R\. A\. R\./.test(R.source) && /"The neck!" three times/.test(R.how));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
