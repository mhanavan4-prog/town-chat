# Town Chat

A small multiplayer town. Everyone walks around as a colored avatar; each
building is its own chatroom — walk through the door and you're chatting
with whoever else is inside. Walk back outside and you're in the open-air
"Town Square" channel instead.

- Move: WASD / arrow keys (desktop), on-screen joystick (mobile/touch)
- Chat: click the chat box, type, hit Enter
- Speech bubbles pop up over a player's head when they send a message
- 5 buildings: Cafe, Library, Arcade, Rooftop Lounge, Town Hall
- Optional shared passcode to keep the town private to your friends

No accounts, no database — it's all in-memory, so the chat history and
player list reset whenever the server restarts.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd town-chat
rm -rf node_modules   # remove the placeholder folder included in this delivery, if present
npm install
npm start
```

Then open **http://localhost:3000**.

- Friends on your same WiFi can join at `http://<your-computer's-local-IP>:3000`
  (find your local IP with `ipconfig` on Windows or `ifconfig`/`ipconfig getifaddr en0` on Mac).
- Friends elsewhere on the internet **cannot** reach `localhost`, so for that
  you need to deploy it (see below).

### Optional: set a shared passcode

```bash
# Mac/Linux
TOWN_PASSWORD=mypassword npm start

# Windows (PowerShell)
$env:TOWN_PASSWORD="mypassword"; npm start
```

Leave it unset and anyone with the link can join without a passcode.

## Deploy it so friends anywhere can join (free)

The easiest free option is **Render**:

1. Create a free [GitHub](https://github.com) account if you don't have one,
   and push this `town-chat` folder to a new repo.
2. Go to [render.com](https://render.com) → sign up (free) → **New +** → **Web Service**.
3. Connect your GitHub repo.
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. (Optional) Under **Environment**, add `TOWN_PASSWORD` = your chosen passcode.
6. Click **Create Web Service**. Render gives you a URL like
   `https://your-town.onrender.com` — share that link with friends.

Render's free tier spins the server down after inactivity, so the first
visit after a quiet period takes ~30-50 seconds to wake up. That's normal.

**Alternatives:** Railway (railway.app) and Fly.io (fly.io) work the same
way — push the repo, point it at `npm start`, set `PORT` is handled
automatically by this server already (`process.env.PORT`).

## How it works (quick tour)

- `server.js` — Node/Express + `ws` WebSocket server. Holds every player's
  position/room in memory, broadcasts position updates ~14x/sec, and routes
  chat messages only to players currently in the same room (building or
  "outside"). Gate-keeps joining with `TOWN_PASSWORD` if set.
- `public/index.html` — join screen, HUD, chat panel markup/styles.
- `public/client.js` — canvas rendering, movement + wall collision (each
  building has solid walls except a door gap), room detection, chat UI,
  WebSocket message handling.

Want changes — different buildings, bigger map, persistent chat history,
login accounts? Just ask and I can extend it.
