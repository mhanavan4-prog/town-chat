// After Episode III (data/epilogues.js): Dame Isolt, one of the folk, and (for the Witch) Hazel at the ring
// each have a word, once, for someone whose class story is done.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-epi-test-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const { EPILOGUES, EPISODE_THREE_DONE } = require('../data/epilogues');
const { STORYLINES } = require('../data/quests');
const { ASH_SPOTS } = require('../data/emberTown');
const { FOLK_BY_ID } = require('../data/ashFolk');
const { RING, FIVE } = require('../data/witchRing');
check('every class has Isolt\'s word and one of the folk\'s; the Witch has Hazel at the ring besides', [0, 1, 2, 3, 4, 5].every((c) => EPILOGUES[c] && EPILOGUES[c].isolt.length > 80 && EPILOGUES[c].says.length > 60 && ['wat', 'nan'].includes(EPILOGUES[c].folk)) && /Hazel/.test(EPILOGUES[0].ring) && EPISODE_THREE_DONE === 12 && Object.values(STORYLINES).every((l) => l.chapters.length === 12));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, charId, chapter) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    const prog = h.getProgress(p); prog.level = 18; prog.story = { [charId]: { chapter, progress: 0, active: false } }; prog.ashminster = { arrived: true, spoke: true }; prog.questsDone = { isolt_field: true, isolt_watch: true };
    return { s, p };
  }
  const at = (p, x, y) => Object.assign(p, { room: 'ember_wastes', x, y, isDead: false, instance: '' });
  const toasts = (s) => s.sent.filter((m) => m.type === 'toast').map((m) => m.message);

  const W = join('Fifth', 0, 12);
  at(W.p, ASH_SPOTS.anchoress.x + 20, ASH_SPOTS.anchoress.y + 30); W.s.sent.length = 0;
  W.s.emit('message', JSON.stringify({ type: 'ash_use', id: 'anchoress' }));
  check('her story done, Isolt has a word for the Witch', toasts(W.s).some((t) => t.includes('two lamps lit')), toasts(W.s));
  W.s.sent.length = 0; W.s.emit('message', JSON.stringify({ type: 'ash_use', id: 'anchoress' }));
  check('once: after it she speaks as she always did', !toasts(W.s).some((t) => t.includes('two lamps lit')) && toasts(W.s).length >= 1);
  const nan = FOLK_BY_ID.nan;
  at(W.p, nan.x + 20, nan.y); W.s.sent.length = 0;
  W.s.emit('message', JSON.stringify({ type: 'ash_folk_use', id: 'nan' }));
  check('Nan at the well tells her who came', toasts(W.s).some((t) => t.includes('campion')), toasts(W.s));
  W.s.sent.length = 0; W.s.emit('message', JSON.stringify({ type: 'ash_folk_use', id: 'nan' }));
  check('and then the well is the well again', !toasts(W.s).some((t) => t.includes('campion')));
  at(W.p, RING.x + 80, RING.y); W.s.sent.length = 0;
  W.s.emit('message', JSON.stringify({ type: 'ring_use', id: FIVE[0].id }));
  check('and Hazel is at the ring before her', toasts(W.s).some((t) => t.includes('It still fits')), toasts(W.s));
  W.s.sent.length = 0; W.s.emit('message', JSON.stringify({ type: 'ring_use', id: FIVE[0].id }));
  check('once; after it the ring is used as it always was', !toasts(W.s).some((t) => t.includes('It still fits')));

  const B = join('Link', 1, 11);
  at(B.p, ASH_SPOTS.anchoress.x + 20, ASH_SPOTS.anchoress.y + 30); B.s.sent.length = 0;
  B.s.emit('message', JSON.stringify({ type: 'ash_use', id: 'anchoress' }));
  check('nothing of it for one whose story is not done', !toasts(B.s).some((t) => t.includes('hounds have stopped')));
  check('a chapter that sends you to her counts however many times you have spoken before', (() => {
    const M = join('Hears', 2, 10); h.getProgress(M.p).story[2].active = true; M.p.isoltHeard = 2;
    at(M.p, ASH_SPOTS.anchoress.x + 20, ASH_SPOTS.anchoress.y + 30);
    M.s.emit('message', JSON.stringify({ type: 'ash_use', id: 'anchoress' }));
    return h.getProgress(M.p).story[2].chapter === 11;
  })());
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
