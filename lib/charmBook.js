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
const ITEM_CATALOG = require('../data/itemCatalog');

const itemName = (id) => (ITEM_CATALOG[id] && ITEM_CATALOG[id].name) || id;

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
  const wardMet = { bottle: !!(w.bottle || (w.bottleSpent || 0) > 0), hexafoil: !!w.hexafoil, shoe: !!w.shoe };
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
      chapter('dyes', '🎨', 'The Hedge Dyes', dyes, { intro: 'Plant dyes, steeped from what you gather.' }),
    ],
  };
}

module.exports = { buildCharmBook };
