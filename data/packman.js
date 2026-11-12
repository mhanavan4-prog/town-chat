// The packman: a pedlar who sets down his pack at the stall in the Wildlands
// Village on the nights its bound fires are lit and the round is closed
// (data/villageWard.js), and is gone by morning. A few small wares, different
// each night, a little dearer than in the town; and he pays over for goods
// from either side, having both markets ahead of him.
const { VILLAGE } = require('./villageHouses');

const PACKMAN = {
  npcId: 'npc_packman',
  name: 'Jack the packman',
  tier: 'record',
  // the market stall, south-east of the hall (client/wilds-scene.js places it at VX+330, VZ+330)
  x: VILLAGE.x + 330, y: VILLAGE.y + 330,
  range: 190,
  perNight: 4,
  // what may be in the pack: small wares the town already sells, at a carrier's price
  pool: [
    { id: 'bent_pins', price: 5 }, { id: 'red_thread', price: 4 }, { id: 'iron_nails', price: 8 }, { id: 'glass_vial', price: 7 },
    { id: 'healing_potion', price: 17 }, { id: 'bellarmine_jug', price: 24 }, { id: 'magic_scroll', price: 32 }, { id: 'iron_ingot', price: 42 },
  ],
  shut: '🎒 The stall is shuttered and there is nobody at it. A packman will not lie out in the Wilds where the bound fires are not lit.',
  lore: [
    'Before there were shops in small places there was the packman: the pedlar, chapman or Scotch draper, who walked a round of farms and villages with his stock on his back and sold it at the door. The probate inventories of seventeenth-century chapmen list what was in the pack: pins and needles by the thousand, thread, tape, ribbon and lace, buttons, combs, small looking-glasses, lengths of linen, and little printed books at a penny or two.',
    'He was the way news travelled as well as goods, and he was not trusted: an Act of 1697 made hawkers and pedlars buy a licence, and they were lumped with vagrants in older ones. Shakespeare\'s Autolycus, with his ballads and ribbons and light fingers, is the type.',
    'The same pack carried what a cunning-woman or an anxious household wanted and could not make: pins, iron nails, red thread, a stoneware bottle.',
  ],
  source: 'Margaret Spufford, The Great Reclothing of Rural England: Petty Chapmen and their Wares in the Seventeenth Century (1984), from chapmen\'s probate inventories; the licensing Act of 8 & 9 William III (1697); The Winter\'s Tale, Act IV.',
  note: 'Pedlars and what they carried are in the record. One who comes to this village only on nights the round of fire is closed is the game\'s.',
};

// Tonight's pack: the same for everyone, and different from last night's.
function stockFor(cycle) {
  const n = PACKMAN.pool.length, start = ((cycle * 3) % n + n) % n, out = [];
  for (let i = 0; i < PACKMAN.perNight; i++) out.push(PACKMAN.pool[(start + i * 3) % n]);   // 3 and 8 share no factor: four different things
  return out;
}

module.exports = { PACKMAN, stockFor };
