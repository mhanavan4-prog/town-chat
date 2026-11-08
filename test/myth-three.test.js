// Myth or record?, herbs and healing (data/mythOrRecord.js MYTH_QUIZ_3): the
// King's Evil, "eye of newt", the toadstone, the doctrine of signatures,
// willow bark, the plague doctor, vervain, bloodletting, rosemary and the
// apple a day. A third set on the shelf, with its own best.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-myth3-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MYTH_QUIZ_3: Q, MYTH_SETS } = require('../data/mythOrRecord.js');
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
const q = (id) => Q.find((x) => x.id === id);

check('ten on herbs and healing, five myths and five on the record, alternating', Q.length === 10 && Q.filter((x) => x.answer === 'myth').length === 5 && Q.every((x, i) => i === 0 || x.answer !== Q[i - 1].answer) && Q.every((x) => x.claim && x.verdict && x.source));
check('the third set on the shelf, "Herbs and healing"', MYTH_SETS[2] && MYTH_SETS[2].key === 'third' && MYTH_SETS[2].title === 'Herbs and healing' && MYTH_SETS[2].items === Q);
check('the King\'s Evil: tens of thousands, and Johnson touched in 1712 (not 1711)', q('kings_evil').answer === 'record' && /tens of thousands/.test(q('kings_evil').verdict) && /1712/.test(q('kings_evil').verdict) && /"a lady in diamonds, and a long black hood\."/.test(q('kings_evil').verdict));
check('"eye of newt": no early source, and not all the ingredients are animals', q('eye_of_newt').answer === 'myth' && /No herbal or dictionary before 1900/.test(q('eye_of_newt').verdict) && /"Root of Hemlocke"/.test(q('eye_of_newt').verdict));
check('the toadstone: a fossil fish tooth; Shakespeare\'s jewel', q('toadstone').answer === 'record' && /fossil teeth of an extinct fish/.test(q('toadstone').verdict) && /"Wears yet a precious jewel in his head"/.test(q('toadstone').verdict));
check('signatures: learned, not peasant (Paracelsus, della Porta 1588, Coles 1657)', q('signatures_peasant').answer === 'myth' && /Paracelsus/.test(q('signatures_peasant').verdict) && /1588/.test(q('signatures_peasant').verdict) && /Adam in Eden \(1657\)/.test(q('signatures_peasant').verdict));
check('willow bark: Edward (not "Edmund") Stone, 1763', q('willow_bark').answer === 'record' && /Edward Stone/.test(q('willow_bark').verdict) && /"remedies lie not far from their causes"/.test(q('willow_bark').verdict) && /Philosophical Transactions 53 \(1763\)/.test(q('willow_bark').source));
check('the plague doctor: France, Italy, Rome 1656; no London 1665 source, and no stronger claim', q('plague_doctor').answer === 'myth' && /Rome in 1656/.test(q('plague_doctor').verdict) && /No London source of 1665 is known to show it/.test(q('plague_doctor').verdict));
check('vervain: the charm, mocked in 1624', q('vervain_charm').answer === 'record' && /"Hallowed be thou, Vervein, \/ As thou growest on the ground,/.test(q('vervain_charm').verdict) && /1624/.test(q('vervain_charm').verdict));
check('bloodletting: Washington, 1799, and the leeches of 1833', q('bloodletting').answer === 'myth' && /1799/.test(q('bloodletting').verdict) && /forty-two million leeches/.test(q('bloodletting').verdict));
check('rosemary: Ophelia and Gerard (not Bankes)', q('rosemary_memory').answer === 'record' && /"There's rosemary, that's for remembrance\."/.test(q('rosemary_memory').verdict) && /Gerard/.test(q('rosemary_memory').verdict) && !/Bankes/.test(q('rosemary_memory').verdict + q('rosemary_memory').source));
check('the apple a day: Pembrokeshire, 1866, and the modern words by the late 1880s', q('apple_a_day').answer === 'myth' && /1866/.test(q('apple_a_day').verdict) && /"Eat an apple on going to bed, \/ And you'll keep the doctor from earning his bread\."/.test(q('apple_a_day').verdict) && /late 1880s/.test(q('apple_a_day').verdict));
check('Culpeper\'s "trial" is not claimed', !Q.some((x) => /Culpeper/.test(x.claim + x.verdict)));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Herbalist'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Herbalist', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'herbalist'; h.accounts.herbalist = {}; h.playerProgress.herbalist = { level: 1, xp: 0 };
  s.emit('message', JSON.stringify({ type: 'real_shelf' }));
  const sh = s.lastOfType('real_shelf');
  check('the shelf sends the third set, not yet tried, with its "Check it" links', sh.myth.sets[2] && sh.myth.sets[2].key === 'third' && sh.myth.sets[2].best === null && sh.checks['myth:kings_evil'].some((x) => x.work));
  s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: 'third', answers: Object.fromEntries(Q.map((x) => [x.id, x.answer])) }));
  const r = s.lastOfType('myth_quiz_result');
  check('the third set is scored and kept on its own', r.set === 'third' && r.score === 10 && h.accounts.herbalist.mythBests.third === 10 && !h.accounts.herbalist.mythBests.first);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
