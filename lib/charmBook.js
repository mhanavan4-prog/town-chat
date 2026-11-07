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
const { CHARMS, WART_CHARM } = require('../data/charms');
const { HALLOWEEN_RITES } = require('../data/halloween');
const { YULE_RITES } = require('../data/yule');
const { WHEEL_RITES } = require('../data/wheelRites');
const { REAL_BOOKS } = require('../data/realBooks');
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
    source: `Bríatharogam kenning; letter-name originally "${o.meaningOrig}" (McManus 1991). The reading is the game's own.`,
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
  charms.push({
    id: WART_CHARM.key, met: has(saidCharms, WART_CHARM.key), icon: WART_CHARM.icon, title: WART_CHARM.title,
    lore: `${WART_CHARM.use} ${WART_CHARM.lore}`, source: WART_CHARM.source, tier: WART_CHARM.tier,
    hint: 'Someone with warts will come to the door.',
  });

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

  // ── The Library (the Real Shelf) ──
  const booksRead = a.booksRead || [];
  const library = REAL_BOOKS.map((b) => ({
    id: b.id, met: has(booksRead, b.id), icon: '📚', title: `${b.title} (${b.date})`,
    lore: `${b.summary} ${b.fact || ''}`.trim(), source: `${b.author}, ${b.title} (${b.date})`, tier: b.tier,
    hint: 'Read it on the Real Shelf in the Library.',
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
      chapter('yule', '❄️', 'Yuletide', yule, { intro: 'The customs of the midwinter season, from the solstice through Hogmanay to Twelfth Night: the orchard wassailed, the first foot over the step, the log lit from last year\'s brand. They come round once a year, at Yule.' }),
      chapter('feasts', '🌾', 'The Turning Year', feasts, { intro: 'Two old customs for each of the other festivals of the year, from Bride\'s bed at Candlemas to the last blackberries before Michaelmas. Each comes round once a year, in its own season.', showNames: true }),
      chapter('library', '📚', 'The Witch\'s Library', library, { intro: 'The real books behind the witch: the charms and herbals people used, the books that hunted witches, the sceptics who argued back, and the modern revival. Read them on the Real Shelf in the Library.' }),
      chapter('hours', '⏳', 'The Planetary Hours', hours, { intro: HOUR_LORE }),
      chapter('dyes', '🎨', 'The Hedge Dyes', dyes, { intro: 'Plant dyes, steeped from what you gather.' }),
    ],
  };
}

module.exports = { buildCharmBook };
