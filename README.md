# Town Chat

A small 3D multiplayer town. Everyone walks around as a humanoid avatar in a
third-person view; each building is its own chatroom with a full-screen
medieval interior — walk through the door and the view switches entirely to
that building's inside, where you're chatting with whoever else is in there.
Walk back out through the door and you're back in the open-air town square.

- Move: W/S walk forward/backward in the direction you're facing, A/D (or
  left/right arrows) turn in place — desktop. On-screen joystick on
  mobile/touch.
- Chat only exists **inside buildings** — the open world has no chat at all.
- Speech bubbles pop up over a player's head when they send a message.
- 5 buildings, each with its own medieval interior theme: ☕ The Cafe
  (tavern — **free to enter**), 📚 The Library (scriptorium), 🎮 The Arcade
  (alchemist's den), 🛋️ Rooftop Lounge (noble's parlor), 🏛️ Town Hall
  (great hall). The four non-Cafe buildings are locked behind a one-time
  "Town Pass" payment (see **Premium buildings & Stripe payments** below).
- Optional shared passcode to keep the town private to your friends.

No accounts, no database — it's all in-memory, so the chat history and
player list reset whenever the server restarts. The premium-unlock flag is
likewise just a flag in that browser's `localStorage` once a real payment is
verified — not a real account system.

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
