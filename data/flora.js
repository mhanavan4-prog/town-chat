// What is gathered off trees, bushes and the ground in the Wilds and is not a herb of the garden: leaves, bark,
// berries, caps, wood. A player calls all of it plants, and the herb bag has a place for it (lib/herbBag.js).
// client/item-kinds.js keeps a copy (the client cannot read this file); test/inventory-move.test.js holds them together.
const FLORA_IDS = ['pine_pitch', 'witchwood', 'willow_frond', 'toadcap', 'hex_acorn', 'birch_bark', 'bramble_vine', 'nightberry', 'blackthorn', 'fern_frond', 'ring_cap',
  'alder_bark', 'ash_key', 'haw', 'ivy_leaf', 'elderberry', 'gorse_bloom', 'heather_sprig', 'crotal', 'aspen_leaf', 'yew_wood'];
module.exports = { FLORA_IDS };
