// Planetary Hours (blueprint proposal D).
//
// The real system, checked against itself and against the sky: hours are
// twelfths of the day and of the night (so unequal through the year); rulers
// run in Chaldean order without a break; the first hour after sunrise names
// the weekday — which is WHY the week runs Sun, Moon, Mars, Mercury, Jupiter,
// Venus, Saturn; a planetary day begins at sunrise, not midnight; the sunrise
// times are right for Greenwich; the HUD gets a run of hours in the calendar;
// and a tea brewed in its own planet's hour really does hold longer.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-hours-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const P = require('../data/planetaryHours');
const { PLANETS, TEAS } = require('../data/teas');
const DAY = 86400000;
const at = (iso) => Date.parse(iso);

// ── The system ────────────────────────────────────────────────────────────
check('Chaldean order, slowest to swiftest', P.CHALDEAN.map((p) => p.key).join(',') === 'saturn,jupiter,mars,sun,venus,mercury,moon');
const weekPlanets = [];
for (let d = 0; d < 7; d++) {
  const midnight = at('2026-11-08T00:00:00Z') + d * DAY; // a Sunday
  const first = P.planetaryDay(midnight)[0];
  weekPlanets.push(first.planet);
  check(`${['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'][d]}day's first hour is ruled by its own planet (${first.name})`, first.planetDay === new Date(midnight).getUTCDay());
}
check('…which is the order of the week: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn', weekPlanets.join(',') === 'sun,moon,mars,mercury,jupiter,venus,saturn');
check('the teas agree on which planet rules which day', P.CHALDEAN.every((c) => PLANETS[c.day].planet.toLowerCase().replace(/^the /, '') === c.name.toLowerCase().replace(/^the /, '')));

// Continuity: hour after hour without a break, day into day.
let breaks = 0, gaps = 0;
for (let d = 0; d < 14; d++) {
  const today = P.planetaryDay(at('2026-11-08T00:00:00Z') + d * DAY);
  const next = P.planetaryDay(at('2026-11-08T00:00:00Z') + (d + 1) * DAY);
  const seq = [...today, next[0]];
  for (let i = 1; i < seq.length; i++) {
    const a = P.CHALDEAN.findIndex((c) => c.key === seq[i - 1].planet), b = P.CHALDEAN.findIndex((c) => c.key === seq[i].planet);
    if ((a + 1) % 7 !== b) breaks++;
    if (Math.abs(seq[i].start - seq[i - 1].end) > 1) gaps++;
  }
}
check('the rulers run in Chaldean order without a break, across days', breaks === 0, breaks);
check('the hours are contiguous — no gaps, no overlaps', gaps === 0, gaps);

// Unequal hours.
const len = (h) => (h.end - h.start) / 60000;
const june = P.planetaryDay(at('2026-06-21T00:00:00Z')), dec = P.planetaryDay(at('2026-12-21T00:00:00Z'));
check('a midsummer day-hour is long (~83 min)', len(june[0]) > 80 && len(june[0]) < 86, len(june[0]));
check('a midwinter day-hour is short (~39 min)', len(dec[0]) > 36 && len(dec[0]) < 42, len(dec[0]));
check('…and the midsummer night-hours are the short ones', len(june[12]) < 40, len(june[12]));

// The sky at Greenwich (sunrise/sunset, UTC).
const near = (ms, hhmm, tol = 3) => { const d = new Date(ms); const m = d.getUTCHours() * 60 + d.getUTCMinutes(); const [H, M] = hhmm.split(':').map(Number); return Math.abs(m - (H * 60 + M)) <= tol; };
const jun = P.sunTimes(at('2026-06-21T00:00:00Z')), dc = P.sunTimes(at('2026-12-21T00:00:00Z')), mar = P.sunTimes(at('2026-03-20T00:00:00Z'));
check('Greenwich midsummer: sunrise ~03:43, sunset ~20:21 UTC', near(jun.rise, '03:43') && near(jun.set, '20:21'));
check('Greenwich midwinter: sunrise ~08:04, sunset ~15:53 UTC', near(dc.rise, '08:04') && near(dc.set, '15:53'));
check('Greenwich equinox: sunrise ~06:03, sunset ~18:12 UTC', near(mar.rise, '06:03') && near(mar.set, '18:12'));

// A planetary day begins at sunrise.
const preDawnFri = at('2026-11-13T05:00:00Z'); // a Friday, before sunrise
const h0 = P.planetaryHourAt(preDawnFri);
check("before sunrise on a Friday it is still Thursday's night", h0.weekday === 4 && h0.isDay === false, h0);
const afterDawn = P.planetaryHourAt(at('2026-11-13T08:00:00Z'));
check("after sunrise, Friday's day — its first hour is Venus's", afterDawn.weekday === 5 && afterDawn.isDay && P.planetaryDay(at('2026-11-13T00:00:00Z'))[0].planet === 'venus');

// ── In the game ───────────────────────────────────────────────────────────
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Astrologer'); connHandler(s);
  say(s, { type: 'join', name: 'Astrologer', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'hours_a'; h.accounts.hours_a = {};

  const cal = s.lastOfType('calendar_state');
  check('the calendar carries a run of planetary hours for the HUD', cal && Array.isArray(cal.calendar.hours) && cal.calendar.hours.length >= 24, cal && cal.calendar && cal.calendar.hours && cal.calendar.hours.length);
  check('…starting with the hour in force now', cal && cal.calendar.hours[0].start <= Date.now() && cal.calendar.hours[0].end > Date.now());
  check('…and the lore that explains them', cal && /Chaldean/.test(cal.calendar.hourLore || ''));
  s.sent.length = 0;
  say(s, { type: 'calendar_state' });
  check('the client can ask for a fresh run', !!s.lastOfType('calendar_state'));

  // A tea in its own hour holds longer. Find a moment in Venus's hour on a
  // day that is NOT Friday, so only the hour bonus is in play.
  const realNow = Date.now;
  let t = at('2026-11-09T00:00:00Z'), venusHour = null; // a Monday
  for (const hr of P.planetaryDay(t)) if (hr.planet === 'venus') { venusHour = hr; break; }
  const marsHour = P.planetaryDay(t).find((x) => x.planet === 'mars');
  const tea = TEAS.find((x) => x.day === 5 && !x.sabbat && !x.requires); // a Venus tea
  const inv = h.getInventory(p);
  const brewAt = (ms) => {
    Date.now = () => ms;
    for (const ing of tea.herbs) h.addItemToAccount(inv, ing.id, ing.qty);
    say(s, { type: 'brew_tea', teaId: tea.id });
    const d = h.accounts.hours_a.teaBuff.until - ms;
    Date.now = realNow;
    return d;
  };
  const inHour = brewAt(venusHour.start + 60000);
  const outHour = brewAt(marsHour.start + 60000);
  check(`a Venus tea brewed in Venus's hour holds ×${h.TEA_HOUR_BONUS} longer`, Math.abs(inHour / outHour - h.TEA_HOUR_BONUS) < 0.01, { inHour, outHour });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
