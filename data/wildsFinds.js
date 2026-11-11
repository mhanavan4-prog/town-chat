// Things to find out in the Wilds, between its landmarks: caches under cairns,
// and six balefires to light. Where each lies is worked out once, the same way
// every time, clear of everything that already stands in the Wilds.
//
// Balefires: fires lit on high ground at the turning points of the year
// (Beltane, Midsummer, Hallowe'en) are among the best recorded customs of
// Britain and Ireland; cattle were driven between two, and brands carried
// round the fields. (R. Hutton, The Stations of the Sun, 1996.) Lighting a
// round of six for a purse is the game's own.
const { CLOOTIE_WELL } = require('./clootie');
const { COUNTLESS } = require('./countlessStones');
const { MEN_AN_TOL } = require('./menAnTol');
const { TROY_TOWN } = require('./troyTown');

const SIZE = 10000;
const KEEP_OFF = [
  [5000, 8800, 1300], [5000, 3000, 900], [2200, 5000, 650], [7800, 5000, 650], [6500, 6200, 450], [2000, 2000, 600], [3000, 3000, 450], [5000, 1500, 600],
  [CLOOTIE_WELL.x, CLOOTIE_WELL.y, 450], [MEN_AN_TOL.x, MEN_AN_TOL.y, 500], [TROY_TOWN.x, TROY_TOWN.y, 650], [COUNTLESS.x, COUNTLESS.y, 450],
  [5000, 8450, 250], [3400, 4300, 250], [6300, 5300, 250], [2650, 2650, 250], [5000, 1600, 250],
  [3800, 7300, 250], [5900, 4300, 250], [2900, 5200, 250], [2350, 2350, 250], [7300, 3300, 250],
  [1200, 1500, 350], [3500, 2800, 350], [6000, 1200, 350], [2000, 7000, 350], [7500, 4000, 350], [6300, 9150, 350], [8200, 8200, 350], [900, 6500, 350],
];
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clear = (x, y, placed, gap) => KEEP_OFF.every(([kx, ky, r]) => Math.hypot(x - kx, y - ky) > r) && placed.every((p) => Math.hypot(x - p.x, y - p.y) > gap);

function build() {
  const rand = mulberry(0xBA1EF12E);
  const placed = [];
  // six balefires, one to each sixth of the Wilds (three across, two down), so lighting them all is a walk round the whole of it
  const balefires = [];
  for (let k = 0; k < 6; k++) {
    const cx = (k % 3) * (SIZE / 3), cy = Math.floor(k / 3) * (SIZE / 2);
    for (let tries = 0; tries < 400; tries++) {
      const x = Math.round(cx + 700 + rand() * (SIZE / 3 - 1400)), y = Math.round(cy + 700 + rand() * (SIZE / 2 - 1400));
      if (!clear(x, y, placed, 1500)) continue;
      const f = { id: 'bale' + (k + 1), x, y }; balefires.push(f); placed.push(f); break;
    }
  }
  // fourteen caches, scattered
  const caches = [];
  for (let tries = 0; tries < 4000 && caches.length < 14; tries++) {
    const x = Math.round(600 + rand() * (SIZE - 1200)), y = Math.round(600 + rand() * (SIZE - 1200));
    if (!clear(x, y, placed, 900)) continue;
    const c = { id: 'wcache' + (caches.length + 1), x, y }; caches.push(c); placed.push(c);
  }
  return { balefires, caches };
}
const WILDS_FINDS = build();
// A cache is yours once in six hours; a round of balefires once a day.
const WILDS_FIND_RULES = { range: 95, cacheAgainMs: 6 * 60 * 60 * 1000, cacheGold: [4, 9], cacheGoods: ['bone_shard', 'fur_scrap', 'iron_ore', 'glimmerdust'], fireXp: 8, roundGold: 40, roundXp: 60 };

module.exports = { WILDS_FINDS, WILDS_FIND_RULES, WILDS_FINDS_KEEP_OFF: KEEP_OFF };
