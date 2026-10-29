// Correspondences engine (data/correspondences.js) — altarAlignment scores how
// well an altar + the moment align with a blessing, returning the bonus that
// scales its strength. Pure function, so drive it directly.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { altarAlignment, RITUAL_DECOS, DAY_RITUAL, ALIGN } = require('../data/correspondences.js');

// A bare altar on an ordinary day gives the plain blessing.
const bare = altarAlignment({ ritualId: 'ward', decos: [], moon: { key: 'first_quarter', isFull: false }, day: 0, offered: false });
check('bare altar = no bonus', bare.bonus === 0, bare);

// Each matching decoration adds perDeco; duplicates do not double-count.
const wardDecos = RITUAL_DECOS.ward; // ['pentacle','skull']
const twoSymbols = altarAlignment({ ritualId: 'ward', decos: wardDecos.slice(), moon: {}, day: null, offered: false });
check('two attuned symbols add 2× perDeco', Math.abs(twoSymbols.bonus - 2 * ALIGN.perDeco) < 1e-9, twoSymbols);
const dupSymbols = altarAlignment({ ritualId: 'ward', decos: ['pentacle', 'pentacle'], moon: {}, day: null, offered: false });
check('a duplicated symbol counts once', Math.abs(dupSymbols.bonus - ALIGN.perDeco) < 1e-9, dupSymbols);
const wrongSymbols = altarAlignment({ ritualId: 'ward', decos: ['chalice', 'candles'], moon: {}, day: null, offered: false });
check('symbols for another rite give nothing', wrongSymbols.bonus === 0, wrongSymbols);

// The full moon lifts any rite; a favouring phase lifts the ones it favours.
const full = altarAlignment({ ritualId: 'vigor', decos: [], moon: { key: 'full', isFull: true }, day: null, offered: false });
check('full moon adds the full-moon bonus', Math.abs(full.bonus - ALIGN.fullMoon) < 1e-9, full);
const favored = altarAlignment({ ritualId: 'forage', decos: [], moon: { key: 'waxing_gibbous', isFull: false }, day: null, offered: false });
check('a favouring phase adds moonFavor', Math.abs(favored.bonus - ALIGN.moonFavor) < 1e-9, favored);
const unfavored = altarAlignment({ ritualId: 'ward', decos: [], moon: { key: 'waxing_gibbous', isFull: false }, day: null, offered: false });
check('a phase that does not favour the rite adds nothing', unfavored.bonus === 0, unfavored);

// The planetary day: Thursday (4) favours fortune.
check('DAY_RITUAL maps Thursday to fortune', DAY_RITUAL[4] === 'fortune');
const onDay = altarAlignment({ ritualId: 'fortune', decos: [], moon: {}, day: 4, offered: false });
check('working on its planetary day adds dayMatch', Math.abs(onDay.bonus - ALIGN.dayMatch) < 1e-9, onDay);

// An offering adds its bonus.
const offering = altarAlignment({ ritualId: 'vigor', decos: [], moon: {}, day: null, offered: true });
check('an offering adds the offering bonus', Math.abs(offering.bonus - ALIGN.offering) < 1e-9, offering);

// Everything aligned caps at ALIGN.cap and lists its reasons.
const stacked = altarAlignment({ ritualId: 'fortune', decos: RITUAL_DECOS.fortune.slice(), moon: { key: 'full', isFull: true }, day: 4, offered: true });
check('a fully-aligned rite caps at the max bonus', stacked.bonus === ALIGN.cap, stacked);
check('a fully-aligned rite lists its reasons', Array.isArray(stacked.reasons) && stacked.reasons.length >= 3, stacked.reasons);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
