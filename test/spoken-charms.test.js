// Spoken charms: the charmer's craft. Three recorded charms (burn, blood,
// toothache), said line by line for a caller on the Town Board, each caller
// pairing the words with the sound practical half of the cure.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-charms-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { CHARMS } = require('../data/charms.js');
const { CALLERS, READING_KINDS } = require('../data/callers.js');
const { buildCharmBook } = require('../lib/charmBook.js');
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

// ── The words, as recorded ──
check('the spoken charms: burn, blood, toothache, sprain, cramp', JSON.stringify(Object.keys(CHARMS)) === '["burn","blood","tooth","sprain","cramp"]');
check('the burn charm is Hunt\'s: three angels, fire and frost', /three angels out of the east/.test(CHARMS.burn.lines[0]) && /One brought fire and two brought frost/.test(CHARMS.burn.lines[1]) && /Out fire and in frost/.test(CHARMS.burn.lines[2]) && /Hunt.*1865/.test(CHARMS.burn.source));
check('the blood charm is Ezekiel 16:6 word for word', CHARMS.blood.lines.join(' ') === 'And when I passed by thee, and saw thee polluted in thine own blood, I said unto thee when thou wast in thy blood, Live.' && /Ezekiel 16:6/.test(CHARMS.blood.source) && /Dorson.*1952/.test(CHARMS.blood.source));
check('the toothache charm opens and closes as the Scottish paper does, and says the middle is shortened', /Peter sat on a marble stone weeping/.test(CHARMS.tooth.lines[1]) && /shall never have the toothache/.test(CHARMS.tooth.lines[3]) && /shortened/.test(CHARMS.tooth.lore) && /co106732/.test(CHARMS.tooth.source));
check('every charm is badged and sourced', Object.values(CHARMS).every((c) => c.tier === 'record' && c.source && c.lore && c.use));

// ── The callers ──
check('the charm is a reading kind', READING_KINDS.includes('charm'));
const scald = CALLERS.find((c) => c.id === 'the_scald'), axe = CALLERS.find((c) => c.id === 'the_axe_slipped'), tooth = CALLERS.find((c) => c.id === 'the_toothache');
check('three charm callers, one per charm', scald && axe && tooth && scald.steps[0].charm === 'burn' && axe.steps[0].charm === 'blood' && tooth.steps[0].charm === 'tooth');
check('the scald is cooled under the pump, not just charmed', /cold pump/.test(scald.resolution) && /cold water is doing the real work/.test(scald.resolution));
// The scald's practical half (NHS, British Red Cross, nidirect): twenty minutes under cool water, cling film and nothing else, no leaves on the burn; a child seen, 111 and 999; the kettle.
check('(the lore, as audited) …and its practical half: twenty minutes, within three hours; cling film over not round; no butter, oil, cream or leaves; blisters left; a child always seen, 111 under five, 999; the short flex and the fifteen-minute drink', scald.steps[1].item === 'bramble_vine' && !/lay on it/.test(scald.steps[1].label));
check('…and its lore no longer says "never charged" or "nearly every parish"; Hunt\'s section and Courtney cited', !/never charged|nearly every parish/.test(scald.lore) && /§132 "For a Scald or Burn", p\. 213/.test(scald.source) && /Courtney/.test(scald.source) && /NHS/.test(scald.source));
check('the burn charm: the leaves "employed in this charm", Bottrell\'s and Courtney\'s "Three ladies", the two rules on the sexes, and the paid Penzance charmer', /"Bramble-leaves, or sometimes the leaves of the common dock, wetted with spring water, are employed in this charm"/.test(CHARMS.burn.use) && /"Three ladies come from the east, \/ One with fire and two with frost"/.test(CHARMS.burn.lore) && !/Three wise men/.test(CHARMS.burn.lore) && /"A man would not on any account tell his charm to a woman, or a woman communicate hers to a man"/.test(CHARMS.burn.lore) && /"must never communicate them to one of the same sex"/.test(CHARMS.burn.lore) && /"made a great deal of money by her profession"/.test(CHARMS.burn.lore));
check('the axe wound gets pressure and the surgeon', /press down/.test(axe.resolution) && /surgeon/.test(axe.resolution));
check('the toothache is sent to the barber if it doesn\'t ease', /shilling is cheaper/.test(tooth.resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Charmer'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Charmer', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'charmer'; h.accounts.charmer = {}; h.playerProgress.charmer = { level: 1, xp: 0 };
  const say = (m) => s.emit('message', JSON.stringify(m));

  say({ type: 'charm_say', line: 0 });
  check('no working, no charm', /no working in hand/.test((s.lastOfType('caller_error') || {}).message || ''));

  h.callers.stateOf(p);
  h.accounts.charmer.callers.active = { id: 'the_scald', done: {} };
  const step = () => h.callers.callersStatePayload(p).active.steps[0];
  check('the Board shows the charm\'s lines and how it is used', step().charm && step().charm.lines.length === 4 && /dock leaves/.test(step().charm.use) && step().said === 0);

  say({ type: 'charm_say', line: 2 });
  check('lines must be said in order', /Say it in order/.test((s.lastOfType('caller_error') || {}).message || '') && step().said === 0);

  for (let li = 0; li < 3; li++) say({ type: 'charm_say', line: li });
  check('each line said moves it on', step().said === 3 && !step().done);
  check('not remembered until the last line', !(h.accounts.charmer.charmsSaid || []).includes('burn'));
  say({ type: 'charm_say', line: 3 });
  check('the last line completes the step', step().done && /You said the charm for a burn for Annie Polglase/.test(step().note), step().note);
  check('the account remembers the charm', (h.accounts.charmer.charmsSaid || []).includes('burn'));

  say({ type: 'charm_say', line: 0 });
  check('nothing more to say once it is said', /no charm to say/.test((s.lastOfType('caller_error') || {}).message || ''));

  const book = buildCharmBook({ acct: h.accounts.charmer, prog: {}, seasonKey: null });
  const ch = book.chapters.find((c) => c.key === 'charms');
  check('the Charm Book has a Spoken Charms chapter: five said, and the wart and stye workings', ch && ch.total === 7 && ch.entries.some((e) => e.id === 'warts') && ch.entries.some((e) => e.id === 'stye'));
  check('…with the burn charm written in, words and all', ch && ch.entries.find((e) => e.id === 'burn').met && /three angels/.test(ch.entries.find((e) => e.id === 'burn').lore));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
