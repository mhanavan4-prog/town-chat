// St Andrew's Day (Hasted, 1798, and Hone; Chambers, 1864; Henderson, 1879;
// the Declaration of Arbroath; Charleston, 1729): Hannah Gilbert comes on the
// Commonplace Book's own day (30 November, and 1 December), with a practical
// half on the red squirrel's protection and the grey's release; and the Charm
// Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-andrew-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { ANDREW_RITES } = require('../data/stAndrew.js');
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

const R = ANDREW_RITES.st_andrew;
check('the Squirrel Hunt: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Hasted at Easling, 1798: the day, the lawless rabble, the guns, poles and clubs, the pretence, the hares and hedges, the alehouse', /"On Nov\. 30, being St\. Andrew's, there is yearly a diversion called squirrel hunting"/.test(R.lore) && /"the labourers and lower kind of people assembling together, form a lawless rabble, and being accoutred with guns, poles, clubs, and other such weapons"/.test(R.lore) && /"under the pretence of demolishing the squirrels, some few of which they kill"/.test(R.lore) && /"breaking down the hedges"/.test(R.lore) && /"in drunkenness, as is usual with such sort of gentry"/.test(R.lore) && /Hasted/.test(R.source) && /Hone/.test(R.source));
check('…Chambers\'s patron saint and the Scots abroad; Arbroath\'s "patron for ever"; Charleston, 30 November 1729', /"regarded, from time immemorial, as the patron saint of Scotland"/.test(R.lore) && /"a favorite occasion of social and national reunion"/.test(R.lore) && /"Scotchmen residing in England and other places abroad"/.test(R.lore) && /"patron for ever"/.test(R.lore) && /30 November 1729/.test(R.lore) && /Arbroath/.test(R.source));
check('…Andermas and the sheep\'s heads, the lace-makers\' patron, Sternberg\'s carnival; the saltire in the sky called late; no Andrew\'s Eve divination', /Andermas/.test(R.lore) && /"by repasts of sheeps' heads"/.test(R.lore) && /"the patron of lacemakers"/.test(R.lore) && /"a kind of miniature carnival"/.test(R.lore) && /much later addition/.test(R.lore) && !/832|divination|Andrew's Eve/.test(R.lore));
const cal = OLD_CALENDAR.find((e) => e.key === 'st_andrew');
check('the Commonplace Book\'s St Andrew stands: Chambers\'s "from time immemorial", Advent', cal && cal.month === 11 && cal.day === 30 && cal.quote === 'regarded, from time immemorial, as the patron saint of Scotland' && /Advent/.test(cal.text));
const c = CALLERS.find((x) => x.id === 'st_andrew');
check('Hannah Gilbert, from Easling, dated by it, for two days', c && /Easling/.test(c.caller) && c.when && c.when.calendar === 'st_andrew' && c.when.days === 2 && c.steps.length === 1 && c.steps[0].rite === 'st_andrew');
check('the practical half: the red squirrel protected, intentionally in England and Wales, recklessly too in Scotland, the drey everywhere; the grey not to be released', /Then the practical half/.test(c.resolution) && /in England and Wales it's an offence under the Wildlife and Countryside Act to intentionally kill, injure or take one/.test(c.resolution) && /in Scotland recklessly too, and everywhere it's an offence to damage its drey or disturb it there/.test(c.resolution) && /it's an offence to release one or let one escape into the wild/.test(c.resolution) && /Wildlife and Countryside Act 1981, sch\. 5/.test(c.source) && /Invasive Alien Species/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Hannah'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Hannah', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'hannah'; h.accounts.hannah = {}; h.playerProgress.hannah = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('st_andrew');
  const days = [Date.UTC(2027, 10, 30, 12), Date.UTC(2027, 11, 1, 12)].map(offered);
  check('on St Andrew\'s Day and the 1st she comes first', days.every(leads), days);
  const outside = [Date.UTC(2027, 10, 29, 12), Date.UTC(2027, 11, 2, 12), Date.UTC(2027, 8, 1, 12)].map(offered);
  check('on other days she never comes', outside.every((o) => !o.includes('st_andrew') && o.length === 3), outside);
  at(Date.UTC(2027, 10, 30, 12), () => {
    h.accounts.hannah.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.hannah, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'st_andrew');
  check('…and writes the Squirrel Hunt into The Turning Year, dated 30 November', e && e.met && /· St Andrew's Day$/.test(e.title) && e.date === '30 November' && ch.entries.findIndex((x) => x.id === 'st_andrew') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
