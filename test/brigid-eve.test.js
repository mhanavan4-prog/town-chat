// St Brigid's Eve (Ireland): the Brídeóg carried from house to house, the
// rushes let in, the brat Bríde on the sill (Kildare Archaeological Society,
// 1890s; Leinster Leader, 1907; the Schools' Collection), a caller dated by the
// Commonplace Book's own entry (1 February, and the 2nd), first at the door,
// and the Charm Book.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-brigid-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { BRIGID_RITES } = require('../data/brigidEve.js');
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

const R = BRIGID_RITES.brideog;
check('the Brídeóg: badged folk (living custom, gathered), three signs that fit the Board', R && R.tier === 'folk' && R.outcomes.length === 3 && R.outcomes.every((o) => `${R.icon} ${R.name}: ${o}`.length <= 140));
check('Kerry in the 1890s: the churn-dash in a woman\'s dress, pennies or eggs', /"consists of a churn-dash, or broomstick, padded round with straw"/.test(R.lore) && /"covered with a woman's dress"/.test(R.lore) && /"given pennies, or more generally eggs"/.test(R.lore) && /Kildare Archaeological Society, vol\. I \(1891–95\)/.test(R.source));
check('…Kildare\'s "Miss Biddy" (1907), Galway\'s rhyme and Donegal\'s door (Schools\' Collection)', /"in honour of Miss Biddy"/.test(R.lore) && /Leinster Leader \(2 February 1907\)/.test(R.source) && /"Here is St Bridget dressed in white, Give her a penny in honour of the night"/.test(R.lore) && /"Go on your knees and let in Brigid"/.test(R.lore) && /"she is welcome"/.test(R.lore));
check('…the brat Bríde in the Collection\'s words', /"The 'Brat Bríde' \(Brigid's Mantle\) was a piece of cloth left outside the dwelling-house on the eve of St Brigid's Day\./.test(R.lore) && /a cure for various pains and headaches and a protection against dangers such as drowning\."/.test(R.lore));
check('…the Biddy Boys today, and the holiday since 2023 (not on the 1st itself, so no date given)', /"masked men and women dressed in white uniforms, sashes and wearing elaborate oaten-straw hats"/.test(R.lore) && /Since 2023/.test(R.lore) && !/west Limerick/.test(R.lore));
const c = CALLERS.find((x) => x.id === 'brigid_eve_brideog');
check('Síle and Peig Donovan, dated by the old calendar\'s St Brigid\'s Eve, for two days', c && c.when && c.when.calendar === 'brigid_eve' && c.when.days === 2 && OLD_CALENDAR.some((e) => e.key === 'brigid_eve' && e.month === 2 && e.day === 1) && c.steps[0].rite === 'brideog');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Sile'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Sile', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'sile'; h.accounts.sile = {}; h.playerProgress.sile = { level: 1, xp: 0 };
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const offered = (t) => at(t, () => { const st = h.callers.stateOf(p); st.active = null; return h.callers.offeredIds(p, st); });
  const days = [1, 2].map((d) => offered(Date.UTC(2027, 1, d, 12)));
  const season = at(Date.UTC(2027, 1, 1, 12), () => h.calendarPublicState().season.key);
  // Mistress Cole comes on Candlemas Eve, the same day (data/candlemasEve.js):
  // then the two dated callers come first, and the season's after them.
  check('on St Brigid\'s Eve they come first (with any other caller of the day), a caller of the season after them', days.every((o) => { const d = o.filter((id) => CALLERS.find((x) => x.id === id).when); return o.length === 3 && d.includes('brigid_eve_brideog') && o.slice(0, d.length).every((id) => d.includes(id)) && CALLERS.find((x) => x.id === o[d.length]).season === season; }), [season, days]);
  const outside = [Date.UTC(2027, 0, 31, 12), Date.UTC(2027, 1, 3, 12), Date.UTC(2027, 7, 1, 12)].map(offered);
  check('on other days they never come', outside.every((o) => !o.includes('brigid_eve_brideog') && o.length === 3), outside);
  at(Date.UTC(2027, 1, 1, 12), () => {
    h.accounts.sile.callers.active = { id: c.id, done: {} };
    s.emit('message', JSON.stringify({ type: 'rite_do' }));
  });
  const step = h.callers.callersStatePayload(p).active.steps[0];
  check('working it gives one of its signs', step.done && R.outcomes.some((o) => step.note.endsWith(o)), step);
  const ch = buildCharmBook({ acct: h.accounts.sile, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'feasts');
  const e = ch.entries.find((x) => x.id === 'brideog');
  check('…and writes the Brídeóg into The Turning Year, dated 1 February, between Plough Monday and Shrove Tuesday', e && e.met && /· St Brigid's Eve$/.test(e.title) && e.date === '1 February' && ch.entries.findIndex((x) => x.id === 'brideog') > ch.entries.findIndex((x) => x.id === 'plough_monday') && ch.entries.findIndex((x) => x.id === 'brideog') < ch.entries.findIndex((x) => x.id === 'shroving'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
