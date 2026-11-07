// Hallowe'en rites — Burns's charms of a Scottish Hallowe'en, worked for
// callers who come to the door only in the Samhain season.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-halloween-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { HALLOWEEN_RITES } = require('../data/halloween.js');
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

// ── The rites, after Burns's notes ──
check('five rites: nuts, kail, apple, clue, luggies', JSON.stringify(Object.keys(HALLOWEEN_RITES)) === '["nuts","kail","apple","clue","luggies"]');
check('every rite cites Burns\'s "Halloween" and his notes, and is badged record', Object.values(HALLOWEEN_RITES).every((r) => /Burns, "Halloween" \(1785; Kilmarnock edition 1786\), with his own notes/.test(r.source) && r.tier === 'record'));
check('every rite says how it was done and has signs to give', Object.values(HALLOWEEN_RITES).every((r) => r.how && r.lore && r.outcomes.length >= 3));
check('the blue clue keeps its question: "Wha hauds?"', /Wha hauds\?/.test(HALLOWEEN_RITES.clue.lore));
check('the rite is a reading kind', READING_KINDS.includes('rite'));
const seasonal = CALLERS.filter((c) => c.season === 'samhain');
check('three Hallowe\'en callers, all Samhain-only', seasonal.length === 3 && seasonal.every((c) => c.steps.some((s) => s.kind === 'rite')));
check('between them they work all five rites', new Set(seasonal.flatMap((c) => c.steps.filter((s) => s.kind === 'rite').map((s) => s.rite))).size === 5);

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const s = makeMockSocket('Guiser'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Guiser', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'guiser'; h.accounts.guiser = {}; h.playerProgress.guiser = { level: 1, xp: 0 };
  const say = (m) => s.emit('message', JSON.stringify(m));
  h.callers.stateOf(p);

  // ── The season gate ──
  const HALLOWEEN = Date.UTC(2026, 9, 31, 20), MIDSUMMER = Date.UTC(2026, 5, 21, 12);
  const seasonAt = (t) => at(t, () => h.calendarPublicState().season.key);
  check('the calendar calls 31 October Samhain', seasonAt(HALLOWEEN) === 'samhain', seasonAt(HALLOWEEN));
  let summerSeasonal = 0, samhainFirst = 0, days = 0;
  for (let d = 0; d < 20; d++) {
    const summer = at(MIDSUMMER + d * 86400000, () => h.callers.callersStatePayload(p).offered.map((o) => o.id));
    summerSeasonal += summer.filter((id) => seasonal.some((c) => c.id === id)).length;
    const hallow = at(HALLOWEEN - 10 * 86400000 + d * 86400000, () => ({ season: h.calendarPublicState().season.key, ids: h.callers.callersStatePayload(p).offered.map((o) => o.id) }));
    // A dated caller (Martinmas week, 9–13 Nov) goes first of all; then the season's.
    const lead = hallow.ids[0] === 'martinmas_cock' ? hallow.ids[1] : hallow.ids[0];
    if (hallow.season === 'samhain') { days++; if (seasonal.some((c) => c.id === lead)) samhainFirst++; }
  }
  check('no Hallowe\'en caller ever comes at midsummer (20 days)', summerSeasonal === 0, summerSeasonal);
  check('in the Samhain season one is always first at the door (after Martinmas\'s, in its week)', days > 0 && samhainFirst === days, { days, samhainFirst });

  // ── Working a rite ──
  h.accounts.guiser.callers.active = { id: 'hallowe_en_nuts', done: {} };
  const step = (i) => h.callers.callersStatePayload(p).active.steps[i];
  check('the Board shows how the rite is done', step(0).rite && /two nuts/.test(step(0).rite.how));
  say({ type: 'rite_do' });
  check('doing it gives a sign from the nuts, noted on the step', step(0).done && HALLOWEEN_RITES.nuts.outcomes.some((o) => step(0).note.endsWith(o)), step(0).note);
  say({ type: 'rite_do' });
  check('the next rite (the luggies) is next', step(1).done && HALLOWEEN_RITES.luggies.outcomes.some((o) => step(1).note.endsWith(o)), step(1).note);
  check('the account remembers both rites', JSON.stringify(h.accounts.guiser.ritesDone) === '["nuts","luggies"]');
  const first = step(0).note;
  h.accounts.guiser.callers.active = { id: 'hallowe_en_nuts', done: {} };
  say({ type: 'rite_do' });
  check('the same account gets the same sign again (no fishing)', step(0).note === first);
  say({ type: 'rite_do' }); say({ type: 'rite_do' });
  check('no rite left, nothing to do', /no rite/.test((s.lastOfType('caller_error') || {}).message || ''));

  const book = buildCharmBook({ acct: h.accounts.guiser, prog: {}, seasonKey: null });
  const ch = book.chapters.find((c) => c.key === 'halloween');
  check('the Charm Book has a Hallowe\'en chapter of five, two written in', ch && ch.total === 5 && ch.met === 2);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
