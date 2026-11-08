// Yule callers — wassailing the orchard, first-footing at Hogmanay and the
// Yule log, worked for callers who come to the door only in the Yule season.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-yule-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { YULE_RITES } = require('../data/yule.js');
const { HALLOWEEN_RITES } = require('../data/halloween.js');
const { CALLERS } = require('../data/callers.js');
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

// ── The rites, as recorded ──
check('three Yule rites: wassail, first-foot, Yule log', JSON.stringify(Object.keys(YULE_RITES)) === '["wassail","firstfoot","yulelog"]');
check('no Yule rite shares a key with a Hallowe\'en rite', Object.keys(YULE_RITES).every((k) => !HALLOWEEN_RITES[k]));
check('every rite is badged record, sourced, says how it was done and has signs to give', Object.values(YULE_RITES).every((r) => r.tier === 'record' && r.source && r.how && r.lore && r.outcomes.length >= 3));
check('every sign fits whole on the Board (step notes are cut at 140)', [...Object.values(YULE_RITES), ...Object.values(HALLOWEEN_RITES)].every((r) => r.outcomes.every((o) => `${r.icon} ${r.name}: ${o}`.length <= 140)));
check('the wassail quotes Herrick (1648) and keeps the robins\' toast', /Wassail the trees, that they may bear/.test(YULE_RITES.wassail.lore) && /Herrick, Hesperides \(1648\)/.test(YULE_RITES.wassail.source) && /toast/.test(YULE_RITES.wassail.how) && /robins/.test(YULE_RITES.wassail.how));
check('the wassail gives Old Twelvey Night its date', /Old Twelvey Night \(17 January\)/.test(YULE_RITES.wassail.lore));
check('the first-foot is dark, comes after midnight, and brings coal and salt', /dark-haired/.test(YULE_RITES.firstfoot.lore) && /midnight/.test(YULE_RITES.firstfoot.how) && /coal/.test(YULE_RITES.firstfoot.how) && /salt/.test(YULE_RITES.firstfoot.how));
check('the first-foot names its sources, the Manx qualtagh among them', /Simpson & S\. Roud/.test(YULE_RITES.firstfoot.source) && /qualtagh/.test(YULE_RITES.firstfoot.source));
check('the Yule log is lit from last year\'s brand, kept "Till Christmas next return"', /last year's brand/.test(YULE_RITES.yulelog.lore) && /Till Christmas next return/.test(YULE_RITES.yulelog.lore) && /Candlemas Day/.test(YULE_RITES.yulelog.source));

const yuleCallers = CALLERS.filter((c) => c.season === 'yule');
check('four Yule callers (the Mari Lwyd too), all Yule-only', yuleCallers.length === 4 && yuleCallers.every((c) => c.steps.some((s) => s.kind === 'rite')));
check('between them they work all three Yule rites, and the pwnco', JSON.stringify([...new Set(yuleCallers.flatMap((c) => c.steps.filter((s) => s.kind === 'rite').map((s) => s.rite)))].sort()) === JSON.stringify([...Object.keys(YULE_RITES), 'pwnco'].sort()));
check('every caller cites a source and is badged', yuleCallers.every((c) => c.source && c.tier === 'record' && c.lore && c.resolution));
check('the wassail caller is told the honest half (apples often crop every other year)', /every other year/.test(CALLERS.find((c) => c.id === 'yule_wassail').resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const s = makeMockSocket('Wassailer'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Wassailer', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'wassailer'; h.accounts.wassailer = {}; h.playerProgress.wassailer = { level: 1, xp: 0 };
  const say = (m) => s.emit('message', JSON.stringify(m));
  h.callers.stateOf(p);

  // ── The season gate ──
  const HOGMANAY = Date.UTC(2026, 11, 31, 23, 30), OLD_TWELVEY = Date.UTC(2027, 0, 17, 18);
  const MIDSUMMER = Date.UTC(2026, 5, 21, 12), HALLOWEEN = Date.UTC(2026, 9, 31, 20);
  const seasonAt = (t) => at(t, () => h.calendarPublicState().season.key);
  check('the calendar calls Hogmanay and Old Twelvey Night Yule', seasonAt(HOGMANAY) === 'yule' && seasonAt(OLD_TWELVEY) === 'yule', [seasonAt(HOGMANAY), seasonAt(OLD_TWELVEY)]);
  const isYule = (id) => yuleCallers.some((c) => c.id === id);
  let offSeason = 0, yuleFirst = 0, days = 0;
  for (let d = 0; d < 20; d++) {
    for (const t of [MIDSUMMER, HALLOWEEN]) offSeason += at(t + d * 86400000, () => h.callers.callersStatePayload(p).offered.filter((o) => isYule(o.id)).length);
    const yule = at(Date.UTC(2026, 11, 22, 12) + d * 86400000, () => ({ season: h.calendarPublicState().season.key, ids: h.callers.callersStatePayload(p).offered.map((o) => o.id) }));
    // On a dated caller's day (Christmas Eve, St Stephen's Day) that caller comes first, and a Yule caller second.
    const isDated = (id) => !!(CALLERS.find((c) => c.id === id) || {}).when;
    // (On the 7th of January, Twelfth Night's second day, St Distaff's comes too: then both dated callers first.)
    const n = yule.ids.findIndex((id) => !isDated(id));
    if (yule.season === 'yule') { days++; if (n >= 0 && isYule(yule.ids[n])) yuleFirst++; }
  }
  check('no Yule caller comes at midsummer or at Samhain (20 days each)', offSeason === 0, offSeason);
  check('in the Yule season one is always first at the door', days === 20 && yuleFirst === days, { days, yuleFirst });
  const yuleOffersSamhain = at(HOGMANAY, () => h.callers.callersStatePayload(p).offered.some((o) => CALLERS.find((c) => c.id === o.id && c.season === 'samhain')));
  check('…and no Hallowe\'en caller comes at Yule', !yuleOffersSamhain);

  // ── Working the rites ──
  const step = (i) => h.callers.callersStatePayload(p).active.steps[i];
  h.accounts.wassailer.callers.active = { id: 'yule_wassail', done: {} };
  check('the Board shows how the wassail is done', step(0).rite && step(0).rite.key === 'wassail' && /cider/.test(step(0).rite.how), step(0).rite);
  say({ type: 'rite_do' });
  check('wassailing gives a sign from the orchard, noted on the step', step(0).done && YULE_RITES.wassail.outcomes.some((o) => step(0).note.endsWith(o)), step(0).note);
  const first = step(0).note;
  h.accounts.wassailer.callers.active = { id: 'yule_wassail', done: {} };
  say({ type: 'rite_do' });
  check('the same account gets the same sign again (no fishing)', step(0).note === first);

  h.accounts.wassailer.callers.active = { id: 'yule_first_foot', done: {} };
  say({ type: 'rite_do' });
  check('first-footing works for Elspeth', step(0).done && YULE_RITES.firstfoot.outcomes.some((o) => step(0).note.endsWith(o)), step(0).note);
  check('her salt and fuel are asked for', step(1).item === 'salt' && step(2).item === 'wood');

  h.accounts.wassailer.callers.active = { id: 'yule_log', done: {} };
  say({ type: 'rite_do' });
  check('the Yule log is lit (the rite comes after the log is fetched)', step(1).done && YULE_RITES.yulelog.outcomes.some((o) => step(1).note.endsWith(o)), step(1).note);
  check('the account remembers all three', JSON.stringify(h.accounts.wassailer.ritesDone) === '["wassail","firstfoot","yulelog"]', h.accounts.wassailer.ritesDone);

  const book = buildCharmBook({ acct: h.accounts.wassailer, prog: {}, seasonKey: null });
  const ch = book.chapters.find((c) => c.key === 'yule');
  check('the Charm Book has a Yuletide chapter: the three Yule rites first, the three written in, and the dated days after', ch && ch.met === 3 && JSON.stringify(ch.entries.slice(0, 3).map((e) => e.id)) === JSON.stringify(Object.keys(YULE_RITES)) && ['midnight_oxen', 'wren_hunt', 'twelfth_cake', 'st_agnes_pins'].every((id) => ch.entries.findIndex((e) => e.id === id) >= 3));
  check('…after Hallowe\'en, which the Yule rites don\'t touch', book.chapters.findIndex((c) => c.key === 'yule') === book.chapters.findIndex((c) => c.key === 'halloween') + 1 && book.chapters.find((c) => c.key === 'halloween').met === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
