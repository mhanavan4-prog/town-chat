// The Green Path — a botanical questline surfaced inside the garden panel.
// Account-wide (NOT class-gated like the main story, STORYLINES[charId]),
// because gardening is account-scoped. Chapters auto-advance: your garden
// actions ARE the objectives, so there's no separate quest UI.
//
// The plants are REAL witchcraft herbs, organised by traditional category and
// climbing in power/danger across the arc: the gentle Cottage Garden, then the
// Hedge & Wild, then the baneful Poison Path. The full catalogue below is the
// authoritative plan; a plant becomes growable/brewable only when the chapter
// that grants it is actually built (MVP ships the first two chapters).
// See docs/blueprints/gardening-greenpath.md.

// ── The plant catalogue, by witchcraft category ─────────────────────────────
// `plants[].id` is the item id a chapter will grant (added to PLANT_CATALOG as
// its chapter is built). `lore` is the traditional folk-magic association.
const GREEN_PATH_CATEGORIES = [
  {
    id: 'cottage', name: 'The Cottage Garden', band: 'common', chapters: [1, 2, 3],
    lore: "The green witch's everyday herbs — healing, soothing, kitchen-and-hearth cunning. Safe to grow, gentle to brew.",
    plants: [
      { id: 'chamomile',   name: 'Chamomile',          lore: 'calm, sleep, gentle healing' },
      { id: 'calendula',   name: 'Calendula (Marigold)', lore: 'skin-healing, the sun, protection' },
      { id: 'comfrey',     name: 'Comfrey (Knitbone)', lore: 'mending bone and flesh' },
      { id: 'lemon_balm',  name: 'Lemon Balm',         lore: 'uplift, ease, clarity' },
      { id: 'feverfew',    name: 'Feverfew',           lore: 'fever, headache, warding sickness' },
      { id: 'lavender',    name: 'Lavender',           lore: 'peace, cleansing, sleep' }
    ]
  },
  {
    id: 'hedge', name: 'The Hedge & Wild', band: 'rare', chapters: [4, 5, 6],
    lore: "The cunning folk's herbs — for warding the home and crossing the hedge to see. Gathered wild and rare, not coaxed easily from a bed.",
    plants: [
      { id: 'mugwort',       name: 'Mugwort',          lore: "dreams, divination, the traveller's herb" },
      { id: 'vervain',       name: 'Vervain',          lore: 'protection, the all-heal, enchantment' },
      { id: 'yarrow',        name: 'Yarrow',           lore: 'courage, warding, staunching wounds' },
      { id: 'wormwood',      name: 'Wormwood',         lore: 'the sight, calling spirits, bitter protection' },
      { id: 'rue',           name: 'Rue',              lore: 'banishing, breaking curses, the herb of grace' },
      { id: 'st_johns_wort', name: "St. John's Wort",  lore: "the sun's guard against the dark" },
      { id: 'rowan_berry',   name: 'Rowan Berry',      lore: "the witch-tree's ward against ill" }
    ]
  },
  {
    id: 'baneful', name: 'The Poison Path', band: 'mythic', chapters: [7, 8, 9],
    lore: "The baneful herbs — the witch's dark art. Nightshades and toxins, powerful and perilous; the climax of the Green Path. (In-game they brew debuffs, baneful draughts and the famed flying ointment — never real harm.)",
    plants: [
      { id: 'belladonna',     name: 'Belladonna (Deadly Nightshade)', lore: 'the beautiful lady; sight, flight, the long sleep' },
      { id: 'henbane',        name: 'Henbane',          lore: 'oracular madness, calling the storm' },
      { id: 'mandrake',       name: 'Mandrake',         lore: 'the screaming root; power, fertility, command' },
      { id: 'wolfsbane',      name: 'Wolfsbane (Aconite / Monkshood)', lore: "against the wolf; the shapeshifter's bane" },
      { id: 'datura',         name: 'Datura (Thornapple)', lore: "the devil's trumpet; deep trance, danger" },
      { id: 'hemlock',        name: 'Hemlock',          lore: 'the philosophers’ poison; stilling, endings' },
      { id: 'foxglove',       name: 'Foxglove',         lore: "the folk's glove; the heart, the fae" },
      { id: 'black_hellebore', name: 'Black Hellebore',  lore: 'the winter rose; banishing, the underworld' }
    ]
  }
];

// ── The chapters (MVP: 1–2, in the Cottage Garden band) ─────────────────────
// Objective types map to events the garden handlers emit:
//   garden_plant   — sowing a bed
//   garden_harvest — harvesting a bed
const GREEN_PATH = [
  {
    id: 'gp1', title: 'A Handful of Earth', band: 'cottage', requiresLevel: 1,
    objective: { type: 'garden_plant', target: 1, label: 'Sow a seed in any garden bed' },
    outro: 'The soil takes the seed. From the fence, Mother Yarrow nods — "Now we see what you can grow." She tips a packet of chamomile into your palm.',
    xpReward: 30, goldReward: 15, itemRewards: [{ itemId: 'chamomile', qty: 3 }]
  },
  {
    id: 'gp2', title: 'The First Cutting', band: 'cottage', requiresLevel: 3,
    objective: { type: 'garden_harvest', target: 3, label: 'Harvest from your beds three times' },
    outro: 'Three cuttings, and the beds already ask for more. Yarrow presses sun-orange seeds into your hand. "Calendula. Grows toward the light, mends what’s torn. A good next thing to learn."',
    xpReward: 60, goldReward: 30, itemRewards: [{ itemId: 'calendula', qty: 3 }]
  },
  {
    id: 'gp3', title: 'Hearth and Healing', band: 'cottage', requiresLevel: 5,
    objective: { type: 'garden_brew', target: 1, label: "Brew any remedy at Hazel's cauldron" },
    outro: 'Steam curls from the pot and the cottage smells of healing. "You’ve the hands for it," says Mother Yarrow, and loads your arms with seed — comfrey to knit the bone, lemon balm to ease the heart, feverfew for the fever, lavender for peace. "The whole cottage garden is yours now."',
    xpReward: 100, goldReward: 50,
    itemRewards: [
      { itemId: 'comfrey', qty: 3 }, { itemId: 'lemon_balm', qty: 3 },
      { itemId: 'feverfew', qty: 3 }, { itemId: 'lavender', qty: 3 }
    ]
  }
];

module.exports = { GREEN_PATH, GREEN_PATH_CATEGORIES };
