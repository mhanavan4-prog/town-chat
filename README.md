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
- 🧙 Every one of the 5 characters is a real **class** now, each with its
  own 12+ ability battle kit — attacks, defenses, healing, and
  intelligence-gathering: the **Witch** (📖 Spellbook, 12 spells), the
  **Werewolf** (🐺 Wolf Attacks), the **Mystic** (🕯️ Mystic Rites), the
  **Knight** (⚔️ Knightly Arts), and the **Wanderer** (🥾 Wanderer
  Skills). See **The Witch's Spellbook** and **The Other Four Classes**
  below.
- 📜 Every class also has its own six-chapter spooky **story campaign** —
  a Journal button (or the J key) tracks your chapters, objectives, and
  rewards, ending in a class-themed relic — plus a town full of side
  quests: every shopkeeper and building local has work for you now. See
  **Story campaigns & the Journal** below.
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
  from each browser's own clock, not tracked by the server — every
  connected client lands on the same phase just by agreeing what time it
  is, with no network traffic and no state that resets if the server
  restarts.
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
    Opening a note just reveals it; it sticks around after that until the
    recipient clicks the 🔥 **Destroy this note** button underneath it,
    which deletes it from their inbox and tells the sender it's gone. So a
    note can only ever be read by the one person it was sent to, but
    they're the one who decides when it actually disappears, not a timer.
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

## The Witch's Spellbook

Pick the **Witch** on the join screen (witch hat, green robe — character
slot 0) and you get a 📖 **Spellbook** button next to 🎒 Inventory, with 12
starting spells. Other characters never see this button at all — casting is
validated server-side too, so it's not just a hidden client button standing
between anyone and a spell. Open the book, click a spell to see what it
does, pick a target if it needs one, and Cast. Each spell has its own
independent 8-second cooldown — casting Fireball doesn't stop you from
also casting Toad's Tongue a second later — shown as a sweeping wedge
right over that spell's own hotbar icon.

The book is a proper battle kit now — combat, defense, healing, and
intelligence gathering, all of it witchy to the bone. Statuses still follow
the one-at-a-time rule: only one curse/blessing can ride a given player, so
a new one simply replaces whatever was there.

**Combat:**

- 🔥 **Fireball** — the classic. A glowing ball of witchfire actually flies
  from the Witch to the target (everyone in the room sees it) and bursts on
  impact for real damage — players, animals, and mobs alike, same
  death/respawn/loot/XP flow as melee Strike.
- 🥀 **Withering Hex** — rots a player's vitality, draining 3 health per
  second for ten seconds. It can carry them to death's door (1 HP) but
  never through it — only a real blow can finish what the withering
  starts. The target is told, plainly, that they're under attack.
- 🩸 **Leech Hex** — phantom fangs drain 12–20 health from the target (players
  and mobs alike) and a crimson orb of stolen life flies back into the
  Witch, healing her for everything it took. Combat and healing in one bite.
- 👹 **Monstrous Form** — swell into a hulking horror for 15 seconds: your
  Strikes and damage spells hit half again as hard while it lasts.

**Defense:**

- 🎃 **Gourd Ward** — hollow your skull into a grinning ward-gourd; while it
  lasts, ALL damage against you — mob or player — is halved.
- 🪽 **Raven's Cloak** — dissolve into black feathers and move at twice your
  pace for 12 seconds. The Witch's escape (or pursuit) tool.

**Healing:**

- 🦴 **Bone-Knit Blessing** — the old words knit your wounds closed, healing
  steadily over twelve seconds (the same regeneration the Regen Root potion
  grants).

**Intelligence gathering:**

- 🔮 **Scrying Orb** — peer at one chosen soul: their whereabouts, their
  wounds, their level, and whatever curse currently rides them, plus a
  brief glowing highlight on their name tag.
- 🦇 **Nightwing Augury** — loose your bats across the whole realm; they
  return whispering every player's location and health in one report, and
  circle you visibly while the augury lasts.

Both intel spells only gather what every client is already sent by the
normal player-list sync (position, health, level, active status are all in
the public snapshot) — they reveal nothing that wasn't already shared, just
read it out in one legible witchy report.

**Curses & tricks** (the classics that remain):

- 🐸 **Toad's Tongue** — the target starts croaking mid-sentence in chat.
- 🦶 **Stumble Hex** — the ground-sigil trap: click a spot and a witchy
  pentacle glows there for 25 seconds; anyone who steps inside is hexed
  with halved walking speed. No target needed — lay it and walk away.

Movement/speed effects are self-enforced on the affected player's own
client, same trust model as the rest of this game's movement (there's no
anti-cheat here, full stop). Toad's Tongue rewrites the message text once,
at the moment it's sent — a message already sent stays cursed even after
the curse itself wears off.

👁️ **Open 3rd Eye** is the one spell that works differently on purpose. The
obvious version of "peer through someone's eyes" is a covert camera
trigger — cast it, their device silently takes a photo, it gets shipped off
to you. That's not what this does, because silently activating someone
else's camera and exfiltrating the photo without their knowledge is a
spyware pattern no matter how playful the framing is — and a one-time
disclosure buried in a join screen or a Terms-of-Service-style click-through
doesn't fix that either, since the target still has no say over the
specific moment their camera actually turns on. Instead: casting it sends
the **target** a themed on-screen prompt ("The Witch's Eye Turns Toward
You") naming the caster and saying exactly what allowing it does in plain
language ("your camera will capture one photo of you right now and send it
to them as a vision"). Nothing happens until the target clicks **👁️ Let it
open** — only then does their browser even ask for camera permission, snap
one frame, and deliver it to the caster as an image note. Clicking **🚫 Shut
it out** (or just not responding) sends nothing and never touches the
camera; the caster just sees a "spell fizzled" message either way. Same
payoff for the Witch, but the target is always the one deciding, in that
specific moment, whether their own camera turns on.

## The Other Four Classes

The Witch's Spellbook set the pattern; now every character has its own full
kit. Each non-Witch class gets an **Attacks** panel button (and the same
1–= hotbar with per-ability 8-second cooldowns), validated server-side by
`charId` exactly like the Witch's spells — a Mystic can't cast Knightly
Arts by poking the socket, and vice versa. Every kit covers the same four
jobs, in its own voice:

- **Real damage.** Each class has at least one ranged damage ability that
  hits players, animals, and mobs — same death/respawn/loot/XP funnel as
  melee Strike and Fireball, each with its own tinted projectile:
  🦷 **Savage Bite** (Werewolf), 👻 **Spirit Lash** + 💜 **Soul Siphon**
  (Mystic — Soul Siphon drains the target and heals the caster, like the
  Witch's Leech Hex), ⚔️ **Smite** (Knight — the hardest single hit in the
  game), 🔪 **Knife Throw** (Wanderer).
- **A ward.** Every class can halve ALL incoming damage for 30 seconds:
  Iron Pelt, Ethereal Veil, Oath of Iron, Packmule's Guard. The Mystic and
  Knight can also ward **another player** (Spirit Ward, Guardian's
  Pledge). Wards render as a faint glowing dome — the Witch's Gourd Ward
  pumpkin-head is the same effect in witchier packaging.
- **Healing.** Every class self-heals (Moonlit Mending, Séance of Mending,
  Field Dressing, Trail Remedy — the same regen the Bone-Knit Blessing
  grants), and the Mystic and Knight can heal **other players** directly
  (Mending Spirits, Lay on Hands — instant, 22–40 health).
- **Intelligence gathering.** Single-target reveals (Whispered Secret,
  Sentinel's Watch, Compass Trick, Scrying Orb) and whole-realm sweeps
  (Spirit Walk, Herald's Muster, Nightwing Augury) that read out every
  player's whereabouts and wounds — all data the public player-list sync
  already shares, gathered into one report. The Werewolf's Scent Trail and
  Wanderer's Spy Glass keep their special consent/announcement rules
  (see their descriptions in-game).

Plus each class's own tricks carried over: the Werewolf's note-stealing
Rapid Swipe and AoE howls, the Wanderer's pickpocketing and Spy Glass, the
Mystic's Banshee Wail, the Knight's Shield Bash stagger and Banner of
Dread. Werewolf and Wanderer kits grew to 15 abilities — the hotbar shows
the first 12, the Attacks panel lists everything.

## Story campaigns & the Journal

Every class has a six-chapter story campaign, told through in-world
letters and set in the same Thornreach lore as the Wilds factions — the
Hollow, the shattered Fifth Severance, and Witch Hazel keeping her
five-century watch under the Wilds:

- 🖐️ **Witch — The Fifth Hand.** The Old Circle had five ritualists. Four
  graves are accounted for.
- 🌕 **Werewolf — The First Bite.** Every curse has a first link in its
  chain. Yours is still alive.
- 🕯️ **Mystic — Voices Beneath the Floorboards.** The town's dead have
  started leaving reviews. One of the voices isn't dead.
- ⚔️ **Knight — The Hollow Oath.** Your order swore an oath five centuries
  ago. They lied about what it was.
- 🛣️ **Wanderer — The Road That Isn't on the Map.** Every map of
  Thornreach has the same smudge. It moves.

How it plays:

- 📜 **Journal** (button or J key) shows your storyline, the current
  chapter's letter, its objective, and rewards. Chapters are begun
  explicitly from the Journal; a small story tracker (under the quest
  tracker) follows your progress once one is live.
- Objectives use the world you already play in: talk to a named NPC, gather
  in the Wilds, set foot somewhere ominous, drill your class abilities,
  cut down the Hollow's creatures, brew at Hazel's cauldron. Story
  progress runs **in parallel** with your active side quest — the same
  kill can tick both.
- Chapters pay XP and gold, and every finale grants a class relic
  (Shadow Staff, Alpha Fang, Shadow Cloak, Dread Helm, Soul Treads).
- Progress persists per account **per class** (`playerProgress.json`) —
  playing the Knight campaign doesn't touch your Witch campaign. Guests
  get the usual guest deal: progress lasts until they disconnect.

**Side quests, wave two:** beyond the four town quest-givers and the two
Wilds factions, every building NPC now has one repeatable quest of their
own — Barkeep Joss, Scholar Elior, Apothecary Vex, Tailor Ines, Armorer
Beck, Old Mabel, Apprentice Wren, Tinkerer Oswin, Lady Corwin, Sir Dorran,
and Guard Petra (the hint NPCs got a "💬 Ask for a Quest" button in their
dialogue). Same rules as before: one active side quest at a time, 24h
cooldown per quest after completion.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
cd town-chat
rm -rf node_modules   # remove the placeholder folder included in this delivery, if present
npm install
npm start
```

Then open **http://localhost:3000**.

Run the tests with `npm test` — they drive the real server's connection
handler with mock sockets (join/chat/collision, passcode, every class's
ability kit, and a full six-chapter campaign end-to-end). There's also an
optional headless-browser smoke test (`node test/smoke.browser.mjs`) that
needs Playwright installed.

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
