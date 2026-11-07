// ---------------------------------------------------------------------------
// The Charm Book's Calendar page: the whole year at a glance. For each month,
// the festival season(s) it lies in, the days a caller comes only then (the
// dated callers, data/callers.js `when`), the festivals' own first days, and
// the old calendar's customs (data/oldCalendar.js), with today marked. Built
// from the same data the game runs on, so it can't disagree with the Board or
// the Commonplace Book. Pure: the server passes in the moment. (It is called
// the Calendar because the garden already has an Almanac, of herbs.)
// ---------------------------------------------------------------------------
const { SABBATS } = require('../data/seasons');
const { OLD_CALENDAR, entryDate } = require('../data/oldCalendar');
const { CALLERS } = require('../data/callers');
const { nextWindow } = require('./callers');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_MS = 86400000;

function buildYearCalendar(now = Date.now()) {
  const t = new Date(now);
  const y = t.getUTCFullYear();
  const today = { month: t.getUTCMonth() + 1, day: t.getUTCDate() };
  const sabbats = SABBATS.slice().sort((a, b) => a.month - b.month || a.day - b.day);
  // Which season a date lies in: the last sabbat on or before it (wrapping to Yule).
  const seasonOn = (m, d) => {
    let s = sabbats[sabbats.length - 1];
    for (const x of sabbats) if (x.month < m || (x.month === m && x.day <= d)) s = x;
    return s;
  };
  const months = MONTHS.map((name, i) => ({ month: i + 1, name, seasons: [], days: [] }));
  for (const mo of months) {
    const last = new Date(Date.UTC(y, mo.month, 0)).getUTCDate();
    const keys = [];
    for (const d of [1, last]) { const s = seasonOn(mo.month, d); if (!keys.includes(s.key)) keys.push(s.key); }
    for (const s of sabbats) if (s.month === mo.month && !keys.includes(s.key)) keys.splice(keys.length - 1, 0, s.key);
    mo.seasons = keys.map((k) => { const s = sabbats.find((x) => x.key === k); return { key: k, name: s.name, glyph: s.glyph }; });
  }
  const add = (m, d, item) => months[m - 1].days.push({ day: d, ...item });
  // The festivals' first days.
  for (const s of sabbats) add(s.month, s.day, { kind: 'season', icon: s.glyph, title: `${s.name} begins`, key: s.key });
  // The dated callers, on the first day they come.
  for (const c of CALLERS) {
    if (!c.when) continue;
    const w = nextWindow(c.when, Date.UTC(y, 0, 1));
    if (!w) continue;
    const ws = new Date(w.start);
    if (ws.getUTCFullYear() !== y) continue;
    const days = Math.round((w.end - w.start) / DAY_MS);
    const cal = c.when.calendar && OLD_CALENDAR.find((e) => e.key === c.when.calendar);
    const label = c.when.label || (cal ? cal.title.split(':')[0] : '');
    add(ws.getUTCMonth() + 1, ws.getUTCDate(), { kind: 'caller', icon: c.icon, title: label ? `${label}: ${c.caller}` : c.caller, note: days > 1 ? `at the door for ${days} days` : 'at the door that day', key: c.id });
  }
  // The old calendar.
  for (const e of OLD_CALENDAR) {
    const [m, d] = entryDate(e, y);
    add(m, d, { kind: 'old', icon: e.icon, title: e.title, key: e.key });
  }
  const order = { season: 0, caller: 1, old: 2 };
  for (const mo of months) mo.days.sort((a, b) => a.day - b.day || order[a.kind] - order[b.kind]);
  return { year: y, today, months };
}

module.exports = { buildYearCalendar };
