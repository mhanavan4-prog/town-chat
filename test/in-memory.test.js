// In Memory: the two stones by the Town Hall (data/memorial.js) written into
// the Charm Book with the works they come from, met by reading them at the
// stones; no purse for the chapter; and with them on the Sources page, every
// Myth or record? verdict can be checked.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-inmemory-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { MEMORIAL, AFTER_THE_LAW } = require('../data/memorial.js');
const { buildCharmBook } = require('../lib/charmBook.js');
const { buildSources } = require('../lib/sources.js');
const { checksFor } = require('../lib/checkIt.js');
const { dueRewards } = require('../lib/charmRewards.js');
const { MYTH_QUIZ } = require('../data/mythOrRecord.js');
const BOOK = fs.readFileSync(path.join(__dirname, '../client/charm-book.js'), 'utf8');
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

const fresh = buildCharmBook({ acct: {}, prog: {}, seasonKey: null });
const keys = fresh.chapters.map((c) => c.key);
const mem = fresh.chapters.find((c) => c.key === 'memory');
check('In Memory comes straight after The Cunning Folk', mem && mem.title === 'In Memory' && keys.indexOf('memory') === keys.indexOf('cunning') + 1);
check('…with the two stones, on the record, their names shown before they are read', mem.total === 2 && mem.met === 0 && mem.showNames && mem.entries.map((e) => e.title).join('|') === 'In Memory of the Accused|After the Law' && mem.entries.every((e) => e.tier === 'record'));
check('each entry is the stone\'s own words, and its sources one work at a time', mem.entries[0].lore === MEMORIAL.text.replace(/\n\n/g, ' ') && mem.entries[1].lore === AFTER_THE_LAW.text.replace(/\n\n/g, ' ') && mem.entries[0].source === MEMORIAL.sources.split('; ').join(' · ') && mem.entries[1].source.split(' · ').length === AFTER_THE_LAW.sources.split('; ').length);
const read = buildCharmBook({ acct: { stonesRead: ['way_memorial', 'way_after_law'] }, prog: {}, seasonKey: null });
const memRead = read.chapters.find((c) => c.key === 'memory');
check('reading both stones writes the chapter in', memRead.met === 2);
check('…but it pays no purse: it is for the dead', memRead.noPurse === true && !dueRewards(read, {}).chapters.some((c) => c.key === 'memory'));
check('…and the book says so where it names the purse', /c\.noPurse/.test(BOOK) && /which is for the dead/.test(BOOK));

// The Sources page now has the memorial's works, so every verdict links.
const src = buildSources(fresh.chapters);
const checks = checksFor(src, { myth: MYTH_QUIZ });
const unlinked = MYTH_QUIZ.filter((q) => !checks['myth:' + q.id].some((p) => p.work)).map((q) => q.id);
check('every Myth or record? verdict has a work to check it by', unlinked.length === 0, unlinked);
const byId = Object.fromEntries(src.works.map((w) => [w.id, w]));
const levack = checks['myth:nine_million'].find((p) => p.work);
check('"nine million" goes to Levack, cited by the memorial', levack && /Levack/.test(byId[levack.work].cite) && byId[levack.work].entries.some((e) => e.chapter === 'memory' && e.id === 'memorial'));
const isl = checks['myth:islandmagee'].find((p) => p.work);
check('Islandmagee goes to the trial documents, cited by the memorial', isl && /Islandmagee Witches/.test(byId[isl.work].cite) && byId[isl.work].entries.some((e) => e.chapter === 'memory'));
check('Bridget Cleary\'s entry in the Dictionary of Irish Biography is on the page, from After the Law', src.works.some((w) => /Cleary, Bridget/.test(w.cite) && w.entries.some((e) => e.id === 'after_the_law')));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Mourner'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Mourner', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'mourner'; h.accounts.mourner = {}; h.playerProgress.mourner = { level: 1, xp: 0 };
  s.emit('message', JSON.stringify({ type: 'read_waymarker', markerId: 'way_memorial' }));
  s.emit('message', JSON.stringify({ type: 'read_waymarker', markerId: 'way_memorial' }));
  s.emit('message', JSON.stringify({ type: 'read_waymarker', markerId: 'way_after_law' }));
  s.emit('message', JSON.stringify({ type: 'read_waymarker', markerId: 'way_severance' }));
  check('reading the stones records each once, and nothing else', JSON.stringify(h.accounts.mourner.stonesRead) === '["way_memorial","way_after_law"]', h.accounts.mourner.stonesRead);
  const d = s.lastOfType('npc_hint_dialogue');
  check('…and still shows each stone it is asked for', d && d.npcId === 'way_severance');
  s.emit('message', JSON.stringify({ type: 'charm_book_state' }));
  const st = s.lastOfType('charm_book_state');
  check('the server\'s book has In Memory written in', st && st.chapters.find((c) => c.key === 'memory').met === 2);
  const g = makeMockSocket('Passer'); connHandler(g);
  g.emit('message', JSON.stringify({ type: 'join', name: 'Passer', charId: 0 }));
  g.emit('message', JSON.stringify({ type: 'read_waymarker', markerId: 'way_memorial' }));
  check('a guest can read the stone, and nothing is kept', /Agnes Waterhouse/.test((g.lastOfType('npc_hint_dialogue') || {}).message || ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
