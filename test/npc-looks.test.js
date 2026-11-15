// No two townsfolk quite alike (client/npc-looks.js): every NPC body gets a small variation drawn from its seed, the
// same NPC always the same one, and players are left to the Wardrobe.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('a look is stable for a seed, varied across seeds, and modest', async () => {
  const { npcLook, NPC_HEIGHT, NPC_CLOTH, NPC_TRIM } = await import('../client/npc-looks.js');
  const toggles = [{ id: 'hat', mesh: 'Mage_Hat' }, { id: 'cape', mesh: 'Mage_Cape' }];
  assert.deepStrictEqual(npcLook(0, 'npc_finn', toggles), npcLook(0, 'npc_finn', toggles), 'the same person, the same look');
  const looks = Array.from({ length: 60 }, (_, i) => npcLook(0, 'n' + i, toggles));
  const distinct = new Set(looks.map((l) => JSON.stringify([l.bodyTint, l.accentTint, l.hide]))).size;
  assert.ok(distinct >= 30, 'sixty witches, at least thirty outfits: ' + distinct);
  for (const l of looks) {
    assert.ok(l.height >= NPC_HEIGHT[0] && l.height <= NPC_HEIGHT[1]);
    assert.ok(NPC_CLOTH.includes(l.bodyTint) && NPC_TRIM.includes(l.accentTint));
    assert.ok(l.hide.every((m) => m === 'Mage_Hat' || m === 'Mage_Cape'));
  }
  assert.ok(looks.some((l) => l.hide.includes('Mage_Hat')) && looks.some((l) => !l.hide.length), 'some bare-headed, some not');
  assert.notDeepStrictEqual(npcLook(0, 'a', toggles), npcLook(3, 'a', toggles), 'the body counts too');
  assert.deepStrictEqual(npcLook(5, 'x', undefined).hide, []);
});

test('NPCs get it, players do not, and a redrawn NPC stays the same person', () => {
  const h = read('client/humanoid.js');
  assert.match(h, /const isNpc = appearance === undefined \|\| typeof appearance === 'string';/);
  assert.match(h, /createKayKitHumanoid\(charId, isNpc \? null : appearance, npcSeed\)/);
  assert.match(h, /createHumanoid\(rec\.charId, null, rec\.seed\)/);
  assert.match(read('client/player-visuals.js'), /createHumanoid\(p\.charId \|\| 0, null, p\.appearance \|\| null\)/, 'a player passes an appearance or null, never nothing');
  assert.match(read('client/village-npcs.js'), /createHumanoid\(charId, null, 'villager:' \+ id\)/);
  assert.match(read('client/town-scene.js'), /createHumanoid\(npc\.charId, null, npc\.id\)/);
});
