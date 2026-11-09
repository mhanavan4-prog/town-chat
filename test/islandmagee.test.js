// Ireland on the memorial: the Islandmagee trial at Carrickfergus, 31 March
// 1711, Ireland's last and only mass witch trial, with the eight women named
// in Sneddon's spelling, and nothing from local tradition carved as fact.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-islandmagee-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MEMORIAL } = require('../data/memorial.js');
const { WAYMARKER_LORE } = require('../data/townDecor.js');
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

const t = MEMORIAL.text;
const paras = t.split('\n\n');
const ire = paras.find((p) => /^In Ireland/.test(p));
check('the memorial has a paragraph for Ireland', !!ire);
check('Carrickfergus, 31 March 1711: the largest, its only mass trial (Sellor was tried after it)', /Carrickfergus on 31 March 1711/.test(ire) && /the largest, its only mass trial/.test(ire) && !/the last and the largest/.test(ire) && /few trials/.test(ire));
const NAMES = ['Catherine McCalmond', 'Janet Liston', 'Elizabeth Sellor', 'Janet Carson', 'Janet Main', 'Janet Millar', 'Janet Latimer', 'Margaret Mitchell'];
check('the eight women of Islandmagee, each named', NAMES.every((n) => ire.includes(n)) && /Eight women of Islandmagee/.test(ire));
check('…accused by Mary Dunbar, and one judge told the jury the evidence was not enough', /Mary Dunbar/.test(ire) && /one of the two judges told the jury the evidence was not enough/.test(ire));
check('…a year in prison and the pillory four times; the 2023 plaque at the Gobbins', /imprisoned for a year and stood four times in the pillory/.test(ire) && /In 2023 a plaque to them, and to William Sellor, tried that September, was unveiled at the Gobbins in Islandmagee\./.test(ire) && !/memorial stone/.test(ire));
check('nothing from tradition carved as fact (the lost eye), and no misspelt names', !/eye/.test(ire) && !/Mean|Margaret Latimer/.test(ire));
check('it comes after the English and Scottish dead, before the Scottish apology, which is now Scotland\'s own', paras.indexOf(ire) === 2 && /^In 2022 Scotland's First Minister formally apologised "to all those accused, convicted, vilified or executed" under its Witchcraft Act\./.test(paras[3]));
check('its sources are on the stone: Sneddon and Devlin\'s documents, and Sneddon\'s book', /Sneddon and S\. Devlin \(eds\), The Islandmagee Witches documents \(2022\)/.test(MEMORIAL.sources) && /Possessed by the Devil \(2013\)/.test(MEMORIAL.sources) && /Islandmagee Witches/.test(WAYMARKER_LORE.way_memorial.text));

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Reader'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Reader', charId: 0 }));
  s.emit('message', JSON.stringify({ type: 'read_waymarker', markerId: 'way_memorial' }));
  const d = s.lastOfType('npc_hint_dialogue');
  check('reading the memorial shows the women of Islandmagee', d && /Janet Millar/.test(d.message) && /Carrickfergus/.test(d.message));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
