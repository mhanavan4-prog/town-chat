// The child passed through the ash: a practical half (NHS on umbilical
// hernia; NHS 111 Wales on when to go to A&E; Cambridge University Hospitals
// and Healthier Together on inguinal hernia in children) and the lore put
// right from White's own letter (Selborne, 1776, printed 1789): no sunrise and
// no tree never felled in White, who cut some down himself; the tree's life
// tied to the child's is Shirley Heath, 1804 (as Frazer quotes it), and
// "before sunrise" is Somerset, 1887 (Elworthy).
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const c = CALLERS.find((x) => x.id === 'through_the_ash');
check('the ash keys sown, not a tree split; the surgeon, not the bonesetter; before sunrise in the plea', c && c.steps[0].item === 'ash_key' && /You don't split a living tree for it/.test(c.resolution) && /the surgeon in the town/.test(c.resolution) && !/bonesetter/.test(c.resolution) && /before sunrise/.test(c.plea));
check('the lore: White\'s cleft pollard-ashes, the naked children, the loam, the cure if the parts coalesced; and that White cut some down', /'a row of pollard-ashes, which by the seams and long cicatrices down their sides, manifestly show that, in former times, they have been cleft asunder'/.test(c.lore) && /'These trees when young and flexible, were severed and held open by wedges, while ruptured children, stripped naked, were pushed through the apertures'/.test(c.lore) && /'was plastered with loam, and carefully swathed up/.test(c.lore) && /'cut down two or three such trees'/.test(c.lore) && !/never felled/.test(c.lore) && !/at sunrise/.test(c.lore));
check('…the life tied to the tree at Shirley Heath, 1804, via Frazer; before sunrise in Somerset, 1887', /'will not suffer a single branch to be touched, for it is believed the life of the patient depends on the life of the tree'/.test(c.lore) && /Gentleman's Magazine, 1804, as Frazer quotes it/.test(c.lore) && /'upon a Sunday morning, before sunrise'/.test(c.lore) && /Elworthy/.test(c.source) && /Frazer/.test(c.source));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
