// Town Chat — multiplayer world server
// Express serves the static client; "ws" handles realtime player movement + room-scoped chat.

const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
// Set TOWN_PASSWORD as an environment variable on your host to gate the town.
// Leave unset for no password (anyone with the link can join).
const TOWN_PASSWORD = process.env.TOWN_PASSWORD || '';

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---------------------------------------------------------------------------
// World definition — single source of truth, sent to every client on join.
// Buildings double as chatrooms: being inside a building's rect = being in
// that room's chat channel. "outside" is the open-air town-square channel.
// ---------------------------------------------------------------------------
const WORLD = {
  width: 1600,
  height: 1100,
  spawn: { x: 800, y: 560 },
  doorWidth: 64,
  wallThickness: 14,
  buildings: [
    { id: 'cafe',    name: '☕ The Cafe',          x: 180,  y: 190, w: 230, h: 160, color: '#d98a4f' },
    { id: 'library', name: '📚 The Library',       x: 1190, y: 190, w: 230, h: 160, color: '#6f8fae' },
    { id: 'arcade',  name: '🎮 The Arcade',        x: 180,  y: 760, w: 230, h: 160, color: '#9b5fc0' },
    { id: 'lounge',  name: '🛋️ Rooftop Lounge',   x: 1190, y: 760, w: 230, h: 160, color: '#c0596f' },
    { id: 'hall',    name: '🏛️ Town Hall',        x: 685,  y: 55,  w: 230, h: 150, color: '#8a9a5b' }
  ]
};
const ROOM_IDS = new Set(['outside', ...WORLD.buildings.map(b => b.id)]);

const COLORS = ['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#38d9a9','#4dabf7','#748ffc','#da77f2','#f783ac','#63e6be'];

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------
/** @type {Map<string, {ws:any,id:string,name:string,color:string,x:number,y:number,room:string}>} */
const players = new Map();
let colorIdx = 0;

function makeId() {
  return crypto.randomBytes(6).toString('hex');
}

function sanitizeName(raw) {
  const cleaned = String(raw || '').replace(/[<>]/g, '').trim().slice(0, 18);
  return cleaned || ('Guest' + Math.floor(Math.random() * 9000 + 100));
}

function sanitizeText(raw) {
  return String(raw || '').replace(/[<>]/g, '').trim().slice(0, 240);
}

function publicPlayer(p) {
  return { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, room: p.room };
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

function broadcastAll(data, exceptWs) {
  const msg = JSON.stringify(data);
  for (const p of players.values()) {
    if (p.ws !== exceptWs && p.ws.readyState === p.ws.OPEN) p.ws.send(msg);
  }
}

function broadcastRoom(room, data) {
  const msg = JSON.stringify(data);
  for (const p of players.values()) {
    if (p.room === room && p.ws.readyState === p.ws.OPEN) p.ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  let player = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'join') {
      if (player) return; // already joined
      if (TOWN_PASSWORD && msg.password !== TOWN_PASSWORD) {
        send(ws, { type: 'join_error', message: 'Wrong passcode.' });
        return;
      }
      const id = makeId();
      const color = COLORS[colorIdx++ % COLORS.length];
      player = {
        ws, id,
        name: sanitizeName(msg.name),
        color,
        x: WORLD.spawn.x,
        y: WORLD.spawn.y,
        room: 'outside'
      };
      players.set(id, player);

      send(ws, {
        type: 'init',
        id,
        world: WORLD,
        players: Array.from(players.values()).map(publicPlayer)
      });
      broadcastAll({ type: 'player_joined', player: publicPlayer(player) }, ws);
      return;
    }

    if (!player) return; // ignore everything else until joined

    if (msg.type === 'move') {
      const x = Number(msg.x), y = Number(msg.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        player.x = Math.max(0, Math.min(WORLD.width, x));
        player.y = Math.max(0, Math.min(WORLD.height, y));
      }
      if (typeof msg.room === 'string' && ROOM_IDS.has(msg.room)) {
        player.room = msg.room;
      }
      return;
    }

    if (msg.type === 'chat') {
      const text = sanitizeText(msg.text);
      if (!text) return;
      const chatMsg = {
        type: 'chat',
        message: {
          id: player.id,
          name: player.name,
          color: player.color,
          text,
          room: player.room,
          ts: Date.now()
        }
      };
      broadcastRoom(player.room, chatMsg);
      return;
    }
  });

  ws.on('close', () => {
    if (player) {
      players.delete(player.id);
      broadcastAll({ type: 'player_left', id: player.id });
    }
  });
});

// Periodic full-state tick so everyone's position stays in sync even if a
// 'move' packet is dropped. Small player counts, so a full snapshot is fine.
setInterval(() => {
  if (players.size === 0) return;
  const snapshot = { type: 'state', players: Array.from(players.values()).map(publicPlayer) };
  broadcastAll(snapshot);
}, 70);

server.listen(PORT, () => {
  console.log(`Town Chat listening on http://localhost:${PORT}`);
  if (TOWN_PASSWORD) console.log('Passcode protection: ON');
});
