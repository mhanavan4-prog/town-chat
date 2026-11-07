// The Charm Book — every lore entry the game teaches, each with its source and
// provenance tier, marked met from what the account has already done.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-charmbook-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { buildCharmBook } = require('../lib/charmBook.js');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const chap = (b, k) => b.chapters.find((c) => c.key === k);
const metIds = (b, k) => chap(b, k).entries.filter((e) => e.met).map((e) => e.id);

// ── An empty book ────────────────────────────────────────────────────────────
const empty = buildCharmBook({ acct: {}, prog: {}, seasonKey: null });
const KEYS = ['callers', 'wards', 'ogham', 'leaves', 'nine', 'practices', 'cords', 'wheel', 'charms', 'halloween', 'yule', 'feasts', 'hours', 'dyes'];
check('the book has its fourteen chapters in order', JSON.stringify(empty.chapters.map((c) => c.key)) === JSON.stringify(KEYS), empty.chapters.map((c) => c.key));
check('a fresh account has met nothing', empty.chapters.every((c) => c.met === 0), empty.chapters.map((c) => c.key + ':' + c.met));
const all = empty.chapters.flatMap((c) => c.entries);
check('every entry has a title, a hint and a real tier', all.every((e) => e.title && e.hint && /^(record|folk|revival)$/.test(e.tier)), all.filter((e) => !(e.title && e.hint && /^(record|folk|revival)$/.test(e.tier))).map((e) => e.id));
check('every entry carries its lore', all.every((e) => e.lore), all.filter((e) => !e.lore).map((e) => e.id));
check('every entry outside the leaves names a source (leaves cite theirs once, in the chapter note)', all.filter((e) => !e.source).every((e) => chap(empty, 'leaves').entries.includes(e)) && !!chap(empty, 'leaves').note);
check('callers and leaf signs stay hidden until met; the calendar and alphabet are no secret', chap(empty, 'callers').showNames === false && chap(empty, 'leaves').showNames === false && chap(empty, 'wheel').showNames === true && chap(empty, 'ogham').showNames === true);
check('counts add up', empty.chapters.every((c) => c.total === c.entries.length));
check('ids are unique within each chapter', empty.chapters.every((c) => new Set(c.entries.map((e) => e.id)).size === c.entries.length));
check('the ogham chapter keeps the honesty line (casting is modern, Graves is not used)', /modern practice/.test(chap(empty, 'ogham').note) && /Graves/.test(chap(empty, 'ogham').note));
check('the Wheel chapter says the eight-fold Wheel is 20th-century', /20th-century/.test(chap(empty, 'wheel').note));

// ── A well-travelled account ─────────────────────────────────────────────────
const acct = {
  callers: { byId: { butter_wont_come: 2 } },
  ogham: { carved: ['beith', 'coll'] },
  wards: { bottle: null, bottleSpent: 1, hexafoil: { at: 1 }, shoe: null },
  leavesSeen: ['anchor'],
  practices: { greenDone: true, loafDay: 3 },
  cordsUntied: [1, 3],
  sabbatsSeen: ['imbolc'],
  hoursKept: ['venus', 'moon'],
  teasBrewed: ['beltane_tea'],
};
const book = buildCharmBook({ acct, prog: { almanac: ['plantain', 'nettle', 'rose'], dyeUnlocks: ['alder_black', 'void'] }, seasonKey: 'samhain' });
check('a finished caller is met', JSON.stringify(metIds(book, 'callers')) === '["butter_wont_come"]', metIds(book, 'callers'));
check('carved letters are met', JSON.stringify(metIds(book, 'ogham').sort()) === '["beith","coll"]', metIds(book, 'ogham'));
check('a spent witch bottle still counts as made, beside the daisy wheel', JSON.stringify(metIds(book, 'wards').sort()) === '["bottle","hexafoil"]', metIds(book, 'wards'));
check('a seen leaf sign is met', JSON.stringify(metIds(book, 'leaves')) === '["anchor"]');
check('wort-cunning and the crossed loaf are met', JSON.stringify(metIds(book, 'practices').sort()) === '["green","kitchen"]', metIds(book, 'practices'));
check('only the Nine Herbs in the almanac count', JSON.stringify(metIds(book, 'nine').sort()) === '["nettle","plantain"]', metIds(book, 'nine'));
check('loosed knots are met', JSON.stringify(metIds(book, 'cords')) === '["knot1","knot3"]', metIds(book, 'cords'));
check('sabbats: seen, brewed-for, and the one we are in', JSON.stringify(metIds(book, 'wheel').sort()) === '["beltane","imbolc","samhain"]', metIds(book, 'wheel'));
check('only plant dyes count (a Moonstone dye is not a charm)', JSON.stringify(metIds(book, 'dyes')) === '["alder_black"]', metIds(book, 'dyes'));
check('planets whose hour you worked in are met', JSON.stringify(metIds(book, 'hours').sort()) === '["moon","venus"]', metIds(book, 'hours'));
check('each planet names its weekday and its Culpeper herbs by name', /Friday/.test(chap(book, 'hours').entries.find((e) => e.id === 'venus').title) && /Yarrow/.test(chap(book, 'hours').entries.find((e) => e.id === 'venus').lore));
check('the Moon, with no garden herb, is kept with its tea', /tea/.test(chap(book, 'hours').entries.find((e) => e.id === 'moon').hint) && !/herbs/.test(chap(book, 'hours').entries.find((e) => e.id === 'moon').hint));
check('the hours cite Cassius Dio and Culpeper', chap(book, 'hours').entries.every((e) => /Cassius Dio/.test(e.source) && /Culpeper/.test(e.source)));
check('chapter met counts match', chap(book, 'wheel').met === 3 && chap(book, 'nine').met === 2);
check('an un-met carvable letter says what to carve it from', /Carve it from Alder Bark/.test(chap(book, 'ogham').entries.find((e) => e.id === 'fearn').hint));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, acctKey) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (acctKey) {
      p.accountKey = acctKey;
      h.accounts[acctKey] = h.accounts[acctKey] || { username: acctKey, miles: {} };
      h.playerProgress[acctKey] = h.playerProgress[acctKey] || { level: 1, xp: 0 };
    }
    return { s, p };
  }

  // A guest can open the book; nothing is met but the season they're in.
  const g = join('Reader');
  g.s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  const gs = g.s.lastOfType('charm_book_state');
  check('the server answers charm_book_state', gs && Array.isArray(gs.chapters) && gs.chapters.length === 14, gs && gs.chapters && gs.chapters.length);
  check('a guest has met no callers', gs && chap(gs, 'callers').met === 0);
  const season = h.calendarPublicState().season;
  check('a guest sees the current sabbat as met', gs && season && metIds(gs, 'wheel').includes(season.key), { season: season && season.key, met: gs && metIds(gs, 'wheel') });

  // An account: opening the book records the season lived through.
  const a = join('Cunning', 'cunningwoman');
  a.s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  check('opening the book records this sabbat on the account', season && (h.accounts.cunningwoman.sabbatsSeen || []).includes(season.key), h.accounts.cunningwoman.sabbatsSeen);

  // Loosing a knot is remembered for the book.
  const inv = h.getInventory(a.p);
  h.addItemToAccount(inv, 'wind_cord_3', 1);
  const r = h.untieKnot(a.p, 3);
  check('untying a knot works', r && r.knot && r.knot.n === 1, r);
  check('the loosed knot is recorded', (h.accounts.cunningwoman.cordsUntied || []).includes(1), h.accounts.cunningwoman.cordsUntied);
  a.s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  const as = a.s.lastOfType('charm_book_state');
  check('and shows in the book', as && metIds(as, 'cords').includes('knot1'), as && metIds(as, 'cords'));
  check('a signed-in book says so', as && as.signedIn === true && gs.signedIn === false);

  // Working in a planet's hour is remembered.
  h.noteHourKept('cunningwoman', 5);
  h.noteHourKept('cunningwoman', 5);
  check('a planet worked in is recorded once', JSON.stringify(h.accounts.cunningwoman.hoursKept) === '["venus"]', h.accounts.cunningwoman.hoursKept);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
