// A year at the door: walk every day of a year (and a second, for the moving
// days) through the real caller logic and check that every caller can come,
// that seasonal callers come only in their season and dated callers only on
// their days (first at the door), that each day has three callers and no
// repeats, and how often the everyday callers turn up.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-calleryear-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CALLERS } = require('../data/callers.js');
const { nextWindow } = require('../lib/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
const DAY = 86400000;
const byId = Object.fromEntries(CALLERS.map((c) => [c.id, c]));
const dated = CALLERS.filter((c) => c.when);
const seasonal = CALLERS.filter((c) => c.season);
const everyday = CALLERS.filter((c) => !c.when && !c.season);

check('every caller is everyday, seasonal or dated, never both', CALLERS.every((c) => !(c.when && c.season)));
check('caller ids are unique', new Set(CALLERS.map((c) => c.id)).size === CALLERS.length);

// Which dated windows overlap, in either year.
const overlaps = [];
for (const y of [2027, 2028]) {
  const wins = dated.map((c) => ({ id: c.id, ...nextWindow(c.when, Date.UTC(y, 0, 1)) }));
  for (let i = 0; i < wins.length; i++) for (let j = i + 1; j < wins.length; j++) {
    if (wins[i].start < wins[j].end && wins[j].start < wins[i].end) overlaps.push([y, wins[i].id, wins[j].id]);
  }
}
// Two dated days can fall together (Plough Monday on old Hogmanay); then both
// callers come, which the day-by-day walk below checks.
console.log(`  dated days falling together in 2027–28: ${overlaps.map((o) => o.join(' ')).join('; ') || 'none'}`);

// Everything a caller's working writes is in the Charm Book: the caller's own
// entry, and every charm and rite on the way.
const { buildCharmBook } = require('../lib/charmBook.js');
const { writesOf } = require('../lib/whereNext.js');
const book = buildCharmBook({ acct: {}, prog: {}, seasonKey: null });
const has = (w) => book.chapters.some((ch) => (!w.chapter || ch.key === w.chapter) && ch.entries.some((e) => e.id === w.id));
const lost = [];
for (const c of CALLERS) for (const w of writesOf(c)) if (!has(w)) lost.push(`${c.id}: ${w.chapter || 'rite'} ${w.id}`);
check('every caller, charm and rite a working writes has its place in the Charm Book', lost.length === 0, lost);
check('the Callers at the Door chapter has every caller', book.chapters.find((ch) => ch.key === 'callers').total === CALLERS.length);

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Almanac'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Almanac', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'almanac'; h.accounts.almanac = {}; h.playerProgress.almanac = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };

  const seen = {};
  const bad = { count: [], dupe: [], season: [], datedOff: [], datedNotFirst: [], seasonNotFirst: [], noSeason: [] };
  const seasonDays = {};
  for (const y of [2027, 2028]) {
    for (let t = Date.UTC(y, 0, 1, 12); t < Date.UTC(y + 1, 0, 1); t += DAY) {
      const day = new Date(t).toISOString().slice(0, 10);
      const { ids, season } = at(t, () => {
        const st = h.callers.stateOf(p); st.active = null;
        const se = h.calendarPublicState().season;
        return { ids: h.callers.offeredIds(p, st), season: se && se.key };
      });
      if (!season) bad.noSeason.push(day);
      seasonDays[season] = (seasonDays[season] || 0) + 1;
      if (ids.length !== 3) bad.count.push([day, ids]);
      if (new Set(ids).size !== ids.length) bad.dupe.push([day, ids]);
      for (const id of ids) {
        const c = byId[id];
        (seen[id] = seen[id] || []).push(day);
        if (c.season && c.season !== season) bad.season.push([day, id, season]);
      }
      const datedToday = dated.filter((c) => { const w = nextWindow(c.when, t); return w && w.start <= t && t < w.end; }).map((c) => c.id);
      for (const id of ids) if (byId[id].when && !datedToday.includes(id)) bad.datedOff.push([day, id]);
      if (datedToday.length && !datedToday.every((id, k) => ids.slice(0, datedToday.length).includes(id) && k >= 0)) bad.datedNotFirst.push([day, ids, datedToday]);
      const hasSeasonal = seasonal.some((c) => c.season === season);
      if (hasSeasonal) {
        const slot = datedToday.length;
        if (!byId[ids[slot]] || byId[ids[slot]].season !== season) bad.seasonNotFirst.push([day, ids]);
      }
    }
  }
  check('every day of two years falls in a festival season', bad.noSeason.length === 0, bad.noSeason.slice(0, 3));
  check('…and every season has callers of its own', Object.keys(seasonDays).every((k) => seasonal.some((c) => c.season === k)), Object.keys(seasonDays).filter((k) => !seasonal.some((c) => c.season === k)));
  check('three callers at the door every day', bad.count.length === 0, bad.count.slice(0, 3));
  check('nobody at the door twice in one day', bad.dupe.length === 0, bad.dupe.slice(0, 3));
  check('a seasonal caller comes only in its season', bad.season.length === 0, bad.season.slice(0, 3));
  check('a dated caller comes only on its days', bad.datedOff.length === 0, bad.datedOff.slice(0, 3));
  check('…and on its days, first at the door (all of them, when two fall together)', bad.datedNotFirst.length === 0, bad.datedNotFirst.slice(0, 3));
  check('in a season, one of its callers comes every day (after a dated one, if any)', bad.seasonNotFirst.length === 0, bad.seasonNotFirst.slice(0, 3));
  const never = CALLERS.filter((c) => !seen[c.id]).map((c) => c.id);
  check(`all ${CALLERS.length} callers reach the door in two years`, never.length === 0, never);
  // Each dated caller on every day of its window, both years.
  const datedCounts = dated.map((c) => {
    const want = [2027, 2028].reduce((n, y) => { const w = nextWindow(c.when, Date.UTC(y, 0, 1)); return n + Math.round((w.end - w.start) / DAY); }, 0);
    return [c.id, (seen[c.id] || []).length, want];
  });
  check('each dated caller comes on every day of its window', datedCounts.every(([, n, want]) => n === want), datedCounts.filter(([, n, want]) => n !== want));
  // How often the everyday callers come, for one player over two years.
  const counts = everyday.map((c) => (seen[c.id] || []).length).sort((a, b) => a - b);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  console.log(`  everyday callers: ${everyday.length}; days at the door in two years: min ${counts[0]}, mean ${mean.toFixed(1)}, max ${counts[counts.length - 1]}`);
  check('every everyday caller comes at least a dozen times in two years', counts[0] >= 12, counts.slice(0, 5));
  // Each seasonal caller, in its own season.
  const seasonalCounts = seasonal.map((c) => [c.id, (seen[c.id] || []).length]);
  check('every seasonal caller comes in its season', seasonalCounts.every(([, n]) => n > 0), seasonalCounts.filter(([, n]) => !n));
  console.log(`  seasonal callers: days at the door in two years: ${seasonalCounts.map(([id, n]) => `${id} ${n}`).join(', ')}`);
  // A working taken on its day can still be finished after the day has gone.
  const wren = byId.wren_boys;
  at(Date.UTC(2027, 11, 26, 12), () => { const st = h.callers.stateOf(p); st.active = { id: wren.id, done: { 0: 'ivy' } }; });
  const after = at(Date.UTC(2027, 11, 29, 12), () => {
    const st = h.callers.stateOf(p);
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
    return { offered: h.callers.offeredIds(p, st), step: h.callers.callersStatePayload(p).active.steps[1] };
  });
  check('a dated working taken on its day stays at the door, and can be worked, after its day', after.offered[0] === 'wren_boys' && after.offered.length === 4 && after.step.done, after);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
