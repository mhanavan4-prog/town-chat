// ---------------------------------------------------------------------------
// Callers at the Door — the cunning woman's trade (blueprint proposal A).
//
// Cunning folk were not "witches" in the accused sense: they were hired. Court
// records and chapbooks from the 1500s to the 1900s show neighbours paying them
// to find stolen goods, un-bewitch the dairy, protect a threshold, quiet a
// child, tell a fortune. Every caller below brings one of those real jobs, and
// every one is worked with tools the game already has — the pendulum, the
// cards, the staves, the scrying bowl, the garden and Hazel's cauldron.
//
// Rules this file keeps (docs/blueprints/folk-magic-deepening.md §4):
//   • Every working names its provenance tier, honestly:
//       record  — archaeological or documentary: artifacts, manuscripts, print
//       folk    — attested practice, recorded by folklorists, regionally varied
//       revival — a modern (1900s+) reconstruction from older parts
//   • A source line wherever there is one.
//   • Region beats "generic witch" — say where a custom was recorded.
//   • Nothing here is a preparation method for anything harmful.
//
// Step kinds (each satisfied by a real action, see lib/callers.js):
//   pendulum · tarot · runes · scry · leaves — a reading taken while the caller waits
//                                       (a pendulum step's `ask` pre-fills the question)
//   deliver { item, qty }             — handed over (and consumed) at the end
// ---------------------------------------------------------------------------

const TIERS = {
  record: { label: 'Archaeological / documentary', short: 'On record' },
  folk: { label: 'Folk tradition', short: 'Folk tradition' },
  revival: { label: 'Modern revival', short: 'Modern revival' },
};

const CALLERS = [
  {
    id: 'butter_wont_come',
    caller: 'Goodwife Ashby',
    icon: '🧈',
    title: "The Butter Won't Come",
    plea: "Three days I've churned and the cream only sloshes. Old Marrow leaned on my gate Tuesday and looked a long while at the churn. Something's been put on it — I'd swear to it.",
    steps: [
      { kind: 'pendulum', label: 'Dowse the churn — ask the pendulum if it is ill-wished', ask: "Is Goodwife Ashby's churn ill-wished?" },
      { kind: 'deliver', item: 'rowan_charm', qty: 1, label: 'A rowan charm to hang over the dairy door' },
    ],
    resolution: "You have her heat the poker red and plunge it hissing into the cream — \"to burn the witch out,\" as her mother would have said — and you hang the rowan over the dairy door. By evening the butter comes. Whether it was the iron or the warming of cream gone too cold, Goodwife Ashby pays gladly.",
    lore: "Butter that \"would not come\" was among the commonest troubles laid at a witch's door. A Lancashire collection of 1873 records the cure exactly: red-hot iron in the churn, so the witch may be burnt out. Rowan over byre and dairy doors was a protection across Scotland and the north of England. The practical half is true too — a hot iron warms cream too cold to churn.",
    tier: 'folk',
    source: 'Harland & Wilkinson, Lancashire Legends (1873)',
    reward: { gold: 60, xp: 40 },
  },
  {
    id: 'stolen_ring',
    caller: 'Tom Pickering',
    icon: '💍',
    title: 'The Ring Is Gone',
    plea: "My wife's wedding ring, off the sill where she sets it to knead. Gone since Thursday. I've a notion who — but a notion's no proof, and I'll not name a neighbour wrongly.",
    steps: [
      { kind: 'pendulum', label: 'Ask the pendulum: taken, or only lost?', ask: "Was the ring taken, not lost?" },
      { kind: 'tarot', label: 'Turn the cards for where it went' },
    ],
    resolution: "You turn the sieve on the shears with Tom and name no names — only quarters of the village. Then you tell him the true trick: let it be known the cunning woman has been consulted. Two mornings later the ring is back on his step, wrapped in a dock leaf.",
    lore: "Finding stolen goods was the heart of the cunning trade. The sieve and shears — shear-points pinched into a sieve's rim, balanced on two fingers, turning at the guilty name — was familiar enough that Ben Jonson lists \"searching for things lost, with a sieve and shears\" among a conjuror's work in 1610. Historians of cunning folk point to the real engine: once word spread that one had been consulted, stolen things were often quietly returned. (The tarot came to fortune-telling later — France, the 1780s.)",
    tier: 'record',
    source: 'Ben Jonson, The Alchemist (1610), I.i · Owen Davies, Cunning-Folk (2003)',
    reward: { gold: 70, xp: 45 },
  },
  {
    id: 'lintel_mark',
    caller: 'Widow Garrow',
    icon: '🚪',
    title: 'A Mark on the Lintel',
    plea: "There's a flower scratched into the beam over my door — six petals, round as a coin. I never saw it till I whitewashed. Somebody has put a sign on my house.",
    steps: [
      { kind: 'scry', label: 'Scry the bowl for whose hand cut it' },
      { kind: 'pendulum', label: 'Ask the pendulum whether it means her harm', ask: "Does the mark on the lintel mean her harm?" },
    ],
    resolution: "The water shows an older house and an older hand — a carpenter with a pair of compasses, long dead. You tell the widow plainly: it is no curse. It is a daisy wheel, cut to snare whatever would cross her threshold. \"And don't you dare whitewash it again.\"",
    lore: "Hexafoils — \"daisy wheels\" — are compass-drawn six-petalled marks found by the thousand on English doorways, windows, fireplaces, barns and church porches, from the medieval period into the 1800s. Historic England notes the purpose is debated, but ritual protection is the most widely accepted reading. A mark that frightens a householder was most likely put there to guard the house.",
    tier: 'record',
    source: "Historic England, 'Discovering Witches' Marks'",
    reward: { gold: 50, xp: 35 },
  },
  {
    id: 'sleepless_child',
    caller: 'Mary Dunning',
    icon: '🍼',
    title: "The Boy Won't Sleep",
    plea: "Since Lammas he wakes screaming and won't settle. My mother says the fairies have been at the cradle. I only want him to sleep.",
    steps: [
      { kind: 'pendulum', label: 'Ask the pendulum over the cradle: is it fairy-work?', ask: "Is the boy's crying fairy-work?" },
      { kind: 'deliver', item: 'chamomile_tisane', qty: 1, label: 'A chamomile tisane, warm, at bedtime' },
      { kind: 'deliver', item: 'salt', qty: 1, label: 'Salt, for under the cradle' },
    ],
    resolution: "The pendulum hangs over the cradle and tells you what a mother half-knows already: a back tooth coming. Still — a little chamomile, warm, at bedtime; a pinch of salt in a twist of cloth beneath the cradle, where her mother can see it and stop fretting. The boy sleeps. Mary sends round a loaf.",
    lore: "Iron and salt at the cradle were widespread guards against the fairies believed to steal infants and leave changelings — recorded across Scotland, Ireland and England. Chamomile at bedtime is one of the longest-lived household remedies there is: Mrs Rabbit doses Peter with it in The Tale of Peter Rabbit (1902).",
    tier: 'folk',
    source: 'Beatrix Potter, The Tale of Peter Rabbit (1902)',
    reward: { gold: 55, xp: 35 },
  },
  {
    id: 'dream_of_him',
    caller: 'Nell Ashcombe',
    icon: '🌾',
    title: 'Who Will I Marry?',
    plea: "It's near May Eve and the other girls say there's a way to dream him. Will you show me? Mother mustn't know.",
    steps: [
      { kind: 'deliver', item: 'yarrow', qty: 3, label: 'Yarrow — three sprigs make nine leaves for the pillow' },
      { kind: 'pendulum', label: 'Ask the pendulum: wed within the year?', ask: "Will Nell be wed within the year?" },
    ],
    resolution: "Nine yarrow leaves under her pillow, picked on May Eve, and not a word spoken between the picking and the sleeping. She dreams of somebody. She will not say who. She blushes for a week.",
    lore: "Yarrow was a love-divination herb across Britain and Ireland. Folklorists recorded a yarrow sod under the pillow on May Eve to dream of a sweetheart in Donegal (1884), and nine leaves under the pillow in Ulster; in Suffolk a leaf went up the nose with a rhyme — if your love was true, your nose would bleed. Love divination was a steady earner for cunning folk.",
    tier: 'folk',
    source: 'Folk-lore Record (1878) · Folk-lore Journal (1884)',
    reward: { gold: 45, xp: 35 },
  },
  {
    id: 'midsummer_door',
    caller: 'Old Hobb',
    icon: '🌼',
    title: 'The House Feels Wrong',
    plea: "Things go missing. The dog won't lie by the hearth. My grandfather hung a yellow herb over the door every Midsummer and nothing troubled us — and I've forgotten which.",
    steps: [
      { kind: 'deliver', item: 'st_johns_wort', qty: 2, label: "St John's wort, for over the door" },
      { kind: 'scry', label: 'Scry the turning of the wheel for him' },
    ],
    resolution: "St John's wort over the lintel, as his grandfather did, and a sprig at the window for good measure. The bowl shows the wheel turning on regardless. The dog comes back to the hearth by the week's end — though Hobb also finds his pipe behind the settle.",
    lore: "St John's wort flowers about Midsummer and was hung over doors and windows on St John's Eve (23 June) against evil spirits. John Stow's Survey of London (1598) describes Midsummer Eve doors hung with green birch, fennel, St John's wort, orpine and white lilies.",
    tier: 'record',
    source: 'John Stow, A Survey of London (1598)',
    reward: { gold: 55, xp: 35 },
  },
  {
    id: 'ague',
    caller: 'Jack Tolley',
    icon: '🌡️',
    title: 'The Ague at Tolley Farm',
    plea: "My lad's burning and shaking by turns. The doctor's two days off and wants paying first. They say you know what's to be done.",
    steps: [
      { kind: 'deliver', item: 'feverfew_tincture', qty: 1, label: 'A feverfew tincture from the cauldron' },
      { kind: 'tarot', label: 'Read the cards for the turning of it' },
    ],
    resolution: "You leave the tincture and a slip of paper folded small: ABRACADABRA written as a dwindling triangle, a letter less each line, as the fever should dwindle. \"Burn it when he's well.\" By Sunday the lad is asking for bread.",
    lore: "Feverfew's name comes from the Latin febrifugia, \"fever-chaser\". Cunning folk paired herbs with written charms, and the oldest known use of ABRACADABRA is a fever amulet in the Liber Medicinalis of Serenus Sammonicus (3rd century AD), written as a shrinking triangle so the illness would shrink with it. Real charms against the ague were still being written in England in the 1800s.",
    tier: 'record',
    source: 'Serenus Sammonicus, Liber Medicinalis (3rd c. AD)',
    reward: { gold: 65, xp: 40 },
  },
  {
    id: 'northern_staves',
    caller: 'Captain Rask',
    icon: '⚓',
    title: 'Cast the Old Staves',
    plea: "I'm a northern man, ma'am. My grandmother cast lots before every voyage. They tell me you keep the staves. Will the Marta come home?",
    steps: [
      { kind: 'runes', label: 'Cast three staves for the voyage' },
      { kind: 'pendulum', label: 'Ask the pendulum: will the Marta come home?', ask: "Will the Marta come home?" },
    ],
    resolution: "Three staves, drawn one at a time, the way his grandmother did it. You read them to him honestly, the hard one too. He nods, pays you in foreign silver, and goes down to the harbour whistling.",
    lore: "Tacitus (Germania, ch. 10, AD 98) describes Germanic lot-casting: slips of fruit-tree wood marked with signs, scattered on a white cloth and drawn three at a time. Whether those signs were runes nobody knows — the earliest runic inscriptions come about a century later — and rune-reading as practised today is a 20th-century revival. Sailors and their wives were faithful customers of cunning folk for the fortunes of a voyage.",
    tier: 'revival',
    source: 'Tacitus, Germania ch. 10 (AD 98)',
    reward: { gold: 60, xp: 40 },
  },
  {
    id: 'letter_from_abroad',
    caller: 'Mrs Penhallow',
    icon: '✉️',
    title: 'No Letter from America',
    plea: "My Davey sailed for America at Candlemas and not a line since. Sit with me and read my cup, would you? I can bear it, whatever it is.",
    steps: [
      { kind: 'leaves', label: 'Drink a cup with her, then read the leaves' },
      { kind: 'pendulum', label: 'Ask the pendulum: is Davey well?', ask: 'Is Davey well across the water?' },
    ],
    resolution: "You turn her cup three times and set it to drain, and read what is there gently — the good sign first. She keeps the cup on the dresser, unwashed, for a week. The letter, when it comes, has a dollar folded in it.",
    lore: "Tea-leaf reading was a kitchen art, done between neighbours and by paid readers alike. Its printed dictionaries are Victorian and Edwardian: A Highland Seer's guide (early 1900s) reads a square leaf as a letter and a fish as good news from abroad, with the handle standing for the drinker and the rim for what comes soon. Emigrants' families were among the most faithful customers of fortune-tellers.",
    tier: 'folk',
    source: "A Highland Seer, Tea-Cup Reading and Fortune-Telling by Tea Leaves (early 1900s)",
    reward: { gold: 55, xp: 35 },
  },
  {
    id: 'becalmed',
    caller: 'Skipper Quilliam',
    icon: '⛵',
    title: 'Becalmed',
    plea: "Three days sat in the bay with the sails hanging like washing, and the herring won't wait. My father bought his winds from a woman on the Calf of Man. You'll sell me one, won't you? Three knots, mind.",
    steps: [
      { kind: 'deliver', item: 'wind_cord_3', qty: 1, label: 'A wind tied into a cord — three knots, none loosed' },
      { kind: 'pendulum', label: 'Ask the pendulum: will the wind hold to the fishing grounds?', ask: 'Will the wind hold to the fishing grounds?' },
    ],
    resolution: "He takes the cord like it might bite, counts the knots twice, and pays in silver. \"The first when we clear the headland. The second if we must. The third—\" He shakes his head. \"Nobody looses the third.\"",
    lore: "Selling the wind was a real trade along the northern seaboard: a cord with three knots — the first for a moderate wind, the second for half a gale, the third for a hurricane. Frazer gathers it from Finland and Lapland and from witches in Shetland, Lewis and the Isle of Man, where a medieval account already has the wind sold under three knots of thread.",
    tier: 'folk',
    source: 'J. G. Frazer, The Golden Bough (1890)',
    reward: { gold: 70, xp: 40 },
  },
  {
    id: 'aspen_ague',
    caller: 'Widow Fennick',
    icon: '🍃',
    title: 'Shake Instead of Me',
    plea: "It's the shaking ague, comes every other day and rattles my teeth. My granny said the aspen would take it off you, if you asked it right. I can't walk to the wood any more. Will you ask it for me?",
    steps: [
      { kind: 'deliver', item: 'aspen_leaf', qty: 1, label: 'A leaf from an aspen in the Wilds' },
      { kind: 'pendulum', label: 'Ask the pendulum: will the tree take it?', ask: 'Will the aspen take the widow\'s ague?' },
    ],
    resolution: "You pin a lock of her hair to the aspen with a thorn and say it for her, as the old charm has it: \"Aspen tree, aspen tree, shake and shiver instead of me.\" Then you walk home without looking back. The leaf you bring her trembles on the windowsill in no wind at all. The fits come further apart, and then they stop.",
    lore: "The aspen's leaves tremble in the faintest air, so by the logic of sympathy it was asked to take a trembling illness — the ague, malarial fever, once common in the English fens. A lock of the sufferer's hair was pinned to the tree and the charm spoken; versions were recorded in Lincolnshire and elsewhere into the 20th century.",
    tier: 'folk',
    source: 'S. Roud, The Penguin Guide to the Superstitions of Britain and Ireland (2003), "ague"',
    reward: { gold: 60, xp: 40 },
  },
  {
    id: 'lone_thorn',
    caller: 'Farmer Daly',
    icon: '🌳',
    title: 'The Lone Thorn',
    plea: "There's a single hawthorn standing in the middle of my best field and I'm sick of ploughing round it. I've the axe sharpened. My wife says to ask you first. So — I'm asking.",
    steps: [
      { kind: 'scry', label: 'Scry the bowl over the field' },
      { kind: 'pendulum', label: 'Ask the pendulum: may the thorn be cut?', ask: 'May the lone thorn in Daly\'s field be cut?' },
    ],
    resolution: "The water shows the field by moonlight and something dancing a ring round the thorn. The pendulum swings hard. You tell Daly plainly: a lone thorn is the good people's, and the man who cuts one does not prosper. He grumbles, and ploughs around it — and at harvest sends you a sack of potatoes from the best crop that field has given in years.",
    lore: "A lone hawthorn standing in a field was a 'fairy thorn' across Ireland and parts of Britain, and farmers ploughed round it rather than cut it; stories of the bad luck that followed cutting one were told everywhere. The belief is not only old: in 1999 a planned road in County Clare was re-routed after the storyteller Eddie Lenihan campaigned to save the fairy bush at Latoon.",
    tier: 'folk',
    source: 'The Latoon fairy bush, Co. Clare (1999) · Irish folklore of the lone bush',
    reward: { gold: 55, xp: 35 },
  },
  {
    id: 'bringing_in_green',
    caller: 'Mistress Cole',
    icon: '🌿',
    title: 'Bringing in the Green',
    plea: "It's for the house at midwinter — I want it done properly this year, the old way. Holly for the door and ivy for the hearth. And you'll tell me when they have to come down again, because I've heard bad things.",
    steps: [
      { kind: 'deliver', item: 'ivy_leaf', qty: 2, label: 'Ivy, for the hearth' },
      { kind: 'deliver', item: 'wood', qty: 1, label: 'Holly, for the door' },
      { kind: 'tarot', label: 'Read the cards for the house at midwinter' },
    ],
    resolution: "Holly over the door, ivy wound about the hearth, and a sprig of each in the window. Then you tell her the rule: all of it out of the house by Candlemas Eve, every leaf, and burned or thrown out — for the old rhyme says that for every leaf left behind, a goblin will come to sit in its place. She writes the date on the wall in chalk.",
    lore: "Bringing holly and ivy into the house at midwinter is one of the best-recorded of all English customs, and the greenery had to go out again on time. Robert Herrick's 'Ceremony upon Candlemas Eve' (1648) gives the rule — down with the rosemary and bays, down with the mistletoe — and warns that for every leaf left, so many goblins you shall see.",
    tier: 'record',
    source: "Robert Herrick, 'Ceremony upon Candlemas Eve', Hesperides (1648)",
    reward: { gold: 55, xp: 35 },
  },
  {
    id: 'white_heather',
    caller: 'Kirsty Baird',
    icon: '🤍',
    title: 'For the Bride',
    plea: "My sister's to be married Saturday and she's that nervous. At home in Scotland you'd give a bride white heather for her luck. Can you make her some, and tell me if it'll be a happy one?",
    steps: [
      { kind: 'deliver', item: 'white_heather_charm', qty: 1, label: "A White Heather Charm — Hazel can bind one from heather" },
      { kind: 'leaves', label: 'Drink a cup together and read it for the bride' },
    ],
    resolution: "You bind the heather with white ribbon. In the cup you find a ring near the rim, and you are glad to be able to say so honestly. Kirsty cries a little. The bride carries the heather down the aisle and keeps it pressed in her Bible for forty years.",
    lore: "White heather — a rare sport of the purple — was lucky in Scotland, and giving it to a bride or a traveller is a well-recorded custom. Its great vogue is Victorian: Queen Victoria's love of Balmoral made Highland things fashionable, and 'lucky white heather' was sold on English streets into the 20th century.",
    tier: 'folk',
    source: 'S. Roud, The Penguin Guide to the Superstitions of Britain and Ireland (2003), "heather"',
    reward: { gold: 60, xp: 40 },
  },
  {
    id: 'through_the_ash',
    caller: 'Hannah Prior',
    icon: '🌱',
    title: 'Through the Ash',
    plea: "My little one's ruptured, and the old men in the Plough say there's a cure: pass him through a split ash at sunrise and bind the tree up after. I'll do anything. But I'm frightened of doing it wrong.",
    steps: [
      { kind: 'deliver', item: 'ash_key', qty: 2, label: 'Ash keys — to plant his own ash' },
      { kind: 'pendulum', label: 'Ask the pendulum: will the child mend?', ask: 'Will Hannah\'s boy mend?' },
    ],
    resolution: "You don't split a living tree for it. You give her the ash keys to sow by her door instead — the old belief tied the child's health to the tree's, so a sapling of his own is the gentler half of the charm — and you send her to the bonesetter in the next village for the rest. The keys come up in spring. So does the boy.",
    lore: "Gilbert White's Natural History of Selborne (1789) describes the cure: a young ash was split, a ruptured child passed through it naked at sunrise, and the tree bound up again; if the tree healed, so would the child, and the two were thought bound together for life — so the tree was never felled. White saw such trees standing in his own parish.",
    tier: 'record',
    source: 'Gilbert White, The Natural History of Selborne (1789), letter XXVIII to Barrington',
    reward: { gold: 60, xp: 40 },
  },
  {
    id: 'mourning_black',
    caller: 'Agnes Rudd',
    icon: '🖤',
    title: 'Black for the Burying',
    plea: "My father's gone, and we've not the money for mourning black from the draper. My mother dyed her own when her mother died, with bark, she said. Red wood that turns the cloth black. I don't know which tree.",
    steps: [
      { kind: 'deliver', item: 'alder_bark', qty: 2, label: 'Alder bark — the tree whose wood bleeds red' },
      { kind: 'scry', label: 'Scry the bowl for the old man\'s passing' },
    ],
    resolution: "Alder, you tell her — the tree whose cut wood runs orange-red, as if it bled. Steep the bark, and put a rusty nail in the pot: the iron turns the brown to black. She dyes her shawl and her mother's in the yard, and they go to the burying in black of their own making. The bowl shows the old man easy, and you tell her so.",
    lore: "Freshly cut alder turns a vivid orange-red, which made it an uncanny tree in Irish and British lore — a tree that bleeds. Its bark was a common home dye: on its own it gives browns, and with iron in the pot, a good black, the colour country people could make for themselves for mourning.",
    tier: 'folk',
    source: 'Traditional household dyeing in Britain and Ireland',
    reward: { gold: 55, xp: 35 },
  },
];

const CALLERS_PER_DAY = 3;
const READING_KINDS = ['pendulum', 'tarot', 'runes', 'scry', 'leaves', 'ogham'];

module.exports = { CALLERS, TIERS, CALLERS_PER_DAY, READING_KINDS };
