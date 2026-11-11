// Guising (Tier 3.5) — the Samhain tradition of donning a disguise so the
// wandering dead pass you by. Purely cosmetic: a guise is a procedural overlay
// drawn on your body by every nearby client (client/guises.js), driven by the
// account-scoped `guise` id on your broadcast — the same proven path the
// familiars ride. No stats, no gate; a costume you can wear whenever you like,
// and change or doff for free from the Wardrobe.
//
// Keep ids in lockstep with the mesh BUILDERS in client/guises.js.

const GUISES = {
  // The free seven — worn by anyone, changed or doffed for nothing.
  skull:   { name: 'Bone Mask',    emoji: '💀', blurb: 'A bleached skull over your face. The dead nod to their own.' },
  pumpkin: { name: 'Jack-o’-Head', emoji: '🎃', blurb: 'A carved pumpkin for a head, candle-lit from within.' },
  // The older lantern: in Ireland and on Man it was a turnip (data/mythOrRecord.js,
  // 'pumpkin_lanterns'; on Man, the Hop-tu-Naa moot).
  turnip:  { name: 'The Moot',     emoji: '🏮', blurb: 'A hollowed turnip for a head, carved and lit from inside: the Hallowe’en lantern of Ireland and the Isle of Man before the pumpkin.' },
  devil:   { name: 'Little Devil',  emoji: '😈', blurb: 'Red-skinned and sharp-horned — the devil of the English mummers’ play, Beelzebub with his club.' },
  raven:   { name: 'Plague Raven', emoji: '🐦‍⬛', blurb: 'A long-beaked black bird mask, for crossing between worlds.' },
  witch:   { name: 'Pointed Hat',  emoji: '🧙', blurb: 'The tall, wide-brimmed hat of the old stories. Lean into it.' },
  stag:    { name: 'The Horned',   emoji: '🦌', blurb: 'A crown of antlers — Herne, the antlered hunter Shakespeare sets in Windsor Forest.' },
  // ── The Monsters' Masque — a collectible set: wear the real heads of the
  // night's own monsters, cloned from the KayKit character meshes already in the
  // world (the werewolf on the balcony, the Artificer's vampire, the Wilds beast).
  // Bought with Moonstones and kept on the account; gather all three to earn the
  // Spirit-Clad title. Each has a matching GLB head-node mapping in client/guises.js
  // (`kk`/`node` → clone just that character's head onto the wearer's head bone).
  // `set:'masque'` marks the collectible tier; `ms` is the Moonstone price.
  werewolf:    { name: 'The Werewolf',  emoji: '🐺', blurb: 'The long grey muzzle and bared fangs of the moon-mad wolf. Howl if you like — it suits you now.', ms: 15, set: 'masque' },
  vampire:     { name: 'The Vampire',   emoji: '🧛', blurb: 'The pale, sharp-eyed face of the old blood. Smile slowly; let them wonder about the teeth.', ms: 20, set: 'masque' },
  frankenstein:{ name: 'The Monster',   emoji: '🧟', blurb: 'The flat green brow and heavy jaw of the stitched-together thing. Lurch accordingly.', ms: 25, set: 'masque' },
};

// The collectible tier: the ids that make up the Otherworld set (those with a
// Moonstone price), the price lookup, and the title for completing the whole set.
const GUISE_COLLECTIBLE = Object.keys(GUISES).filter((id) => GUISES[id].ms > 0);
const GUISE_SET_TITLE = 'spirit_clad';

module.exports = { GUISES, GUISE_COLLECTIBLE, GUISE_SET_TITLE };
