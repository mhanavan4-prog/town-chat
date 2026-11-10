// Agrippa's tables of Saturn and Jupiter, filled in at the Real Shelf. The
// tables are as the 1651 English text prints them (II.22, EEBO-TCP A26565);
// the server checks a filled table line by line and keeps Agrippa's own given
// numbers in place; Saturn's has only one answer in eight positions, and
// Jupiter's, with its corners and middle given, only Agrippa's.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-kamea-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const { KAMEA, DURER, kameaProblem, kameaWhich, KAMEA_LORE, KAMEA_SOURCE } = require('../data/kamea');
const magic = (g, S) => { const n = g.length; return g.every((r) => r.reduce((a, b) => a + b, 0) === S) && g[0].every((_, j) => g.reduce((a, r) => a + r[j], 0) === S) && g.reduce((a, r, i) => a + r[i], 0) === S && g.reduce((a, r, i) => a + r[n - 1 - i], 0) === S && new Set(g.flat()).size === n * n; };

// ── The tables as printed ────────────────────────────────────────────────────
check('Saturn: 4 9 2 / 3 5 7 / 8 1 6, every line fifteen, forty-five in all', JSON.stringify(KAMEA.saturn.table) === '[[4,9,2],[3,5,7],[8,1,6]]' && magic(KAMEA.saturn.table, 15) && KAMEA.saturn.total === 45);
check('Jupiter: 4 14 15 1 / 9 7 6 12 / 5 11 10 8 / 16 2 3 13, every line thirty-four, 136 in all', JSON.stringify(KAMEA.jupiter.table) === '[[4,14,15,1],[9,7,6,12],[5,11,10,8],[16,2,3,13]]' && magic(KAMEA.jupiter.table, 34) && KAMEA.jupiter.total === 136);
check('Dürer\'s square sums to thirty-four with 1514 in its bottom row', magic(DURER, 34) && DURER[3][1] === 15 && DURER[3][2] === 14);
const turnsOf = (g) => { const out = []; let t = g; const turn = (x) => x[0].map((_, j) => x.map((r) => r[j]).reverse()); for (let k = 0; k < 4; k++) { out.push(t, t.map((r) => r.slice().reverse())); t = turn(t); } return out; };
check('…and is not Agrippa\'s Jupiter, nor any turn or mirror of it (as the lore says)', !turnsOf(KAMEA.jupiter.table).some((t) => JSON.stringify(t) === JSON.stringify(DURER)) && /it is not Agrippa's Jupiter, nor that turned or mirrored/.test(KAMEA_LORE));

// ── Counted, as the file says ────────────────────────────────────────────────
let threes = 0;
const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
for (const p of perms([1, 2, 3, 4, 5, 6, 7, 8, 9])) if (magic([p.slice(0, 3), p.slice(3, 6), p.slice(6)], 15)) threes++;
check('there is one three-by-three square, in eight turns and mirrorings', threes === 8 && turnsOf(KAMEA.saturn.table).every((t) => kameaProblem('saturn', t) === null));
const J = KAMEA.jupiter, given = new Set(J.givens.map(([i, j]) => `${i},${j}`));
const free = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (!given.has(`${i},${j}`)) free.push([i, j]);
const rest = Array.from({ length: 16 }, (_, k) => k + 1).filter((v) => !J.givens.some(([i, j]) => J.table[i][j] === v));
let fills = 0;
for (const p of perms(rest)) { const g = J.table.map((r) => r.slice()); free.forEach(([i, j], k) => { g[i][j] = p[k]; }); if (magic(g, 34)) fills++; }
check('with the corners and middle given, Agrippa\'s is the only Jupiter that can be finished', fills === 1);

// ── The check ────────────────────────────────────────────────────────────────
check('a right table passes; a turned Saturn passes and is told it is turned', kameaProblem('saturn', KAMEA.saturn.table) === null && kameaWhich('saturn', KAMEA.saturn.table) === 'agrippa' && kameaWhich('saturn', [[2, 9, 4], [7, 5, 3], [6, 1, 8]]) === 'turned');
check('a wrong row is named with its sum', /Row 1 makes 16, not 15/.test(kameaProblem('saturn', [[4, 9, 3], [2, 5, 7], [8, 1, 6]]) || ''));
check('a number twice is named', /5 is there twice/.test(kameaProblem('saturn', [[4, 9, 2], [3, 5, 7], [8, 5, 6]]) || ''));
check('Agrippa\'s given numbers stay where he put them', /Leave the numbers Agrippa gives/.test(kameaProblem('jupiter', DURER) || ''));
check('nonsense is refused', kameaProblem('mars', []) !== null && kameaProblem('saturn', 'x') !== null && kameaProblem('saturn', [[1, 2], [3, 4]]) !== null && kameaProblem('saturn', [[0, 9, 2], [3, 5, 7], [8, 1, 6]]) !== null);

// ── The words ────────────────────────────────────────────────────────────────
check('Agrippa\'s own 1651 words for each table', /"a square of three, containing the particular numbers of nine/.test(KAMEA.saturn.says) && /"engraven on a plate of lead"/.test(KAMEA.saturn.use) && /"Impressed upon a Silver plate/.test(KAMEA.jupiter.use));
check('lore: the seals left to "the wise searcher"; name-tracing marked later, Golden Dawn 1910', /"the wise searcher"/.test(KAMEA_LORE) && /Tracing your own name across a square to make a sigil is a later habit/.test(KAMEA_LORE) && /1910/.test(KAMEA_LORE));
check('lore: Saturn\'s lead, with HSE\'s handwashing words', /eat, drink, smoke or bite your nails without washing your hands and face' \(HSE\)/.test(KAMEA_LORE));
check('sources: the 1651 translation, the NGA, the Museum of Witchcraft and Magic, HSE', /1651/.test(KAMEA_SOURCE) && /A26565/.test(KAMEA_SOURCE) && /National Gallery of Art/.test(KAMEA_SOURCE) && /Museum of Witchcraft and Magic/.test(KAMEA_SOURCE) && /HSE/.test(KAMEA_SOURCE));

// ── Through the game's own handler ───────────────────────────────────────────
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Agrippa'); connHandler(s);
  say(s, { type: 'join', name: 'Agrippa', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'kamea_a'; h.accounts.kamea_a = {};
  say(s, { type: 'real_shelf' });
  const shelf = s.lastOfType('real_shelf');
  check('the shelf carries both tables, Jupiter with its eight given numbers, and nothing done yet', shelf.kamea && shelf.kamea.tables.length === 2 && shelf.kamea.tables[1].givens.length === 8 && shelf.kamea.tables[1].givens.every(([i, j, v]) => KAMEA.jupiter.table[i][j] === v) && shelf.kamea.done.length === 0);
  check('…and does not send the answers', !JSON.stringify(shelf.kamea).includes('[4,9,2]') && !JSON.stringify(shelf.kamea).includes('[9,7,6,12]'));
  say(s, { type: 'fill_kamea', key: 'saturn', grid: [[4, 9, 3], [2, 5, 7], [8, 1, 6]] });
  check('a wrong Saturn: the reason comes back', /Row 1 makes 16/.test((s.lastOfType('kamea_result') || {}).problem || ''));
  say(s, { type: 'fill_kamea', key: 'saturn', grid: [[2, 9, 4], [7, 5, 3], [6, 1, 8]] });
  const r1 = s.lastOfType('kamea_result');
  check('a turned Saturn: done, told it is turned, XP the first time', r1.ok && r1.which === 'turned' && r1.xp === 25 && r1.done.includes('saturn'));
  say(s, { type: 'fill_kamea', key: 'saturn', grid: KAMEA.saturn.table });
  check('…no XP the second time', s.lastOfType('kamea_result').ok && s.lastOfType('kamea_result').xp === 0);
  say(s, { type: 'fill_kamea', key: 'jupiter', grid: KAMEA.jupiter.table });
  const r2 = s.lastOfType('kamea_result');
  check('Jupiter, as Agrippa printed it', r2.ok && r2.which === 'agrippa' && r2.xp === 40 && r2.done.length === 2);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
