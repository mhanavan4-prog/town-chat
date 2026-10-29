// Guising (Tier 3.5) — the Samhain tradition of donning a disguise so the
// wandering dead pass you by. Purely cosmetic: a guise is a procedural overlay
// drawn on your body by every nearby client (client/guises.js), driven by the
// account-scoped `guise` id on your broadcast — the same proven path the
// familiars ride. No stats, no gate; a costume you can wear whenever you like,
// and change or doff for free from the Wardrobe.
//
// Keep ids in lockstep with the mesh BUILDERS in client/guises.js.

const GUISES = {
  skull:   { name: 'Bone Mask',    emoji: '💀', blurb: 'A bleached skull over your face. The dead nod to their own.' },
  pumpkin: { name: 'Jack-o’-Head', emoji: '🎃', blurb: 'A carved pumpkin for a head, candle-lit from within.' },
  ghost:   { name: 'Sheet Ghost',  emoji: '👻', blurb: 'A pale winding-sheet with two dark eyeholes. Boo.' },
  raven:   { name: 'Plague Raven', emoji: '🐦‍⬛', blurb: 'A long-beaked black bird mask, for crossing between worlds.' },
  witch:   { name: 'Pointed Hat',  emoji: '🧙', blurb: 'The tall black hat of the old stories. Lean into it.' },
  stag:    { name: 'The Horned',   emoji: '🦌', blurb: 'A crown of antlers — the hunter of the wild Samhain night.' },
};

module.exports = { GUISES };
