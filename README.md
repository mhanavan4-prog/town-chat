# Town Chat

A small 3D multiplayer town. Everyone walks around as a humanoid avatar in a
third-person view; each building is its own chatroom with a full-screen
medieval interior — walk through the door and the view switches entirely to
that building's inside, where you're chatting with whoever else is in there.
Walk back out through the door and you're back in the open-air town square.

- Move: W/S walk forward/backward in the direction you're facing, A/D (or
  left/right arrows) turn in place, Q/E strafe left/right, Space to jump —
  desktop. On-screen joystick on mobile/touch. F interacts (sit, Town Pass
  kiosk) while indoors.
- Click and drag anywhere on the game view to look around, left/right and
  up/down — this only orbits the camera around your character, it doesn't
  change which way you're walking. The instant you move or turn, the
  camera's left/right orbit snaps back behind the character (pitch/looking
  up-and-down stays put) so "forward on screen" and "forward for the
  character" can't end up pointing two different ways.
- Chat only exists **inside buildings** — the open world has no chat at all.
- Speech bubbles pop up over a player's head when they send a message.
- 📷 Pictures in chat: the camera-icon button next to the chat box lets you
  attach an image (resized/compressed in your browser before sending) to a
  message. Relayed by the server exactly like a text message, scoped to
  whichever room you're in.
- A large open town square (3200x2200) with grass, dirt paths, scattered
  trees/shrubs, rock clusters, and flower patches around the edges.
- 🐇 A handful of rabbits wander the grass and gently bound away if you get
  close, settling back into wandering/grazing once you back off. They're
  purely decorative and purely client-side — each player's game runs the
  same flee logic independently, reacting only to that player, so it's not
  networked or synced between players.
- 5 buildings, each with its own medieval interior theme: ☕ The Cafe
  (tavern), 📚 The Library (scriptorium), 🎮 The Arcade (alchemist's den),
  🛋️ Rooftop Lounge (noble's parlor — see below), 🏛️ Town Hall (great hall,
  the building straight ahead when you spawn). All five are free to enter
  for now — the Stripe paywall code is still in place but disabled (see
  **Premium buildings & Stripe payments** below) so it can be turned back on
  later without rebuilding it.
- 🛋️ The Rooftop Lounge is two stories, inside and out: a ground-floor
  parlor (5 tables — a cozy fireside table plus 4 more in a dining grid)
  with a staircase up to an open-air terrace overlooking it, with 3 more
  tables. Walking up/down the stairs is just walking normally — your
  character's height rises and falls to match as you cross the staircase.
- 🎮 The Arcade has two actual playable cabinets — 🐍 Snake and 🧱 Breakout.
  Walk up to one and press F to play (arrow keys to control, Space to retry
  after a game over, Esc to step away). Each is a small self-contained
  client-side mini-game — no server involvement, no shared/competitive
  state, just something to do while you're in there chatting.
- 🎒 Inventory (top-left button): write a private note to any other player
  currently in the town. Notes aren't stored anywhere — they're relayed
  straight to the recipient's inbox and never touch a database. Reading a
  note destroys it permanently (it disappears from the recipient's inbox a
  few seconds after being opened, and the sender gets notified it was read),
  so a note can only ever be read once, by the one person it was sent to.
- Optional shared passcode to keep the town private to your friends.
- Optional accounts — see **Accounts & logging in as the same user** below.
  Everything else is still in-memory and accounts are opt-in: join as a
  Guest and nothing changes from before.

Other than accounts, there's no database — chat history and the player
list reset whenever the server restarts. The premium-unlock flag is
likewise just a flag in that browser's `localStorage` once a real payment is
verified — not a real account system.

## Accounts & logging in as the same user

On the join screen, the **Account** tab lets you create a username +
password and log in as that same identity every time, instead of typing a
fresh name each visit. Logging in always gives you the same display name
and the same color (picked deterministically from your username), even
across different browsers/devices — unlike the Guest tab, which is just
whatever you type, per-browser, with a color that cycles round-robin.

How it's built, and what that means for you:
- Accounts are stored server-side in `accounts.json` (gitignored — **never
  commit it**, it holds password hashes). Passwords are never stored or
  logged in plaintext: each one is hashed with `scrypt` and a random
  per-account salt, verified with a constant-time comparison.
- There's no real database — `accounts.json` is just a JSON file on the
  server's local disk. That's fine for running this on a normal VM/box,
  but **on a host with an ephemeral filesystem (e.g. Render's free tier),
  accounts won't survive a redeploy** — only restarts of the same running
  instance. If you need accounts to truly persist long-term, this would
  need to move to an actual hosted database; ask if you want that.
- Login sessions (the token your browser holds after logging in) are
  in-memory only and don't survive a server restart at all — you'll just
  need to log in again, same as any normal session expiring.
- This is intentionally lightweight: no rate-limiting on login attempts, no
  email/password recovery, no admin tooling. Fine for a casual game among
  friends; not something to put sensitive credentials into.

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

## Premium buildings & Stripe payments

The Cafe is free for everyone. The other four buildings are locked — walking
into their doorway just bounces you back outside — until that browser has a
verified "Town Pass" payment. This is wired up to **real Stripe Checkout**,
not a placeholder:

1. Create a free account at [stripe.com](https://stripe.com).
2. In the Stripe Dashboard, go to **Developers → API keys** and copy your
   **Secret key**. Use the one under **Test mode** first (it starts with
   `sk_test_...`) — test mode lets you run real checkout flows without
   real money, using Stripe's test card `4242 4242 4242 4242` (any future
   expiry, any CVC, any ZIP).
3. Set it as an environment variable — **never paste a secret key into chat
   or commit it to GitHub**:
   ```bash
   # Mac/Linux
   STRIPE_SECRET_KEY=sk_test_xxxxx npm start

   # Windows (PowerShell)
   $env:STRIPE_SECRET_KEY="sk_test_xxxxx"; npm start
   ```
   On Render (or Railway/Fly.io), add `STRIPE_SECRET_KEY` under that
   service's **Environment** settings instead of a local `.env` file.
4. (Optional) `PREMIUM_PRICE_CENTS` sets the price in cents — defaults to
   `300` ($3.00). Example: `PREMIUM_PRICE_CENTS=500` for $5.00.
5. If `STRIPE_SECRET_KEY` is left unset, the "Unlock all" button on the HUD
   simply stays hidden — the rest of the town still works fine with only
   the Cafe enterable.
6. When you're ready for real money, repeat step 2 with your **Live mode**
   secret key (`sk_live_...`) instead of the test one. Test thoroughly with
   a test key first — Stripe's test and live modes are completely separate,
   so nothing you do in test mode risks a real charge.

The unlock check happens server-side (`/api/checkout` creates a real Stripe
Checkout Session; `/api/verify-session` confirms the payment actually went
through before unlocking), so it can't be spoofed by editing the page. The
*result* of that check — "this browser has paid" — is then remembered only
in `localStorage`, consistent with this project's no-database design: it's
per-browser, not a real login, so paying on one device/browser won't carry
over to another.

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
  "outside"). Gate-keeps joining with `TOWN_PASSWORD` if set. Also exposes
  `/api/config`, `/api/checkout`, and `/api/verify-session` for the Stripe
  paywall — these are the only parts of the server that know about payments;
  movement/chat are untouched by it.
- `public/index.html` — join screen, HUD, chat panel, unlock-banner markup/styles.
- `public/client.js` — Three.js rendering for both the outdoor town and each
  building's interior, movement + wall collision, room detection/transitions,
  chat UI, the Stripe unlock button + post-payment verification, WebSocket
  message handling.

A technical note on the indoor/outdoor split: rather than invent a separate
coordinate system for "inside a building" (which the server would have
silently clamped, since it only knows about the single outdoor `[0,width] x
[0,height]` space), each building's interior reuses that same building's
outdoor footprint as its local coordinate space, just rendered at a larger
visual scale. No server-side changes were needed to support it.

**A known limitation of this delivery:** the live Stripe checkout/redirect
flow can't be end-to-end tested in the sandbox this was built in (no
outbound access to Stripe's API), so please test the full pay → redirect →
unlock loop yourself with a Stripe test key and test card before relying on
it, and let me know if anything doesn't unlock correctly.

Want changes — different buildings, bigger map, persistent chat history,
login accounts, a different price or free building? Just ask and I can
extend it.
