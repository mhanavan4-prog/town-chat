// Charm Book rewards: a purse for every chapter finished, and a title and a
// larger purse at a quarter, half, three quarters (with Woad Blue) and the
// whole book. Given once, and given for a backlog too.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-charmreward-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { dueRewards, rewardsView, bookPercent } = require('../lib/charmRewards.js');
const { CHAPTER_PURSE, MILESTONES, WOAD_LORE } = require('../data/charmRewards.js');
const { TITLES } = require('../data/titles.js');
const { DYES, DYE_UNLOCKS } = require('../data/wardrobe.js');
const { CHALDEAN } = require('../data/planetaryHours.js');
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
// A book of n chapters of ten entries, with these met counts.
const fakeBook = (mets) => ({ chapters: mets.map((met, i) => ({ key: 'c' + i, title: 'Chapter ' + i, icon: '📜', met, total: 10 })) });

// ── The rules ──
check('four milestones: 25, 50, 75, 100', JSON.stringify(MILESTONES.map((m) => m.at)) === '[25,50,75,100]');
check('every milestone title is a real title', MILESTONES.every((m) => TITLES[m.title] && TITLES[m.title].name));
check('three quarters gives Woad Blue, a real dye unlocked by the book', MILESTONES.find((m) => m.at === 75).dye === 'woad_blue' && DYES.some((d) => d.id === 'woad_blue') && DYE_UNLOCKS.woad_blue.book === 75);
check('woad says what it is and where that comes from', /Isatis tinctoria/.test(WOAD_LORE.lore) && /Grieve/.test(WOAD_LORE.source) && WOAD_LORE.tier === 'record');
check('no Moonstones are given', MILESTONES.every((m) => !m.ms && !m.moonstones));
check('bookPercent rounds down (24.9% is not a quarter)', bookPercent(fakeBook([10, 10, 4, 0, 0, 0, 0, 0, 0, 0])).pct === 24);
let due = dueRewards(fakeBook([10, 3, 0, 0]), null);
check('a finished chapter is due its purse', due.chapters.length === 1 && due.chapters[0].key === 'c0' && due.chapters[0].gold === CHAPTER_PURSE);
check('…and 13 of 40 crosses a quarter', JSON.stringify(due.milestones.map((m) => m.key)) === '["quarter"]');
due = dueRewards(fakeBook([10, 3, 0, 0]), { chapters: ['c0'], milestones: ['quarter'] });
check('nothing is due twice', due.chapters.length === 0 && due.milestones.length === 0);
check('an empty chapter is never "finished"', dueRewards({ chapters: [{ key: 'x', met: 0, total: 0 }] }, null).chapters.length === 0);
const view = rewardsView(fakeBook([10, 10, 0, 0]), { milestones: ['quarter', 'half'] });
check('the view shows the percentage and which milestones are given', view.pct === 50 && view.milestones.filter((m) => m.given).length === 2 && view.milestones[2].dye === 'woad_blue' && view.milestones[0].title === TITLES.charm_keeper.name);

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, key, acct) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; h.accounts[key] = acct; h.playerProgress[key] = { level: 1, xp: 0 };
    return { s, p };
  }
  const toasts = (s) => s.sent.filter((m) => m.type === 'toast' && /📜/.test(m.message || '')).map((m) => m.message);

  // A backlog: every planet's hour already kept before the feature existed,
  // and the book never looked at. The first look is silent about entries,
  // but the finished chapter is still paid for.
  const keptAll = CHALDEAN.map((c) => c.key);
  const A = join('Backlog', 'backlog', { hoursKept: keptAll });
  const bank0 = h.ensureBankAccount('backlog').balance;
  check('the first look writes no entry notices', h.charmBookNotice(A.p) === null);
  check('…but the finished chapter pays its purse', h.ensureBankAccount('backlog').balance === bank0 + CHAPTER_PURSE, h.ensureBankAccount('backlog').balance - bank0);
  check('…and says so, on screen whatever the notice setting', toasts(A.s).some((t) => /The Planetary Hours is complete\. 30 gold/.test(t)) && A.s.sent.some((m) => m.type === 'toast' && /complete/.test(m.message) && m.always === true), toasts(A.s));
  check('…and the bank is told', !!A.s.lastOfType('bank_state'));
  check('the chapter is recorded as paid', JSON.stringify(h.accounts.backlog.charmRewards.chapters) === '["hours"]');
  h.charmBookNotice(A.p);
  check('nothing is paid twice', h.ensureBankAccount('backlog').balance === bank0 + CHAPTER_PURSE && toasts(A.s).length === 1, toasts(A.s));

  // Milestones, from a book three quarters written.
  const B = join('Charmer', 'charmer', {});
  const bank1 = h.ensureBankAccount('charmer').balance;
  const lines = h.charmBookRewards(B.p, fakeBook([10, 10, 10, 6]));
  const gold = MILESTONES.filter((m) => m.at <= 75).reduce((n, m) => n + m.gold, 0) + 3 * CHAPTER_PURSE;
  check('three quarters written: three titles, three purses, three chapter purses', lines.length === 6 && h.ensureBankAccount('charmer').balance === bank1 + gold, { lines, got: h.ensureBankAccount('charmer').balance - bank1, gold });
  check('the titles are earned and wearable', ['charm_keeper', 'cunning_hand', 'parish_charmer'].every((t) => h.playerProgress.charmer.riteTitles.includes(t)) && !h.playerProgress.charmer.riteTitles.includes('whole_book'));
  check('the titles panel is told', B.s.lastOfType('titles_state') && B.s.lastOfType('titles_state').earned.length === 3);
  check('Woad Blue is in the wardrobe', (h.getProgress(B.p).dyeUnlocks || []).includes('woad_blue'));
  const dyeMsg = B.s.lastOfType('dye_bought');
  check('…and the wardrobe hears about it, with what woad is', dyeMsg && dyeMsg.dye === 'woad_blue' && /Woad Blue/.test(dyeMsg.message) && /fermented/.test(dyeMsg.message));
  check('the milestone line names the title and the dye', lines.some((l) => /Three quarters of the book written: you are Charmer of the Parish/.test(l) && /Woad Blue in your wardrobe/.test(l)), lines);
  check('nothing again for the same book', h.charmBookRewards(B.p, fakeBook([10, 10, 10, 6])) === null);
  const all = h.charmBookRewards(B.p, fakeBook([10, 10, 10, 10]));
  check('the whole book: the last chapter and the last title', all && all.length === 2 && h.playerProgress.charmer.riteTitles.includes('whole_book'));

  // The book itself shows the milestones.
  B.s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  const st = B.s.lastOfType('charm_book_state');
  check('charm_book_state carries the rewards view', st && st.rewards && st.rewards.milestones.length === 4 && st.rewards.milestones.every((m) => m.given) && st.rewards.chapterPurse === CHAPTER_PURSE);

  // Guests earn nothing.
  const g = makeMockSocket('Guest'); connHandler(g);
  g.emit('message', JSON.stringify({ type: 'join', name: 'Guest', charId: 0 }));
  const gp = h.players.get(g.lastOfType('init').id);
  check('a guest gets no rewards', h.charmBookRewards(gp, fakeBook([10, 10, 10, 10])) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
