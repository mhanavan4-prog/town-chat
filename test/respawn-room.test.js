// Dying somewhere that is not the town or the Wilds (the Ember Wastes, the crypt, a room) and respawning: the server
// must put you in the town, not just move your coordinates. Reported from a phone: killed in the Wastes, "can't respawn".
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
const handler = server.slice(server.indexOf("if (msg.type === 'respawn') {"), server.indexOf("if (msg.type === 'respawn') {") + 4200);

test('a respawn into the town sets the room, locks it against stale moves, and leaves the Wastes properly', () => {
  const tail = handler.slice(handler.lastIndexOf('} else {', handler.indexOf("room: 'outside', x: player.x")));
  assert.match(tail, /if \(player\.room !== 'outside'\) \{/);
  assert.match(tail, /player\.room = 'outside';\s*player\.roomLockUntil = Date\.now\(\) \+ 1500;/);
  assert.match(tail, /if \(player\.room === 'ember_wastes'\) \{ player\.emberReturnX = null; player\.emberReturnY = null; emberStorm\.leave\(player\); \}/);
  assert.ok(tail.indexOf("player.room = 'outside'") < tail.indexOf("type: 'you_respawned'"), 'the room is set before she is told');
});

test('the Wilds and the dungeons keep their own way home', () => {
  assert.match(handler, /if \(player\.room && player\.room\.startsWith\('dungeon_'\)\) \{/);
  assert.match(handler, /\} else if \(player\.room === 'wilds'\) \{/);
});

test('a straggling move cannot carry you into or out of the Ember Wastes', () => {
  assert.match(server, /if \(\(player\.room === 'ember_wastes'\) !== \(msg\.room === 'ember_wastes'\)\) return;/);
  const mv = server.indexOf("if ((player.room === 'ember_wastes') !== (msg.room === 'ember_wastes')) return;");
  assert.ok(mv > server.indexOf('if (Date.now() < (player.roomLockUntil || 0) && msg.room !== player.room) return;') && mv < server.indexOf('const bounds = roomBounds(msg.room);', mv - 2000) + 4000);
  // the ways in and out set the room themselves
  assert.match(server, /if \(msg\.type === 'exit_ember_wastes'\) \{[\s\S]{0,900}player\.room = 'outside';/);
});

test('the client says where it is the moment it is back', () => {
  const h = client.slice(client.indexOf("if (msg.type === 'you_respawned') {"), client.indexOf("if (msg.type === 'dungeon_entered') {"));
  assert.match(h, /ws\.send\(JSON\.stringify\(\{ type: 'move', x: msg\.x, y: msg\.y, room: msg\.room \}\)\)/);
});
