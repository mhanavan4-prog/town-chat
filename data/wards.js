// ---------------------------------------------------------------------------
// Threshold & Hearth — apotropaic housecraft (blueprint proposal B).
//
// The Hearth Witch's blurb promised "your threshold is warded and your home
// holds" and delivered a damage-resist number. These are the things English
// householders actually did to ward a house — every one of them is found,
// physically, in old buildings — made into a practice at your own cottage:
//
//   🍶 The witch bottle — a stoneware jug of bent pins and iron nails, buried
//      under the hearth to catch a curse and turn it back. It holds a few
//      curses, then it is spent and must be replaced.
//   ✡ The daisy wheel — a compass-drawn hexafoil scratched over the door.
//      You draw it yourself: one circle, six arcs, one radius.
//   👞 The concealed shoe — one worn shoe of your own, hidden by the chimney.
//      Permanent; one per house.
//
// Each carries its provenance tier and source line, as everywhere in the
// folk-magic layer (docs/blueprints/folk-magic-deepening.md §4).
// ---------------------------------------------------------------------------

const WARDS = {
  bottle: {
    name: 'Witch Bottle',
    icon: '🍶',
    where: 'beneath the hearth',
    blurb: 'Turns the next hostile curse back on its sender. Holds a few, then it is spent.',
    lore: "Some two to two and a half hundred witch bottles are recorded, mostly in England, and most of them from after 1660: \"most bottles post-date the Restoration of Charles II in 1660\". Half are found about the hearth and a quarter beneath thresholds. In 1671 the physician Joseph Blagrave advised: \"stop the urine of the Patient, close up in a bottle, and put into it three nails, pins, or needles, with a little white salt, keeping the urine always warm\". In Glanvill's Suffolk tale (1681) a man put his wife's urine \"together with Pins and Needles and Nails\" into a bottle, corked it and set it to the fire; the cork flew out, and he was told instead to \"bury it in the Earth\". The pins in finds are \"sometimes bent\" (MOLA), and nobody wrote down why. The Greenwich bottle, a late 17th-century stoneware jar found by builders in the mid-2000s, had been buried upside down and was still corked: urine, twelve iron nails, \"one of which was driven through a leather heart\", eight brass pins, hair, nail clippings and brimstone. Others stood upright. If you find one in an old house: \"Treat it as an archaeological find: if you can, please don't move it\", and \"if it is corked or stoppered then please don't remove this\" (MOLA), so don't take the stopper out; tell your local Finds Liaison Officer. Historic England's man who shook one was \"later advised that if you did this they sometimes exploded!\"",
    tier: 'record',
    source: "J. Blagrave, Astrological Practice of Physick (1671), as quoted by Thwaite (2020) and the Museum of Witchcraft and Magic · J. Glanvill, Saducismus Triumphatus (1681) · MOLA, \"Bottles Concealed and Revealed\" (2019) and its advice on finds · B. Hoggard, Apotropaios, \"Witch-bottles\" · British Archaeology (September 2019) · Historic England, \"The mysterious case of the witch bottle\" (2016) · Archaeology, \"Opening a Witch Bottle\" (the Greenwich bottle, A. Massey)",
  },
  hexafoil: {
    name: 'Daisy Wheel',
    icon: '✡',
    where: 'over the door',
    blurb: 'A permanent ward on the threshold.',
    lore: "Hexafoils — \"daisy wheels\" — were drawn with a pair of compasses: one circle, then six arcs of the same radius, each set from where the last crossed the circle. They are very common on doorways, windows, fireplaces, barns and church porches, \"from the early medieval period, up into the 19th century\". \"The purpose of hexafoils is disputed\", Historic England says, but \"their interpretation as a ritual protection mark is the most widely accepted theory at present\": one idea is that a spirit would follow the \"single, endless line\" and be caught in it. Others read them as masons' practice in drawing with compasses. If you find one, record it and leave it be: removing marks from a listed building usually needs consent.",
    tier: 'record',
    source: "Historic England, 'Discovering Witches' Marks' · Historic England, \"Help hunt for witches' marks\" · Historic England, Graffiti on Historic Buildings, HEAG288 (2021) · J. Alexander, in The Guardian (2026)",
  },
  shoe: {
    name: 'Concealed Shoe',
    icon: '👞',
    where: 'hidden by the chimney',
    blurb: 'A permanent ward. One per house — choose a worn shoe from your pack.',
    lore: "Nearly three thousand finds of worn shoes hidden in the fabric of old buildings are now recorded in the concealed-shoe index kept at Northampton Museum since the late 1950s. The chimney and hearth are the commonest place, then floors, walls and roofs; most date from the 1500s to the 1900s, and the earliest was found behind Winchester Cathedral's choir stalls, installed in 1308. Usually a single shoe, almost always well worn (\"all but twenty\" of June Swann's first 1,550), and about two in five of those that can be sized a child's. If you find one, report it to the museum; finders often put it back where it was.",
    tier: 'record',
    source: "J. Swann, \"Shoes Concealed in Buildings\", Costume 30 (1996) · Northampton Museum concealed-shoe index",
  },
  // ── Marks you draw yourself (after the daisy wheel) ──────────────────────
  // The commonest scratched mark in old English houses after the hexafoil:
  // four knife cuts, two Vs side by side, the second's first arm crossing the
  // first's second. Read upside down it is an M.
  marian: {
    name: 'Marian Mark',
    icon: 'Ⓜ️',
    where: 'cut on the hearth beam',
    blurb: 'A permanent ward at the hearth. Four straight cuts: two Vs, the second crossing the first.',
    lore: "Cut \"on hearth beams, doors, and around windows\" (Easton), the VV is among the commonest marks in old English houses. Historic England reads it as \"VV for Virgin of Virgins\", or M for Mary, calling on her protection, but warns that such marks \"are however difficult to interpret and there is some academic dispute as to their meaning\". At Knole, in Kent, double Vs were cut on a fire surround and on floor joists in timber felled in the winter of 1605–06; at Creswell Crags in 2019 \"the most popular design seen is the double 'VV'\". Cut yours in your own new wood or on paper, never in old fabric: graffiti on a listed building or scheduled monument without consent is illegal. If you find one, photograph it with a torch held low to one side and tell your county's Historic Environment Record.",
    tier: 'record',
    source: "Historic England, 'Discovering Witches' Marks: types of marks' and \"Help hunt for witches' marks\" (2016) · T. Easton, \"Four Spiritual Middens in Mid Suffolk\", Historical Archaeology (2014) · J. Wright, \"Ritual Protection Marks and Witchcraft at Knole, Kent\", Gresham College (2015) · Historic England, \"Witches' Marks Discovery 'Largest in Britain'\" (2019) · Historic England, Graffiti on Historic Buildings, HEAG288",
  },
  // A word square, not a drawing: you set the five words so it reads the same
  // four ways. Written on a plate and kept by the hearth.
  sator: {
    name: 'SATOR Plate',
    icon: '🍽️',
    where: 'kept by the hearth',
    blurb: 'A permanent ward at the hearth. Set the five words so the square reads the same four ways.',
    lore: "SATOR AREPO TENET OPERA ROTAS reads the same across, down, backwards and up. The oldest were scratched at Pompeii before AD 79; four more were cut on the walls of a military office at Dura-Europos before about 256; another was scratched on Roman wall-plaster in Victoria Road, Cirencester, found in 1868. In medieval England it is \"most commonly found in medical collections as a charm for childbirth\", written out and tied to the mother; in Germany it was held to put out fires, and Hohman's Long Lost Friend (1820) says to write it \"on each side of a plate, and throw it into the fire\". A plate puts out no fire: in a fire, get out, stay out, and call 999.",
    tier: 'record',
    source: "D. Fishwick, \"An Early Christian Cryptogram?\", CCHA Report 26 (1959) · Corinium Museum, the Cirencester word square · H. Taylor, \"Place, period and purpose: migration(s) of the SATOR AREPO formula\", Kent Material Studies Network (2023) · J. G. Hohman, The Long Lost Friend (1820) · GOV.UK, Fire Kills",
  },
  // Not a house mark: borne on Gawain's shield and coat. One unbroken stroke.
  pentangle: {
    name: "Gawain's Pentangle",
    icon: '🛡️',
    where: 'borne on shield and coat',
    blurb: 'Drawn in one unbroken stroke, the endless knot of keeping faith. It goes with you, not the house: +max health.',
    lore: "Gawain's shield was red, with \"þe pentangel de-paynt of pure golde hweȝ\": \"a syngne þat Salamon set sum-quyle, / In bytoknyng of trawþe\". Each line \"vmbe-lappeȝ & loukeȝ in oþer\", and \"Englych hit callen / Ouer-al, as I here, þe endeles knot\". Its five fives were his five wits, his five fingers, Christ's five wounds, Mary's five joys and five virtues, \"With-outen ende at any noke\"; on the inside of the shield was Mary's image, so that when he looked at it \"his belde neuer payred\". The poem makes it an emblem of keeping faith, not a charm. Historic England counts pentangles among the ritual marks cut in old buildings, and they turn up in medieval church graffiti, far more likely medieval than satanic (Champion); the Wiccan pentacle is a modern revival. If you find one, photograph it and report it; never scrub it off, and never cut one into old fabric.",
    tier: 'record',
    source: "Sir Gawain and the Green Knight (BL Cotton Nero A.x), ll. 619–65, ed. R. Morris, EETS (1864; rev. 1869) · Historic England, \"Help hunt for witches' marks\" (2016) · J. Wright, \"Mediaeval Mythbusting #11: The Pentagram\" (2021), after M. Champion, Medieval Graffiti (2015) · Historic England, Graffiti on Historic Buildings, HEAG288",
  },
  // Scorched, not cut: a taper held at an angle to the beam until the flame
  // burns a tear-shaped mark, deepest at its foot (Dean & Hill's experiments).
  burn: {
    name: 'Taper Burn Mark',
    icon: '🕯️',
    where: 'scorched on the door frame',
    blurb: 'A permanent ward at the door. Hold the taper at a slant, its flame just touching, until the tear-shape forms.',
    lore: "Tear-shaped scorches mark the timbers of many old houses, by doors, windows and hearths, and \"even hidden beneath floors\" (Historic England). They were blamed on tapers left burning, but Dean and Hill's experiments (2014) found unattended lights left only \"linear burns or amorphous scorches\"; a flame held \"at a 45° angle\" so its hottest part \"lightly touched the timber\" made the tear-shape in 5 or 10 minutes. They date from the later thirteenth century to the mid-nineteenth, and at Knole carpenters burned them during building in 1606. Why is not known: perhaps \"a ritual protection against lightening and fire\", in Historic England's words. Never put a flame to real timber: a candle goes in a heat-resistant holder, on a stable surface, away from anything that could catch, and is never left burning unattended. If you find a mark, leave it and record it.",
    tier: 'record',
    source: "Historic England, 'Discovering Witches' Marks: types of marks' · J. Dean & N. Hill, \"Burn marks on buildings: accidental or deliberate?\", Vernacular Architecture 45 (2014) · J. Wright, \"Mediaeval Mythbusting #8: Burn Marks\" (2021) · London Fire Brigade, on candle safety (2025) · Historic England, Graffiti on Historic Buildings, HEAG288 (2021)",
  },
  // Not a protection — nobody who wrote about it thought so. Honest to the
  // museum's own label (milk drawn from the neighbours' cows), in the game it
  // draws a little of the neighbours' plenty: harvest luck, not guard.
  ladder: {
    name: "Witch's Ladder",
    icon: '🪶',
    where: 'hung in the roof space',
    blurb: "Not a ward at all, as far as anyone knows. Tie cock's feathers into a length of cord and hang it in the rafters; it draws a little of the neighbours' plenty — harvest luck.",
    lore: "In 1878–9 workmen pulling down an old house in Wellington, Somerset, found in the roof space a cord about a metre and a half long with cock's feathers worked into it, along with brooms and an old chair. Dr Abraham Colles wrote it up as \"A Witches' Ladder\" in 1887, and it is now in the Pitt Rivers Museum. What it was for is honestly unknown: the workmen said it was a ladder for witches to cross the roof; the museum's label says for getting milk away from neighbours' cows, \"and for causing people's deaths\"; when Tylor showed it at the British Association in 1887, two of his audience said it was a sewel, hung to turn deer in a hunt; and in 1893 Marianne Voader, a woman reputed a witch, told Sabine Baring-Gould it was \"nothing but a string set with feathers to frighten birds from a line of peas\". Tylor told the Folk-Lore Congress in 1891 that \"unsupported opinion does not suffice\".",
    tier: 'record',
    source: "Pitt Rivers Museum 1911.32.7 · A. Colles, \"A Witches' Ladder\", The Folk-Lore Journal 5 (1887) · E. B. Tylor, International Folk-Lore Congress, Papers and Transactions (1892)",
  },
  // Iron at the door, and it must be a shoe you found.
  horseshoe: {
    name: 'Horseshoe',
    icon: '🧲',
    where: 'at the door',
    blurb: 'A horseshoe you found, nailed on the threshold, over the door or behind it. Bought ones won\'t do.',
    lore: "\"It is a thing very common to nail horse-shoes on the thresholds of doors: which is to hinder the power of witches that enter into the house. Most houses of the West end of London, have the horse-shoe on the threshold. It should be a horse-shoe that one finds\" (Aubrey, 1696). Gay's old woman of 1727 has \"The horse-shoe's nail'd (each threshold's guard)\". On the Isle of Man, where iron \"was the only one invested with magical power\" of the metals, \"a horse-shoe is hung up over the entrance door of a house, a stable, or a cow-house\" (Moore, 1891); in the west of Scotland a found shoe was hung \"behind the house door\", for luck and against witchcraft and the evil eye (Napier, 1879). Which way up, these writers do not say.",
    tier: 'folk',
    source: "J. Aubrey, Miscellanies (1696), \"Magick\" · J. Gay, Fables (1727), XXIII, \"The Old Woman and her Cats\" · J. Napier, Folk Lore, or Superstitious Beliefs in the West of Scotland (1879), ch. X · A. W. Moore, The Folk-Lore of the Isle of Man (1891), pp. 152–3",
  },
  // A stone with a natural hole, against the night-hag.
  hagstone: {
    name: 'Hag Stone',
    icon: '🪨',
    where: 'at the bed head, or on the door',
    blurb: 'A stone holed right through by nature, hung at the head of your bed or nailed to the door, to keep the night-hag off. One you bore yourself won\'t do.',
    lore: "\"To hinder the night mare, they hang in a string, a flint with a hole in it (naturally) by the manger\": \"to prevent the nightmare, viz. the hag, from riding their horses, who will sometimes sweat all night\" (Aubrey, 1696). In the north, \"Self-bored stones are considered charms against witchcraft, and they keep away nightmare both from man and beast. They are therefore suspended at the head of the bed as well as in stables\" (Henderson, 1879). At Rushmore, near Salisbury, about 1880, General Pitt Rivers took one \"found fixed on a nail to the cottage-door\" of his carter, Kimber, \"to keep away witches\"; it is in the Pitt Rivers Museum. Every one of them was holed by nature.",
    tier: 'folk',
    source: "J. Aubrey, Miscellanies (1696), \"Magick\" · W. Henderson, Notes on the Folk-Lore of the Northern Counties of England and the Borders (1879), p. 166 n. · Pitt Rivers Museum, the Dorset hag stone (Rushmore, 1880–81), its card catalogue as the museum gives it",
  },
  // Two twigs of rowan made into a cross and set over the door: the Scots way
  // bound with red thread and never knotted, the Manx way made without a knife.
  rowan: {
    name: 'Rowan Cross',
    icon: '✝️',
    where: 'over the door',
    blurb: 'Two twigs of rowan made into a cross and set over the door: the Scots way bound with red thread, never knotted; the Manx way made without a knife.',
    lore: "\"Rawn-tree in red-threed / Gars the witches tyne their speed\", went the rhyme in the north-east of Scotland (Gregor, 1881). On Beltane Eve in the Highlands the rowan was brought in from the woods and, \"formed into the shape of a cross, by means of a red thread\", \"inserted in the different door-lintels in the town\", with one in the midden too; a small one could go \"between the lining and cloth of your garment\" (Stewart, 1823). Walter Gregor told the antiquary George Black \"that upon no account must there be a knot on the thread, or the charm will be of no use\" (1893). On the Isle of Man the crosses were made on May Eve \"without the aid of a knife, which was on no account to be used\", and stuck \"over the doors of the dwelling-houses and cow-houses\" (Moore, 1891).",
    tier: 'folk',
    source: "W. Grant Stewart, The Popular Superstitions and Festive Amusements of the Highlanders of Scotland (1823; ed. of 1851), pp. 35, 181 · W. Gregor, Notes on the Folk-Lore of the North-East of Scotland (1881), p. 188 · G. F. Black, \"Scottish Charms and Amulets\", Proceedings of the Society of Antiquaries of Scotland 27 (1893) · A. W. Moore, The Folk-Lore of the Isle of Man (1891), p. 110",
  },
  // Not a mark but a keeping: the last of the harvest, plaited and kept in the
  // house for its year (data/lastSheaf.js has the three forms and endings).
  sheaf: {
    name: 'The Last Sheaf',
    icon: '🌾',
    where: 'kept in the house',
    blurb: 'Plaited at harvest from the best ears and kept in the house for its year: a neck, a kern baby or a Maiden. While it hangs it wards the house.',
    lore: "All over Britain the last handful of corn was kept back from the threshing, plaited or dressed, and carried home. In Devon and Cornwall it was \"the neck\", hung from a kitchen beam; on the Tweed side a little kern baby, \"enshrined at the top of the bink or dresser\"; in the Highlands the Harvest Maiden, \"hung up in the farmer's house to aid in keeping them out till next harvest\", the fairies. That is the one place it is written down as a protection. Most were kept till the next harvest; in East Cornwall and Aberdeenshire they went to the beasts at Christmas, and at Kilmartin a tuft to the horses on the first day of ploughing. The corn dolly sold as a craft is mostly a revival of the mid-twentieth century and after, \"folk revivalism at its finest\" as Ollie Douglas puts it, not the old record.",
    tier: 'folk',
    source: "R. Hunt, Popular Romances of the West of England (3rd ed., 1903), \"Crying the Neck\" · M. A. Courtney, Cornish Feasts and Folk-lore (1890) · W. Henderson, Notes on the Folk-Lore of the Northern Counties of England and the Borders (1879) · J. G. Campbell, Superstitions of the Highlands and Islands of Scotland (1900) · J. G. Frazer, The Golden Bough, 3rd ed., vol. 7 (1912) · O. Douglas, \"Hello Dolly\", Selvedge 101 (2021)",
  },
};

// ── The drawing boards (one source of truth: the server sends these to the
// panel, and checks what comes back against them) ─────────────────────────
// The hearth beam, 260 units square: five nicks along the top edge and four
// along the bottom. A V is a top nick, a bottom nick to its right, and a top
// nick to the right of that.
const MARIAN_TOPS = [[40, 55], [85, 55], [130, 55], [175, 55], [220, 55]];
const MARIAN_BOTTOMS = [[62, 205], [107, 205], [152, 205], [197, 205]];
// Four cuts, each [topIndex, bottomIndex]. Valid when they make two Vs and the
// second V's first arm crosses the first V's second arm. Returns null if good,
// else a reason the player can act on.
function marianProblem(cuts) {
  if (!Array.isArray(cuts) || cuts.length !== 4) return 'Four cuts make the mark: two Vs.';
  const seen = new Set();
  for (const c of cuts) {
    if (!Array.isArray(c) || c.length !== 2) return 'Every cut runs from a nick on the top edge to one on the bottom.';
    const [t, b] = c.map(Number);
    if (!Number.isInteger(t) || !Number.isInteger(b) || t < 0 || t >= MARIAN_TOPS.length || b < 0 || b >= MARIAN_BOTTOMS.length) return 'Every cut runs from a nick on the top edge to one on the bottom.';
    const k = t + ':' + b;
    if (seen.has(k)) return 'You cut the same line twice.';
    seen.add(k);
  }
  const byBottom = new Map();
  for (const [t, b] of cuts) { if (!byBottom.has(b)) byBottom.set(b, []); byBottom.get(b).push(t); }
  if (byBottom.size !== 2 || [...byBottom.values()].some((ts) => ts.length !== 2)) return 'Each V meets at one point at the bottom: two arms to a point, two points.';
  const vs = [...byBottom.entries()].map(([b, ts]) => { const [l, r] = ts.slice().sort((x, y) => x - y); return { b, l, r }; }).sort((x, y) => x.b - y.b);
  for (const v of vs) if (!(MARIAN_TOPS[v.l][0] < MARIAN_BOTTOMS[v.b][0] && MARIAN_BOTTOMS[v.b][0] < MARIAN_TOPS[v.r][0])) return 'A V opens upward: one arm to the left of its point, one to the right.';
  const [v1, v2] = vs;
  if (!(v1.l < v2.l && v2.l < v1.r && v1.r < v2.r)) return 'Two Vs, but they stand apart. The second V\'s first arm should cross the first V\'s second.';
  return null;
}

// The pentangle: five points on a circle, the first at the top. One unbroken
// stroke visits them; it must make the star (each step skips one point), use
// each of its five lines once, and close where it began.
const PENTANGLE_POINTS = [0, 1, 2, 3, 4].map((i) => {
  const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
  return [Math.round(130 + 95 * Math.cos(a)), Math.round(135 + 95 * Math.sin(a))];
});
function pentangleProblem(seq) {
  if (!Array.isArray(seq) || seq.length < 2) return 'Set the brush on a point and draw without lifting it.';
  const s = seq.map(Number);
  if (s.some((i) => !Number.isInteger(i) || i < 0 || i > 4)) return 'Draw from point to point.';
  const edges = new Set();
  for (let i = 1; i < s.length; i++) {
    const d = (s[i] - s[i - 1] + 5) % 5;
    if (d === 1 || d === 4) return 'That is the side of a pentagon. The pentangle\'s lines cross: skip a point each time.';
    if (d === 0) return 'Draw from point to point.';
    const e = Math.min(s[i], s[i - 1]) + '-' + Math.max(s[i], s[i - 1]);
    if (edges.has(e)) return 'You went back over a line. Each of the five is drawn once.';
    edges.add(e);
  }
  if (edges.size < 5) return 'The knot isn\'t closed: five lines, and back to where you began.';
  if (s[0] !== s[s.length - 1] || s.length !== 6) return 'The knot isn\'t closed: five lines, and back to where you began.';
  return null;
}
const PENTANGLE_VITALITY = 10;

// The taper burn: the flame held at a slant (about 45° from upright, Dean &
// Hill) for long enough to char a tear-shape. The game compresses their 5–10
// minutes into seconds of holding.
const BURN_ANGLE = [30, 60];   // degrees from upright that make the tear-shape
const BURN_HOLD = [3, 8];      // seconds held
function burnProblem(angle, seconds) {
  const a = Number(angle), t = Number(seconds);
  if (!Number.isFinite(a) || !Number.isFinite(t)) return 'Set the taper to the beam and hold it there.';
  if (a < BURN_ANGLE[0]) return 'Held straight up under the beam, the flame only smokes it. Slant the taper so the hottest part of the flame lightly touches the wood.';
  if (a > BURN_ANGLE[1]) return 'Laid nearly flat, the flame spreads into an amorphous scorch. Slant it, about halfway between upright and flat.';
  if (t < BURN_HOLD[0]) return 'A faint brown smudge: hold the flame there longer.';
  if (t > BURN_HOLD[1]) return 'Held too long, the char catches and spreads. That is how houses burn: start again, and take the taper away in time.';
  return null;
} // + max health while it is borne

// The SATOR square: five rows of five. Either order is the old one (ROTAS
// first at Pompeii, SATOR first later).
const SATOR_WORDS = ['SATOR', 'AREPO', 'TENET', 'OPERA', 'ROTAS'];
function satorProblem(rows) {
  if (!Array.isArray(rows) || rows.length !== 5) return 'Five rows of five letters.';
  const g = rows.map((r) => String(r || '').toUpperCase().replace(/[^A-Z]/g, ''));
  if (g.some((r) => r.length !== 5)) return 'Five rows of five letters.';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    if (g[r][c] !== g[c][r]) return `Row ${r + 1} and column ${r + 1} should read the same: the square reads alike across and down.`;
    if (g[r][c] !== g[4 - r][4 - c]) return `Row ${r + 1} should read row ${5 - r} backwards: the square reads alike from either end.`;
  }
  const joined = g.join('');
  if (joined !== SATOR_WORDS.join('') && joined !== SATOR_WORDS.slice().reverse().join('')) return 'It reads the same four ways, but those are not the old five words.';
  return null;
}

// The horseshoe: where it goes (each where a writer put it), which way up
// (either: the writers don't say), and it must be one you found.
const HORSESHOE_PLACES = {
  threshold: { label: 'On the threshold', note: 'Aubrey; Gay' },
  over: { label: 'Over the door', note: 'Moore, on Man' },
  behind: { label: 'Behind the door', note: 'Napier, the west of Scotland' },
};
function horseshoeProblem(m) {
  if (!m || !HORSESHOE_PLACES[m.place]) return 'Where will it go: on the threshold, over the door, or behind it?';
  if (m.up !== 'points_up' && m.up !== 'points_down') return 'Which way up? Either will do; choose.';
  return null;
}
const HORSESHOE_FIND_CHANCE = 1 / 30; // a cast shoe on the road, now and then, while you gather
// The hag stone: holed by nature, and hung at the bed head or on the door.
const HAGSTONE_PLACES = {
  bed: { label: 'At the head of your bed', note: 'Henderson' },
  door: { label: 'Nailed to the door', note: 'the Rushmore stone' },
};
function hagstoneProblem(m) {
  if (!m || (m.stone !== 'natural' && m.stone !== 'bored')) return 'Which stone?';
  if (m.stone === 'bored') return 'Not one you bored yourself: Aubrey\'s flint has its hole "naturally", Henderson\'s are "self-bored". Only a stone holed by nature will do.';
  if (!HAGSTONE_PLACES[m.place]) return 'Where will it hang: at the head of your bed, or on the door?';
  return null;
}
const HAGSTONE_FIND_CHANCE = 1 / 5; // at the foot of a crotal stone in the Wilds

// The rowan cross, two ways, each with the one rule its record gives.
const ROWAN_WAYS = {
  scots: {
    label: 'The Scots way',
    parts: [{ id: 'rowan_berry', qty: 1 }, { id: 'red_thread', qty: 1 }],
    how: 'Two twigs of rowan bound crosswise with red thread, and set over the door lintel (Stewart; Gregor).',
  },
  manx: {
    label: 'The Manx way',
    parts: [{ id: 'rowan_berry', qty: 1 }],
    how: 'Two twigs of rowan broken by hand, never cut, made into a cross and stuck over the door (Moore). How the two were held together Moore does not say; Clague (1911) split one stick and put the other through it, as S. Miller\'s compilation (2018) gives it.',
  },
};
// null if the cross is made as the record allows, else why not.
function rowanProblem(m) {
  if (!m || typeof m !== 'object' || !ROWAN_WAYS[m.way]) return 'Choose the way: the Scots way, or the Manx.';
  if (m.tool !== 'hand' && m.tool !== 'knife') return 'Take the two twigs from the rowan first.';
  if (m.way === 'manx' && m.tool === 'knife') return 'Not with a knife: on Man the crosses were made "without the aid of a knife, which was on no account to be used" (Moore).';
  if (m.way === 'scots') {
    if (m.finish === 'knot') return 'No knot: "upon no account must there be a knot on the thread, or the charm will be of no use" (Gregor, to Black). Wind it and tuck the end under.';
    if (m.finish !== 'tuck') return 'Bind the twigs with the red thread first.';
  }
  return null;
}

// The ladder's pull: harvest luck while it hangs (more for a Hearth Witch).
const LADDER_FORAGE = 0.05;
const LADDER_FORAGE_HEARTH = 0.08;
const LADDER_PARTS = [{ id: 'hemp_cord', qty: 1 }, { id: 'cock_feathers', qty: 1 }];

// The ingredients a cunning person would have put in. (The bottle's other
// contents — the householder's own hair, nail parings and urine — are the
// player's to imagine; the game does not inventory them.)
const WITCH_BOTTLE_PARTS = ['bellarmine_jug', 'bent_pins', 'iron_nails'];

// Filling it, as the record has it (Blagrave 1671, Glanvill 1681, and the
// finds). Urine and iron or pins are what both writers agree on; the rest turn
// up in bottles that have been opened. Each says where it comes from.
const BOTTLE_FILLINGS = [
  { key: 'urine', label: 'The householder\'s urine', src: 'Blagrave: "stop the urine of the Patient"; urine in every bottle tested', need: true },
  { key: 'nails', label: 'Iron nails', src: 'Blagrave: "three nails, pins, or needles"; iron in nearly all finds' },
  { key: 'pins', label: 'Pins', src: 'Glanvill: "Pins and Needles and Nails"; pins in finds "sometimes bent"' },
  { key: 'salt', label: 'A little white salt', src: 'Blagrave: "with a little white salt"' },
  { key: 'hair', label: 'Hair and nail parings', src: 'in the Greenwich bottle, and others' },
  { key: 'heart', label: 'A heart of cloth or leather, a nail through it', src: 'cloth and leather hearts in finds; at Greenwich a nail "driven through a leather heart"' },
  { key: 'brimstone', label: 'A pinch of brimstone', src: 'sulphur in the Greenwich bottle' },
];
const BOTTLE_PLACES = {
  hearth: { label: 'Under the hearthstone', note: 'about half of all finds' },
  threshold: { label: 'Beneath the threshold', note: 'about a quarter' },
  floor: { label: 'Under the floor', note: 'found there too' },
};
const BOTTLE_PINS = 3; // pins to bend, if pins go in

// null if the bottle is filled and set as the record allows, else why not.
function bottleProblem(m) {
  if (!m || typeof m !== 'object') return 'Fill the bottle first.';
  const contents = Array.isArray(m.contents) ? [...new Set(m.contents.map(String))] : [];
  if (contents.some((k) => !BOTTLE_FILLINGS.some((f) => f.key === k))) return 'That does not go in a witch bottle.';
  if (!contents.includes('urine')) return 'Begin with the urine: Blagrave\'s first words are "stop the urine of the Patient".';
  if (!contents.includes('nails') && !contents.includes('pins')) return 'Something sharp: Blagrave\'s "three nails, pins, or needles".';
  if (m.corked !== true) return 'Cork it fast first: in Glanvill\'s tale the cork flew out.';
  if (!BOTTLE_PLACES[m.place]) return 'Choose where it goes: under the hearth, beneath the threshold, or under the floor.';
  if (typeof m.inverted !== 'boolean') return 'Neck down or upright? Both are found.';
  const bent = Number(m.bent) || 0;
  if (bent < 0 || bent > BOTTLE_PINS) return 'There are only three pins.';
  return null;
}

const BOTTLE_CHARGES = 3;           // curses a buried bottle turns before it is spent
const BOTTLE_CHARGES_HEARTH = 5;    // …for a Hearth Witch, whose practice this is
const WARD_GUARD = 0.03;            // damage resist from each permanent ward
const WARD_GUARD_HEARTH = 0.05;     // …for a Hearth Witch
const BOTTLE_TURN_GRACE_MS = 10000; // once a curse is turned, the house holds for a breath

// Curses a witch bottle can turn: the hostile statuses one player (or a hex
// trap) can lay on another. Self-buffs are never touched.
const TURNABLE_CURSES = ['wither', 'stumble', 'shrink', 'toad', 'gibberish', 'wolfmark', 'bloodcurse', 'reversed', 'rooted'];

module.exports = { HORSESHOE_PLACES, horseshoeProblem, HORSESHOE_FIND_CHANCE, HAGSTONE_PLACES, hagstoneProblem, HAGSTONE_FIND_CHANCE, ROWAN_WAYS, rowanProblem, BOTTLE_FILLINGS, BOTTLE_PLACES, BOTTLE_PINS, bottleProblem, WARDS, BURN_ANGLE, BURN_HOLD, burnProblem, MARIAN_TOPS, MARIAN_BOTTOMS, marianProblem, PENTANGLE_POINTS, pentangleProblem, PENTANGLE_VITALITY, SATOR_WORDS, satorProblem, WITCH_BOTTLE_PARTS, BOTTLE_CHARGES, BOTTLE_CHARGES_HEARTH, WARD_GUARD, WARD_GUARD_HEARTH, BOTTLE_TURN_GRACE_MS, TURNABLE_CURSES, LADDER_FORAGE, LADDER_FORAGE_HEARTH, LADDER_PARTS };
