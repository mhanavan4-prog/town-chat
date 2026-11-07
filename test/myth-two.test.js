// Myth or record?, ten more (data/mythOrRecord.js MYTH_QUIZ_2): familiars,
// the first broomstick picture, "ancient" Wicca, "Mother Hutton", the
// mandrake, witch marks, swimming, Salem, Helen Duncan and Joan of Arc. Two
// sets on the shelf, each with its own best; the first set's best is still
// the one older saves kept.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-myth2-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { MYTH_QUIZ, MYTH_QUIZ_2: Q, MYTH_SETS } = require('../data/mythOrRecord.js');
const MAIN = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
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

check('ten more, five myths and five on the record, alternating', Q.length === 10 && Q.filter((x) => x.answer === 'myth').length === 5 && Q.every((x, i) => i === 0 || x.answer !== Q[i - 1].answer) && Q.every((x) => x.claim && x.verdict && x.source));
const ids = MYTH_SETS.flatMap((s) => s.items.map((x) => x.id));
check('two sets, and no id used twice across them', MYTH_SETS.map((s) => s.key).join() === 'first,second' && MYTH_SETS[0].items === MYTH_QUIZ && new Set(ids).size === ids.length && ids.length === 20);
check('familiars: Chelmsford 1566, the white spotted cat', q('familiars').answer === 'record' && /1566/.test(q('familiars').verdict) && /"in the likeness of a white spotted Cat"/.test(q('familiars').verdict));
check('"ancient" Wicca: Gardner in the 1950s, on Murray\'s rejected witch-cult', q('ancient_wicca').answer === 'myth' && /Gardner/.test(q('ancient_wicca').verdict) && /Murray/.test(q('ancient_wicca').verdict) && /Witchcraft Today \(1954\)/.test(q('ancient_wicca').source));
check('the broomstick: Le Champion des Dames, Arras, 1451, BnF fr. 12476', q('broomstick_1451').answer === 'record' && /1451/.test(q('broomstick_1451').verdict) && /fr\. 12476, fol\. 105v/.test(q('broomstick_1451').source));
check('"Mother Hutton": Withering\'s unnamed old woman, the name an advertiser\'s; and the foxglove a poison', q('mother_hutton').answer === 'myth' && /"had long been kept a secret by an old woman in Shropshire"/.test(q('mother_hutton').verdict) && /advertisement/.test(q('mother_hutton').verdict) && /deadly poison/.test(q('mother_hutton').verdict));
check('the mandrake: Juliet\'s line and Gerard\'s dog, and no Josephus', q('mandrake_shriek').answer === 'record' && /"shrieks like mandrakes torn out of the earth"/.test(q('mandrake_shriek').verdict) && /Gerard/.test(q('mandrake_shriek').verdict) && !/Josephus/.test(q('mandrake_shriek').verdict + q('mandrake_shriek').source));
check('witch marks were made against witches (Historic England)', q('witch_marks').answer === 'myth' && /"to protect inhabitants and visitors from witches and evil spirits"/.test(q('witch_marks').verdict));
check('swimming: Daemonologie, and Mary Sutton', q('swimming').answer === 'record' && /Mary Sutton/.test(q('swimming').verdict) && /Daemonologie \(1597\)/.test(q('swimming').source));
check('Salem: nineteen hanged, Giles Corey pressed, none burned', q('salem_burned').answer === 'myth' && /nineteen people were hanged/.test(q('salem_burned').verdict) && /Giles Corey/.test(q('salem_burned').verdict) && /None was burned/.test(q('salem_burned').verdict));
check('Helen Duncan, 1944, and the Act repealed in 1951', q('helen_duncan').answer === 'record' && /1944/.test(q('helen_duncan').verdict) && /1951/.test(q('helen_duncan').verdict));
check('Joan of Arc: a relapsed heretic, with the trial\'s divination admitted', q('joan_witch').answer === 'myth' && /relapsed heretic/.test(q('joan_witch').verdict) && /Divination/.test(q('joan_witch').verdict));
check('the shelf offers each set with its own best, and sends the set it scored', /function mythSets\(m\)/.test(MAIN) && /data-set="\$\{k\}"/.test(MAIN) && /type: 'myth_quiz_done', set:/.test(MAIN) && /esc\(set\.title\)/.test(MAIN));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const join = (tag, acct, saved) => {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (acct) { p.accountKey = acct; h.accounts[acct] = saved || {}; h.playerProgress[acct] = { level: 1, xp: 0 }; }
    return { s, p };
  };
  // An older save kept the first set's best as mythBest.
  const a = join('Reader', 'reader', { mythBest: 7 });
  a.s.emit('message', JSON.stringify({ type: 'real_shelf' }));
  const sh = a.s.lastOfType('real_shelf');
  check('the shelf sends both sets; the older save\'s 7 is the first set\'s best', sh.myth.sets.length === 2 && sh.myth.sets[0].best === 7 && sh.myth.best === 7 && sh.myth.sets[1].best === null && sh.myth.sets[1].items.length === 10);
  check('…and a "Check it" for the second set\'s verdicts too', sh.checks['myth:witch_marks'] && sh.checks['myth:witch_marks'].some((p) => p.work));
  const right2 = Object.fromEntries(Q.map((x) => [x.id, x.answer]));
  a.s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: 'second', answers: right2 }));
  const r = a.s.lastOfType('myth_quiz_result');
  check('the second set is scored on its own: 10 of 10, kept as its best', r.set === 'second' && r.score === 10 && r.of === 10 && r.best === 10 && h.accounts.reader.mythBests.second === 10);
  check('…and the first set\'s best is untouched', h.accounts.reader.mythBest === 7);
  a.s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: 'second', answers: {} }));
  check('a worse run of the second set leaves its best', a.s.lastOfType('myth_quiz_result').best === 10);
  a.s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: 'first', answers: Object.fromEntries(MYTH_QUIZ.map((x) => [x.id, x.answer])) }));
  check('a better first-set run updates both its stores', h.accounts.reader.mythBests.first === 10 && h.accounts.reader.mythBest === 10);
  a.s.emit('message', JSON.stringify({ type: 'myth_quiz_done', set: '__proto__', answers: right2 }));
  const odd = a.s.lastOfType('myth_quiz_result');
  check('an unknown set is scored as the first set, and nothing odd is stored', odd.set === 'first' && odd.score === 0 && Object.keys(h.accounts.reader.mythBests).sort().join() === 'first,second');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
