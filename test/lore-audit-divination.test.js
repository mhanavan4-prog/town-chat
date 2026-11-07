// Lore audit (divination): runes read from the rune poems, the nine runes that
// look the same upside down never fall reversed, and the tarot, runes, moon
// and pendulum each say where they really come from.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-auditdiv-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { RUNES, RUNE_PROVENANCE, RUNE_AETTIR } = require('../data/runes.js');
const { TAROT_CARDS, TAROT_PROVENANCE } = require('../data/tarot.js');
const CLIENT = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
const CAVE = fs.readFileSync(path.join(__dirname, '../client/cave-scene.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
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

// ── Runes ──
const SAME = ['gebo', 'hagalaz', 'nauthiz', 'isa', 'jera', 'eihwaz', 'sowilo', 'ingwaz', 'dagaz'];
check('the nine runes that look the same upside down are marked', JSON.stringify(RUNES.filter((r) => r.same).map((r) => r.key)) === JSON.stringify(SAME));
const runeText = JSON.stringify(RUNES) + JSON.stringify(RUNE_AETTIR);
check('no modern glosses: god-breath, Tyr\'s spear, sealed seed, world-tree yew', !/god-breath|spear|sealed seed|world-tree/i.test(runeText), runeText.match(/god-breath|spear|sealed seed|world-tree/gi));
check('readings that come from the rune poems say so', ['eihwaz', 'perthro', 'algiz', 'laguz', 'ingwaz'].every((k) => /Old English poem/.test(RUNES.find((r) => r.key === k).reading)));
check('Týr is the one-handed god who bound the wolf', /one-handed god/.test(RUNES.find((r) => r.key === 'tiwaz').reading));
check('the runes\' provenance names Blum (1982), Tacitus and the Vadstena bracteate, and is badged revival', RUNE_PROVENANCE.tier === 'revival' && /Blum, 1982/.test(RUNE_PROVENANCE.line) && /Germania 10/.test(RUNE_PROVENANCE.line) && /Vadstena/.test(RUNE_PROVENANCE.line));
check('"merkstave" is not shown to players', !/\(merkstave\)/.test(SERVER));

// ── Tarot ──
check('the twelfth trump is The Hanged Man, as in every historic deck', TAROT_CARDS.find((c) => c.key === 'hanged').name === 'The Hanged Man');
check('the tarot\'s provenance: Italian playing cards, de Gébelin\'s invented Egypt, Rider–Waite–Smith, Eden Gray', TAROT_PROVENANCE.tier === 'revival' && /15th-century Italian/.test(TAROT_PROVENANCE.line) && /Court de Gébelin \(1781\) invented their Egyptian origin/.test(TAROT_PROVENANCE.line) && /1909/.test(TAROT_PROVENANCE.line) && /Eden Gray/.test(TAROT_PROVENANCE.line));
check('the cave mural says Wheel of Fortune, not "Wheel of Fate"', /WHEEL OF FORTUNE/.test(CAVE) && !/WHEEL OF FATE/.test(CAVE));

// ── The moon and the pendulum (client copy) ──
check('the moon page says the eight phases and moon water are modern, and esbat is Murray\'s word', /eight phases with their intentions, and moon water, are 20th-century/.test(CLIENT) && /Margaret Murray/.test(CLIENT));
check('the pendulum cites Ammianus Marcellinus', /PENDULUM_PROVENANCE = \{ tier: 'revival'/.test(CLIENT) && /Ammianus Marcellinus/.test(CLIENT));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const realNow = Date.now;
  const MIDSUMMER = Date.UTC(2027, 5, 25, 12); // not Samhain: staves may fall reversed
  const s = makeMockSocket('Caster'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Caster', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'caster'; h.accounts.caster = {}; h.playerProgress.caster = { level: 1, xp: 0 };

  let sameRev = 0, sameAll = 0, otherRev = 0, otherAll = 0, prov = true;
  Date.now = () => MIDSUMMER;
  try {
    for (let i = 0; i < 200; i++) {
      h.accounts.caster.lastRuneDay = null;
      s.emit('message', JSON.stringify({ type: 'rune_cast' }));
      const r = s.lastOfType('rune_result');
      if (!r || !r.provenance || !/Blum/.test(r.provenance.line)) prov = false;
      for (const st of (r && r.cast) || []) {
        if (SAME.includes(st.key)) { sameAll++; if (st.reversed) sameRev++; } else { otherAll++; if (st.reversed) otherRev++; }
      }
    }
  } finally { Date.now = realNow; }
  check('a rune that looks the same upside down never falls reversed (200 casts)', sameAll > 50 && sameRev === 0, { sameAll, sameRev });
  check('…while the others still do', otherAll > 100 && otherRev > 0 && otherRev < otherAll, { otherAll, otherRev });
  check('every cast carries the runes\' provenance', prov);

  s.emit('message', JSON.stringify({ type: 'tarot_state' }));
  const t = s.lastOfType('tarot_result');
  check('the tarot panel is sent its provenance', t && t.provenance && /tarocchi/.test(t.provenance.line));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
