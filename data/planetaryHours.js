// ---------------------------------------------------------------------------
// Planetary Hours (blueprint proposal D).
//
// The classical and medieval system: daylight, sunrise to sunset, is divided
// into twelve EQUAL PARTS, and so is the night — so the "hours" are unequal,
// long by day in summer and short by day in winter (the old horae temporales).
// Each hour is ruled by a planet, taken in Chaldean order — Saturn, Jupiter,
// Mars, the Sun, Venus, Mercury, the Moon, slowest to swiftest — round and
// round without a break. The first hour after sunrise names the day.
//
// Twenty-four hours is three more than three weeks of seven, so each day's
// first hour lands three places further round the Chaldean order: Sun, then
// Moon, Mars, Mercury, Jupiter, Venus, Saturn. That is why the week runs as it
// does — Sunday, Monday, Tuesday (Tiw's day, Mars), Wednesday (Woden's,
// Mercury), Thursday (Thor's, Jupiter), Friday (Frigg's, Venus), Saturday.
//
// The hours need a place on Earth: sunrise and sunset differ by latitude. The
// game reckons them at Greenwich (51.48° N, 0°), so the planetary day lines up
// with the UTC weekday the tea almanac already uses. A planetary day begins at
// SUNRISE, not midnight: before dawn it is still the night of the day before.
// ---------------------------------------------------------------------------

const LAT = 51.48;   // Greenwich
const LON = 0;
const DAY_MS = 86400000;

// Chaldean order, slowest to swiftest. `day` = the weekday each planet rules
// (0 Sunday … 6 Saturday), matching data/teas.js PLANETS.
const CHALDEAN = [
  { key: 'saturn', name: 'Saturn', glyph: '♄', day: 6 },
  { key: 'jupiter', name: 'Jupiter', glyph: '♃', day: 4 },
  { key: 'mars', name: 'Mars', glyph: '♂', day: 2 },
  { key: 'sun', name: 'the Sun', glyph: '☉', day: 0 },
  { key: 'venus', name: 'Venus', glyph: '♀', day: 5 },
  { key: 'mercury', name: 'Mercury', glyph: '☿', day: 3 },
  { key: 'moon', name: 'the Moon', glyph: '☽', day: 1 },
];
const DAY_RULER_INDEX = [3, 6, 2, 5, 1, 4, 0]; // weekday → index into CHALDEAN

const HOUR_LORE = 'Day and night are each cut into twelve equal parts, so the hours stretch and shrink with the seasons. Each is ruled by a planet in Chaldean order — Saturn, Jupiter, Mars, the Sun, Venus, Mercury, the Moon — round without a break, and the first hour after sunrise names the day. Twenty-four hours carry each new day three planets on: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn — the order of the week. Reckoned by the real sun at Greenwich — not Thornreach\'s own quick day and night — and a planetary day begins at sunrise.';

const rad = (d) => d * Math.PI / 180;
const deg = (r) => r * 180 / Math.PI;

// Sunrise and sunset (ms, UTC) at Greenwich for the UTC calendar day holding
// `dayStartMs` (midnight). NOAA-style approximation: solar declination and the
// equation of time from the day of the year, with the standard −0.833° for
// refraction and the sun's disc. Good to a minute or two.
function sunTimes(dayStartMs) {
  const d = new Date(dayStartMs);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const N = Math.round((dayStartMs - start) / DAY_MS);
  const g = (2 * Math.PI / 365) * (N - 1 + 0.5);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const cosH = (Math.sin(rad(-0.833)) - Math.sin(rad(LAT)) * Math.sin(decl)) / (Math.cos(rad(LAT)) * Math.cos(decl));
  const H = deg(Math.acos(Math.max(-1, Math.min(1, cosH))));
  const noonMin = 720 - 4 * LON - eqtime;
  return { rise: dayStartMs + (noonMin - 4 * H) * 60000, set: dayStartMs + (noonMin + 4 * H) * 60000 };
}

// The 24 planetary hours of the planetary day that begins at sunrise on the
// UTC date holding `dayStartMs`. Hours 0–11 are day, 12–23 night.
function planetaryDay(dayStartMs) {
  const today = sunTimes(dayStartMs);
  const tomorrow = sunTimes(dayStartMs + DAY_MS);
  const weekday = new Date(dayStartMs).getUTCDay();
  const first = DAY_RULER_INDEX[weekday];
  const dayLen = (today.set - today.rise) / 12;
  const nightLen = (tomorrow.rise - today.set) / 12;
  const hours = [];
  for (let k = 0; k < 24; k++) {
    const isDay = k < 12;
    const start = isDay ? today.rise + k * dayLen : today.set + (k - 12) * nightLen;
    const p = CHALDEAN[(first + k) % 7];
    hours.push({ n: k, isDay, start: Math.round(start), end: Math.round(start + (isDay ? dayLen : nightLen)), planet: p.key, name: p.name, glyph: p.glyph, planetDay: p.day, weekday });
  }
  return hours;
}

// The hour in force at `now`, plus a run of the hours after it.
function planetaryHourAt(now) {
  const midnight = Math.floor(now / DAY_MS) * DAY_MS;
  for (const ds of [midnight - DAY_MS, midnight]) {
    const h = planetaryDay(ds).find((x) => now >= x.start && now < x.end);
    if (h) return h;
  }
  return planetaryDay(midnight)[0]; // unreachable in practice
}
function planetaryHourSchedule(now, count = 30) {
  const midnight = Math.floor(now / DAY_MS) * DAY_MS;
  const all = [...planetaryDay(midnight - DAY_MS), ...planetaryDay(midnight), ...planetaryDay(midnight + DAY_MS)];
  const i = all.findIndex((x) => now >= x.start && now < x.end);
  return all.slice(Math.max(0, i), Math.max(0, i) + count);
}

module.exports = { CHALDEAN, DAY_RULER_INDEX, HOUR_LORE, sunTimes, planetaryDay, planetaryHourAt, planetaryHourSchedule, LAT, LON };
