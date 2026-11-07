// The cunning folk of the record, on the Real Shelf: six real, long-dead
// cunning folk, each sourced, legend marked as legend, written into the Charm
// Book's Cunning Folk chapter when read.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-cunning-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { CUNNING_FOLK, CUNNING_FOLK_INTRO } = require('../data/cunningFolk.js');
const { buildCharmBook } = require('../lib/charmBook.js');
const CLIENT = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
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
const F = Object.fromEntries(CUNNING_FOLK.map((f) => [f.id, f]));

check('six cunning folk, unique ids, each with name, place, dates, summary, fact and source', CUNNING_FOLK.length === 6 && new Set(CUNNING_FOLK.map((f) => f.id)).size === 6 && CUNNING_FOLK.every((f) => f.name && f.place && f.dates && f.summary && f.fact && f.source && f.tier === 'record'));
check('quotes are short (under 25 words)', CUNNING_FOLK.every((f) => !f.quote || f.quote.split(/\s+/).length <= 25));
check('Murrell: a shoemaker; Morrison\'s novel called fiction; the broomstick called legend', /shoemaker/.test(F.murrell.summary) && /is fiction/.test(F.murrell.legend) && /broomstick/.test(F.murrell.legend) && F.murrell.dates === '1785–1860');
check('Biddy Early: Lady Gregory\'s bottle quote; the 1865 trial never proved', /by the bottle she did all/.test(F.biddy_early.quote) && /never been proved/.test(F.biddy_early.fact) && /Gregory, Visions and Beliefs/.test(F.biddy_early.source));
check('Wrightson: Atkinson\'s judgement, and his death honestly unknown', /charlatan/.test(F.wrightson.fact) && /Atkinson, Forty Years in a Moorland Parish \(1891\)/.test(F.wrightson.source) && /^Unknown/.test(F.wrightson.legend));
check('Bessie Dunlop: Thom Reid, the charge from Pitcairn, 8 November 1576, the doubt about her fate stated', /Thom Reid/.test(F.bessie_dunlop.summary) && /invocatioun of spretis/.test(F.bessie_dunlop.fact) && /8 November 1576/.test(F.bessie_dunlop.fact) && /most probably/.test(F.bessie_dunlop.fact) && /Pitcairn/.test(F.bessie_dunlop.source));
check('John Harries: the dyn hysbys; the padlocked book called legend; NLW manuscript', /dyn hysbys/.test(F.harries.summary) && /No record of it/.test(F.harries.legend) && /Cwrtmawr MS 97A/.test(F.harries.source));
check('Tamsin Blight: "Tammy Blee", a pellar; Semmens; her birth year marked unsure', /Tammy Blee/.test(F.tamsin_blight.summary) && /pellar/.test(F.tamsin_blight.summary) && /Semmens/.test(F.tamsin_blight.source) && /^Unsure/.test(F.tamsin_blight.legend));
check('the shelf intro says legend is marked', /legend marked/.test(CUNNING_FOLK_INTRO));
check('the client shows them on the Real Shelf, legend in its own line, and reads them', /shelfFolkHead/.test(CLIENT) && /shelfLegend/.test(CLIENT) && /type: 'read_cunning'/.test(CLIENT));

const book0 = buildCharmBook({ acct: {}, prog: {}, seasonKey: null });
const ch0 = book0.chapters.find((c) => c.key === 'cunning');
check('the Charm Book has a Cunning Folk chapter, after the Library', ch0 && ch0.total === 6 && ch0.met === 0 && book0.chapters.findIndex((c) => c.key === 'cunning') === book0.chapters.findIndex((c) => c.key === 'library') + 1);

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Reader'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Reader', charId: 0 }));
  s.emit('message', JSON.stringify({ type: 'real_shelf' }));
  const g = s.lastOfType('real_shelf');
  check('a guest sees the cunning folk on the shelf', g && g.folk && g.folk.length === 6 && g.folkIntro && Array.isArray(g.folkRead) && g.folkRead.length === 0);
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'reader'; h.accounts.reader = {}; h.playerProgress.reader = { level: 1, xp: 0 };
  s.emit('message', JSON.stringify({ type: 'read_cunning', id: 'biddy_early' }));
  s.emit('message', JSON.stringify({ type: 'read_cunning', id: 'biddy_early' }));
  s.emit('message', JSON.stringify({ type: 'read_cunning', id: 'not_a_person' }));
  const r = s.lastOfType('real_shelf');
  check('reading one records it once; an unknown id is ignored', JSON.stringify(h.accounts.reader.cunningRead) === '["biddy_early"]' && r.folkRead.length === 1);
  const ch = buildCharmBook({ acct: h.accounts.reader, prog: {}, seasonKey: null }).chapters.find((c) => c.key === 'cunning');
  check('…and writes it into the Charm Book', ch.met === 1 && ch.entries.find((e) => e.id === 'biddy_early').met);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
