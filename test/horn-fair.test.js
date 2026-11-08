// Horn Fair, St Luke's Day (Hone, 1827, with Brand and Fuller; Defoe, 1724–27;
// Lysons, 1796, with Philipott, 1659): Sukey Turner comes on the Commonplace
// Book's own day (18 October, and the 19th, Defoe's day), with a practical half
// on alcohol poisoning and the recovery position (NHS; St John Ambulance); and
// the Charm Book. The old calendar is put right: the ox is Hone's conjecture,
// and St Luke's summer is not his.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-horn-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { HORN_RITES } = require('../data/hornFair.js');
const { CALLERS } = require('../data/callers.js');
const { OLD_CALENDAR } = require('../data/oldCalendar.js');
const { buildCharmBook } = require('../lib/charmBook.js');
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

const R = HORN_RITES.horn_fair;
check('Horn Fair: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Philipott\'s horns for sale, as Lysons gives him; Defoe\'s "rabble of mad-people", the women "impudent", "suppress\'d, as a nusance"', /"called Horn-fair, by reason of the great plenty of all sorts of winding horns and cups, and other vessels of horn there brought to be sold"/.test(R.lore) && /"famous, or rather infamous for the yearly collected rabble of mad-people, at Horn-Fair"/.test(R.lore) && /"The mob indeed at that time take all kinds of liberties, and the women are especially impudent for that day"/.test(R.lore) && /"suppress'd, as a nusance and offence to all sober people"/.test(R.lore) && !/rudest drunken mob/.test(R.lore));
check('…Hone: Brand\'s mob at Cuckold\'s Point, the gingerbread, three times round the church, the proverb and its furze, Fuller\'s gown, the masks of 1825', /"a riotous mob, who, after a printed summons dispersed through the adjacent towns, meet at Cuckold's point, near Deptford"/.test(R.lore) && /"even the ginger-bread figures have horns"/.test(R.lore) && /"went round the church three times"/.test(R.lore) && /"all is fair at Horn Fair"/.test(R.lore) && /"so many indecencies on Blackheath, such as the whipping of females with furze"/.test(R.lore) && /"dressed in my land-ladie's best gown"/.test(R.lore) && /"most of the visitors wore masks"/.test(R.lore));
check('…St Luke\'s ox only conjectured; King John dismissed by both, no miller\'s wife; 1768, 1872, Charlton House', /"may be conjectured to have originated from the symbol"/.test(R.lore) && /"a vague and idle tradition"/.test(R.lore) && /"too ridiculous to merit the smallest attention"/.test(R.lore) && !/miller's wife/.test(R.lore) && /1768/.test(R.lore) && /abolished in 1872 under the Fairs Act/.test(R.lore) && /Charlton House/.test(R.lore) && /Defoe/.test(R.source) && /Lysons/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'horn_fair');
check('the Commonplace Book\'s Horn Fair, put right: Hone "suggested", 1872, and St Luke\'s summer cited to the Spectator, not Hone', cal && cal.month === 10 && cal.day === 18 && /Hone suggested/.test(cal.text) && !/Hone thought/.test(cal.text) && /abolished in 1872/.test(cal.text) && /St Luke's summer/.test(cal.text) && /Spectator/.test(cal.source) && cal.quote === 'all is fair at Horn Fair');
const c = CALLERS.find((x) => x.id === 'horn_fair');
check('Sukey Turner, from Deptford, dated by it, for two days', c && /Deptford/.test(c.caller) && c.when && c.when.calendar === 'horn_fair' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'horn_fair');
check('the practical half: the signs of alcohol poisoning and 999; stay with them; sit up or the recovery position, step by step', /Then the practical half/.test(c.resolution) && /confused, being sick, breathing slowly or unevenly, having a fit, or can't be woken, it may be alcohol poisoning: ring 999/.test(c.resolution) && /Stay with them, because they could choke on their own sick or stop breathing/.test(c.resolution) && /the near arm out at a right angle, the back of the other hand against their cheek, the far knee pulled up/.test(c.resolution) && /tilt the head back to keep the airway open/.test(c.resolution));
check('…sips of water only if they can swallow, warmth; no more drink, no coffee, no cold shower; slower, with food, water between', /sips of water only if they can swallow and aren't being sick, and keep them warm/.test(c.resolution) && /No more drink, no coffee, and no cold shower or bath/.test(c.resolution) && /drink more slowly, with food, and water in between/.test(c.resolution) && /NHS, "Alcohol poisoning"/.test(c.source) && /St John Ambulance/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Sukey'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Sukey', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'sukey'; h.accounts.sukey = {}; h.playerProgress.sukey = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('horn_fair');
  const days = [Date.UTC(2027, 9, 18, 12), Date.UTC(2027, 9, 19, 12)].map(offered);
  check('on St Luke\'s Day and the 19th she comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 9, 17, 12), Date.UTC(2027, 9, 20, 12), Date.UTC(2027, 8, 1, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('horn_fair') && o.length === 3), outside);
  at(Date.UTC(2027, 9, 18, 12), () => {
    h.accounts.sukey.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.sukey, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'horn_fair');
  check('…and writes the Horn Fair into The Turning Year, dated 18 October', e && e.met && /· St Luke's Day$/.test(e.title) && e.date === '18 October' && ch.entries.findIndex((x) => x.id === 'horn_fair') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
