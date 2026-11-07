// The turning year: two callers for each of the other six festivals (Imbolc,
// Ostara, Beltane, Litha, Lughnasadh, Mabon), each with a recorded custom, who
// come to the door only in their own festival's season.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wheel-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { WHEEL_RITES } = require('../data/wheelRites.js');
const { YULE_RITES } = require('../data/yule.js');
const { HALLOWEEN_RITES } = require('../data/halloween.js');
const { CALLERS } = require('../data/callers.js');
const { SABBATS } = require('../data/seasons.js');
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
const SIX = ['imbolc', 'ostara', 'beltane', 'litha', 'lughnasadh', 'mabon'];
const rites = Object.values(WHEEL_RITES);

// ── The rites, as recorded ──
check('two rites for each of the six other festivals', SIX.every((k) => rites.filter((r) => r.season === k).length === 2) && rites.length === 12);
check('every rite\'s season is a real sabbat', rites.every((r) => SABBATS.some((s) => s.key === r.season)));
check('no rite key clashes with Hallowe\'en or Yule', rites.every((r) => !HALLOWEEN_RITES[r.key] && !YULE_RITES[r.key]));
check('every rite is badged, sourced, says how it was done and has three signs', rites.every((r) => /^(record|folk)$/.test(r.tier) && r.source && r.how && r.lore && r.outcomes.length === 3));
check('every sign fits whole on the Board (notes are cut at 140)', rites.every((r) => r.outcomes.every((o) => `${r.icon} ${r.name}: ${o}`.length <= 140)));
check('Bride\'s bed is Martin Martin\'s, with the cry and the club in the ashes', /Briid is come, Briid is welcome/.test(WHEEL_RITES.bridesbed.lore) && /club/.test(WHEEL_RITES.bridesbed.how) && /Martin Martin.*1703/.test(WHEEL_RITES.bridesbed.source));
check('the sun dance cites Browne, who doubted it', /the Sun doth not dance on Easter day/.test(WHEEL_RITES.sundance.lore) && /Browne.*1646/.test(WHEEL_RITES.sundance.source));
check('pace eggs are Pasch eggs, onion-boiled', /Pasch/.test(WHEEL_RITES.paceeggs.lore) && /onion/.test(WHEEL_RITES.paceeggs.how));
check('May dew is Pepys, 28 May 1667', /the only thing in the world to wash her face with/.test(WHEEL_RITES.maydew.lore) && /28 May 1667/.test(WHEEL_RITES.maydew.source));
check('the Beltane cake is Pennant\'s, libation and fox', /by way of libation/.test(WHEEL_RITES.beltanecake.lore) && /O Fox! spare thou my lambs/.test(WHEEL_RITES.beltanecake.lore) && /Pennant/.test(WHEEL_RITES.beltanecake.source));
check('the St John\'s Eve door is Stow\'s 1603 edition, not 1598', /green birch, long fennel and St John's wort/.test(WHEEL_RITES.midsummerdoor.how) && /2nd ed\., 1603/.test(WHEEL_RITES.midsummerdoor.source));
check('the hemp-seed quotes Gay and Hunt as written', /This hemp-seed with my virgin hand I sow/.test(WHEEL_RITES.hempseed.lore) && /Hemp-seed I sow, \/ Hemp-seed I hoe/.test(WHEEL_RITES.hempseed.lore));
check('the Lammas loaf is hlāf-mæsse, crumbled in the four corners', /hlāf-mæsse/.test(WHEEL_RITES.lammasloaf.lore) && /four corners of the barn/.test(WHEEL_RITES.lammasloaf.how) && /Cotton Vitellius E xviii/.test(WHEEL_RITES.lammasloaf.source));
check('Bilberry Sunday is folk, from MacNeill', WHEEL_RITES.bilberries.tier === 'folk' && /MacNeill/.test(WHEEL_RITES.bilberries.source));
check('the neck is cried "The neck!" and "We yen!"', /"The neck!" three times/.test(WHEEL_RITES.neck.how) && /We yen!/.test(WHEEL_RITES.neck.how));
check('the Michaelmas brambles go back to Threlkeld, 1727', /Threlkeld.*1727/.test(WHEEL_RITES.michaelmas.source));

const wheelCallers = CALLERS.filter((c) => SIX.includes(c.season));
check('two callers for each festival', SIX.every((k) => wheelCallers.filter((c) => c.season === k).length === 2));
check('every one works a rite of its own season', wheelCallers.every((c) => c.steps.some((s) => s.kind === 'rite' && WHEEL_RITES[s.rite] && WHEEL_RITES[s.rite].season === c.season)));
check('between them they work all twelve rites', new Set(wheelCallers.flatMap((c) => c.steps.filter((s) => s.kind === 'rite').map((s) => s.rite))).size === 12);
check('every caller cites a source and is badged', wheelCallers.every((c) => c.source && /^(record|folk)$/.test(c.tier) && c.lore && c.resolution && c.reward && c.reward.gold > 0));
check('the Lammas barn gets the cat and staddle stones too', /staddle stones/.test(CALLERS.find((c) => c.id === 'lughnasadh_lammas_loaf').resolution));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const realNow = Date.now;
  const at = (ms, fn) => { Date.now = () => ms; try { return fn(); } finally { Date.now = realNow; } };
  const s = makeMockSocket('Reeve'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Reeve', charId: 0 }));
  const p = h.players.get(s.lastOfType('init').id);
  p.accountKey = 'reeve'; h.accounts.reeve = {}; h.playerProgress.reeve = { level: 1, xp: 0 };
  const say = (m) => s.emit('message', JSON.stringify(m));
  h.callers.stateOf(p);

  // ── The season gate: for each festival, ten days into its season ──
  const START = { imbolc: [1, 2], ostara: [2, 21], beltane: [4, 2], litha: [5, 22], lughnasadh: [7, 2], mabon: [8, 22] };
  for (const k of SIX) {
    const [m, d] = START[k];
    let days = 0, first = 0, strays = 0;
    for (let i = 0; i < 10; i++) {
      const t = Date.UTC(2027, m, d, 12) + i * 86400000;
      const r = at(t, () => ({ season: h.calendarPublicState().season.key, ids: h.callers.callersStatePayload(p).offered.map((o) => o.id) }));
      if (r.season !== k) continue;
      days++;
      const seasonOf = (id) => (CALLERS.find((c) => c.id === id) || {}).season;
      // A dated caller (Good Friday, which can fall in Ostara) comes first on its days, the season's second.
      const dated = (id) => !!(CALLERS.find((c) => c.id === id) || {}).when;
      if (seasonOf(r.ids[0]) === k || (dated(r.ids[0]) && seasonOf(r.ids[1]) === k)) first++;
      strays += r.ids.filter((id) => seasonOf(id) && seasonOf(id) !== k).length;
    }
    check(`${k}: one of its callers is always first at the door, and no other season's caller comes`, days === 10 && first === 10 && strays === 0, { days, first, strays });
  }

  // ── Working every rite through the real handler ──
  for (const c of wheelCallers) {
    h.accounts.reeve.callers.active = { id: c.id, done: {} };
    const idx = c.steps.findIndex((st) => st.kind === 'rite');
    say({ type: 'rite_do' });
    const step = h.callers.callersStatePayload(p).active.steps[idx];
    const r = WHEEL_RITES[c.steps[idx].rite];
    if (!(step.done && step.rite && step.rite.key === r.key && r.outcomes.some((o) => step.note.endsWith(o)))) check(`${c.id}: the rite gives one of its signs`, false, step);
  }
  check('every rite gives one of its signs on the Board', fail === 0);
  check('the account remembers all twelve', (h.accounts.reeve.ritesDone || []).length === 12, h.accounts.reeve.ritesDone);

  const book = buildCharmBook({ acct: h.accounts.reeve, prog: {}, seasonKey: null });
  const ch = book.chapters.find((c) => c.key === 'feasts');
  check('the Charm Book has a Turning Year chapter of twelve, all written in (and Martinmas, Plough Monday, St Mark\'s Eve, Valentine\'s Eve, Good Friday, St John\'s Eve, All Souls\' Day and St Catherine\'s Day after them)', ch && ch.total === 20 && ch.met === 12 && ch.entries[12].id === 'martin_blood' && ch.entries[13].id === 'plough_monday' && ch.entries[14].id === 'porch_watch' && ch.entries[15].id === 'valentine_bay' && ch.entries[16].id === 'cross_bun' && ch.entries[17].id === 'fern_seed' && ch.entries[18].id === 'soul_cakes' && ch.entries[19].id === 'cattern_cakes');
  check('…in Wheel order, each naming its festival', ch && ch.entries[0].id === 'bridesbed' && /Imbolc/.test(ch.entries[0].title) && ch.entries[11].id === 'michaelmas' && /Mabon/.test(ch.entries[11].title));
  check('…right after Yuletide', book.chapters.findIndex((c) => c.key === 'feasts') === book.chapters.findIndex((c) => c.key === 'yule') + 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
