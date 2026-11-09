// The Wheel of the Year — Thornreach's living seasons (Tier 3.5).
//
// Eight sabbats of the pagan Wheel of the Year, each opening a ~6–7 week season
// that runs until the next sabbat begins. Which one is "live" is derived purely
// from the calendar date (UTC) by seasonWindow() in lib/calendar.js — the same
// no-scheduler, wall-clock-derived approach as the festival + blood-moon
// windows, so every restart and every client agrees.
//
// `month`/`day` are the sabbat's start date (month is 1–12 for readability; the
// solstice/equinox dates are the conventional fixed observances). Ordered around
// the wheel; the list wraps (Yule → Imbolc across the New Year).
//
// `effects` are live on the sabbat's own day — a full UTC day; seasonWindow()
// carries them only then — and a coven that completes the season's Rite keeps
// the XP blessing for the rest of the season (lib/rites activeSeasonBuff).
// Where each is applied (server.js):
//   xpMult       grantXP — the player's XP gain (or a coven's Rite buff, whichever is greater)
//   forageBonus  skillHarvestExtraChance — extra-yield odds when gathering
//   regenBonus / restBonus   skillMendRate — HP/s mended out of combat (Imbolc, Yule)
//   fireBonus    the Witch's Fireball damage (Beltane)
//   lootBonus    rollPendingLoot — every drop's odds (Mabon)
//   veilThin     hostile respawn-time multiplier (< 1: the slain rise sooner; Samhain)
// seasonEffectLines() below turns them into the words players see on the HUD tag
// and in the Commonplace Book.

const SABBATS = [
  {
    key: 'imbolc', name: 'Imbolc', epithet: 'the First Stirring', glyph: '🌱',
    month: 2, day: 1,
    blurb: "The first green stirs beneath the snow. Sacred to Brigid of healing, poetry and the forge — a season of quickening, purification and the returning hearth-light.",
    blessing: "🌱 Imbolc stirs beneath Thornreach's frost — Brigid's first green breaks the snow, and healing quickens in the cold.",
    provenance: { tier: 'record', line: "Old Irish Imbolc (Oimelc), 1 February, 'the beginning of spring' — one of the four Gaelic quarter-days named in early Irish literature, and St Brigid's Day, kept at Kildare by the late 7th century. Genuinely old.", source: 'Tochmarc Emire, trans. K. Meyer · Cogitosus, Life of St Brigit (7th century) · R. Hutton, The Stations of the Sun (1996)' },
    effects: { forageBonus: 0.10, regenBonus: 0.8 }
  },
  {
    key: 'ostara', name: 'Ostara', epithet: 'the Balance of Spring', glyph: '🥚',
    month: 3, day: 20,
    blurb: "Day and night stand equal as spring surges. Eggs, hares and blossoms — the world wakes and multiplies. A season of renewal, fertility and fresh beginnings.",
    blessing: "🥚 Ostara balances Thornreach — day equals night and the world blooms awake. The Wilds grow green and generous.",
    provenance: { tier: 'revival', line: "The name comes from Bede (De temporum ratione, 725), who says the Anglo-Saxon April, Ēosturmōnaþ, was named for a goddess Ēostre — attested by Bede alone. 'Ostara' is Jacob Grimm's 1835 German reconstruction, and calling the spring equinox by it is a 1970s coinage. Spring rites of eggs and hares are old; the festival under this name is modern.", source: 'Bede, De temporum ratione ch. 15 (725) · J. Grimm, Deutsche Mythologie (1835)' },
    effects: { forageBonus: 0.15 }
  },
  {
    key: 'beltane', name: 'Beltane', epithet: 'the Bright Fire', glyph: '🔥',
    month: 5, day: 1,
    blurb: "Bel's fires blaze and life runs at full flood. Fertility, passion and the leap over the flame into summer — and, with Samhain, one of the two nights the fair folk are most abroad.",
    blessing: "🔥 Beltane blazes over Thornreach — Bel's bright fire leaps, and every living thing burns brighter. Summer is coming in.",
    provenance: { tier: 'record', line: "Old Irish Beltaine, 1 May — a Gaelic quarter-day. Cormac's Glossary (c. 900) calls it 'lucky fire': 'two fires which Druids used to make with great incantations', and the cattle were brought to them 'against the diseases of each year' — between them, one manuscript says. Genuinely old.", source: "Sanas Cormaic (Cormac's Glossary, c. 900), trans. J. O'Donovan, ed. W. Stokes (1868) · R. Hutton, The Stations of the Sun (1996)" },
    effects: { xpMult: 1.10, fireBonus: 0.30 }
  },
  {
    key: 'litha', name: 'Litha', epithet: 'the Sun at its Height', glyph: '☀️',
    month: 6, day: 21,
    blurb: "The longest day. The sun stands at the peak of its power, a season of confidence, vitality and fullness — before the slow turn back toward the dark.",
    blessing: "☀️ Litha crowns Thornreach — the sun stands at its height and strength runs long into the evening. Make the most of the light.",
    provenance: { tier: 'revival', line: "Midsummer bonfires on St John's Eve are old and widely recorded. The name 'Litha' is not: Bede gives Lida, 'gentle or navigable', as the Anglo-Saxon name of both June and July (later Old English texts tell them apart as Ærra and Æftera Līða), and Aidan Kelly gave the name to the solstice festival in 1974, the same 1970s naming that gave Mabon its name. Tolkien's Shire calendar had already used 'Lithe'.", source: 'Bede, De temporum ratione ch. 15 (725) · A. Kelly, on naming the sabbats in 1974' },
    effects: { xpMult: 1.15 }
  },
  {
    key: 'lughnasadh', name: 'Lughnasadh', epithet: 'the First Harvest', glyph: '🌾',
    month: 8, day: 1,
    blurb: "The first grain is cut. Named for Lugh — a festival of skill, games and craft, and of giving thanks for the first fruits of hard labor.",
    blessing: "🌾 Lughnasadh gilds Thornreach — the first harvest is in, and Lugh's games call the skilled to compete. Reap, and give thanks.",
    provenance: { tier: 'record', line: "Old Irish Lugnasad, 1 August, the festival of the god Lugh — a Gaelic quarter-day whose hilltop gatherings survived into the 20th century. In England the same day was Lammas, hlāf-mæsse, 'loaf-mass', probably the blessing of bread from the first grain. Genuinely old.", source: 'Máire MacNeill, The Festival of Lughnasa (1962)' },
    effects: { xpMult: 1.10, forageBonus: 0.10 }
  },
  {
    key: 'mabon', name: 'Mabon', epithet: 'the Second Harvest', glyph: '🍂',
    month: 9, day: 21,
    blurb: "Day and night balance again as the second harvest is gathered. A season of gratitude and plenty — and of releasing what will not survive the coming dark.",
    blessing: "🍂 Mabon settles over Thornreach — the second harvest is gathered and the year turns inward. Take stock, and be grateful.",
    provenance: { tier: 'revival', line: "Aidan Kelly named the autumn equinox 'Mabon' in 1974, for a pagan calendar, after Mabon ap Modron of Welsh legend (Culhwch and Olwen), who has no known link to the equinox. Harvest-home suppers and the last sheaf are old; this name and festival are modern, from the 1970s.", source: 'Culhwch and Olwen (Mabinogion) · A. Kelly, on naming the sabbats in 1974' },
    effects: { forageBonus: 0.15, lootBonus: 0.20 }
  },
  {
    key: 'samhain', name: 'Samhain', epithet: 'the Start of Winter', glyph: '🕯️',
    month: 10, day: 31,
    blurb: "The final harvest, and the turning of the year. The hollow hills stand open and the dead come home — a season to honor the ancestors, practice divination, and beware what crosses over.",
    blessing: "🕯️ Samhain has come to Thornreach — the hollow hills stand open, and the dead walk closer to the torchlight. Honor them, and guard your lantern.",
    provenance: { tier: 'record', line: "Old Irish Samain, 1 November — with Beltaine one of the two chief Gaelic quarter-days, when early Irish tales have the otherworld open: 'the fairy-mounds of Erinn are always opened about Halloween' (Echtra Nerai). Genuinely old. That it began the Celtic year is a 19th-century theory (Rhys, Frazer) on thin evidence, Hutton argues; the 'witches' new year' is a modern framing.", source: 'Echtra Nerai, trans. K. Meyer · R. Hutton, The Stations of the Sun (1996)' },
    effects: { xpMult: 1.15, veilThin: 0.6 }
  },
  {
    key: 'yule', name: 'Yule', epithet: 'the Longest Night', glyph: '❄️',
    month: 12, day: 21,
    blurb: "The sun dies and is reborn. The longest night holds, then yields to the returning light — a season of hearth, hope, protection and rest.",
    blessing: "❄️ Yule falls on Thornreach — the longest night holds, but the light is already turning back. Gather by the hearth.",
    provenance: { tier: 'record', line: 'Old English Gēola and Old Norse jól — the Germanic midwinter season. Bede gives Giuli as the name of both December and January, and Hákonar saga góða says King Hákon made Yule begin "at the same time as Christian people held it". Genuinely old, though its rites are known mostly through later Christmas custom.', source: 'Bede, De temporum ratione ch. 15 (725) · Hákonar saga góða ch. 15 (Heimskringla, trans. S. Laing)' },
    effects: { xpMult: 1.10, restBonus: 0.8 }
  }
];

// The wheel as a whole (shown beside each sabbat's own provenance): every
// festival on it has a history, but the eight-fold set is modern.
const WHEEL_PROVENANCE = {
  tier: 'revival',
  line: "The eight-spoked Wheel of the Year is a 20th-century assembly. Gerald Gardner's Wicca kept the four Gaelic quarter-days; the solstices and equinoxes joined them around 1958, and the names Ostara, Litha and Mabon were given in the 1970s. Five of its festivals are genuinely old — the four Gaelic quarter-days and Yule — and the other three stand on old customs under modern names; but no one before the 1950s kept all eight as one wheel.",
  source: 'R. Hutton, The Stations of the Sun (1996) and The Triumph of the Moon (1999)',
};

// What a season's effects do, in plain words (HUD tag + Commonplace Book).
function seasonEffectLines(effects) {
  const e = effects || {};
  const pct = (x) => Math.round(x * 100);
  const out = [];
  if (e.xpMult && e.xpMult !== 1) out.push(`+${pct(e.xpMult - 1)}% XP`);
  if (e.forageBonus) out.push(`+${pct(e.forageBonus)}% foraging`);
  const mend = e.regenBonus || e.restBonus;
  if (mend) out.push(`+${mend} HP/s mending out of combat`);
  if (e.fireBonus) out.push(`+${pct(e.fireBonus)}% Fireball damage`);
  if (e.lootBonus) out.push(`+${pct(e.lootBonus)}% loot odds`);
  if (e.veilThin && e.veilThin < 1) out.push(`the slain rise ${pct(1 - e.veilThin)}% sooner`);
  return out;
}

module.exports = { SABBATS, WHEEL_PROVENANCE, seasonEffectLines };
