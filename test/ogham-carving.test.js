// Carving ogham yourself: the letter is cut against the stave's edge, as on
// the stones (B to the right, H to the left, M slanting across, vowels as
// notches on the edge), and the server checks the cuts before any wood is
// spent. The carving lore is record-tier and says to cut only your own wood.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ogcarve-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const { classifyOghamCut, oghamProblem, OGHAM_CARVING_LORE } = require('../data/ogham');
const c = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });

check('a cut from the edge out to the right is a B stroke', classifyOghamCut(c(60, 100, 95, 100)) === 'right');
check('…to the left an H stroke', classifyOghamCut(c(60, 100, 25, 102)) === 'left');
check('…slanting across the edge an M stroke', classifyOghamCut(c(35, 110, 85, 94)) === 'across');
check('…a tap on the edge a vowel notch; a short stroke straight across the manuscripts\' vowel', classifyOghamCut(c(60, 100, 60, 100)) === 'notch' && classifyOghamCut(c(50, 100, 70, 100)) === 'straight');
check('…and a cut that never meets the edge is a stray', classifyOghamCut(c(80, 100, 110, 100)) === 'stray' && classifyOghamCut(c(70, 100, 70, 100)) === 'stray');
check('Fearn: three to the right, even and parallel', oghamProblem('B', 3, [c(60, 140, 95, 140), c(60, 152, 95, 152), c(60, 164, 95, 164)]) === null);
check('…cut to the wrong side is the wrong letter', /right of the edge/.test(oghamProblem('B', 3, [c(60, 140, 25, 140), c(60, 152, 25, 152), c(60, 164, 25, 164)]) || ''));
check('…too few strokes is another letter', /3 strokes/.test(oghamProblem('B', 3, [c(60, 140, 95, 140), c(60, 152, 95, 152)]) || ''));
check('…strokes strewn down the stave don\'t read as one letter', /evenly/.test(oghamProblem('B', 3, [c(60, 60, 95, 60), c(60, 72, 95, 72), c(60, 200, 95, 200)]) || ''));
check('…strokes splayed every which way aren\'t parallel', /parallel/.test(oghamProblem('M', 2, [c(35, 160, 85, 145), c(40, 150, 80, 180)]) || ''));
check('Úr: three notches; mixing notches and strokes is refused', oghamProblem('A', 3, [c(60, 140, 60, 140), c(60, 152, 60, 152), c(60, 164, 60, 164)]) === null && /one way/.test(oghamProblem('A', 2, [c(60, 140, 60, 140), c(50, 152, 70, 152)]) || ''));
check('nonsense is refused, not thrown', !!oghamProblem('B', 1, 'cut') && !!oghamProblem('B', 1, [{}]) && !!oghamProblem('Z', 1, []));
check('the carving lore: White\'s stemline and reading, X MAQI Y, the monument law', /"relative to a stemline, generally the natural angle or edge of the stone"/.test(OGHAM_CARVING_LORE.text) && /X MAQI Y/.test(OGHAM_CARVING_LORE.text) && /scheduled monument consent/.test(OGHAM_CARVING_LORE.text) && OGHAM_CARVING_LORE.tier === 'record' && /Cadw/.test(OGHAM_CARVING_LORE.source));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Carver'); connHandler(s);
  say(s, { type: 'join', name: 'Carver', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'ogc_a'; h.accounts.ogc_a = {};
  const inv = h.getInventory(p);
  h.addItemToAccount(inv, 'birch_bark', 2);
  say(s, { type: 'ogham_state' });
  const st = s.lastOfType('ogham_state');
  check('the panel is sent the bench and its lore', st && st.board && st.board.stemX === 60 && st.carvingLore && st.carvingLore.tier === 'record');
  say(s, { type: 'ogham_carve', key: 'beith' });
  check('no cuts, no stave, and the bark kept', !(h.accounts.ogc_a.ogham.carved || []).includes('beith') && h.countItemQty(inv, 'birch_bark') === 2);
  say(s, { type: 'ogham_carve', key: 'beith', cuts: [c(60, 150, 25, 150)] });
  check('cut to the wrong side, refused with the reason, and the bark kept', /right of the edge/.test((s.lastOfType('ogham_error') || {}).message || '') && h.countItemQty(inv, 'birch_bark') === 2);
  say(s, { type: 'ogham_carve', key: 'beith', cuts: [c(60, 150, 95, 150)] });
  check('one cut to the right: Beith is carved and the bark spent', (h.accounts.ogc_a.ogham.carved || []).includes('beith') && h.countItemQty(inv, 'birch_bark') === 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
