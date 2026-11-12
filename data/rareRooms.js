// ---------------------------------------------------------------------------
// Rare rooms — now and then one chamber of a dungeon, or of a Delve floor, is
// something else for a while. Three kinds, each out of something real, with
// its tier and source named as with the Old Ways (data/oldWays.js) and a note
// where the game goes past the record. Where they can be is in the dungeon's
// shape (data/dungeonLayouts.js, rareSites); what they do is lib/dungeonFinds.js.
//
// In the four dungeons the hour is cut into spells; in some spells one chamber
// is rare, the same for everyone down there. On a Delve each floor rolls once.
// ---------------------------------------------------------------------------
const MIN = 60 * 1000;

const RARE_ROOMS = {
  marked: {
    id: 'marked', icon: '✴️', name: 'The Marked Chamber',
    how: 'Every face of the rock is scratched with marks. Nothing of the dungeon will come at you while you stand among them, and you mend as you rest there.',
    tier: 'record',
    lore: 'In 2019 two cavers on a tour at Creswell Crags, on the border of Nottinghamshire and Derbyshire, saw that the walls and roof of one of the caves were covered in scratched marks that had been taken for graffiti. They are ritual protection marks, the same that are cut by the doors, windows and hearths of old houses: the doubled V for the Virgin of Virgins, PM for Pace Maria, and crossed lines, boxes and mazes meant to catch whatever came by. Historic England called it the largest gathering of such marks ever found in a British cave. They were made between the Middle Ages and the early nineteenth century, crowded most thickly round the holes that go down into the dark, by people who seem to have feared what might come up.',
    source: 'Historic England, "Witches\' Marks Discovery Largest in Britain" (February 2019); Creswell Heritage Trust; T. Easton, "Ritual Marks on Historic Timber", Weald & Downland Open Air Museum Magazine (1999), for the marks in houses.',
    note: 'The marks were made to keep something in or out. That they also mend the one who shelters among them is the game\'s.',
  },
  hoard: {
    id: 'hoard', icon: '🪙', name: 'The Walled-Up Hoard',
    how: 'A low vault of piled stone stands in the middle of the chamber, sealed in a hurry a long time ago. Three blows will bring the stones down, and what was put by is inside.',
    tier: 'record',
    lore: 'Hunting for buried treasure by magic was common enough in Tudor England to need a law. William Stapleton, a monk of St Benet\'s at Holme in Norfolk, set down for Cardinal Wolsey in 1528 how he had borrowed books of conjuring and gone out digging with a company of treasure-seekers, meaning to buy his way out of his vows with what he found; he found nothing. The Act of 1542, the first English statute against witchcraft, opens with those who conjure spirits to learn "in what place treasure of golde and Silver shulde or mought be founde", and made it felony. After the monasteries were pulled down it was long believed that the monks had walled their wealth into the ruins.',
    source: 'Stapleton\'s letter to Wolsey, printed by D. Turner in Norfolk Archaeology 1 (1847); 33 Hen. VIII c. 8 (1542), in W. Notestein, A History of Witchcraft in England (1911); F. Young, "The Dissolution of the Monasteries and the Democratisation of Magic", Religions 10 (2019).',
    note: 'The seekers in the record almost never found anything. In the game the hoard is there.',
  },
  well: {
    id: 'well', icon: '📍', name: 'The Pin Well',
    how: 'A spring rises in a stone basin, its floor bright with old pins. Bend a pin and drop it in: the water puts you right, and you come away with a bone key you did not have.',
    tier: 'folk',
    lore: 'At wells all over Britain and Brittany a pin was dropped in the water, and very often a bent one. A paper read to the British Association in 1893 gathered them: at St Baglan\'s well in Carnarvonshire sore eyes were bathed and a pin dropped in, or a wart pricked and the pin bent and thrown after it, and basins of bent pins had been cleared out within memory; in Pembrokeshire a crooked pin thrown in on Easter Day was "throwing Lent away"; in Brittany girls threw pins to be married within the year. At Wooler in Northumberland women still walked out to the Pin Well on May morning. Why the pin was bent nobody could say for certain. One who knew St Baglan\'s well thought it was to drive out the spirit of the sickness.',
    source: '"Pin-Wells and Rag-Bushes", Folk-Lore 4 (1893); R. C. Hope, The Legendary Lore of the Holy Wells of England (1893).',
    note: 'A pin well gave a cure or a husband. The bone key is the game\'s.',
  },
};
const RARE_KINDS = Object.keys(RARE_ROOMS);

const RARE = {
  spellMs: 20 * MIN,     // in a dungeon, a rare room lasts one spell of this length
  chance: 0.4,           // how many spells have one
  delveChance: 0.25,     // how many Delve floors have one
  radius: 300,           // how far from the middle of the chamber the marks reach
  mendEveryMs: 2000, mendShare: 0.03,   // the Marked Chamber: 3% of your health every 2 seconds
  hoardBlows: 3, hoardPurse: [6, 9], hoardRolls: 2,   // the Hoard: a purse in the dungeon's coin (lib/dungeonFinds.js TIER_COIN) and two rolls of its loot
  wellXp: 20,
};

// Which rare room, if any, a place has: the same answer for everyone who asks
// with the same seed (the dungeon and the spell, or the Delve run and floor).
function rareFor(seed, sites, chance) {
  let a = (seed ^ 0x9E3779B9) >>> 0;
  const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (!sites || !sites.length || rnd() >= chance) return null;
  const kind = RARE_KINDS[Math.floor(rnd() * RARE_KINDS.length)], site = sites[Math.floor(rnd() * sites.length)];
  return { kind, site };
}

module.exports = { RARE_ROOMS, RARE_KINDS, RARE, rareFor };
