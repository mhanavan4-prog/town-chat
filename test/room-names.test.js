// A room is never shown by its internal id (client/collision.js roomLabel): the chat tab read "vh_forge".
const test = require('node:test');
const assert = require('node:assert');

const make = async (houses) => {
  const { default: createCollision } = await import('../client/collision.js');
  return createCollision({ getWorld: () => ({ buildings: [{ id: 'cafe', name: '☕ The Café' }] }), getWalls: () => [], getDungeonLore: () => null, getDelveState: () => null, getVillageHouses: () => houses });
};

test('every village house goes by its own name', async () => {
  const { VILLAGE_HOUSES } = require('../data/villageHouses');
  const c = await make(VILLAGE_HOUSES);
  for (const h of Object.values(VILLAGE_HOUSES)) {
    const label = c.roomLabel(h.room);
    assert.ok(label.includes(h.name), h.room + ' -> ' + label);
    assert.ok(!/vh_/.test(label));
  }
  assert.strictEqual(c.roomLabel('vh_forge'), '⚒️ The Smithy');
});

test('named rooms keep their names, and an unnamed one is made readable', async () => {
  const c = await make(null);
  assert.strictEqual(c.roomLabel('cafe'), '☕ The Café');
  assert.strictEqual(c.roomLabel('wilds'), '🌲 The Wilds');
  assert.strictEqual(c.roomLabel('vh_forge'), 'Forge', 'before the catalogue arrives');
  assert.strictEqual(c.roomLabel('witch_cave'), 'Witch Cave');
  assert.strictEqual(c.plainRoomName(''), 'Room');
});
