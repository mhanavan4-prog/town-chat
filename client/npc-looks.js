// No two townsfolk quite alike. There are six bodies in the game and far more people than that, so every NPC built from
// one of them gets a small variation of its own: the cloth a shade of some plain dye, a hat or cape left at home, a
// little taller or shorter. The same NPC always gets the same look (it is drawn from a seed: its id where it has one).
//
// The game's own dressing: nothing here is from the record. Players are untouched (they have the Wardrobe).

// Plain cloth colours, multiplied over the model's own. null = as the model comes.
export const NPC_CLOTH = [null, 0xd2c2a4, 0xa3ad92, 0x98a4b8, 0xb89282, 0xb3a472, 0x968aa6, 0x8a9a90, 0xc0a8a6, 0x7f8a9c, 0xa88f6c];
export const NPC_TRIM = [null, 0xb87a62, 0x78927a, 0x7388a8, 0xc8aa5c, 0x86769a, 0x969696, 0xa86a6a];
export const NPC_HEIGHT = [0.93, 1.07]; // shortest and tallest, against the model's own height

function npcHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function npcRand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// toggles: the body's own hat / cape pieces, as the Wardrobe lists them ([{ id, mesh }]).
export function npcLook(charId, seed, toggles) {
  const r = npcRand(npcHash(String(charId) + '|' + String(seed)));
  const pick = (list) => list[Math.floor(r() * list.length)];
  const bodyTint = pick(NPC_CLOTH), accentTint = pick(NPC_TRIM);
  const hide = [];
  for (const t of (toggles || [])) if (r() < 0.38) hide.push(t.mesh);
  const height = NPC_HEIGHT[0] + r() * (NPC_HEIGHT[1] - NPC_HEIGHT[0]);
  return { bodyTint, accentTint, hide, height: Math.round(height * 1000) / 1000 };
}
