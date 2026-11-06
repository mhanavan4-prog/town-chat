// ---------------------------------------------------------------------------
// Charm Book rewards — what writing the book up earns.
//
// Every chapter finished pays a small purse. Four milestones across the whole
// book (a quarter, half, three quarters, every page) each give a title and a
// larger purse, and three quarters also gives Woad Blue, the one plant dye you
// can't steep from a pocketful of gatherings. Rewards are given once per
// account (accounts[k].charmRewards) and are never taken back, even if later
// updates add more pages to the book.
// ---------------------------------------------------------------------------
const CHAPTER_PURSE = 30;

const MILESTONES = [
  { key: 'quarter', at: 25, label: 'A quarter of the book', title: 'charm_keeper', gold: 60 },
  { key: 'half', at: 50, label: 'Half the book', title: 'cunning_hand', gold: 120 },
  { key: 'three_quarters', at: 75, label: 'Three quarters of the book', title: 'parish_charmer', gold: 200, dye: 'woad_blue' },
  { key: 'whole', at: 100, label: 'Every page of the book', title: 'whole_book', gold: 400 },
];

// Woad: earned from the book, not steeped, because a woad vat is a slow,
// fermenting thing you learn rather than a pot you boil.
const WOAD_LORE = {
  tier: 'record',
  lore: 'Woad (Isatis tinctoria) was the blue of the British Isles before Indian indigo came in: the leaves were crushed, balled and fermented, then set in a warm vat that had to be tended for days before the wool came out green and turned blue in the air. It was a trade of its own, and the woad mills stank.',
  source: 'M. Grieve, A Modern Herbal (1931), "Woad"',
};

module.exports = { CHAPTER_PURSE, MILESTONES, WOAD_LORE };
