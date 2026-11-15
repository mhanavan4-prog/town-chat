// What a thing in the pack IS, at a glance: every slot carries the item's name under it and a small coloured mark
// for its kind, so a pack of forty look-alike icons can be read without hovering over each.
//
// FLORA is a copy of data/flora.js (the client cannot read the server's data); test/inventory-move.test.js holds
// the two together.
export const FLORA = ['pine_pitch', 'witchwood', 'willow_frond', 'toadcap', 'hex_acorn', 'birch_bark', 'bramble_vine', 'nightberry', 'blackthorn', 'fern_frond', 'ring_cap',
  'alder_bark', 'ash_key', 'haw', 'ivy_leaf', 'elderberry', 'gorse_bloom', 'heather_sprig', 'crotal', 'aspen_leaf', 'yew_wood'];
const floraSet = new Set(FLORA);
export const ITEM_KINDS = {
  gear:     { label: 'Gear',     color: '#e8c06a' },
  brew:     { label: 'Brew',     color: '#c08af0' },
  plant:    { label: 'Plant',    color: '#8fd67a' },
  material: { label: 'Material', color: '#9fb4c8' },
};
// itemId -> 'gear' | 'brew' | 'plant' | 'material'. catalog: ITEM_CATALOG; plants: the plant table (its keys are plants and brews).
export function itemKind(itemId, catalog, plants) {
  const it = catalog && catalog[itemId];
  if (it && it.slot) return 'gear';
  if (/potion|_tea$|brew|draught|tonic|elixir|philtre|salve/.test(itemId)) return 'brew';
  if (floraSet.has(itemId) || itemId === 'berries' || (plants && plants[itemId])) return 'plant';
  return 'material';
}
export function itemName(itemId, catalog) {
  const it = catalog && catalog[itemId];
  return (it && it.name) || String(itemId).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
