// Familiars (Tier 3.5) — the witch's bonded companion. One of the most
// recognizable witch tropes, and the game's first owned companion. A familiar
// follows its witch everywhere (a cosmetic follower rendered client-side, see
// client/familiars.js) and grants one small passive perk mapped to an existing
// derived stat, so no new combat math is needed — familiarBuffContrib adds it
// alongside the ritual blessing.
//
// Chosen/changed freely from the menu; stored on the account so it spans every
// character. The perk is live; the follower is visible to every nearby player.

const FAMILIARS = {
  cat:   { name: 'Black Cat', emoji: '🐈‍⬛', stat: 'forage',   amount: 0.15, blurb: 'A hedge-cat who finds what the Wilds hide — +15% harvest luck.' },
  raven: { name: 'Raven',     emoji: '🐦‍⬛', stat: 'xp',       amount: 0.10, blurb: 'The dead gossip to ravens, and what they learn, you learn — +10% XP.' },
  toad:  { name: 'Toad',      emoji: '🐸',  stat: 'vitality', amount: 25,   blurb: "A toad's old patience steadies the blood — +25 max health." },
  hare:  { name: 'Hare',      emoji: '🐇',  stat: 'swift',    amount: 0.10, blurb: 'Quick as a moonlit hare — +10% move speed.' },
  bat:   { name: 'Bat',       emoji: '🦇',  stat: 'leech',    amount: 0.06, blurb: 'It drinks what you spill, and shares — heal 6% of the damage you deal.' },
};

// What the trial records really say about each familiar — shown in the
// familiar panel. The English pamphlets name real familiars ("imps") with
// their shapes; the hare, raven and bat are told honestly.
const FAMILIAR_LORE = {
  cat: { tier: 'record',
    lore: 'Elizabeth Francis of Hatfield Peverel said her grandmother gave her Sathan, "in the likeness of a white spotted Cat", which she fed on bread and milk and drops of her own blood. Years later she gave it to Agnes Waterhouse for a cake. Agnes was hanged at Chelmsford on 29 July 1566.',
    source: 'The Examination and Confession of Certaine Wytches at Chensforde (1566)' },
  toad: { tier: 'record',
    lore: 'Agnes Waterhouse kept Sathan in a pot lined with wool, where the cat became a toad (Chelmsford, 1566). At St Osyth in 1582 one of Ursula Kemp\'s four spirits, Pigine, was "black like a Toad".',
    source: 'Chelmsford pamphlet (1566); W. W., A True and Just Record (1582)' },
  hare: { tier: 'record',
    lore: 'In the records the hare is the witch herself, not her familiar. Isobel Gowdie of Auldearn confessed in 1662 to the charm for going into one: "I sall goe intill ane haire, / With sorrow, and sych, and meikle caire". What became of her is not recorded.',
    source: 'R. Pitcairn, Ancient Criminal Trials in Scotland, vol. 3 (1833)' },
  raven: { tier: 'record',
    lore: 'Ravens hardly appear in the English trial records. Their name for knowing things comes from Norse myth: Odin\'s two ravens, Huginn and Muninn, Thought and Memory, fly over the world each day and bring him news.',
    source: 'Poetic Edda, Grímnismál 20' },
  bat: { tier: 'revival',
    lore: 'Bats are not among the familiars the trial pamphlets name. They flew into witch pictures later, with the Hallowe\'en of the 19th and 20th centuries.',
    source: 'The English trial pamphlets, 1566–1647' },
};

// Familiars named in the records that the game has no follower for (yet).
const FAMILIAR_RECORDS = [
  { name: 'Tibb', shape: 'a boy in a coat half black and half brown, and later a brown dog', who: "Elizabeth Southerns (Demdike), Pendle, 1612" },
  { name: 'Fancie', shape: 'a man, about midnight', who: 'Anne Whittle (Chattox), Pendle, 1612' },
  { name: 'Tittey, Tyffin, Pigine and Jacke', shape: 'a little grey cat, a white lamb, a toad and a black cat', who: 'Ursula Kemp, St Osyth, 1582' },
  { name: 'Vinegar Tom', shape: 'like a long-legged greyhound with an ox\'s head, a long tail and broad eyes', who: 'Manningtree, 1645 (Hopkins)' },
  { name: 'Holt', shape: 'like a white kitten', who: 'Manningtree, 1645 (Hopkins)' },
  { name: 'Sack and Sugar', shape: 'like a black rabbit', who: 'Manningtree, 1645 (Hopkins)' },
  { name: 'Newes', shape: 'like a polecat', who: 'Manningtree, 1645 (Hopkins)' },
  { name: 'Elemanzer, Pyewacket, Peckin the Crown, Grizzel, Greedigut', shape: 'names, Hopkins wrote, "which no mortall could invent"', who: 'Manningtree, 1645 (Hopkins)' },
];
const FAMILIAR_RECORDS_NOTE = 'Familiars ("imps") are an English and Scottish feature of the trials, recorded from the accused under questioning, often after days kept from sleep. They tell us what was said, and what was done to make people say it.';


// ── Familiar coats (cosmetic skins) ─────────────────────────────────────────
// A shared palette of coat colors that recolor whichever familiar you've bonded
// (the primary body material — fur/feather/skin — client-side). 'default' is
// the familiar's natural coat and is always free; the rest are account-wide
// Moonstone cosmetics. Pure flair: the perk is unchanged, and nearby players
// see your coat because familiarSkin rides publicPlayer.
const FAMILIAR_SKINS = [
  { id: 'default',  label: 'Natural',  hex: null },
  { id: 'ashen',    label: 'Ashen',    hex: 0xe8e2d0, ms: 12 },
  { id: 'spectral', label: 'Spectral', hex: 0x8fe9ff, ms: 12 },
  { id: 'ember',    label: 'Ember',    hex: 0xff7a3c, ms: 12 },
  { id: 'moonlit',  label: 'Moonlit',  hex: 0xb9c2ff, ms: 12 },
  { id: 'shadow',   label: 'Shadow',   hex: 0x4a3568, ms: 12 },
  { id: 'verdant',  label: 'Verdant',  hex: 0x5fbf6a, ms: 12 },
  { id: 'rosewood', label: 'Rosewood', hex: 0xd98fa8, ms: 15 },
  { id: 'gilded',   label: 'Gilded',   hex: 0xffcf5a, ms: 15 },
];
const FAMILIAR_SKIN_BY_ID = FAMILIAR_SKINS.reduce((o, s) => { o[s.id] = s; return o; }, {});

module.exports = { FAMILIARS, FAMILIAR_LORE, FAMILIAR_RECORDS, FAMILIAR_RECORDS_NOTE, FAMILIAR_SKINS, FAMILIAR_SKIN_BY_ID };
