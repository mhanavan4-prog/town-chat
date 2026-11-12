// ---------------------------------------------------------------------------
// The Old Ways — eleven things a witch (or a cunning man, or a horseman) was
// said to do, each with a verb in the game and its tier and source named, as
// with the practices (data/practices.js):
//
//   🧹 the besom      — bind a broom, and ride it by night
//   🪆 the poppet     — make an image, and name it for someone
//   🫗 lead-pouring   — pour lead through a key into water, and read it
//   🐝 the bees       — keep a skep, and keep the bees told
//   🥛 the brownie    — set out cream for whatever keeps the house
//   🍞 sin-eating     — take the bread and ale, and what comes with them
//   🐸 the toad-bone  — win the bone at running water
//   🐇 the hare       — go into a hare, and come out again
//   🕯️ the Hand of Glory — light it, and the sleepers do not stir
//   🌒 the new moon   — turn your silver when you first see her
//   💃 the reel       — take hands at the stones, three or more, and dance it round
//
// Tiers: 'record' is in documents of the time; 'folk' was collected from
// people who did it or remembered it done; 'revival' is modern practice.
// Where the game does something the record does not say, the note says so.
// ---------------------------------------------------------------------------
const MIN = 60 * 1000, HOUR = 60 * MIN;

const OLD_WAYS = [
  {
    id: 'besom', icon: '🧹', name: 'The besom',
    how: 'Cut an ash stave and a bundle of birch in the Wilds, bind them with willow in the town after dark, and the broom will carry you by night between the town and the far places of the Wilds.',
    tier: 'record',
    lore: 'The first pictures of women riding broomsticks are in the margin of a manuscript of Martin Le Franc\'s Le Champion des Dames, made about 1451: two women, one on a broom and one on a white stick, labelled as Waldensians. Two years later the prior Guillaume Edelin confessed, under pressure, to having ridden one. Nider and others wrote of an ointment that made women believe they had flown while they lay asleep. In English trials flight was hardly ever alleged, and Reginald Scot (1584) thought the whole idea absurd. In Scotland Isobel Gowdie (1662) said she rode straws and bean-stalks, crying "Horse and hattock, in the Devil\'s name." A besom of birch twigs on an ash stave, bound with willow, is how brooms were made in England; that this was a witch\'s recipe is a modern saying.',
    source: 'Martin Le Franc, Le Champion des Dames (BnF fr. 12476, c.1451); Johannes Nider, Formicarius (1430s); Reginald Scot, The Discoverie of Witchcraft (1584); R. Pitcairn, Criminal Trials in Scotland (1833), for Gowdie.',
  },
  {
    id: 'poppet', icon: '🪆', name: 'The poppet',
    how: 'Stitch a figure of cloth and stuff it with a scrap of fur. Name it for yourself or for one of your party standing by, and it takes blows meant for them for a while, or mends them at once. Or, underground, name it for the boss and bind it round with thread: the boss drags its feet for a minute.',
    tier: 'record',
    lore: 'An image made to stand for a person is among the oldest charges in the trials. In 1612 Elizabeth Southerns, "Old Demdike", was recorded as saying that "the speediest way to take a man\'s life away by witchcraft is to make a picture of clay, like unto the shape of the person whom they mean to kill". Figures of wax, cloth and clay stuck with pins have been found hidden in old buildings, one in a Hereford cellar with a name pinned to its skirt. The record is nearly all of harm. Making a poppet to heal or to guard, as the game does, is how modern witches have turned the practice round, and is not in the old accounts. Binding one with thread to hinder an enemy is the old use, turned here on monsters.',
    source: 'Thomas Potts, The Wonderfull Discoverie of Witches in the Countie of Lancaster (1613); the Hereford Museum poppet; R. Merrifield, The Archaeology of Ritual and Magic (1987).',
  },
  {
    id: 'lead', icon: '🫗', name: 'Lead-pouring',
    how: 'Once a day, melt a little lead and pour it through the ring of a door key into cold water. The shape it sets in is your omen.',
    tier: 'folk',
    lore: 'Children across Ireland described it to the Schools\' Collection in 1937 and 1938 as a Hallowe\'en game: lead was melted in a spoon over the fire and poured through the ring of a key into a basin of water, and the shape it took told a girl her future husband\'s trade, a ship for a sailor, a hammer for a smith. The same was done in Scotland and in parts of England at Hallowe\'en, Midsummer or the New Year, sometimes with the white of an egg instead of lead.',
    source: 'The Schools\' Collection (1937–38), National Folklore Collection, University College Dublin; S. Roud, The Penguin Guide to the Superstitions of Britain and Ireland (2003).',
  },
  {
    id: 'bees', icon: '🐝', name: 'The bees',
    how: 'Barter for a skep (bees are not to be bought for money). They lay up comb while you are about your business, so long as you keep them told: go and tell the bees your news every few days, or they sulk and make nothing.',
    tier: 'folk',
    lore: 'Bees were treated as members of the household. They were told of deaths, marriages and births, in a low voice, sometimes with three taps of the door key on the hive, and a hive not told was expected to pine, give no honey or leave. In many places it was unlucky to buy bees for money: a swarm was bartered for, given, or paid for in gold. A swarm that settled could be claimed by "tanging", following it beating a pan. "A swarm of bees in May is worth a load of hay."',
    source: 'R. Chambers, The Book of Days (1864); H. M. Ransome, The Sacred Bee in Ancient Times and Folklore (1937); S. Roud (2003).',
  },
  {
    id: 'brownie', icon: '🥛', name: 'The brownie',
    how: 'Set a bowl of cream by the hearth at night and leave it be. In the morning see what was done about the house. Never thank it, never watch for it, and whatever you do, do not give it clothes.',
    tier: 'folk',
    lore: 'The brownie of Scotland and the north of England, like Robin Goodfellow further south, did the work of the house or farm by night for a bowl of cream or a bannock left out, not handed over as wages. Reginald Scot wrote in 1584 of the "bowl of milk" set for Robin Goodfellow "for grinding of malt or mustard, and sweeping the house at midnight". Paid, praised or spied on, it took offence. Given a suit of clothes it left for good; the Cauld Lad of Hylton went off singing, "Here\'s a cloak and here\'s a hood, the Cauld Lad of Hylton will do no more good."',
    source: 'Reginald Scot, The Discoverie of Witchcraft (1584); K. Briggs, A Dictionary of Fairies (1976); W. Henderson, Notes on the Folk-Lore of the Northern Counties (1866).',
  },
  {
    id: 'sin', icon: '🍞', name: 'Sin-eating',
    how: 'Once a day you may take the bread and the bowl of ale handed over the dead, and the sixpence that goes with them. The sins come too: blows land harder on you until you have laid the burden down at the memorial stone in the town.',
    tier: 'record',
    lore: 'John Aubrey wrote in the 1680s that "in the County of Hereford was an old Custome at funeralls to hire poor people, who were to take upon them all the sinnes of the party deceased". A loaf of bread and a mazer bowl of beer were handed over the corpse, with sixpence, "in consideration whereof he took upon him all the sinnes of the Defunct, and freed him or her from walking after they were dead". He described one such man as "a long, lean, ugly, lamentable poor rascal". The last known in England was Richard Munslow, a farmer of Ratlinghope in Shropshire, who died in 1906; his grave was restored in 2010. How the eater was ever rid of the sins the accounts do not say. Laying them down at a stone is the game\'s own answer.',
    source: 'John Aubrey, Remaines of Gentilisme and Judaisme (1686–87); B. Puckle, Funeral Customs (1926); the Munslow grave, St Margaret\'s, Ratlinghope.',
  },
  {
    id: 'toad', icon: '🐸', name: 'The toad-bone',
    how: 'Lay a dead toad on an ant-hill in the Wilds and leave it till the bones are clean. Then at night carry the bones to running water in the Wilds. One will go against the stream: take it and do not look behind you. With it in your pocket the night creatures of the Wilds will let you pass for a while.',
    tier: 'folk',
    lore: 'Horsemen in Norfolk, Suffolk and Cambridgeshire told George Ewart Evans in the 1950s how a man became a "toadman" with power over horses. A toad, a natterjack by choice, was killed and left on an ant-hill or a thorn till only bones were left; at midnight, often at the full moon, the bones were thrown into a stream, and one of them, a forked bone, would float up against the current, sometimes with a scream. Whoever kept hold of it through what came next could stop a horse dead ("jading") or draw it after him. Many said the bone was got from the Devil and that it sent men mad. The game gives it power over the creatures of the Wilds, not over horses.',
    source: 'G. E. Evans, The Horse in the Furrow (1960) and The Pattern Under the Plough (1966); E. Porter, Cambridgeshire Customs and Folklore (1969).',
  },
  {
    id: 'hare', icon: '🐇', name: 'Going into a hare',
    how: 'Out of doors, say the charm and go into a hare. For a minute and a half you run nearly twice as fast. Strike a blow, or take one, and you are yourself again on the spot; or say the other charm to come out when you choose.',
    tier: 'record',
    lore: 'Isobel Gowdie of Auldearn gave the words in her confession of 1662: "I sall goe intill ane haire, / With sorrow, and sych, and meikle caire", and another verse to come out again, wishing the hare care and saying she would be in a woman\'s likeness "even now". She said the dogs would sometimes get a bite of them while they were hares, and that the marks were on them still when they were women again. That last is the oldest part of the story. Gerald of Wales wrote about 1188 that it was an old complaint, in Wales, Ireland and Scotland alike, that certain hags changed themselves into hares to suck the cows of their neighbours, and the tale of a hare shot or bitten, and an old woman found next morning with the same wound, was told in most English counties into the last century. In the game a blow turns you back at once, which is how the stories end; that the hare is only fast, and steals no milk, is the game\'s own.',
    source: 'R. Pitcairn, Ancient Criminal Trials in Scotland, vol. 3 (1833), for Gowdie; Giraldus Cambrensis, Topographia Hibernica (c.1188); K. Briggs, A Dictionary of Fairies (1976).',
  },
  {
    id: 'glory', icon: '🕯️', name: 'The Hand of Glory',
    how: 'Buy the hand in the town, from a man who does not say where he had it. Light it underground, in a dungeon or the Delve, and the creatures near you stand where they are and do not stir while it burns. The keepers of each deep are not held by it.',
    tier: 'record',
    lore: 'A thieves\' charm. Francis Grose put the recipe into English in 1787 from the French Petit Albert, printed from 1722: the hand of a man hanged by the highway, wrapped in a piece of winding-sheet, pickled a fortnight with salt, saltpetre and long pepper and dried in the sun of the dog-days, to hold a candle made of a hanged man\'s fat, virgin wax and sesame. Lit in a house, it left everyone in it unable to stir. William Henderson printed a tale of the Spital Inn on Stainmore in 1797, told by the daughter of the maid who was there: a traveller dressed as a woman lit the hand by the kitchen fire, the household could not be woken, and the maid found that water would not put it out, and skimmed milk did. Whitby Museum has a dried hand found hidden in the wall of a cottage at Castleton and given to it in 1935. The name is the French main de gloire, which Skeat showed in 1904 to be a wearing-down of mandragore, the mandrake. In the game the hand is bought, not made, it is turned on what lives underground and not on a sleeping household, and it burns only a short while.',
    source: 'F. Grose, A Provincial Glossary (1787); Les secrets merveilleux du Petit Albert (1722); W. Henderson, Notes on the Folk-Lore of the Northern Counties (1866); W. W. Skeat, Notes on English Etymology (1904); Whitby Museum.',
  },
  {
    id: 'moon', icon: '🌒', name: 'Turning your silver',
    how: 'On the nights when the new moon is first seen, go out of doors after dark (never look at her first through glass), bow to her, and turn over the silver in your pocket. Once each moon.',
    tier: 'folk',
    lore: 'Robert Hunt wrote in 1865 that in Cornwall people turned their money on first seeing the new moon, or showed her a piece of gold. In Shropshire a girl curtseyed to her three times, turning round between, and looked for a present before the next moon; in West Sussex in 1868 people still bowed or curtseyed to her. Camden wrote of the Irish in 1586 that when they first saw her after the change they "commonly bow the knee and say the Lord\'s Prayer", and Aubrey, a century on, of country women who knelt to her. The thought behind it is that what is in your pocket when she is new will grow as she grows, so it was unlucky to be caught with a pocket empty; and almost everywhere it was unlucky to see her first through a window. In the game the silver does grow by a little, which is more than the custom ever promised.',
    source: 'R. Hunt, Popular Romances of the West of England (1865); C. S. Burne, Shropshire Folk-Lore (1883); C. Latham, "Some West Sussex Superstitions Lingering in 1868", Folk-Lore Record 1 (1878); W. Camden, Britannia (1586); J. Aubrey, Remaines of Gentilisme and Judaisme (1686–87); S. Roud (2003).',
  },
  {
    id: 'reel', icon: '💃', name: 'The reel at the stones',
    how: 'By night, at the Unbound Circle in the Wilds, take hands. When three or more have hold, the reel goes round the stones against the sun. Stay in it to the end and blows land softer on every dancer for half an hour, the more so the more who danced. The leader of a coven can call hers to the stones for the coming night.',
    tier: 'record',
    lore: 'The pamphlet Newes from Scotland (1591) tells how the witches of North Berwick, some two hundred of them, went to the kirk there on All Hallows\' Eve of 1590 and "took hands on the land and danced this reel or short dance, singing all with one voice: Commer goe ye before, commer goe ye; Gif ye will not goe before, commer let me". Geillis Duncan, a maidservant of Tranent, went before them playing it on a trump, the small harp held in the teeth, and King James, who sat in on the examinations, was so taken with the strangeness of it that he had her fetched to play the dance to him. One of the indictments says they went round the kirk withershins, the men nine times and the women six. Duncan was hanged on the Castlehill of Edinburgh in December 1591, saying at the last that what she had told of others was put into her mouth by those who tortured her. That stone circles are dancers is a different tale and a commoner one: the Merry Maidens in Cornwall are nineteen girls turned to stone for dancing on a Sunday. In the game the reel is danced at standing stones, not in a kirkyard, and it does the dancers good; the record says only that it was danced.',
    source: 'Newes from Scotland (1591); R. Pitcairn, Ancient Criminal Trials in Scotland, vol. 1 (1833); L. Normand and G. Roberts, Witchcraft in Early Modern Scotland (2000); R. Hunt, Popular Romances of the West of England (1865), for the Merry Maidens.',
  },
];

// ── The besom ────────────────────────────────────────────────────────────────
// Three things to do, each in its place, then the riding. Flight is by night,
// under the open sky, and the broom wants a rest between rides.
const BESOM_STEPS = [
  { id: 'stave', label: 'Cut an ash stave', where: 'wilds', done: 'You cut a straight ash pole and trim it to your height.' },
  { id: 'brush', label: 'Gather the birch', where: 'wilds', done: 'You cut an armful of birch twigs and tie them in a bundle.' },
  { id: 'bind', label: 'Bind it with willow', where: 'outside', night: true, done: 'By night you bind the birch to the stave with split willow, tight, and knock the stave home.' },
];
const BESOM_REST_MS = 3 * MIN;
// how long the ride in lasts on her screen; nothing in the Wilds can reach her while she is up
const BESOM_RIDE_MS = 7000;
// Where it will carry you. Each is open ground a few strides from the place named.
const BESOM_LANDINGS = [
  { id: 'square', room: 'outside', name: 'The town square', x: 1600, y: 1180 },
  { id: 'gate', room: 'wilds', name: 'The edge of the Wilds', spawn: true },
  { id: 'camp', room: 'wilds', name: 'The scouts\' camp', x: 7800, y: 5250 },
  { id: 'circle', room: 'wilds', name: 'The Unbound Circle', x: 2200, y: 5240 },
  { id: 'hazel', room: 'wilds', name: 'The waymark by Hazel\'s', x: 2350, y: 2430 },
  { id: 'wastes', room: 'wilds', name: 'The waymark toward the Wastes', x: 7300, y: 3380 },
  { id: 'severance', room: 'wilds', name: 'The Severance waymark', x: 3800, y: 7380 },
  { id: 'clootie', room: 'wilds', name: 'The clootie well', x: 2900, y: 8620 },
  { id: 'crick', room: 'wilds', name: 'The Crick-stone', x: 3700, y: 6240 },
  { id: 'troy', room: 'wilds', name: 'The Shepherd\'s Race', x: 7000, y: 8470 },
  { id: 'countless', room: 'wilds', name: 'The Nine-and-Twenty', x: 8600, y: 6880 },
];
const BESOM_SIGHTS = [
  'The roofs fall away under you and the lanes are a handful of dropped thread.',
  'You go over the hedges at the height of the owls. One keeps you company a while.',
  'Cold air, and the smell of woodsmoke a long way down.',
  'The moon lays your shadow on the fields, broom and all.',
  'Something in the Wilds looks up as you pass, and thinks better of it.',
];

// ── The poppet ───────────────────────────────────────────────────────────────
const POPPET = { cost: { itemId: 'fur_scrap', qty: 1 }, guard: 0.1, guardMs: 10 * MIN, heal: 0.3, range: 260, restMs: 15 * MIN,
  // Named for a dungeon's boss and bound round with thread, it slows the boss for a minute.
  bindSlow: 0.6, bindMs: 60 * 1000, bindRange: 700 };

// ── Lead-pouring ─────────────────────────────────────────────────────────────
// Each shape and what it was said to mean; `xp` is the luck it leaves you.
const LEAD_SHAPES = [
  { key: 'ship', glyph: '⛵', name: 'a ship', meaning: 'A journey over water, or a sailor.' },
  { key: 'hammer', glyph: '🔨', name: 'a hammer', meaning: 'A smith, or hard work that pays.' },
  { key: 'ring', glyph: '💍', name: 'a ring', meaning: 'A wedding before the year is out.' },
  { key: 'key', glyph: '🗝️', name: 'a key', meaning: 'A door opening: a new house or a new trade.' },
  { key: 'tree', glyph: '🌳', name: 'a tree', meaning: 'Long life, and roots put down.' },
  { key: 'plough', glyph: '🌾', name: 'a plough', meaning: 'A farmer, and a full barn.' },
  { key: 'purse', glyph: '👛', name: 'a purse', meaning: 'Money coming, from where you did not look.' },
  { key: 'bird', glyph: '🐦', name: 'a bird', meaning: 'News, and soon.' },
  { key: 'book', glyph: '📖', name: 'a book', meaning: 'A scholar or a clerk, or something learned.' },
  { key: 'coffin', glyph: '⚰️', name: 'a coffin', meaning: 'An ending. Mind how you go this year.' },
  { key: 'cradle', glyph: '👶', name: 'a cradle', meaning: 'A birth in the house.' },
  { key: 'nothing', glyph: '🌫️', name: 'no shape at all', meaning: 'Nothing settled yet. Ask again another night.' },
];
const LEAD_XP = 18;

// ── The bees ─────────────────────────────────────────────────────────────────
// A skep is bartered for (never bought), fills a comb every so often up to a
// full hive, and stops if the bees have not been told within the time.
const BEES = { barter: { itemId: 'bone_shard', qty: 3 }, combMs: 3 * HOUR, maxCombs: 6, toldMs: 72 * HOUR, combGold: 5, potionEvery: 4 };
const BEE_NEWS = [
  'You tap the skep three times with the door key and tell them, quietly, how things stand.',
  'You tell the bees who has come to the town and who has gone. The hum does not change, which is how you know they heard.',
  'You tell them the news in a low voice, as you would tell an old aunt.',
];

// ── The brownie ──────────────────────────────────────────────────────────────
const BROWNIE = { creamGold: 3, workMs: 6 * HOUR, staleMs: 48 * HOUR };
const BROWNIE_WORK = [
  { text: 'The hearth is swept and the ashes banked. A coin you lost months ago is on the mantel.', gold: [3, 8] },
  { text: 'The herbs are stripped and hung to dry, better than you tie them.', xp: 14 },
  { text: 'A hide you had given up on has been scraped and stretched.', item: 'leather_hide' },
  { text: 'The churn has been worked. There is more butter than there was cream.', gold: [4, 10] },
  { text: 'Your boots are by the door, mended. You did not know they wanted mending.', xp: 18 },
  { text: 'Every knife in the house has an edge on it. A few bone offcuts are stacked neatly by.', item: 'bone_shard' },
  { text: 'The bowl is licked clean and nothing else is touched. Even a brownie has a night off.' },
];
const BROWNIE_GONE = 'You lay out a little coat and hood, new made. In the morning they are gone, and so is whatever wore them. The house is only a house now.';

// ── Sin-eating ───────────────────────────────────────────────────────────────
// Sixpence, and what comes with it: blows land harder until the burden is laid
// down at the memorial stone in the town.
const SIN = { gold: 30, xp: 25, guard: -0.1, restMs: 20 * HOUR, stone: { room: 'outside', x: 1760, y: 410, range: 220 }, shedXp: 20 };

// ── The toad-bone ────────────────────────────────────────────────────────────
const TOAD = { cleanMs: 10 * MIN, calmMs: 5 * MIN, restMs: 30 * MIN };

// ── Going into a hare ────────────────────────────────────────────────────────
// A minute and a half at nearly twice her pace; a blow given or taken ends it.
const HARE = { ms: 90 * 1000, speed: 1.8, restMs: 10 * MIN };

// ── The Hand of Glory ────────────────────────────────────────────────────────
// Bought once. Lit underground it holds the creatures within reach (never a
// boss) for as long as it burns, and then wants a long rest.
const GLORY = { gold: 60, holdMs: 20 * 1000, range: 520, restMs: 20 * MIN };

// ── Turning your silver ──────────────────────────────────────────────────────
// Once a moon, while she is a young crescent: a twentieth of what is in the
// bank comes back as luck, never less than `min` nor more than `max`.
const MOON = { phase: 'waxing_crescent', share: 0.05, min: 8, max: 60, xp: 15 };

// ── The reel at the stones ───────────────────────────────────────────────────
// Three or more take hands at the Unbound Circle by night and it goes round.
// Each who stays to the end has `guardPer` for every dancer (up to `guardMax`)
// for `boonMs`; a ring all of one coven has `covenGuard` more.
const REEL = { at: { room: 'wilds', x: 2200, y: 5000 }, joinRange: 420, ringR: 190, need: 3, ms: 40 * 1000, turns: 3,
  guardPer: 0.03, guardMax: 0.15, covenGuard: 0.03, boonMs: 30 * MIN, xp: 60, fullMoonXp: 2, restMs: 6 * HOUR,
  // a coven's leader may call her coven to the stones for the coming night, this often
  callRestMs: 2 * HOUR };

module.exports = { HARE, GLORY, MOON, REEL, OLD_WAYS, BESOM_STEPS, BESOM_REST_MS, BESOM_RIDE_MS, BESOM_LANDINGS, BESOM_SIGHTS, POPPET, LEAD_SHAPES, LEAD_XP, BEES, BEE_NEWS, BROWNIE, BROWNIE_WORK, BROWNIE_GONE, SIN, TOAD };
