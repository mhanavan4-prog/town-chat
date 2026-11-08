// ---------------------------------------------------------------------------
// The Charm Book — builds the book from the lore catalogs and what the account
// has already done. Cunning folk kept handwritten books of charms and
// receipts; this is that, for everything the game teaches, each entry with
// where it really comes from and its provenance tier (record / folk / revival).
//
// "Met" is read from state the game already keeps on the account:
//   callers     accounts[k].callers.byId[id] > 0           (lib/callers.js)
//   ogham       accounts[k].ogham.carved includes the letter
//   wards       accounts[k].wards.{bottle|bottleSpent, hexafoil, shoe}
//   leaves      accounts[k].leavesSeen includes the symbol
//   practices   accounts[k].practices.{greenDone, drawNight, hedgeNight, loafDay}
//   nine herbs  progress.almanac includes the herb (the Garden Almanac)
//   cords       accounts[k].cordsUntied includes the knot (recorded on untie)
//   sabbats     accounts[k].sabbatsSeen includes it, or its tea is in teasBrewed
//   charms      accounts[k].charmsSaid includes the charm (said for a caller)
//   halloween   accounts[k].ritesDone includes the rite (worked for a caller)
//   yule        the same, for the Yule rites
//   feasts      the same, for the other six festivals' rites
//   library     accounts[k].booksRead includes the book (read on the Real Shelf)
//   cunning     accounts[k].cunningRead includes the person (read on the Real Shelf)
//   memory      accounts[k].stonesRead includes the stone (read by the Town Hall)
//   household   accounts[k].ritesDone includes the household rite (worked for a caller)
//   hours       accounts[k].hoursKept includes the planet (worked in its hour)
//   dyes        progress.dyeUnlocks includes the plant dye
// Pure: no I/O, so the test can drive it directly.
// ---------------------------------------------------------------------------
const { CALLERS } = require('../data/callers');
const { OGHAM, OGHAM_LORE } = require('../data/ogham');
const { WARDS } = require('../data/wards');
const { LEAF_SYMBOLS, LEAVES_LORE } = require('../data/leaves');
const { PRACTICES } = require('../data/practices');
const { NINE_HERBS, NINE_HERBS_LORE } = require('../data/nineHerbs');
const { KNOTS, CORD_LORE } = require('../data/cords');
const { SABBATS, WHEEL_PROVENANCE } = require('../data/seasons');
const { TEAS } = require('../data/teas');
const { DYES, DYE_UNLOCKS, PLANT_DYE_LORE } = require('../data/wardrobe');
const { CHALDEAN, HOUR_LORE } = require('../data/planetaryHours');
const { CULPEPER_RULERS } = require('../data/practices');
const { CHARMS, WART_CHARM, STYE_CHARM } = require('../data/charms');
const { HALLOWEEN_RITES } = require('../data/halloween');
const { YULE_RITES } = require('../data/yule');
const { WHEEL_RITES } = require('../data/wheelRites');
const { MARTINMAS_RITES } = require('../data/martinmas');
const { WREN_RITES } = require('../data/wrenDay');
const { AGNES_RITES } = require('../data/stAgnes');
const { REAL_BOOKS } = require('../data/realBooks');
const { CUNNING_FOLK } = require('../data/cunningFolk');
const { MEMORIAL, AFTER_THE_LAW } = require('../data/memorial');
const { HOUSEHOLD_RITES } = require('../data/household');
const { SMOORING, KINDLING } = require('../data/hearth');
const ITEM_CATALOG = require('../data/itemCatalog');
const { PLANT_CATALOG } = require('../data/world');

const itemName = (id) => (ITEM_CATALOG[id] && ITEM_CATALOG[id].name) || (PLANT_CATALOG[id] && PLANT_CATALOG[id].name) || id;

// showNames: whether an un-met entry shows its name. True for things that are
// no secret (the calendar, the alphabet, the herbs); false where finding it is
// the point (who comes to your door, what's in your cup).
function chapter(key, icon, title, entries, extra) {
  const met = entries.filter((e) => e.met).length;
  return Object.assign({ key, icon, title, met, total: entries.length, entries, showNames: true }, extra || {});
}

// Where a dated caller's rite falls in the year, for The Turning Year's order:
// { order, note }. A day that moves is placed as it falls in a middling year
// (2027, Easter 28 March), and its note says it moves.
const { OLD_CALENDAR, entryDate, easter } = require('../data/oldCalendar');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const REF_YEAR = 2027;
const DAY_MS = 86400000;
function datedPlace(riteKey) {
  const c = CALLERS.find((x) => x.when && (x.steps || []).some((st) => st.kind === 'rite' && st.rite === riteKey));
  if (!c) return null;
  const w = c.when;
  if (!w.calendar) {
    const span = w.to - w.from >= 2 ? `${w.from}–${w.to}` : `${w.from}`;
    return { order: w.month * 100 + w.from, note: `${span} ${MONTHS[w.month - 1]}` };
  }
  const e = OLD_CALENDAR.find((x) => x.key === w.calendar);
  if (!e) return null;
  const [m, d] = entryDate(e, REF_YEAR);
  if (!e.rule) return { order: m * 100 + d, note: `${d} ${MONTHS[m - 1]}` };
  // A moving day: as the entry says (Plough Monday), or with Easter if it
  // keeps the same distance from Easter.
  if (e.moves) return { order: m * 100 + d, note: e.moves };
  const gap = (y) => { const [mm, dd] = entryDate(e, y); const [em, ed] = easter(y); return Math.round((Date.UTC(y, mm - 1, dd) - Date.UTC(y, em - 1, ed)) / DAY_MS); };
  return { order: m * 100 + d, note: gap(2027) === gap(2028) ? 'moves with Easter' : 'moves with the weekday' };
}

function buildCharmBook({ acct, prog, seasonKey }) {
  const a = acct || {};
  const p = prog || {};
  const has = (arr, x) => Array.isArray(arr) && arr.indexOf(x) !== -1;

  // ── Callers at the Door ──
  const byId = (a.callers && a.callers.byId) || {};
  const callers = CALLERS.map((c) => ({
    id: c.id, met: (byId[c.id] || 0) > 0, icon: c.icon, title: c.title,
    lore: c.lore, source: c.source, tier: c.tier,
    hint: `${c.caller} has not knocked yet.`,
  }));

  // ── The Tree Alphabet ──
  const carved = (a.ogham && a.ogham.carved) || [];
  const ogham = OGHAM.map((o) => ({
    id: o.key, met: has(carved, o.key), icon: '🌳',
    title: `${o.name} · ${o.letter} · ${o.tree}`,
    // The kenning is medieval (the Bríatharogam); the reading is the game's.
    lore: `Kenning: "${o.kenning}". Reading: ${o.reading}`,
    source: `D. McManus, A Guide to Ogam (1991): the letter-name originally "${o.meaningOrig}"; the kenning is the Bríatharogam's, the reading the game's own.`,
    tier: 'record',
    hint: o.wood === 'hazel_rod' ? 'Hazel gives you this one.' : `Carve it from ${itemName(o.wood)}.`,
  }));

  // ── Threshold & Hearth ──
  const w = a.wards || {};
  const wardMet = { bottle: !!(w.bottle || (w.bottleSpent || 0) > 0), hexafoil: !!w.hexafoil, shoe: !!w.shoe, ladder: !!w.ladder };
  const wards = Object.keys(WARDS).map((k) => ({
    id: k, met: !!wardMet[k], icon: WARDS[k].icon, title: WARDS[k].name,
    lore: WARDS[k].lore, source: WARDS[k].source, tier: WARDS[k].tier,
    hint: 'Made at your threshold or hearth.',
  }));

  // ── Reading the Leaves ──
  const seen = a.leavesSeen || [];
  const leaves = LEAF_SYMBOLS.map((s) => ({
    id: s.key, met: has(seen, s.key), icon: s.glyph, title: s.name,
    lore: s.meaning, tier: LEAVES_LORE.tier, hint: 'Not yet seen in a cup.',
  }));

  // ── The Witch Paths' practices ──
  const pr = a.practices || {};
  const prMet = { green: !!pr.greenDone, lunar: !!pr.drawNight, hedge: !!pr.hedgeNight, kitchen: !!pr.loafDay };
  const practices = PRACTICES.map((x) => ({
    id: x.id, met: !!prMet[x.id], icon: x.icon, title: x.name,
    lore: x.lore, source: x.source, tier: x.tier, hint: x.how || 'Not yet practised.',
  }));

  // ── The Nine Herbs Charm ──
  const almanac = p.almanac || [];
  const nine = NINE_HERBS.map((h) => ({
    id: h.id, met: has(almanac, h.id), icon: '🌿',
    title: `${h.name} — ${h.oe}`,
    lore: h.line + (h.uncertain ? ' (Which plant the Old English means is uncertain.)' : ''),
    source: NINE_HERBS_LORE.source, tier: NINE_HERBS_LORE.tier, hint: 'Not yet gathered.',
  }));

  // ── Knots & the Wind ──
  const untied = a.cordsUntied || [];
  const cords = KNOTS.map((k) => ({
    id: 'knot' + k.n, met: has(untied, k.n), icon: '🪢', title: `${k.name} — ${k.wind}`,
    lore: k.line, source: CORD_LORE.source, tier: CORD_LORE.tier, hint: 'Not yet loosed.',
  }));

  // ── The Wheel ──
  const sabSeen = a.sabbatsSeen || [];
  const brewed = a.teasBrewed || [];
  const teaFor = {};
  for (const t of TEAS) if (t.sabbat) teaFor[t.sabbat] = t.id;
  const sabbats = SABBATS.map((s) => ({
    id: s.key, met: has(sabSeen, s.key) || s.key === seasonKey || has(brewed, teaFor[s.key]),
    icon: s.glyph, title: `${s.name} — ${s.epithet}`,
    lore: s.provenance ? s.provenance.line : s.blurb, source: s.provenance && s.provenance.source,
    tier: s.provenance ? s.provenance.tier : 'revival', hint: 'Its season has not come round for you yet.',
  }));

  // ── Spoken charms ──
  const saidCharms = a.charmsSaid || [];
  const charms = Object.values(CHARMS).map((ch) => ({
    id: ch.key, met: has(saidCharms, ch.key), icon: ch.icon, title: ch.title,
    lore: `“${ch.lines.join(' ')}” — ${ch.use} ${ch.lore}`,
    source: ch.source, tier: ch.tier, hint: 'A caller at the door will need it said.',
  }));
  for (const [w, hint] of [[WART_CHARM, 'Someone with warts will come to the door.'], [STYE_CHARM, 'A child with a stye will come to the door.']]) {
    charms.push({
      id: w.key, met: has(saidCharms, w.key), icon: w.icon, title: w.title,
      lore: `${w.use} ${w.lore}`, source: w.source, tier: w.tier, hint,
    });
  }

  // ── Hallowe'en ──
  const ritesDone = a.ritesDone || [];
  const rites = Object.values(HALLOWEEN_RITES).map((r) => ({
    id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: r.name,
    lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
    hint: "Only at Samhain — someone will come to the door on Hallowe'en.",
  }));

  // ── Yule ──
  const yule = Object.values(YULE_RITES).map((r) => ({
    id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: r.name,
    lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
    hint: 'Only at Yule — someone will come to the door between the solstice and Candlemas.',
  }));
  // …and the Mari Lwyd, at Yule in south Wales (data/mariLwyd.js).
  for (const r of Object.values(require('../data/mariLwyd').MARI_RITES)) {
    yule.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: r.name,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only at Yule, between Christmas and Twelfth Night: someone will come to the door.' });
  }
  // …and Christmas Eve, 24 December, the oxen and the bees (data/christmasEve.js).
  for (const r of Object.values(require('../data/christmasEve').CHRISTMAS_EVE_RITES)) {
    yule.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Christmas Eve`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Christmas Eve, 24 December: someone will come to the door.' });
  }
  // …and Wren Day, St Stephen's Day, which comes on its own date (data/wrenDay.js).
  for (const r of Object.values(WREN_RITES)) {
    yule.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · St Stephen's Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on St Stephen's Day, 26 December: the wren boys will come to the door." });
  }
  // …and New Year's Day in Wales, calennig (data/calennig.js).
  for (const r of Object.values(require('../data/calennig').CALENNIG_RITES)) {
    yule.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · New Year's Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on New Year's Day: someone will come to the door." });
  }
  // …and Twelfth Night, 6 January, the bean king (data/twelfthNight.js).
  for (const r of Object.values(require('../data/twelfthNight').TWELFTH_RITES)) {
    yule.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Twelfth Night`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Twelfth Night, 6 January: someone will come to the door.' });
  }
  // …and St Agnes' Eve, 20 January, on its own date too (data/stAgnes.js).
  for (const r of Object.values(AGNES_RITES)) {
    yule.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · St Agnes' Eve`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on St Agnes' Eve, 20 January: someone will come to the door." });
  }

  // ── The turning year: the other six festivals, in Wheel order ──
  const sabbatName = (k) => (SABBATS.find((x) => x.key === k) || {}).name || k;
  const wheelOrder = SABBATS.map((x) => x.key);
  const feasts = Object.values(WHEEL_RITES)
    .slice().sort((x, y) => wheelOrder.indexOf(x.season) - wheelOrder.indexOf(y.season))
    .map((r) => ({
      id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · ${sabbatName(r.season)}`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: `Only at ${sabbatName(r.season)} — someone will come to the door in its season.`,
    }));
  // …and Martinmas, the farming year's term day, though not a festival of the Wheel.
  for (const r of Object.values(MARTINMAS_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Martinmas`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only in Martinmas week (9–13 November): someone will come to the door.' });
  }
  // …and Plough Monday, the first Monday after Twelfth Day, when the farm year
  // began again (data/ploughMonday.js; dated by the old calendar).
  for (const r of Object.values(require('../data/ploughMonday').PLOUGH_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Plough Monday`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Plough Monday, the first Monday after Twelfth Day: the ploughboys will come to the door.' });
  }
  // …and Childermas, 28 December, the unluckiest day (data/childermas.js).
  for (const r of Object.values(require('../data/childermas').CHILDERMAS_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Childermas`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Childermas, 28 December: someone will come to the door.' });
  }
  // …and the Burning of the Clavie, 11 January, old Hogmanay (data/clavie.js).
  for (const r of Object.values(require('../data/clavie').CLAVIE_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Old Hogmanay`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on old Hogmanay, 11 January: someone will come to the door.' });
  }
  // …and St Mark's Eve, 24 April, the porch watch (data/stMarksEve.js).
  for (const r of Object.values(require('../data/stMarksEve').MARK_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · St Mark's Eve`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on St Mark's Eve, 24 April: someone will come to the door." });
  }
  // …and May Day, 1 May, the children's garland (data/mayGarland.js).
  for (const r of Object.values(require('../data/mayGarland').MAY_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · May Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on May Day: someone will come to the door.' });
  }
  // …and Rogationtide, which moves with Easter (data/rogation.js).
  for (const r of Object.values(require('../data/rogation').ROGATION_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Rogationtide`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only in Rogation week, the days before Ascension Day: someone will come to the door.' });
  }
  // …and Holy Rood Day, 14 September (data/holyRood.js).
  for (const r of Object.values(require('../data/holyRood').ROOD_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Holy Rood Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Holy Rood Day, 14 September: someone will come to the door.' });
  }
  // …and Hop-tu-Naa, the Manx Hollantide Eve, 31 October (data/hopTuNaa.js).
  for (const r of Object.values(require('../data/hopTuNaa').HOP_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Hollantide Eve`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Hollantide Eve, 31 October: someone will come to the door.' });
  }
  // …and Valentine's Eve, 13 February (data/valentine.js).
  for (const r of Object.values(require('../data/valentine').VALENTINE_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Valentine's Eve`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on Valentine's Eve, 13 February: someone will come to the door." });
  }
  // …and St Brigid's Eve, 1 February (data/brigidEve.js).
  for (const r of Object.values(require('../data/brigidEve').BRIGID_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · St Brigid's Eve`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on St Brigid's Eve, 1 February: someone will come to the door." });
  }
  // …and Candlemas Eve, 1 February, down with the green (data/candlemasEve.js).
  for (const r of Object.values(require('../data/candlemasEve').CANDLEMAS_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Candlemas Eve`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Candlemas Eve, 1 February: someone will come to the door.' });
  }
  // …and Good Friday, which moves with Easter (data/goodFriday.js).
  for (const r of Object.values(require('../data/goodFriday').GOOD_FRIDAY_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Good Friday`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Good Friday, which moves with Easter: someone will come to the door.' });
  }
  // …and Oak Apple Day, 29 May (data/oakApple.js).
  for (const r of Object.values(require('../data/oakApple').OAK_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Oak Apple Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Oak Apple Day, 29 May: someone will come to the door.' });
  }
  // …and the Rush-bearing at Ambleside, the first Saturday in July (data/rushbearing.js).
  for (const r of Object.values(require('../data/rushbearing').RUSH_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Ambleside`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on the Rush-bearing Saturday, the first in July: someone will come to the door.' });
  }
  // …and Grotto Day, Old St James's, 5 August (data/grotto.js).
  for (const r of Object.values(require('../data/grotto').GROTTO_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Grotto Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on Grotto Day, Old St James's, 5 August: someone will come to the door." });
  }
  // …and St John's Eve, 23 June, the fern seed (data/fernSeed.js).
  for (const r of Object.values(require('../data/fernSeed').FERN_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · St John's Eve`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on St John's Eve, 23 June: someone will come to the door." });
  }
  // …and St Swithin's Day, 15 July (data/stSwithin.js).
  for (const r of Object.values(require('../data/stSwithin').SWITHIN_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · St Swithin's Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on St Swithin's Day, 15 July: someone will come to the door." });
  }
  // …and All Souls' Day, 2 November, souling (data/souling.js).
  for (const r of Object.values(require('../data/souling').SOUL_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · All Souls' Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on All Souls' Day, 2 November: someone will come to the door." });
  }
  // …and St Clement's Day, 23 November, Old Clem (data/stClement.js).
  for (const r of Object.values(require('../data/stClement').CLEMENT_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · St Clement's Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on St Clement's Day, 23 November: someone will come to the door." });
  }
  // …and St Catherine's Day, 25 November, Cattern (data/catterning.js).
  for (const r of Object.values(require('../data/catterning').CATTERN_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · St Catherine's Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on St Catherine's Day, 25 November: someone will come to the door." });
  }
  // …and St Thomas's Day, 21 December, going a-gooding (data/stThomas.js).
  for (const r of Object.values(require('../data/stThomas').THOMAS_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · St Thomas's Day`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: "Only on St Thomas's Day, 21 December: someone will come to the door." });
  }
  // …and Shrove Tuesday, which moves with Easter (data/shroveTuesday.js).
  for (const r of Object.values(require('../data/shroveTuesday').SHROVE_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Shrove Tuesday`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Shrove Tuesday, the day before Lent: someone will come to the door.' });
  }
  // …and Mothering Sunday, Mid-Lent Sunday, which moves with Easter (data/mothering.js).
  for (const r of Object.values(require('../data/mothering').MOTHERING_RITES)) {
    feasts.push({ id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: `${r.name} · Mothering Sunday`,
      lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
      hint: 'Only on Mothering Sunday, the fourth Sunday in Lent: someone will come to the door.' });
  }

  // The dated rites after the twelve, in the order of the year, each with its
  // date (datedPlace, below).
  const dated = feasts.splice(12).map((e) => ({ e, at: datedPlace(e.id) }));
  dated.sort((a, b) => (a.at ? a.at.order : 9999) - (b.at ? b.at.order : 9999));
  for (const { e, at } of dated) feasts.push(at ? Object.assign(e, { date: at.note }) : e);

  // ── The house and the hive ──
  const riteEntry = (r) => ({
    id: r.key, met: has(ritesDone, r.key), icon: r.icon, title: r.name,
    lore: `${r.how} ${r.lore}`, source: r.source, tier: r.tier,
    hint: 'Someone will come to the door needing it done.',
  });
  const household = Object.values(HOUSEHOLD_RITES).filter((r) => !r.against).map(riteEntry);
  // ── Against the witch: counter-magic, and what it could cost ──
  const against = Object.values(HOUSEHOLD_RITES).filter((r) => r.against).map(riteEntry);
  const hearth = a.hearth || {};
  household.push(
    { id: SMOORING.key, met: (hearth.smoorCount || 0) > 0, icon: SMOORING.icon, title: SMOORING.name, lore: `${SMOORING.how} “${SMOORING.verse.join(' ')}” ${SMOORING.lore}`, source: SMOORING.source, tier: SMOORING.tier, hint: 'Smoor the fire at your own cottage hearth, at night.' },
    { id: KINDLING.key, met: (hearth.kindleCount || 0) > 0, icon: KINDLING.icon, title: KINDLING.name, lore: `${KINDLING.how} “${KINDLING.verse.join(' ')}” ${KINDLING.lore}`, source: KINDLING.source, tier: KINDLING.tier, hint: 'Kindle it again in the morning from the embers you smoored.' },
  );

  // ── The Library (the Real Shelf) ──
  const booksRead = a.booksRead || [];
  const library = REAL_BOOKS.map((b) => ({
    id: b.id, met: has(booksRead, b.id), icon: '📚', title: `${b.title} (${b.date})`,
    lore: `${b.summary} ${b.fact || ''}`.trim(), source: `${b.author}, ${b.title} (${b.date})`, tier: b.tier,
    hint: 'Read it on the Real Shelf in the Library.',
  }));

  // ── The cunning folk of the record (also on the Real Shelf) ──
  const folkRead = a.cunningRead || [];
  const cunning = CUNNING_FOLK.map((f) => ({
    id: f.id, met: has(folkRead, f.id), icon: '🗝️', title: `${f.name} of ${f.place} (${f.dates})`,
    lore: `${f.summary} ${f.fact || ''}${f.legend ? ' ' + f.legend : ''}`.trim(), source: f.source, tier: f.tier,
    hint: 'Read about them on the Real Shelf in the Library.',
  }));

  // ── In Memory: the two stones by the Town Hall, with the works they come
  //    from (data/memorial.js). Read at the stones. ──
  const stonesRead = a.stonesRead || [];
  const memory = [[MEMORIAL, 'way_memorial', 'In Memory of the Accused'], [AFTER_THE_LAW, 'way_after_law', 'After the Law']].map(([m, way, title]) => ({
    id: m.id, way, met: has(stonesRead, way), icon: '🕯️', title,
    lore: m.text.replace(/\n\n/g, ' '), source: m.sources.split('; ').join(' · '), tier: 'record',
    hint: 'Read it on the stone by the Town Hall.',
  }));

  // ── The planetary hours ──
  const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const kept = a.hoursKept || [];
  const hours = CHALDEAN.map((pl) => {
    const herbs = Object.keys(CULPEPER_RULERS).filter((h) => CULPEPER_RULERS[h] === pl.day).map(itemName);
    const name = pl.name; // 'Saturn', 'the Sun', 'the Moon'
    return {
      id: pl.key, met: has(kept, pl.key), icon: pl.glyph,
      title: `${pl.name.charAt(0).toUpperCase() + pl.name.slice(1)} — ${WEEKDAY[pl.day]}`,
      lore: `Its hour comes round once in every seven, and the first hour after sunrise on ${WEEKDAY[pl.day]} is always ${pl.name}'s — which is how ${WEEKDAY[pl.day]} got its planet. ` +
        (herbs.length ? `Culpeper gives ${name} these of your herbs: ${herbs.join(', ')}.` : `None of your garden herbs is ${name}'s in Culpeper; keep its hour with its tea.`),
      source: 'Cassius Dio, Roman History 37.18–19 (c. AD 200), on the planetary hours and the week · N. Culpeper, The English Physitian (1652)',
      tier: 'record',
      hint: herbs.length ? `Gather one of ${name}'s herbs, or brew its tea, in its own hour.` : 'Brew its tea in its own hour.',
    };
  });

  // ── The Hedge dyes ──
  const owned = p.dyeUnlocks || [];
  const dyes = Object.keys(PLANT_DYE_LORE).map((id) => {
    const d = DYES.find((x) => x.id === id) || { label: id };
    const st = (DYE_UNLOCKS[id] && DYE_UNLOCKS[id].steep) || {};
    const L = PLANT_DYE_LORE[id];
    return {
      id, met: has(owned, id), icon: '🎨', title: d.label, lore: L.lore, source: L.source, tier: L.tier,
      hint: `Steep ${st.qty || 4} ${itemName(st.item)} in the wardrobe.`,
    };
  });

  return {
    signedIn: !!acct,
    chapters: [
      chapter('callers', '🚪', 'Callers at the Door', callers, { intro: 'Neighbours who came to the cunning-woman with a trouble, and what was really done about it.', showNames: false }),
      chapter('wards', '🏠', 'Threshold & Hearth', wards, { intro: 'Protections hidden in the fabric of a house — the commonest real magic in the archaeological record.' }),
      chapter('ogham', '🌳', 'The Tree Alphabet', ogham, { intro: 'Ogham is an Early Medieval Irish script, cut on standing stones.', note: OGHAM_LORE.provenance }),
      chapter('leaves', '🍵', 'Reading the Leaves', leaves, { intro: LEAVES_LORE.method, note: LEAVES_LORE.provenance, showNames: false }),
      chapter('nine', '🌿', 'The Nine Herbs Charm', nine, { intro: NINE_HERBS_LORE.text }),
      chapter('practices', '🕯️', 'The Witch Paths', practices),
      chapter('cords', '🪢', 'Knots & the Wind', cords, { intro: CORD_LORE.wind, note: CORD_LORE.ladder }),
      chapter('wheel', '☸️', 'The Wheel of the Year', sabbats, { intro: 'Each turn of the year, and how old it really is.', note: WHEEL_PROVENANCE.line }),
      chapter('charms', '🗣️', 'Spoken Charms', charms, { intro: 'The commonest cunning folk were charmers: someone in the parish who could charm a burn, stop blood or ease a toothache with a few remembered words, usually for nothing. The words are as recorded; the game\'s callers pair each with the sound practical half of the cure.' }),
      chapter('halloween', '🎃', "Hallowe'en", rites, { intro: "The love divinations of a Scottish Hallowe'en night, as Burns set them down in his notes to \"Halloween\" (1785). They come round once a year, at Samhain." }),
      chapter('yule', '❄️', 'Yuletide', yule, { intro: 'The customs of the midwinter season, from the solstice through Hogmanay to Twelfth Night: the orchard wassailed, the first foot over the step, the log lit from last year\'s brand, the Mari Lwyd answered in verse at the door, the oxen watched at midnight on Christmas Eve, the wren carried round on St Stephen\'s Day, the bean king crowned on Twelfth Night, the row of pins on St Agnes\' Eve. They come round once a year, at Yule.' }),
      chapter('feasts', '🌾', 'The Turning Year', feasts, { intro: 'Two old customs for each of the other festivals of the year, from Bride\'s bed at Candlemas to the last blackberries before Michaelmas; then the customs of single days, from Plough Monday to St Thomas\'s, in the order of the year, each with its date. Each comes round once a year.', showNames: true }),
      chapter('household', '🐝', 'The House and the Hive', household, { intro: 'What a household did when a death came, when the eye was on a child, or when the horses were ridden in the night: the small customs of the house, byre and hive.' }),
      chapter('against', '🛡️', 'Against the Witch', against, { intro: 'What people did when they believed a neighbour had bewitched them: the glass that showed a face, the heart stuck with pins, the cross on the hearth post, the question put to a sick wife. Most of it harmed no one. Some of it ended at a ducking pond or a fire: Ruth Osborne at Tring in 1751, Bridget Cleary in Tipperary in 1895. Each entry says what it really was, and the callers who ask for it are told the truth.' }),
      chapter('library', '📚', 'The Witch\'s Library', library, { intro: 'The real books behind the witch: the charms and herbals people used, the books that hunted witches, the sceptics who argued back, and the modern revival. Read them on the Real Shelf in the Library.' }),
      chapter('cunning', '🗝️', 'The Cunning Folk', cunning, { intro: 'Real cunning folk, long dead and on the record: what people paid them for, what they were accused of, and what is only legend. Read about them on the Real Shelf in the Library.' }),
      // No purse for this one: it is for the dead.
      chapter('memory', '🕯️', 'In Memory', memory, { noPurse: true, intro: 'The two stones by the Town Hall: one for the people put to death as witches, one for the people killed as witches after the law had changed. Every name, date and number on them is from the record, and here are the works they come from. Read them at the stones.' }),
      chapter('hours', '⏳', 'The Planetary Hours', hours, { intro: HOUR_LORE }),
      chapter('dyes', '🎨', 'The Hedge Dyes', dyes, { intro: 'Plant dyes, steeped from what you gather.' }),
    ],
  };
}

module.exports = { buildCharmBook };
