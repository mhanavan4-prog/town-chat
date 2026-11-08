// Myth or record?, feasts and festivals (data/mythOrRecord.js MYTH_QUIZ_4):
// lanterns, the Windsor tree, mistletoe, Eostre, hot cross buns, the 1647 ban,
// Santa's red, a Valentine of 1477, the bonfires and the plum pudding. A
// fourth set on the shelf, with its own best.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-myth4-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { MYTH_QUIZ_4: Q, MYTH_SETS } = require('../data/mythOrRecord.js');
const { HOP_RITES } = require('../data/hopTuNaa.js');
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

check('ten on feasts and festivals, myths and records alternating', Q.length === 10 && Q.filter((x) => x.answer === 'myth').length === 5 && Q.every((x, i) => i === 0 || x.answer !== Q[i - 1].answer) && Q.every((x) => x.claim && x.verdict && x.source));
check('the fourth set on the shelf, "Feasts and festivals"', MYTH_SETS[3] && MYTH_SETS[3].key === 'fourth' && MYTH_SETS[3].title === 'Feasts and festivals' && MYTH_SETS[3].items === Q);
check('lanterns: turnips in Ireland and Man, agreeing with Hop-tu-Naa\'s moots; no unsourced mangel-wurzels', q('pumpkin_lanterns').answer === 'myth' && /turnips/.test(q('pumpkin_lanterns').verdict) && /moots, hollowed turnips/.test(HOP_RITES.hop_tu_naa.lore) && !/mangel/i.test(q('pumpkin_lanterns').verdict));
check('Windsor: Queen Charlotte, in the Royal Collection\'s words; the 1848 picture', q('windsor_tree').answer === 'record' && /"It was in fact Queen Charlotte who introduced Christmas trees to Britain"/.test(q('windsor_tree').verdict) && /1848/.test(q('windsor_tree').verdict));
check('mistletoe: Pliny\'s golden sickle, no kissing; the kiss from 1784', q('mistletoe_druids').answer === 'myth' && /"with a golden sickle"/.test(q('mistletoe_druids').verdict) && /1784/.test(q('mistletoe_druids').verdict));
check('Eostre: what Bede wrote of the month, and the doubt', q('eostre_bede').answer === 'record' && /Eosturmonath/.test(q('eostre_bede').verdict) && /"once called after a goddess of theirs named Eostre"/.test(q('eostre_bede').verdict) && /argued/.test(q('eostre_bede').verdict));
check('hot cross buns: first recorded 1733, the pagan tale Victorian; no unchecked street cry', q('buns_eostre').answer === 'myth' && /1733/.test(q('buns_eostre').verdict) && /Victorian/.test(q('buns_eostre').verdict) && !/one a penny/i.test(q('buns_eostre').verdict));
check('1647: the ordinance\'s words, Canterbury, 1660', q('christmas_banned').answer === 'record' && /8 June 1647/.test(q('christmas_banned').verdict) && /"be no longer observed as Festivals or Holy-dayes"/.test(q('christmas_banned').verdict) && /Canterbury/.test(q('christmas_banned').verdict));
check('Santa: 1868 before 1931, and Coca-Cola\'s own words', q('santa_red').answer === 'myth' && /1868/.test(q('santa_red').verdict) && /"Santa appeared in a red coat before Sundblom painted him"/.test(q('santa_red').verdict));
check('Margery Brews, 1477, in Gairdner\'s spelling', q('valentine_1477').answer === 'record' && /"my ryght wele-beloved Voluntyne"/.test(q('valentine_1477').verdict) && /Paston Letters, vol\. V \(1904\), no\. 897/.test(q('valentine_1477').source));
check('the bonfires: the Act ordered prayers, not fires (a myth, not a record)', q('bonfires_law').answer === 'myth' && /"say Morning Prayer, and give unto Almighty God Thanks"/.test(q('bonfires_law').verdict) && /1859/.test(q('bonfires_law').verdict));
check('plum porridge: Glasse, 1747, "a Leg and Shin of Beef"', q('plum_porridge').answer === 'record' && /"Take a Leg and Shin of Beef"/.test(q('plum_porridge').verdict) && /1747/.test(q('plum_porridge').verdict));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Feaster'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Feaster', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'feaster'; h.accounts.feaster = {}; h.playerProgress.feaster = { level: 1, xp: 0 };
  s.emit('message', JSON.stringify({ type: 'real_shelf' }));
  const sh = s.lastOfType('real_shelf');
  check('the shelf sends the fourth set, not yet tried', sh.myth.sets[3] && sh.myth.sets[3].key === 'fourth' && sh.myth.sets[3].best === null);
  s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: 'fourth', answers: Object.fromEntries(Q.map((x) => [x.id, x.answer])) }));
  const r = s.lastOfType('myth_quiz_result');
  check('the fourth set is scored and kept on its own', r.set === 'fourth' && r.score === 10 && h.accounts.feaster.mythBests.fourth === 10);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
