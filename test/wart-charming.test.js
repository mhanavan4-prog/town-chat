// Charming warts: a knot for every wart, tied one by one on the Board — and an
// honest resolution about why wart charms so often "worked".
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-warts-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { WART_CHARM } = require('../data/charms.js');
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

check('the wart charm cites Henderson and says why charms "worked"', /Henderson, Notes on the Folk-Lore of the Northern Counties/.test(WART_CHARM.source) && /go away on their own/.test(WART_CHARM.lore) && WART_CHARM.tier === 'record');
check('…a knot for every wart, and the apple: the North\'s, "This, too, is done in Devonshire"; Hunt\'s Cornish knot touched to each wart', /as many knots/.test(WART_CHARM.use) && /an apple cut in two/.test(WART_CHARM.lore) && /"This, too, is done in Devonshire"/.test(WART_CHARM.lore) && !/in Devonshire an apple/.test(WART_CHARM.lore) && /"each wart being carefully touched with the knot dedicated to it"/.test(WART_CHARM.lore) && /Hunt, Popular Romances/.test(WART_CHARM.source));
check('knots is a reading kind', READING_KINDS.includes('knots'));
const c = CALLERS.find((x) => x.id === 'charming_warts');
check('Tam Lumsden has five warts, and brings an apple step', c && c.steps[0].kind === 'knots' && c.steps[0].count === 5 && c.steps[1].item === 'crab_apple');
check('the lore: Henderson\'s "choice of several modes of relief", Devonshire as an also, Hunt\'s knot, Bacon\'s own warts, Cochrane\'s three in ten', /"the choice of several modes of relief"/.test(c.lore) && /"This, too, is done in Devonshire"/.test(c.lore) && /"each wart being carefully touched with the knot dedicated to it"/.test(c.lore) && /"because of mine own experience"/.test(c.lore) && /about three cases in ten/.test(c.lore) && /"a very reasonable option"/.test(c.lore) && /Cochrane/.test(c.source) && /Bacon/.test(c.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Charmer'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Charmer', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'wartcharmer'; h.accounts.wartcharmer = {}; h.playerProgress.wartcharmer = { level: 1, xp: 0 };
  const say = (m) => s.emit('message', JSON.stringify(m));

  say({ type: 'knot_tie' });
  check('no working, no knots', /no working in hand/.test((s.lastOfType('caller_error') || {}).message || ''));

  h.callers.stateOf(p);
  h.accounts.wartcharmer.callers.active = { id: 'charming_warts', done: {} };
  const step = () => h.callers.callersStatePayload(p).active.steps[0];
  check('the Board shows five knots to tie and how', step().count === 5 && step().tied === 0 && /as many knots/.test(step().use));
  for (let k = 1; k <= 4; k++) say({ type: 'knot_tie' });
  check('four knots: not done, and not yet remembered', step().tied === 4 && !step().done && !(h.accounts.wartcharmer.charmsSaid || []).includes('warts'));
  say({ type: 'knot_tie' });
  check('the fifth knot completes the step', step().done && /5 knots tied, one touched to every wart, for Tam Lumsden/.test(step().note), step().note);
  check('the account remembers the wart charm', (h.accounts.wartcharmer.charmsSaid || []).includes('warts'));
  say({ type: 'knot_tie' });
  check('no more knots to tie', /no knots to tie/.test((s.lastOfType('caller_error') || {}).message || ''));

  const ch = buildCharmBook({ acct: h.accounts.wartcharmer, prog: {}, seasonKey: null }).chapters.find((x) => x.key === 'charms');
  check('the Charm Book writes in Charming Warts', ch.entries.find((e) => e.id === 'warts').met);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
