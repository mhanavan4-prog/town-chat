// Dowsing for a well with a forked hazel twig, and Agricola's own test of it:
// the twig dips at random as you walk the Wilds; you dig where it dipped and
// once well away from every dip; water is struck at both, at a depth that
// depends only on the spot. The lore and the practical half say plainly that
// tested fairly the twig does no better than chance.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-dowse-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const D = require('../data/dowsing');
const { CALLERS, READING_KINDS } = require('../data/callers');
const c = CALLERS.find((x) => x.id === 'dowse_well');
// ── Water is hard to miss ────────────────────────────────────────────────────
let all = true, depths = new Set();
for (let x = 0; x < 10000; x += 137) for (let y = 0; y < 10000; y += 211) { const f = D.dowseDepth(x, y); if (!(f >= 4 && f <= 13)) all = false; depths.add(f); }
check('every spot in the Wilds strikes water, 4 to 13 feet down, and the depth varies', all && depths.size >= 8);
check('the depth depends only on the spot', D.dowseDepth(1234, 5678) === D.dowseDepth(1234, 5678) && D.dowseDepth(1234, 5678) === D.dowseDepth(1240, 5680));
// ── The words ────────────────────────────────────────────────────────────────
check('Agricola: the hazel fork, the clenched fists, "turns and twists", and his own verdict', /'a forked one cut from a hazel bush'/.test(D.DOWSE_LORE) && /'with their hands, clenching their fists'/.test(D.DOWSE_LORE) && /'It is said that the moment they place their feet on a vein the twig immediately turns and twists'/.test(D.DOWSE_LORE) && /'the manipulation is the cause of the twig's twisting motion'/.test(D.DOWSE_LORE) && /'should not make use of an enchanted twig'/.test(D.DOWSE_LORE));
check('England: the Cornish mines in Elizabeth\'s day, Wiltshire water', /Cornish mines by the merchant venturers of Queen Elizabeth's day/.test(D.DOWSE_LORE) && /Wiltshire/.test(D.DOWSE_LORE));
check('the verdict, plainly: no better than chance, the ideomotor effect, water hard to miss', /'when it has been tested impartially it has been no more successful than would be expected by chance'/.test(D.DOWSE_LORE) && /ideomotor/.test(D.DOWSE_LORE) && /'in many areas water would be hard to miss'/.test(D.DOWSE_LORE));
check('a record-tier caller whose step is a reading the server credits', c.tier === 'record' && c.steps[0].kind === 'dowse' && READING_KINDS.includes('dowse') && /Agricola/.test(c.source));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Dowser'); connHandler(s);
  say(s, { type: 'join', name: 'Dowser', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'dowse_a'; h.accounts.dowse_a = { callers: { day: Math.floor(Date.now() / 86400000), served: [], active: { id: 'dowse_well', done: {} }, total: 0, byId: {} } };
  const view = () => { say(s, { type: 'callers_state' }); return s.lastOfType('callers_state').active.steps[0]; };
  say(s, { type: 'dowse_dig' });
  check('digging in town is refused', /in the Wilds/.test((s.lastOfType('caller_error') || {}).message || ''));
  p.room = 'wilds';
  say(s, { type: 'move', x: 3000, y: 3000, room: 'wilds' });
  say(s, { type: 'dowse_dig' });
  check('digging before the twig has dipped anywhere is refused', /Walk with the twig first/.test(s.lastOfType('caller_error').message));
  let x = 3000;
  const dipsBefore = () => view().dowse.dips;
  for (let k = 0; k < 120 && dipsBefore() === 0; k++) { x += 20; say(s, { type: 'move', x, y: 3000, room: 'wilds' }); }
  check('walking, the twig dips at random, and says so', view().dowse.dips >= 1 && s.sent.some((m) => m.type === 'toast' && /twists down in your hands/.test(m.message)));
  check('…and the Board knows you stand where it dipped', view().dowse.dipNow === true);
  say(s, { type: 'move', x: x + 120, y: 3000, room: 'wilds' });
  say(s, { type: 'dowse_dig' });
  check('a dig near, but not at, a dip is neither: refused', /Dig where the twig dipped, or well away/.test(s.lastOfType('caller_error').message));
  say(s, { type: 'move', x, y: 3000, room: 'wilds' });
  say(s, { type: 'dowse_dig' });
  check('dug where it dipped: water', view().dowse.dug.length === 1 && view().dowse.dug[0].dipped === true && s.sent.some((m) => m.type === 'toast' && /Where the twig dipped, you strike water at \d+ feet/.test(m.message)));
  say(s, { type: 'dowse_dig' });
  check('the same kind of dig twice is refused', /Now dig well away/.test(s.lastOfType('caller_error').message));
  p.x = 8000; p.y = 8000; p._dowse = null;
  say(s, { type: 'move', x: 8000, y: 8000, room: 'wilds' });
  say(s, { type: 'dowse_dig' });
  const v = view();
  check('dug well away from every dip: water there too, and the step is done', v.done && /where the twig dipped, and at \d+ ft where it did not: water was hard to miss/.test(v.note), v);
  s.sent.length = 0;
  say(s, { type: 'caller_finish' });
  check('and Tobias pays', !!s.lastOfType('caller_result'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
