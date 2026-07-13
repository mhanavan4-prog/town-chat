# Town Chat

A small 3D multiplayer town. Everyone walks around as a humanoid avatar in a
third-person view; each building is its own chatroom with a full-screen
medieval interior — walk through the door and the view switches entirely to
that building's inside, where you're chatting with whoever else is in there.
Walk back out through the door and you're back in the open-air town square.

- Move: W/S walk forward/backward in the direction you're facing, A/D (or
  left/right arrows) turn in place, Q/E strafe left/right, Space to jump —
  desktop. F interacts (sit, portals, NPCs, the Town Pass kiosk). On
  phones/tablets the whole control scheme is different and built for
  thumbs — see **Mobile: rebuilt for thumbs** below.
- Click and drag anywhere on the game view to look around, left/right and
  up/down — this only orbits the camera around your character, it doesn't
  change which way you're walking. The instant you move or turn, the
  camera's left/right orbit snaps back behind the character (pitch/looking
  up-and-down stays put) so "forward on screen" and "forward for the
  character" can't end up pointing two different ways.
- Chat only exists **inside buildings** — the open world has no chat at all.
- Speech bubbles pop up over a player's head when they send a message
  (desktop). On phones there's no chat log at all anymore — messages arrive
  as text-message-style banners at the top of the screen that fade away on
  their own; see **Mobile: rebuilt for thumbs** below.
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
- A large open town square (3200x2200) that actually looks lived-in now:
  grass, dirt paths, and a full scenery pass — 🏮 lampposts lining every
  lane (they come on with the dark, warm against the cool moonlight), a
  stone well, two striped market stalls and benches around the plaza, a
  fenced flower garden, hay bales, crates and barrels snugged against
  building walls, stumps and fallen logs in the meadows, and a much
  thicker spread of trees/shrubs/rocks/flowers through the midfield,
  edges, and corners (the new trees/shrubs/flowers are harvestable like
  the originals). Every placement is machine-validated to stay clear of
  walking lanes, doors, the spawn plaza, torches, portals, NPCs, and
  mob/animal spawns — `test/gen-scenery.cjs` is the generator+validator
  that emitted the list; rerun it after any town-layout change.
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
- 👹 Hostile mobs spawn outside (not inside) the buildings once night
  falls — and they **hunt you now**. Wander too close after dark and one
  will lock on, chase you down, and land real hits (gentler than the
  Wilds' horrors — the town square is the beginner hunting ground; you
  can always duck indoors, mobs never follow inside). They pay real XP
  and loot when killed, count for side quests, and the **first town-mob
  kill each night pays a +25 XP "Night's First Trophy" bonus** — showing
  up when the moon does is always worth something. Like the rabbits,
  server-simulated and synced so everyone sees the same mobs in the same
  places. See **Countermeasures** below for the two ways to slip a fight
  you're losing.
- 6 buildings, each with its own medieval interior theme: ☕ The Cafe
  (tavern), 📚 The Library (scriptorium), 🎮 Starlight Arcade (a starlit
  arcane hall), 👻 The Phantom Parlor (a ghost-green séance parlor — see
  below), 🏛️ Town Hall (great hall,
  the building straight ahead when you spawn), 🏦 The Bank (see **In-game
  economy** below). Four are free; the **Parlor and the Arcade are
  ticketed** — a 🎟️ **Town Pass** ($0.99 for 24 hours, one purchase opens
  both, real Stripe Checkout) gets you in. Chat, quests, the campaign,
  and the whole economy never sit behind the pass — only the two leisure
  venues do. See **The Town Pass (Stripe payments)** below.
- 👻 The Phantom Parlor is two stories, inside and out: a ground-floor
  séance parlor (5 tables — a cozy witchfire-side table plus 4 more in a
  dining grid, watched over by a haunted portrait gallery) with a
  staircase up to the open-air Widow's Watch terrace overlooking it, with
  3 more tables. Walking up/down the stairs is just walking normally — your
  character's height rises and falls to match as you cross the staircase.
- 🎮 The Starlight Arcade has two actual playable cabinets — rune-etched
  arcane machines running 🐍 Snake and 🧱 Breakout.
  Walk up to one and press F to play (arrow keys to control, Space to retry
  after a game over, Esc to step away). Fully playable by touch too: swipe
  across the board to steer the snake (chained swipes work without lifting
  your thumb), slide your thumb to put the Breakout paddle right under it,
  and tap the board to retry after a game over. (Snake also refuses 180°
  reversals now on every input — running back through your own neck was an
  instant unfair death.) Each is a small self-contained client-side
  mini-game — no server involvement, no shared/competitive state, just
  something to do while you're in there chatting.
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
- 💾 **Hard Drive media & countermeasures** — save selfies and 3-second
  voice clips on your Hard Drive, then USE them: play a clip mid-fight (V)
  to evade — everyone nearby literally hears it — or wear a saved selfie
  as a disguise and pass as that person to players and shopkeepers alike.
  Take someone's picture with P. See **Countermeasures** below.
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
  buyout price) on each one, plus a **+ List an item** button whose picker
  offers both pools — 🎒 what you're carrying and 🏦 what's in your bank
  slots — so selling loot you just found needs no deposit round-trip.

### Bank slots vs. your personal inventory

The Bank's 24 slots and your personal carried inventory (🎒 Inventory button,
**Items** tab — see above) are two separate pools, on purpose: the bank is
the economy feature (account-gated, what auctions draw from), while your
inventory is what you actually carry and can equip from, available to
guests too. The Bank modal is the only place that moves items between
them — **Withdraw to Inventory** (bank → carried) and **Deposit from
Inventory** (carried → bank). Auctions can list from either pool: the
Auction House picker groups your 🎒 pack and 🏦 vault separately, escrows
the item out of whichever one you picked, and returns it to that same
pool if nobody bids (falling back to the vault if your pack has filled
up in the meantime). One caveat: an *equipped* item is in neither pool —
unequip it to your pack first and it shows up in the picker.

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
- Pick an item + quantity from your pack or your bank slots, set a
  starting bid, an optional buyout price, and a duration of **1 hour, 12
  hours, or 24 hours**. The item leaves that pool the moment the listing
  goes up (so you can't also use or re-list it mid-auction) and either
  returns to it if nobody bids, or converts to gold once it sells.
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

## The Wilds, repopulated

The 10000x10000 Wilds got its own density pass — it's a place to travel
through now, not an empty field with landmarks in it:

- 🌿 **9 of every plant** (225 harvestables, up from 5 each) — forage is
  the map's core loop, so it's everywhere now, still on the same 24h
  per-player regrow.
- 🐇 **36 friendly animals** (up from 24) to hunt, same server-synced
  behavior. Hostile mob count is deliberately unchanged — danger stays
  scarce, forage doesn't.
- 🔥 **Five always-lit campfires** spaced along the natural routes (the
  spawn road, the village↔circle meadow, the camp's edge, the cave
  approach, the far north). Stand in the glow and wounds mend at 20 HP/s —
  the Wilds' answer to the town's ritual-torch sanctuary, and the reason
  a hunting trip no longer ends with limping home at 12 HP.
- ⛰️ **Five weathered waymarkers** — standing stones with faintly glowing
  runes, each carrying a piece of Thornreach lore (the Severance, the
  Hollow, the two factions, the Keeper, the Ember road). Walk up and the
  pill reads "read the waymarker"; they double as navigation landmarks.
- 💀 More atmosphere everywhere: 150 twisted trees (was 90), two more
  graveyards, two more ruin clusters, and bone piles where the dead
  congregate.
- 🕯️ The **Witch's Cave is an actual rock formation** now — a mound of
  huge mossy boulders shouldering each other around a dark maw with
  purple candlelight seeping out, gnarled trees leaning over it — visible
  from a distance instead of a floating box with a sign.

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

**Pacing — a campaign is a journey now, not a sprint.** Each chapter has a
minimum level before its "Begin Chapter" button unlocks — 1, 2, 3, 4, 6,
and 8 across the six chapters — enforced server-side and shown right on the
button ("Opens at Level 8 — you're Level 5"). Reaching the Level-8 finale
means roughly **two-plus hours of actual play** even for someone rushing:
campaign chapters and all 18 side quests together don't pay enough XP to
get there, so the road between chapters runs through night hunts, dungeons,
and harvests by design. The gates are levels, never timers — you're always
one more hunt away, never told to go wait. The design leans on a few
well-worn psychology levers, on purpose: the Journal draws the whole
six-chapter arc with your position pinned on it (a visibly shrinking
distance — the goal-gradient effect), progress bars glow as they pass 75%
and progress toasts switch to "ONE more to go!" near the finish, every
chapter completion names your NEXT goal at the moment of triumph (an open
loop, per Zeigarnik — a gate reads as a target, not a wall), campaign
finales ring a town-wide announcement bell (public recognition, and free
advertising that the campaigns exist), the nightly first-kill trophy gives
every session a fresh-start hook, and chapter completions and level-ups
get a short center-screen ceremony (the peak-end rule: end beats loud).
Story and quest beats also write themselves into the chat log as system
lines now, so a missed toast is never lost information — and every
objective carries a 🧭 **where** hint (in the tracker, the Journal, and
the toast) so "what do I do next" always has a concrete answer.

**Side quests, wave two:** beyond the four town quest-givers and the two
Wilds factions, every building NPC now has one repeatable quest of their
own — Barkeep Joss, Scholar Elior, Apothecary Vex, Tailor Ines, Armorer
Beck, Old Mabel, Apprentice Wren, Tinkerer Oswin, Lady Corwin, Sir Dorran,
and Guard Petra (the hint NPCs got a "💬 Ask for a Quest" button in their
dialogue). Same rules as before: one active side quest at a time, 24h
cooldown per quest after completion.

## Countermeasures: the Hard Drive's selfies & voice clips

The 💽 Hard Drive (awarded at your first level-up) isn't just a note vault
anymore — it has two media shelves, and both are **combat tools**. Open it
from the 💾 **Drive** button (or Inventory → Hard Drive tab):

- 📸 **Selfies** (up to 8). Two ways to get one: take one with your own
  camera (you click the button, your browser asks permission, one frame is
  captured — same consent-first pattern as Hazel's shop and the 3rd Eye),
  or press **"📸 Save face to Drive"** on any picture note someone sent
  you — a shared photo, a 3rd-Eye vision, a snapshot. Each selfie is
  tagged with whose face it shows.
- 🎙️ **Voice clips** (up to 6, ~3 seconds each). Record with your own mic,
  name them ("BOO!", "my evil laugh"), and pick one to **arm for the V
  key**.

What they do:

- 📢 **Voice-clip evasion (V).** Only works while something is actually
  attacking you (a hit in the last ~6 seconds). Fire it and your clip
  **actually plays out loud to every player in earshot** — proximity, not
  room-wide, with visible sound-rings at your position — while you slip
  attacks for ~4 seconds: mobs lose your scent entirely and everything in
  earshot is routed (they scatter like rabbits for ~8s), and PvP swings
  whiff with a message telling your attacker exactly what happened ("…
  their echo still hangs in the air!"). 45-second cooldown, and you need
  the 💽 item on you. A genuine escape button, not an immortality toggle.
- 🎭 **Selfie disguise.** Wear any saved selfie as a mask and you *are*
  that person to the town: your face renders as that photo (a circular
  paper-mask look — charming, and clearly a mask up close), your nameplate
  shows their name, **📷 snapshots of you capture them instead of you**,
  and gear-selling NPCs greet the face they see — including honoring that
  person's **regulars discount** (15% off at any shopkeeper whose side
  quest they've completed; finish a quest yourself and you're a regular
  there too, no mask needed). Guests and made-up faces earn nothing — a
  discount needs a durable identity behind the face. Your mask slips when
  you die, and NPCs address you normally again once it's off.
- 📷 **Snapshots (P).** Point your camera at the nearest player (within
  hugging distance) and press P — a photo card of *what they look like*
  lands in your notes: their disguise if masked, or a drawn portrait of
  their avatar if not (never a real photo nobody shared). The subject
  always hears the shutter click — paranoia is half the fun, and it means
  masks actually get tested. 15-second cooldown per photographer.

Privacy, spelled out: nothing here ever captures anyone's camera or mic
but your own, always behind an explicit button press plus the browser's
own permission prompt. Other people's faces only enter your drive through
pictures they deliberately sent into the game, and a snapshot of an
unmasked player is a cartoon of their avatar, not a photo of them.
Broadcasting a voice clip is always the owner's own trigger pull. Media
lives in the same vault as your notes (`hardDrives.json` for accounts,
in-memory for guests) with the same password protection if you set one.

## Mobile: rebuilt for thumbs

The touch layout was rebuilt from scratch around the two-thumb grip every
modern mobile game uses (movement under one thumb, camera and actions
under the other), fixing a pile of real problems: the old fixed joystick
sat at the bottom-RIGHT exactly where the ability bar and the door/portal
banner also rendered (buttons were literally underneath the movement
ring), the top of the screen stacked five different menus, and every
name banner in sight rendered permanently.

- **Floating joystick, left half.** Touch anywhere in the lower-left and
  the stick appears under your thumb; lift and it ghosts back to a resting
  hint. Movement is **camera-relative** now (point the stick where you
  want to go; your character turns and runs that way, camera easing in
  behind) instead of the old tank controls.
- **Camera on the right thumb.** Drag anywhere else on the screen to orbit
  and pitch the camera — touch never had drag-to-look before, at all.
- **Action wheel, bottom-right.** A big ⚔️ attack-nearest button in the
  corner, 🦘 jump and 😀 emotes along the bottom, your class's first three
  abilities arced up the side (with their cooldown sweeps), ✨/📖 opening
  the full kit, and 📢 appearing only when a voice-clip countermeasure is
  actually possible. The 12-slot keyboard hotbar is desktop-only now.
- **The door/portal button can't be buried anymore.** "Tap to enter …" is
  a large glowing pill pinned ABOVE the action wheel, clear of everything,
  and pulses so it's never missed.
- **One ☰ menu instead of five.** The top bar is just a compact vitals
  pill (❤️ health · level · ☀️/🌕) and a menu button; Inventory, Journal,
  abilities, Hard Drive, Town Pass, snapshots, music and Leave-building
  live in a bottom sheet with big touch rows.
- **Chat is text-message banners now, not a log.** Phones don't get the
  scrolling chat panel at all: each message in your room pops in under
  the top bar like an incoming text (sender name in their color, photo
  thumbnails tappable to zoom) and quietly fades out after ~9 seconds —
  at most four ride the stack, so the screen stays tidy on its own.
  Story/quest system lines that would only have landed in the log get a
  banner too (never duplicating a toast that just said the same thing).
  The 💬 button (indoors, where chat exists) opens a slim compose bar —
  input, 📷 attach, and a ➤ send button — that rides above the software
  keyboard; there's no unread badge anymore because there's nothing to
  catch up on. In the Arcade the compose bar still carries the Chat|Text
  tabs, so Twilio texting works from a phone unchanged.
- **Panels all close by thumb.** The inventory has a real ✕ now (it was
  literally unclosable on a phone before), and an armed targeted spell
  can be canceled by tapping its 🎯 banner — the copy tells you so,
  instead of telling you to press an Esc key you don't have.
- **Name banners behave.** Your own is hidden; others' appear only within
  conversational range (fading with distance), when someone speaks (6s),
  or when you tap a player — and NPC signs show only when you're near
  enough for them to matter. Tap-to-reveal honors disguises, naturally.
- Safe-area insets (notches), ≥50px touch targets throughout, and
  `prefers-reduced-motion` is respected by every effect below.

## Game feel & social play

The juice pass (tuned with a phone in hand, but live on desktop too):

- **Floating damage numbers** over every landed hit in the room — white
  for hits, gold for kills, red for damage you take (server-broadcast
  `hit_fx`, so bystanders see your fights land too).
- **Screen shake + haptics**, small and proportional: a brief shake with
  a tenth-of-a-degree of rotation when you're struck, a tick of vibration
  on hits, kills, and level-ups (phones only, and never when the OS asks
  for reduced motion).
- **🔥 Hunt streaks** — chain creature kills within 8 seconds and a
  growing streak counter appears; ×5 and ×10 pay bonus XP and ×10 rings
  the town bell. Every hostile pool counts (town, Wilds, dungeons, the
  Wastes); PvP deliberately doesn't.
- **😀 Emote wheel** — eight quick emotes (👋 😂 ❤️ 😮 😢 😡 👍 💃) on the
  action wheel (mobile) or the T key (desktop), floating above your head
  for everyone in the room. Works OUTDOORS, where chat doesn't exist —
  which is exactly where you pass people.

Headless UI testing: `test/mobile-shots.cjs` boots the real client with
`test/three-stub.js` standing in for three.js (Playwright route
interception) and screenshots the phone layouts; the `?testdrive=1` query
param exposes a tiny harness-only hook for teleporting around. Neither
affects normal play. The QA sweep grew with the mobile work:

- `test/qa-deep-mobile.cjs` — a full scripted evening on a phone (join,
  camera-relative movement, every door incl. locked ones, chat banners +
  compose, night combat vs hunting mobs, the Wilds round-trip with a
  harvest and item use, spellbook + touch targeting, emotes, bank-as-guest,
  campaign start, PvP death → respawn, scenery/lamppost checks, and an
  orientation flip). Wants the night server: `node test/night-server.cjs`
  boots the real server with the shared clock shifted to just-after-dusk
  and prints the offset the harness reads automatically.
- `test/qa-pass-flow.cjs` — the whole Town Pass loop against
  `test/stripe-mock-server.cjs` (a real server boot with a mocked `stripe`
  module where every checkout instantly pays): buy → redirect → verify →
  receipt → both ticketed doors open → cabinets playable by touch
  (pixel-verified paddle) → Text tab reachable → replay-proofing — plus
  the three seamless-return scenarios (paid resume from inside the Cafe
  mid-quest, canceled resume, dead-token fallback to the join screen).
- `test/qa-account-bank.cjs` — registers an account through the join
  screen UI, opens the teller and auctioneer, and checks the economy
  modals actually fit a 390px phone.
- `test/gen-scenery.cjs` — the town-scenery generator/validator (see the
  town-square bullet up top).

One playtest discovery worth knowing as the designer: the four ritual
torches around the spawn hub heal 25 HP/s within their light at night —
which out-heals strike damage entirely. That makes the lit plaza a
genuine night sanctuary (mobs and PvP both can't finish anyone standing
in the glow). It reads as intentional — the town bell of "safety in the
torchlight" — so it was left exactly as is; just know the hub is a
no-kill zone after dark while the torches burn.

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

## The Town Pass (Stripe payments)

Four buildings are free for everyone, always: the Cafe, the Library, Town
Hall, and the Bank — everything a player *needs* (chat, quests, story
chapters, the whole economy) lives in free territory. The two leisure
venues — the 👻 **Phantom Parlor** and the 🎮 **Starlight Arcade** — are ticketed:
their doors bounce you back outside until you hold a 🎟️ **Town Pass**.

One pass, **$0.99, opens BOTH buildings for 24 hours** (price and duration
configurable — `TOWN_PASS_PRICE_CENTS` / `TOWN_PASS_HOURS` in `.env`). Buy
it from the HUD bar, from a locked door's prompt, or in-world at the 🗿
Town Pass statue inside the Cafe (walk up, press F). What the pass gates is
deliberately *bonus* content — the Arcade's cabinets and Text tab, the
Parlor's Widow's Watch terrace — plus exactly three optional NPCs (Lady Corwin, Apprentice
Wren, Tinkerer Oswin) whose side quests are extra, never required. No story
campaign ever needs a pass.

This is wired to **real Stripe Checkout**, not a placeholder:

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

   > ⚠️ **The #1 gotcha:** a `.env` file only works on the machine it sits
   > on — it's gitignored and **never deploys with a push**. If passes work
   > on your own computer but the hosted game's statue shows a dimmed
   > "🚫 Passes not on sale here" button, the host is missing
   > `STRIPE_SECRET_KEY` in its Environment settings. Add it there and
   > redeploy/restart the service.
4. If `STRIPE_SECRET_KEY` is left unset, the two ticketed buildings simply
   stay locked (the game says pass sales aren't set up) — the rest of the
   town works exactly as before.
5. When you're ready for real money, repeat step 2 with your **Live mode**
   secret key (`sk_live_...`). Test thoroughly with a test key first —
   Stripe's test and live modes are completely separate, so nothing you do
   in test mode risks a real charge.

How enforcement and persistence actually work now:

- **The server is the gate.** `/api/checkout` creates a real Stripe
  Checkout Session; `/api/verify-session` confirms with Stripe that the
  session was paid before granting anything; and the `move` handler
  refuses to let a passless connection set foot in a locked room — a
  crafted client can't walk through a locked door, because the check isn't
  in the client anymore.
- **Replay-proof.** A Checkout session grants exactly one 24-hour window,
  computed from the payment time. Refreshing the success page or
  re-presenting an old receipt never stacks extra hours.
- **Guests:** your browser keeps the Checkout session id in `localStorage`
  as a receipt and presents it when you join. Even if the server restarted
  and forgot everything, it re-verifies that id against Stripe itself —
  Stripe is the durable record, so a guest's day pass survives server
  restarts without this project needing a database.
- **Logged-in accounts:** the pass also attaches to your account
  (`townPasses.json`, same persistence model and ephemeral-filesystem
  caveat as every other JSON store here), so it follows you across
  browsers and devices for its 24 hours.
- Buildings you're already inside never eject you when a pass expires —
  expiry is checked at the door, not mid-conversation.
- **Buying never costs you your session anymore.** Stripe Checkout is a
  full-page redirect, and a guest's whole life (XP, inventory, quest
  progress, position) used to die with the page — you came back to the
  character-select screen as a stranger. Now the client grabs a one-time
  resume token right before redirecting (the server snapshots your exact
  player), and when Stripe bounces you back — **paid or canceled** — you're
  auto-rejoined as the same character in the same spot, mid-quest tracker
  and all, with the pass already applied. Tokens are random, single-use,
  15-minute, and bound to the same account/guest identity; a dead token
  falls back to the join screen with your name prefilled rather than ever
  silently making you a fresh guest.

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

**Two known limitations of this delivery:** (1) the live Stripe
checkout/redirect flow can't be end-to-end tested in the sandbox this was
built in (no outbound access to Stripe's API) — the complete loop IS
exercised against a mocked Stripe (`node test/stripe-mock-server.cjs` +
`node test/qa-pass-flow.cjs`, all green), so the game-side wiring is
verified; still, run one real test-mode purchase (sk_test key + card
4242 4242 4242 4242) before going live. (2) three.js loads from the cdnjs
CDN, and the local fallback `public/three.min.js` that index.html would
reach for if the CDN is unreachable is NOT bundled — if you want the game
to survive a CDN outage, download three.js r128's `build/three.min.js`
once and drop it into `public/`.

Want changes — different buildings, bigger map, persistent chat history,
login accounts, a different price or free building? Just ask and I can
extend it.
