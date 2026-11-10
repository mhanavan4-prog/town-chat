// A Bath curse tablet, put together on the Board: bath_cloak's step is a
// 'tablet', the clauses are the Tabellae Sulis' own words (Tomlin 1988, via
// RIB Online), and the server holds the player to the tablets' order: the
// goddess and the name (either first, as on 32 and 10), the curse or gift,
// the thief and what is denied him (either order, as on 10 and 32), and the
// way out last. Backwards writing is offered the ways the tablets have it.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-tablet-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const { TABELLA_TILES, TABELLA_BACKWARDS, tabellaProblem, tabellaText } = require('../data/tabella');
const { CALLERS, READING_KINDS } = require('../data/callers');
const c = CALLERS.find((x) => x.id === 'bath_cloak');
const tile = (k) => TABELLA_TILES.find((t) => t.key === k);

// ── The words are the tablets' own ───────────────────────────────────────────
check('Tab. Sulis 10: "devoveo eum qui caracallam meam involaverit", "I curse him who has stolen my hooded cloak"', tile('devoveo').latin === 'devoveo eum qui caracallam meam involaverit' && tile('devoveo').en === 'I curse him who has stolen my hooded cloak' && tile('devoveo').src === 'Tab. Sulis 10');
check('"si vir si femina si servus si liber", on 10 and 32', tile('si_vir').latin === 'si vir si femina si servus si liber' && /10 and 32/.test(tile('si_vir').src));
check('the way out: 10\'s "donec … ad templum sui numinis pertulerit", 32\'s "nissi … ad templum tuum detulerit"', /^donec caracallam meam ad templum sui numinis pertulerit$/.test(tile('donec').latin) && /^nissi se retegens istas species ad templum tuum detulerit$/.test(tile('nissi').latin));
check('the two addresses: "deae Suli Minervae" (32), "deae sanctissimae Suli" (10)', tile('suli_minervae').src === 'Tab. Sulis 32' && tile('sanctissimae').src === 'Tab. Sulis 10');
check('the adapted tiles say so', /^after Tab\. Sulis 32/.test(tile('dono').src) && /the caller's/.test(tile('name').src));
check('every tile names its tablet', TABELLA_TILES.every((t) => /Tab\. Sulis \d+/.test(t.src)));

// ── The order the tablets keep ───────────────────────────────────────────────
const ok32 = ['suli_minervae', 'name', 'dono', 'sanitatem', 'si_vir', 'nissi'];
const ok10 = ['name', 'sanctissimae', 'devoveo', 'si_vir', 'nascentes', 'donec'];
check('Tab. Sulis 32\'s order is right', tabellaProblem(ok32) === null);
check('Tab. Sulis 10\'s order (name first, thief before the denial) is right', tabellaProblem(ok10) === null);
check('the way out anywhere but last is wrong', /way out comes last/.test(tabellaProblem(['suli_minervae', 'name', 'devoveo', 'si_vir', 'donec', 'nascentes']) || ''));
check('the curse before the goddess is wrong', /Begin with the goddess and the name/.test(tabellaProblem(['devoveo', 'suli_minervae', 'name', 'si_vir', 'nascentes', 'donec']) || ''));
check('the thief in the third place is wrong', /the stolen thing/.test(tabellaProblem(['suli_minervae', 'name', 'si_vir', 'devoveo', 'nascentes', 'donec']) || ''));
check('two addresses is one too many', /goddess twice/.test(tabellaProblem(['suli_minervae', 'sanctissimae', 'devoveo', 'si_vir', 'nascentes', 'donec']) || ''));
check('a missing clause is named', /still wants the way out/.test(tabellaProblem(['suli_minervae', 'name', 'devoveo', 'si_vir', 'nascentes']) || ''));
check('nonsense is refused', tabellaProblem(['x']) !== null && tabellaProblem('abc') !== null && tabellaProblem([]) !== null);

// ── Backwards, the ways the tablets were ─────────────────────────────────────
check('backwards: the whole (98), each line (44, 62), each word (4)', TABELLA_BACKWARDS.whole.src === 'Tab. Sulis 98' && /44 and 62/.test(TABELLA_BACKWARDS.lines.src) && TABELLA_BACKWARDS.words.src === 'Tab. Sulis 4');
check('the whole text backwards ends with the goddess, reversed', tabellaText(ok32, 'whole').slice(-1)[0] === 'eavreniM iluS eaed');
check('each line backwards keeps the line order', tabellaText(ok32, 'lines')[0] === 'eavreniM iluS eaed');
check('each word backwards keeps the word order', tabellaText(ok32, 'words')[0] === 'eaed iluS eavreniM');

// ── The caller and the lore ──────────────────────────────────────────────────
check('the caller asks for a tablet, a reading the server credits', c && c.steps[0].kind === 'tablet' && READING_KINDS.includes('tablet'));
check('lore: about 130 from the spring, Tomlin\'s "largest published dossier of petty theft", Docilianus\'s cloak', /about 130/.test(c.lore) && /'the largest published dossier of petty theft in Roman Britain'/.test(c.lore) && /'until he has brought my hooded cloak to the temple of her divinity' \(Tab\. Sulis 10\)/.test(c.lore));
check('lore: few are true lead, "only four are in fact lead"', /'only four are in fact lead'/.test(c.lore) && /pewter/.test(c.lore));
check('the practical half: 999, 101, Crimestoppers, Report Fraud (not Action Fraud), lead hygiene from HSE and UKHSA', /the practical half/i.test(c.resolution) && /999/.test(c.resolution) && /101/.test(c.resolution) && /0800 555 111/.test(c.resolution) && /Report Fraud, which replaced Action Fraud/.test(c.resolution) && /0300 123 2040/.test(c.resolution) && /\(HSE\)/.test(c.resolution) && /\(UKHSA\)/.test(c.resolution) && /NHS 111/.test(c.resolution));
check('it doesn\'t send lead down the well', /you stop him, because the town drinks that water/.test(c.resolution));
check('record tier, Tomlin and RIB Online cited', c.tier === 'record' && /Tomlin/.test(c.source) && /RIB Online/.test(c.source) && /UNESCO/.test(c.source));

// ── Through the game's own handler ───────────────────────────────────────────
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Scribe'); connHandler(s);
  say(s, { type: 'join', name: 'Scribe', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'tablet_a'; h.accounts.tablet_a = {};
  h.accounts.tablet_a.callers = { day: Math.floor(Date.now() / 86400000), served: [], active: { id: 'bath_cloak', done: {} }, total: 0, byId: {} };
  const view = () => { say(s, { type: 'callers_state' }); return s.lastOfType('callers_state').active.steps[0]; };
  const v0 = view();
  check('the board gets the ten tiles, shuffled, and the ways backwards', v0.tablet && v0.tablet.tiles.length === 10 && v0.tablet.tiles[0].key !== 'suli_minervae' && v0.tablet.backwards.length === 4 && !v0.done);
  s.sent.length = 0;
  say(s, { type: 'tablet_write', parts: ['devoveo', 'suli_minervae', 'name', 'si_vir', 'nascentes', 'donec'], backwards: 'none' });
  check('out of order, the server says why, and the step waits', /Begin with the goddess/.test((s.lastOfType('caller_error') || {}).message || '') && !view().done);
  say(s, { type: 'tablet_write', parts: { 0: 'x' } });
  check('a malformed write changes nothing', !view().done);
  say(s, { type: 'tablet_write', parts: ok10, backwards: 'whole' });
  const v1 = view();
  check('in order, the step is done, and the note says how it was written', v1.done && /written to Sulis/.test(v1.note) && /backwards/.test(v1.note), v1);
  s.sent.length = 0;
  say(s, { type: 'caller_finish' });
  check('and Jonah pays', !!s.lastOfType('caller_result'), s.lastOfType('caller_error'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
