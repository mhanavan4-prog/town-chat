// The Moon (lib/calendar.js moonPhaseWindow + data/moon.js) — the lunar phase
// is pure wall-clock math, so drive it with fixed `now` values and assert the
// cycle, the full-moon index, moon-water charging, and the blood-moon override.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { MOON_PHASES, FULL_MOON_INDEX } = require('../data/moon.js');
const { SABBATS } = require('../data/seasons.js');

const CYCLE_MS = 40 * 60 * 1000;   // 20m day + 20m night (matches server)
const DAY_MS = 20 * 60 * 1000;
const LUNAR_MONTH_MS = 20 * 3600 * 1000;
const PHASE_MS = LUNAR_MONTH_MS / MOON_PHASES.length;

const cal = require('../lib/calendar.js')({
  CYCLE_MS, DAY_MS,
  LEGENDARY_EPOCH: Date.UTC(2026, 0, 5), LEGENDARY_WEEK_MS: 7 * 24 * 3600 * 1000,
  legendaryWeekIndex: (now) => Math.floor((now - Date.UTC(2026, 0, 5)) / (7 * 24 * 3600 * 1000)),
  SABBATS, MOON_PHASES, FULL_MOON_INDEX, LUNAR_MONTH_MS
});

// ── Shape ─────────────────────────────────────────────────────────────────────
check('eight phases defined', MOON_PHASES.length === 8, MOON_PHASES.length);
check('full moon index points at the Full Moon', MOON_PHASES[FULL_MOON_INDEX] && MOON_PHASES[FULL_MOON_INDEX].key === 'full', FULL_MOON_INDEX);
check('calendar exposes moonPhaseWindow', typeof cal.moonPhaseWindow === 'function');
check('calendarPublicState carries the moon', !!cal.calendarPublicState(0).moon);

// ── The cycle: 8 consecutive windows yield all 8 phases in order ──────────────
// Anchor on a window that is NOT a blood-moon night so the raw cycle shows.
function isBlood(now) { return cal.bloodMoonWindow(now).active; }
let base = 0;
// walk forward to a window start whose 8-window run contains no blood night
for (let w = 0; w < 10000; w++) {
  const run = Array.from({ length: 8 }, (_, k) => (w + k) * PHASE_MS + 1000);
  if (run.every((t) => !isBlood(t))) { base = w * PHASE_MS; break; }
}
const seen = [];
for (let k = 0; k < 8; k++) {
  const m = cal.moonPhaseWindow(base + k * PHASE_MS + 1000);
  seen.push(m.key);
}
const expectOrder = MOON_PHASES.map((p) => p.key);
// seen should be a rotation of the canonical order (same 8 keys, in cycle order)
const startAt = expectOrder.indexOf(seen[0]);
const rotated = expectOrder.slice(startAt).concat(expectOrder.slice(0, startAt));
check('a full cycle visits all eight phases in order', JSON.stringify(seen) === JSON.stringify(rotated), { seen, rotated });

// ── Full moon: charges moon water; others do not ──────────────────────────────
// Find a full-moon window that is not a blood night.
let fullNow = null;
for (let w = 0; w < 10000; w++) {
  const t = w * PHASE_MS + 1000;
  const m = cal.moonPhaseWindow(t);
  if (m.index === FULL_MOON_INDEX && !m.isBlood) { fullNow = t; break; }
}
const full = cal.moonPhaseWindow(fullNow);
check('full moon is isFull', full.isFull === true);
check('full moon charges moon water', full.chargesMoonWater === true);
check('full moon is not blood (ordinary full)', full.isBlood === false);
const waning = cal.moonPhaseWindow(fullNow + PHASE_MS + 1000); // next window = waning gibbous
check('a non-full phase does not charge moon water', waning.chargesMoonWater === false, waning.key);

// ── Blood moon override: a blood night reads as a Blood (full) Moon ───────────
// Night index 0 is a blood night; night falls at DAY_MS into the cycle.
const bloodNow = DAY_MS + 1000;
check('sanity: that moment is a blood-moon night', isBlood(bloodNow));
const bm = cal.moonPhaseWindow(bloodNow);
check('blood night overrides phase to full', bm.isFull === true && bm.index === FULL_MOON_INDEX, bm);
check('blood night is flagged isBlood', bm.isBlood === true);
check('blood night charges moon water (special full)', bm.chargesMoonWater === true);
check('blood moon glyph is the red moon', bm.glyph === '🔴', bm.glyph);

// ── Determinism ──────────────────────────────────────────────────────────────
const t = 123456789;
check('same now yields same phase', cal.moonPhaseWindow(t).key === cal.moonPhaseWindow(t).key);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
