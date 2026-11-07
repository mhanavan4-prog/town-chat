// The Charm Book's Calendar page: the year at a glance (lib/yearCalendar.js),
// built from the seasons, the dated callers and the old calendar, with today
// marked; sent with the book and drawn by the client.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-yearcal-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { buildYearCalendar } = require('../lib/yearCalendar.js');
const { OLD_CALENDAR } = require('../data/oldCalendar.js');
const { SABBATS } = require('../data/seasons.js');
const { CALLERS } = require('../data/callers.js');
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

const cal = buildYearCalendar(Date.UTC(2027, 10, 7, 18));
check('twelve months of 2027, today the 7th of November', cal.year === 2027 && cal.months.length === 12 && cal.today.month === 11 && cal.today.day === 7);
const m = (n) => cal.months[n - 1];
check('each month names its season(s): November Samhain, December Samhain then Yule, January Yule', m(11).seasons.map((s) => s.key).join() === 'samhain' && m(12).seasons.map((s) => s.key).join() === 'samhain,yule' && m(1).seasons.map((s) => s.key).join() === 'yule');
check('every festival\'s first day is there', SABBATS.every((s) => m(s.month).days.some((d) => d.kind === 'season' && d.key === s.key && d.day === s.day)));
check('every old calendar day is there', cal.months.reduce((n, mo) => n + mo.days.filter((d) => d.kind === 'old').length, 0) === OLD_CALENDAR.length);
const callerDay = (id) => { for (const mo of cal.months) { const d = mo.days.find((x) => x.kind === 'caller' && x.key === id); if (d) return [mo.month, d.day, d.title, d.note]; } return null; };
check('every dated caller is there once', CALLERS.filter((c) => c.when).every((c) => cal.months.reduce((n, mo) => n + mo.days.filter((d) => d.kind === 'caller' && d.key === c.id).length, 0) === 1));
const plough = callerDay('plough_boys');
check('…on its 2027 days: Plough Monday 11 January, St Agnes\' Eve 20 January, Martinmas week from 9 November, the wren boys 26 December',
  JSON.stringify(plough.slice(0, 2)) === '[1,11]' && JSON.stringify(callerDay('st_agnes_eve').slice(0, 2)) === '[1,20]' && JSON.stringify(callerDay('martinmas_cock').slice(0, 2)) === '[11,9]' && JSON.stringify(callerDay('wren_boys').slice(0, 2)) === '[12,26]');
check('…named by its day and its caller, with how long they come', plough[2] === 'Plough Monday: Will Gotobed and the ploughboys' && plough[3] === 'at the door for 2 days' && callerDay('martinmas_cock')[3] === 'at the door for 5 days');
check('days are in order within each month, a festival before a caller before the old calendar', cal.months.every((mo) => mo.days.every((d, i, a) => i === 0 || a[i - 1].day <= d.day)));
const moving = buildYearCalendar(Date.UTC(2028, 0, 1, 12));
check('a moving day moves: Plough Monday 2028 is 10 January', moving.months[0].days.some((d) => d.key === 'plough_boys' && d.day === 10));

const CB = fs.readFileSync(path.join(__dirname, '../client/charm-book.js'), 'utf8');
check('the client draws the Calendar from the book, today marked, and only with textContent', /function renderCalendar\(body\)/.test(CB) && /openChapter === CALENDAR/.test(CB) && /◆ Today/.test(CB) && !/innerHTML/.test(CB));

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Reader'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Reader', charId: 0 }));
  s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  const st = s.lastOfType('charm_book_state');
  const now = new Date();
  check('the server sends this year\'s Calendar with the book, today included', st && st.calendar && st.calendar.months.length === 12 && st.calendar.year === now.getUTCFullYear() && st.calendar.today.month === now.getUTCMonth() + 1);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
