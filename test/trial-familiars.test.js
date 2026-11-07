// The familiars as the trial records give them, and the memorial to the
// accused: names, dates and numbers from the record, the myths corrected.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-trialfam-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { FAMILIARS, FAMILIAR_LORE, FAMILIAR_RECORDS, FAMILIAR_RECORDS_NOTE } = require('../data/familiars.js');
const { MEMORIAL } = require('../data/memorial.js');
const { WAYMARKER_LORE } = require('../data/townDecor.js');
const TOWN = fs.readFileSync(path.join(__dirname, '../client/town-scene.js'), 'utf8');
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

// ── The familiars ──
check('every familiar has its record, badged and sourced', Object.keys(FAMILIARS).every((k) => FAMILIAR_LORE[k] && /^(record|folk|revival)$/.test(FAMILIAR_LORE[k].tier) && FAMILIAR_LORE[k].lore && FAMILIAR_LORE[k].source));
check('the cat is Sathan, the white spotted cat of Chelmsford, 1566', /white spotted Cat/.test(FAMILIAR_LORE.cat.lore) && /Agnes Waterhouse/.test(FAMILIAR_LORE.cat.lore) && /29 July 1566/.test(FAMILIAR_LORE.cat.lore) && /Chensforde \(1566\)/.test(FAMILIAR_LORE.cat.source));
check('the toad is the same Sathan, and Ursula Kemp\'s Pigine', /pot lined with wool/.test(FAMILIAR_LORE.toad.lore) && /Pigine/.test(FAMILIAR_LORE.toad.lore));
check('the hare is the witch herself: Isobel Gowdie\'s charm, her fate unrecorded', /the witch herself/.test(FAMILIAR_LORE.hare.lore) && /I sall goe intill ane haire/.test(FAMILIAR_LORE.hare.lore) && /not recorded/.test(FAMILIAR_LORE.hare.lore) && /Pitcairn/.test(FAMILIAR_LORE.hare.source));
check('the raven says it is hardly in the records, and where its name comes from', /hardly appear/.test(FAMILIAR_LORE.raven.lore) && /Huginn and Muninn/.test(FAMILIAR_LORE.raven.lore));
check('the bat is honest: not a trial familiar, badged revival', FAMILIAR_LORE.bat.tier === 'revival' && /not among the familiars/.test(FAMILIAR_LORE.bat.lore));
const rec = JSON.stringify(FAMILIAR_RECORDS);
check('the records name Tibb, Fancie and Kemp\'s four', /Tibb/.test(rec) && /Fancie/.test(rec) && /Tittey, Tyffin, Pigine and Jacke/.test(rec));
check('Hopkins\'s imps as he spelled them, and his "no mortall could invent"', /Vinegar Tom/.test(rec) && /Sack and Sugar/.test(rec) && /Elemanzer/.test(rec) && /Peckin the Crown/.test(rec) && /no mortall could invent/.test(rec));
check('the records note says how the confessions were got', /kept from sleep/.test(FAMILIAR_RECORDS_NOTE));

// ── The memorial ──
const m = MEMORIAL.text;
check('the memorial gives the real number, and calls nine million a guess', /forty to sixty thousand/.test(m) && /"nine million" of a 1784 guess/.test(m));
check('…most were poor women, few healers or midwives', /poor women/.test(m) && /few were healers or midwives/.test(m));
check('…hanged, not burned, in England; strangled then burned in Scotland', /hanged, not burned/.test(m) && /strangled at the stake and then burned/.test(m));
check('…names the dead of Chelmsford, St Osyth, Pendle, Manningtree, Exeter and Dornoch', ['Agnes Waterhouse', 'Ursula Kemp', 'Alizon Device', 'Alice Nutter', 'Isabel Robey', 'Elizabeth Clarke', 'Temperance Lloyd', 'Janet Horne'].every((n) => m.includes(n)));
check('…and Scotland\'s apology of 2022', /In 2022 Scotland formally apologised/.test(m));
check('the stone is read like a waymarker, with its sources', WAYMARKER_LORE.way_memorial && WAYMARKER_LORE.way_memorial.name === MEMORIAL.name && /Sources: B\. Levack/.test(WAYMARKER_LORE.way_memorial.text));
check('the town builds the stone by the Town Hall and makes it readable', /buildMemorialStone\(scene\)/.test(TOWN) && /markerId: 'way_memorial'/.test(TOWN));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Reader'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Reader', charId: 0 }));
  s.emit('message', JSON.stringify({ type: 'familiar_lore' }));
  const fl = s.lastOfType('familiar_lore');
  check('the server answers familiar_lore, to guests too', fl && fl.lore && fl.lore.cat && Array.isArray(fl.records) && fl.records.length >= 6 && fl.note);
  s.emit('message', JSON.stringify({ type: 'read_waymarker', markerId: 'way_memorial' }));
  const d = s.lastOfType('npc_hint_dialogue');
  check('reading the memorial shows its text', d && d.npcId === 'way_memorial' && /Agnes Waterhouse/.test(d.message));
  void h;
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
