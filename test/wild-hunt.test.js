// lib/wildHunt.js: one course a night, the same for everyone; each rider's
// place in it her own; titles and a wake for nights ridden, and nothing else.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const fs = require('fs'), path = require('path');
const { HUNT, HUNT_LORE, HUNT_WAKES } = require('../data/wildHunt');
const { TITLES } = require('../data/titles');

function world() {
  const accounts = { ada: {} }, players = new Map(), sent = [], titles = [];
  let night = true, id = 7, t = 1000000, saves = 0;
  const W = require('../lib/wildHunt')({ players, send: (ws, m) => sent.push([ws.id, m]), isNight: () => night, nightId: () => id, hasBesom: (p) => p.level >= 20,
    accountOf: (p) => (p.accountKey ? accounts[p.accountKey] : null), grantTitle: (p, tid) => titles.push(tid), save: () => { saves++; }, now: () => t });
  const mk = (pid, key, level = 20) => { const p = { id: pid, accountKey: key, level, room: 'wilds', mounted: true, x: 0, y: 0, besomAlt: 26, ws: { id: pid } }; players.set(pid, p); return p; };
  const rideAll = (p) => { for (const r of W.course(id)) { p.x = r.x; p.y = r.y; p.besomAlt = r.alt; t += 20000; W.at(p); } };
  return { W, accounts, sent, titles, mk, rideAll, setNight: (n) => { night = n; }, nextNight: () => { id++; }, id: () => id, saves: () => saves, last: (pid) => [...sent].reverse().find((e) => e[0] === pid)[1] };
}

{
  const w = world(); const c = w.W.course(7), again = w.W.course(7), other = w.W.course(8);
  check('a night has nine horns', c.length === HUNT.rings);
  check('the same night gives the same course', JSON.stringify(c) === JSON.stringify(again));
  check('another night gives another', JSON.stringify(c) !== JSON.stringify(other));
  check('every horn is inside the Wilds and above the ground', c.every((r) => r.x > HUNT.margin - 1 && r.x < 10000 - HUNT.margin + 1 && r.y > HUNT.margin - 1 && r.y < 10000 - HUNT.margin + 1 && r.alt >= HUNT.minAlt && r.alt <= HUNT.maxAlt));
  check('above where anything on the ground can reach', HUNT.minAlt > require('../lib/besomMount').MOUNT.safe);
  let ok = true; for (let n = 0; n < 200; n++) { const k = w.W.course(1000 + n); for (let i = 1; i < k.length; i++) { const d = Math.hypot(k[i].x - k[i - 1].x, k[i].y - k[i - 1].y); if (d > HUNT.stride[1] * 1.5 || d < 200) ok = false; } }
  check('each horn is a fair ride from the last, over 200 nights', ok);
}

{
  const w = world(); const ada = w.mk('1', 'ada'), low = w.mk('2', 'ada2', 12);
  check('without the besom there is no Hunt', w.W.state(low) === null);
  const s = w.W.state(ada);
  check('with it, by night, she is shown the course and its lore', s.rings.length === 9 && s.next === 0 && s.lore.tier === 'record' && s.total === 9);
  const c = w.W.course(w.id());
  ada.x = c[1].x; ada.y = c[1].y; ada.besomAlt = c[1].alt;
  check('the horns are ridden in order: the second does not count first', w.W.at(ada) === false);
  ada.x = c[0].x; ada.y = c[0].y; ada.besomAlt = c[0].alt + HUNT.reach + 20;
  check('too high over a horn does not count', w.W.at(ada) === false);
  ada.besomAlt = c[0].alt; ada.mounted = false;
  check('nor on foot', w.W.at(ada) === false);
  ada.mounted = true;
  check('through the first horn', w.W.at(ada) === true && w.last('1').passed === 1 && w.last('1').next === 1 && w.last('1').sfx === 'hunt_horn');
  check('the same horn does not count twice', w.W.at(ada) === false);
  // a dropped connection: a new player object for the same account
  const again = w.mk('9', 'ada'); again.x = c[1].x; again.y = c[1].y; again.besomAlt = c[1].alt;
  check('a reconnect keeps the horns already ridden', w.W.state(again).next === 1 && w.W.at(again) === true && w.W.state(again).next === 2);
}

{
  const w = world(); const ada = w.mk('1', 'ada');
  w.rideAll(ada);
  const m = w.last('1');
  check('all nine: she has ridden with the Hunt', m.finished === true && m.done === true && /ridden with the Wild Hunt/.test(m.message) && m.secs === 160);
  check('the first night gives a title and a wake', w.titles.join() === 'hunt_rider' && w.accounts.ada.hunt.nights === 1 && w.accounts.ada.hunt.wake === 'ash' && w.saves() === 1);
  w.rideAll(ada);
  check('one ride a night is counted', w.accounts.ada.hunt.nights === 1);
  w.nextNight(); w.rideAll(ada); w.nextNight(); w.rideAll(ada);
  check('three nights give the second honour', w.accounts.ada.hunt.nights === 3 && w.titles.join() === 'hunt_rider,hunt_horn' && w.W.state(ada).wakes.join() === 'ash,frost');
  check('she may wear a wake she has earned, or none', w.W.setWake(ada, 'frost').ok && w.W.wakeOf(ada) === 'frost' && w.W.setWake(ada, null).ok && w.W.wakeOf(ada) === null);
  check('and not one she has not', !!w.W.setWake(ada, 'moon').error);
  check('the best time is kept', w.accounts.ada.hunt.best === 160);
}

{
  const w = world(); const g = w.mk('3', null);
  w.rideAll(g);
  check('a guest may ride, and is told it is not kept', /guest/.test(w.last('3').message) && w.titles.length === 0);
  w.setNight(false);
  check('by day there is no course', w.W.state(g).rings.length === 0 && w.W.at(g) === false);
}

{
  const w = world(); w.mk('1', 'ada'); w.mk('2', 'x', 5);
  w.setNight(false); w.W.tick(); w.sent.length = 0;
  w.setNight(true); w.W.tick();
  check('at nightfall those with the besom hear the horns, once', w.sent.length === 1 && w.sent[0][0] === '1' && /Wild Hunt rides tonight/.test(w.sent[0][1].message));
  w.W.tick(); check('and not again the same night', w.sent.length === 1);
}

{
  check('the lore says what is the record and what is the game\'s', HUNT_LORE.tier === 'record' && /1127/.test(HUNT_LORE.source) && /the game's/.test(HUNT_LORE.note));
  check('every rank has a title that exists and a wake that exists', HUNT.ranks.every((r) => TITLES[r.title] && HUNT_WAKES[r.wake]));
  check('the Hunt gives nothing but titles and wakes', !/grantXP|gold|balance|addItem/.test(fs.readFileSync(path.join(__dirname, '..', 'lib/wildHunt.js'), 'utf8')));
}
{
  // The night company: a coven riding together.
  const { COMPANY, COMPANY_LORE } = require('../data/wildHunt');
  const accounts = { ada: {}, bea: {}, cyd: {} }, players = new Map(), sent = [], titles = [], told = [];
  const coven = { id: 'c1', name: 'The Thorns', members: ['ada', 'bea'] };
  let saved = 0, t = 5000000;
  const W = require('../lib/wildHunt')({ players, send: (ws, m) => sent.push([ws.id, m]), isNight: () => true, nightId: () => 3, hasBesom: () => true,
    accountOf: (p) => accounts[p.accountKey] || null, grantTitle: (p, tid) => titles.push(p.accountKey + ':' + tid), now: () => t,
    covenOf: (p) => (coven.members.includes(p.accountKey) ? coven : null), saveCoven: () => { saved++; }, covenTell: (cv, m) => told.push(m) });
  const mk = (id, key) => { const p = { id, name: key, accountKey: key, room: 'wilds', mounted: true, x: 0, y: 0, besomAlt: 0, ws: { id } }; players.set(id, p); return p; };
  const ada = mk('1', 'ada'), bea = mk('2', 'bea'), cyd = mk('3', 'cyd');
  const c = W.course(3);
  const put = (p, r, dx = 0) => { p.x = r.x + dx; p.y = r.y; p.besomAlt = r.alt; };
  put(ada, c[0]); put(bea, c[0], COMPANY.reach - 50); put(cyd, c[0], 300);
  bea.besomAlt = 26;   // riding beside her, far below the horn
  W.at(ada);
  check('a horn one of the coven rides through counts for another of it riding close', W.state(bea).next === 1 && /counts for you/.test([...sent].reverse().find((e) => e[0] === '2')[1].message));
  check('and not for someone of no coven riding just as close', W.state(cyd).next === 0);
  put(ada, c[1]); put(bea, c[1], COMPANY.reach + 400); W.at(ada);
  check('too far off, she must ride it herself', W.state(ada).next === 2 && W.state(bea).next === 1);
  put(bea, c[1]); W.at(bea);
  check('riding it herself does not count twice for the one ahead', W.state(ada).next === 2 && W.state(bea).next === 2);
  for (let i = 2; i < c.length; i++) { put(ada, c[i]); put(bea, c[i], 100); t += 10000; W.at(ada); }
  check('both finish, and the coven has ridden in company', accounts.ada.hunt.nights === 1 && accounts.bea.hunt.nights === 1 && coven.huntNights === 1 && saved === 1 && told.length === 1 && /in company/.test(told[0]));
  check('each of the company is given its title, once', titles.filter((x) => /hunt_company/.test(x)).sort().join() === 'ada:hunt_company,bea:hunt_company');
  check('the panel is told of the company', W.state(ada).company.coven === 'The Thorns' && W.state(ada).company.nights === 1 && W.state(ada).company.tonight === 2 && W.state(cyd).company.coven === null);
  check('the company has its lore, and says what is the game\'s', COMPANY_LORE.tier === 'record' && /906/.test(COMPANY_LORE.source) && /the game's/.test(COMPANY_LORE.note) && TITLES[COMPANY.title]);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
