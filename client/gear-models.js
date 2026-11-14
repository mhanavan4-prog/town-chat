// Worn gear that has a model of its own (public/kk/gear/<itemId>.glb, tools/models/build_gear.py). An item
// not listed here is drawn the old way, as its slot's plain shape in the item's colour.
// test/gear-models.test.js holds this list to the files and to the catalogue.
export const GEAR_IDS = [
  'iron_sword', 'spell_tome', 'yew_wand', 'cursed_blade', 'shadow_staff', 'void_staff', 'alpha_fang', 'wizard_hat', 'bloodmoon_circlet', 'beast_crown', 'spirit_veil', 'knights_helm', 'travelers_hood', 'dread_helm', 'shadow_crown', 'steel_shield', 'witch_robe', 'beast_hide', 'spirit_robe', 'travelers_vest', 'bone_armor', 'shadow_cloak', 'abyssal_armor', 'moonhowl_pelt', 'leather_boots', 'hexed_boots', 'paw_boots', 'soul_treads', 'wraith_treads', 'nightfang_boots', 'silver_ring', 'hex_amulet', 'spirit_ring', 'order_signet', 'trail_ring', 'witches_boon', 'death_ring', 'packbound_ring',
];
// Where a model sits on a KayKit body, per slot: the bone's own space is not the model's, so each slot has a
// turn (radians, XYZ) and an offset (game units) found by eye in the real client. A model is built at 1 unit =
// 10 game units.
export const GEAR_SCALE = 10;
export const GEAR_SEAT = {
  weapon: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1.25 },
  head: { pos: [0, 14, 0], rot: [0, 0, 0], scale: 1.08 },
  chest: { pos: [0, -3, 0], rot: [0, 0, 0], scale: 1.4 },
  feet: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1.5, body: true },   // body: square to the body, not to the bone
  ring: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1.4 },
};
