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
- 🧑 Characters have actual faces now (eyes, brows, a mouth) and one of 5
  distinct looks — different skin tone, hair color **and** hair shape
  (short/ponytail/long/buzzed/mohawk), shirt, and pants per preset, not
  just a recolor. Pick one on the join screen before entering town; your
  choice is remembered in that browser for next time, but it's just a
  cosmetic, per-session pick — not tied to your account/login the way your
  name and color are.
- 📷 Pictures in chat: the camera-icon button next to the chat box lets you
  attach an image (resized/compressed in your browser before sending) to a
  message. Relayed by the server exactly like a text message, scoped to
  whichever room you're in.
- A large open town square (3200x2200) with grass, dirt paths, scattered
  trees/shrubs, rock clusters, and flower patches around the edges.
- 🐇 A handful of rabbits wander the grass and gently bound away if you get
  close, settling back into wandering/grazing once you back off. Their
  flee/wander behavior is simulated server-side and broadcast to everyone,
  so every connected player sees the same rabbit in the same place doing
  the same thing — not each client running its own disconnected copy.
- ☀️🌕 A day/night cycle outdoors: 20 real-world minutes of day, 20 of
  night, on a continuous loop, with a few minutes of dawn/dusk blending in
  between rather than an instant flip. The sun arcs across the sky during
  the day; a full moon (with its own dim, cool-toned moonlight — enough to
  still see by, just bluer and darker than daytime) arcs opposite it at
  night. There's a small ☀️/🌕 indicator in the top HUD. This is computed
  from each browser's own clock (like the self-destructing notes feature),
  not tracked by the server — every connected client lands on the same
  phase just by agreeing what time it is, with no network traffic and no
  state that resets if the server restarts.
- 👹 Hostile-looking mobs spawn outside (not inside) the buildings once
  night falls and wander the area obliviously until dawn, when they
  disappear again. They do **not** flee from you (unlike the rabbits) and
  do **not** attack — that's deliberately not built yet, this is just the
  atmosphere/foundation for it. Like the rabbits, server-simulated and
  synced so everyone sees the same mobs in the same places.
- 6 buildings, each with its own medieval interior theme: ☕ The Cafe
  (tavern), 📚 The Library (scriptorium), 🎮 The Arcade (alchemist's den),
  🛋️ Rooftop Lounge (noble's parlor — see below), 🏛️ Town Hall (great hall,
  the building straight ahead when you spawn), 🏦 The Bank (see **In-game
  economy** below). All six are free to *enter* for now — the Stripe
  paywall code is still in place but disabled (see **Premium buildings &
  Stripe payments** below) so it can be turned back on later without
  rebuilding it.
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
- 📱 The Arcade's chat panel is also 3x the normal size and has a second
  **Text** tab next to Chat — log in with your own Twilio account once and
  send a real SMS to a real phone number from there (see **Texting
  (Twilio)** below for how each player sets this up). An earlier version of
  this tab tried to embed a web browser instead; that's gone now since most
  real sites refuse to render inside another page anyway
  (`X-Frame-Options`/CSP), so it never reliably worked.
- 🎒 Inventory (top-left button), two tabs:
  - **Items** — what you're actually carrying: 24 slots plus a ⚔️ Weapon and
    🛡️ Armor equip slot. Click a slot to equip whatever's eligible; click an
    equip slot to take it off again. This is separate from the Bank's own
    24 slots (see **In-game economy** below) — move things between the two
    from inside the Bank modal. Works for guests too, not just logged-in
    accounts (see that section for why the split matters).
  - **Notes** — the original feature: write a private note to any other
    player currently in the town. Notes aren't stored anywhere — they're
    relayed straight to the recipient's inbox and never touch a database.
    Reading a note destroys it permanently (it disappears from the
    recipient's inbox a few seconds after being opened, and the sender gets
    notified it was read), so a note can only ever be read once, by the one
    person it was sent to.
- Optional shared passcode to keep the town private to your friends.
- Optional accounts — see **Accounts & logging in as the same user** below.
  Everything else is still in-memory and accounts are opt-in: join as a
  Guest and nothing changes from before.
- 🏦 An in-game economy — bank accounts with a gold balance and 24 item
  slots, plus an auction house to buy/sell between players. Requires an
  account (see above); see **In-game economy: the Bank & Auction House**
  below.
- 🎒 A real personal inventory — 24 carried slots plus weapon/armor equip
  slots, separate from the bank. Works for guests too; see **Bank slots vs.
  your personal inventory** below.

Other than accounts, bank balances, auction listings, and logged-in
players' inventories, there's no database — chat history and the player
list reset whenever the server
restarts. The premium-unlock flag is likewise just a flag in that browser's
`localStorage` once a real payment is verified — not a real account system.

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

## In-game economy: the Bank & Auction House

🏦 The Bank is the 6th building (south of spawn, gold-trimmed roof). Walk in
and you'll find two NPCs standing behind the counter — walk up to either and
press F:

- **🏦 Bank Teller** — opens your bank account: a gold balance and a 24-slot
  item grid. First visit creates the account automatically (100 starting
  gold + 3 random items); every visit after that just shows its current
  state. Click any filled slot to bring up a form for listing that item at
  auction *or* withdrawing it to your personal inventory; a separate
  **Deposit from Inventory** box moves things the other way.
- **🔨 Auctioneer** — opens the Auction House: every active listing from
  every player, with a bid box (and a Buyout button, if the seller set a
  buyout price) on each one, plus a **+ List an item** button to put up
  something from your own bank slots.

### Bank slots vs. your personal inventory

The Bank's 24 slots and your personal carried inventory (🎒 Inventory button,
**Items** tab — see above) are two separate pools, on purpose: the bank is
the economy feature (account-gated, what auctions draw from), while your
inventory is what you actually carry and can equip from, available to
guests too. The Bank modal is the only place that moves items between
them — **Withdraw to Inventory** (bank → carried) and **Deposit from
Inventory** (carried → bank). Auctions only ever list from bank slots, so
something you want to sell needs to be deposited first if you withdrew or
equipped it.

Equipping works the same regardless of account vs. guest: click an eligible
item in your **Items** tab to equip it as a weapon or armor (whatever was
equipped before swaps back into your inventory automatically), or click the
equip slot itself to take it off. Other players see your equipped gear on
your character model too — it's synced, not just a local display.

**This needs an account** (see **Accounts & logging in as the same user**
above) — log in via the join screen's **Account** tab *before* entering the
world. Guests can walk into the Bank and talk to either NPC, but get a clear
explanation instead of an account: a guest identity is a fresh one every
visit, so there's nowhere for a balance to durably attach to. Logging in
mid-session doesn't retroactively grant one either — log in on the join
screen, then join.

How listings work:
- Pick an item + quantity from your bank slots, set a starting bid, an
  optional buyout price, and a duration of **1 hour, 12 hours, or 24
  hours**. The item leaves your slots the moment the listing goes up (so
  you can't also use or re-list it mid-auction) and either returns to you
  if nobody bids, or converts to gold once it sells.
- Bidding is escrowed: placing a bid deducts that amount from your balance
  immediately, so you can never bid more than you actually have. Getting
  outbid refunds you automatically. Hitting (or exceeding) the buyout price
  ends the auction immediately in your favor instead of waiting for the
  timer.
- A listing that expires with no bids just returns the item to the
  seller's slots, gold untouched.
- You'll see the result the next time you open your bank account even if
  you're offline when an auction you're part of resolves — the sweep that
  resolves expired listings runs on a timer regardless of who's connected,
  and writes straight to `bankAccounts.json`. If you happen to be online
  with the panel open, it updates live instead of waiting for you to reopen
  it.

Persistence works the same way `accounts.json` does, and has the same
caveat: `bankAccounts.json` (balances + items, keyed by username),
`listings.json` (active auctions), and `inventories.json` (logged-in
players' carried items + equipped gear, also keyed by username) are plain
gitignored JSON files on local disk, rewritten on every change. Fine on a
normal VM/box; **on a host with an ephemeral filesystem (Render's free
tier, etc.) none of them survive a redeploy** — only restarts of the same
running instance. A guest's personal inventory never touches disk at all —
it lives only on their in-memory connection and is gone the moment they
disconnect, same as the rest of a guest identity.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd town-chat
rm -rf node_modules   # remove the placeholder folder included in this delivery, if present
npm install
npm start
```

Then open **http://localhost:3000**.

- The passcode and Stripe payments below are both configured the same way:
  copy `.env.example` to `.env` and fill in whichever lines you need. Leave
  the rest blank and those features just stay off. (Twilio texting is
  different — it's set up per-player inside the game, not in `.env`; see
  **Texting (Twilio)** below.)
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

## Texting (Twilio)

The Arcade's **Text** tab sends a real SMS through [Twilio](https://www.twilio.com)
— but unlike Stripe, **this is not something the server operator configures
once for everyone.** Each player logs in with their *own* Twilio account
from inside the Text tab, and texts they send are sent (and billed) through
that account, not the operator's. There's nothing to set up in `.env` for
this one.

**For each player who wants to use it:**

1. Create a Twilio account and buy/activate a phone number capable of
   sending SMS (a trial account can usually text your own verified number
   for free — see the trial-account gotcha below).
2. From the Twilio Console, grab your **Account SID** (starts with `AC`)
   and **Auth Token**, plus the **phone number** you bought, in
   international format (e.g. `+15551234567`).
3. In the Arcade, open the chat panel's **Text** tab and fill in the login
   form: Account SID, Auth Token, and your Twilio number. Hit **Save
   Twilio Login**.
4. That's it — the form switches to a simple "phone number + message"
   sender from then on. Logging in is sticky (saved in your browser), so
   you only need to do this once per device/browser; there's a **log out**
   link if you want to clear it.
5. **Trial-account gotcha:** an unupgraded Twilio trial account can only
   send SMS to phone numbers you've manually verified in the Console (under
   **Phone Numbers → Manage → Verified Caller IDs**) — texting any other
   number fails even with correct credentials. Add the destination phone
   there first, or upgrade the Twilio account to remove that restriction.

**Where your credentials actually go:** typing them into the Text tab
saves them in that browser's `localStorage` only — they are never written
to this server's disk or any database. Every time you hit Send, your
browser sends them to this game's own server for that one request, which
relays a single message to Twilio using them and then discards them; they
aren't logged or kept around between requests. That's a real trust
boundary, though — this server's operator (or anyone with access to that
server while it's running) could in principle intercept a request in
transit. **For extra safety, use a Twilio API Key instead of your main
Auth Token:** in the Twilio Console under **Account → API keys & tokens →
Create API key**, then put the **API Key SID** (starts with `SK`) in the
Text tab's optional "API Key SID" field and the **API Key Secret** in the
Auth Token field. An API key can be revoked independently at any time
without resetting your whole account's credentials — your main Auth Token
can't be limited or revoked without regenerating it (which breaks
everything else using it too).

A couple of light server-side guardrails still apply regardless of whose
account is used: phone numbers must be in strict international (`+1...`)
format, messages are capped at 300 characters, and each visitor's IP is
limited to 3 send requests per 10 minutes (an in-memory counter — resets on
server restart). That's there to stop this server's `/api/send-sms`
endpoint from being usable as a high-volume, IP-hiding relay for *anyone's*
Twilio credentials (including stolen ones), not to protect anyone's
texting budget. None of it is real bot/abuse protection — there's no
CAPTCHA — so don't expose a deployed copy of this game publicly unless
you're comfortable with that.

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
  movement/chat are untouched by it. Also simulates the rabbits/mobs
  (server-authoritative, broadcast ~7x/sec) and owns the bank/auction
  economy *and* personal inventories/equip state entirely — balances, item
  slots, listings, and what's equipped are never trusted from the client,
  only ever read back from what the server already has. Equipped
  weapon/armor rides along on the same player-state broadcast as position,
  so other clients pick it up within one tick.
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
