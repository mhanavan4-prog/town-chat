// The toothache paper, written out by the player: the_toothache's step is now
// a written charm, copied line by line as the Science Museum's Scottish paper
// has it (co106732), folded eight times as at Kishorn (Black, 1893); the lore
// adds Henderson's Sussex prayer-book copy and Black's Kishorn and Orkney.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-tooth-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
function makeMockSocket(tag) {
  return { OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); }, emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); }, lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; } };
}
const { SCRIBINGS } = require('../data/charms');
const { CALLERS } = require('../data/callers');
const T = SCRIBINGS.tooth, c = CALLERS.find((x) => x.id === 'the_toothache');
check('the paper\'s own words, from "In the Name of the Lord God" to "shall never have the toothache"', T.copy && T.lines.length === 7 && T.lines[0] === 'In the Name of the Lord God,' && /Christ came by and asked what aileth thee Peter\?/.test(T.lines.join(' ')) && T.lines[6] === 'shall never have the toothache.');
check('the caller asks you to write it', c.steps[0].kind === 'scribe' && c.steps[0].charm === 'tooth');
check('…folded eight times, not to be opened (Kishorn)', /fold the paper eight times/.test(c.resolution) && /not to open it to look/.test(c.resolution) && /shilling is cheaper/.test(c.resolution));
check('…and the lore: Henderson\'s prayer-book, Kate M\'Aulay at Kishorn, Orkney\'s sewn lines; Black and Henderson cited', /"from the fly-leaf of a common prayer-book"/.test(c.lore) && /Kate M'Aulay, "a professional witch"/.test(c.lore) && /"folded eight times"/.test(c.lore) && /"lose its efficacy when looked at"/.test(c.lore) && /"sewed into some part of the dress"/.test(c.lore) && /PSAS 27 \(1893\)/.test(c.source) && /Henderson/.test(c.source));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  const s = makeMockSocket('Writer'); connHandler(s);
  say(s, { type: 'join', name: 'Writer', charId: 0 });
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'tooth_a'; h.accounts.tooth_a = {};
  h.accounts.tooth_a.callers = { day: Math.floor(Date.now() / 86400000), served: [], active: { id: 'the_toothache', done: {} }, total: 0, byId: {} };
  const view = () => { say(s, { type: 'callers_state' }); return s.lastOfType('callers_state').active.steps[0]; };
  check('the board shows the paper to copy', view().scribe.copy === true && view().written === 0);
  s.sent.length = 0;
  say(s, { type: 'scribe_line', text: 'Peter sat on a marble stone weeping' });
  check('out of order, it says which line to copy', /Copy the line as it stands: "In the Name of the Lord God,"/.test((s.lastOfType('caller_error') || {}).message || '') && view().written === 0);
  say(s, { type: 'scribe_line', text: 'in the name of the lord god' });
  check('case and stops don\'t count', view().written === 1);
  for (const ln of T.lines.slice(1)) say(s, { type: 'scribe_line', text: ln });
  const v = view();
  check('seven lines, folded eight times', v.done && /folded eight times/.test(v.note));
  check('the Charm Book\'s toothache charm is met', (h.accounts.tooth_a.charmsSaid || []).includes('tooth'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
