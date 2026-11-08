// Tynwald Day (the Act for the new calendar, 1753; Tynwald's own pages; the
// Interpretation Act 2015, s. 47; the Standing Orders of Tynwald Court, 2023;
// Moore, 1891 and 1924): Juan Kinvig comes on the Commonplace Book's own day,
// 5 July or the Monday after if it falls at a weekend, with a practical half
// on presenting a Petition for Redress; and the Charm Book. The old calendar is
// put right: Tynwald still sits on Old Midsummer Day, and the Acts are
// promulgated.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-tynwald-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { TYNWALD_RITES } = require('../data/tynwald.js');
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

const R = TYNWALD_RITES.tynwald;
check('Tynwald Day: badged record, three signs that fit the Board', R && R.tier === 'record' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('the 1753 Act kept the Midsummer Tynwald Court on its natural day; "on old midsummer\'s day" still; 1417 and 1237; 1979 a traditional date', /"the Midsummer Tynwald Court usually holden or kept with the Fair or Mart on the Feast Day of Saint John Baptist"/.test(R.lore) && /"eleven Days later"/.test(R.lore) && /"in the open air once a year, on old midsummer's day, at Tynwald Hill in St John's"/.test(R.lore) && /"First among the customary laws that were written down in 1417 was the procedure for Tynwald Day"/.test(R.lore) && /"a convention of all the Manx people"/.test(R.lore) && /traditional date/.test(R.lore));
check('…the Acts promulgated "in Manx and English", lapsing after eighteen months; the petition; Moore\'s bollan bane against witchcraft, and the Fencibles\' caps', /promulgated, a memorandum of each read "in Manx and English", and one not promulgated within eighteen months "ceases to have effect"/.test(R.lore) && /"Any person may approach Tynwald Hill on Tynwald Day and present a Petition for Redress\."/.test(R.lore) && /"was made into wreaths to be worn on the heads of man and beast to protect them from witchcraft"/.test(R.lore) && /"used to wear it in their caps on oul' Tynwald Day"/.test(R.lore) && !/1924 revival|revived in 1924/.test(R.lore) && /Standing Orders/.test(R.source));
const cal = OLD_CALENDAR.find((e) => e.key === 'tynwald');
const { entryDate } = require('../data/oldCalendar.js');
check('the Commonplace Book\'s Tynwald, put right: still Old Midsummer Day, promulgated not proclaimed, the weekend rule; record', cal && cal.rule && cal.moves === '5 July, or the Monday after' && /On Old Midsummer Day Tynwald sits in the open air/.test(cal.text) && /promulgated in English and Manx/.test(cal.text) && !/once did|proclaim/.test(cal.text) && cal.tier === 'record' && cal.quote === "on old midsummer's day, at Tynwald Hill in St John's" && JSON.stringify(cal.rule(2026)) === '[7,6]' && JSON.stringify(cal.rule(2031)) === '[7,7]' && JSON.stringify(cal.rule(2027)) === '[7,5]', cal && cal.rule && [cal.rule(2026), cal.rule(2031)]);
const c = CALLERS.find((x) => x.id === 'tynwald');
check('Juan Kinvig, from Peel, dated by it, for the one day', c && /Peel/.test(c.caller) && c.when && c.when.calendar === 'tynwald' && c.when.days === 1 && c.steps.length === 1 && c.steps[0].rite === 'tynwald');
check('the practical half: only at St John\'s on Tynwald Day; three at most, the processional path, the Clerk at the foot of the Hill; typed, headed, addressed, temperate, a prayer, signed', /Then the practical half/.test(c.resolution) && /can be presented only at St John's on Tynwald Day, by the petitioner or someone they authorise, three people at most, walking the processional path and handing it to the Clerk of Tynwald at the foot of the Hill/.test(c.resolution) && /typed, not handwritten, headed 'In Tynwald' and addressed 'To the Honourable Members of Tynwald Court'/.test(c.resolution) && /respectful, decorous and temperate; ending with a prayer, and signed on that page/.test(c.resolution) && /Standing Orders/.test(c.source));
check('…public interest within Tynwald\'s province, not a case for a court; the neighbour\'s wall belongs in court; the Clerk\'s advice and the Lych Gate briefing', /a matter of public interest that falls within Tynwald's province, and not a case a court, tribunal or complaints procedure could deal with/.test(c.resolution) && /a quarrel over a neighbour's wall belongs in court/.test(c.resolution) && /Ask the Clerk of Tynwald's office for advice beforehand/.test(c.resolution) && /Lych Gate of the Royal Chapel/.test(c.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Juan'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Juan', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'juan'; h.accounts.juan = {}; h.playerProgress.juan = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const dated = (id) => !!(CALLERS.find((x) => x.id === id) || {}).when;
  const leads = (o) => o.length === 3 && o.slice(0, o.filter(dated).length).includes('tynwald');
  const days = [Date.UTC(2027, 6, 5, 12), Date.UTC(2026, 6, 6, 12), Date.UTC(2031, 6, 7, 12)].map(offered);
  check('on Tynwald Day he comes first: 5 July 2027, and the Monday after in 2026 and 2031', days.every(leads), days);
  const outside = [Date.UTC(2027, 6, 4, 12), Date.UTC(2027, 6, 6, 12), Date.UTC(2031, 6, 5, 12)].map(offered);
  check('on other days he never comes, nor on a 5 July that falls on a Saturday', outside.every((o) => !o.includes('tynwald') && o.length === 3), outside);
  at(Date.UTC(2027, 6, 5, 12), () => {
    h.accounts.juan.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.juan, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'tynwald');
  check('…and writes the Tynwald Day into The Turning Year, dated as it moves', e && e.met && /· St John's$/.test(e.title) && e.date === '5 July, or the Monday after' && ch.entries.findIndex((x) => x.id === 'tynwald') >= 12, e);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
