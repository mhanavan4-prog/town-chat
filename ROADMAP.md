# Thornreach — Roadmap & Open Threads

A living list of gaps, loose threads, and bets worth making. Not a spec — a
place to park ideas so they don't live only in chat. Reprioritize freely.

Last reviewed: 2026-10-21.

---

## Recently shipped (context)

- **All five building interiors reskinned with KayKit furniture** — the
  Cauldron Café, the Coven Court (Town Hall), the Midnight Archive (Library),
  the Starlight Arcade, and the Phantom Parlor. Each keeps its witchy
  centrepiece (séance circles, pentacles, rune rings, relic displays, star
  charts) and both NPCs; furniture streams post-spawn with procedural fallback.
- **Café systems polish** — Champions' Table reserved for the reigning coven
  (with a baked-in sign), Barkeep Joss repositioned, seat facing fixed.
- **Rendering fix** — KayKit static props no longer frustum-cull/vanish by
  camera angle (`staticInstance` now disables `frustumCulled`).
- **Covens marketing page** — added a Séance Board section that sets clear
  "it's AI but not a chatbot" guardrails.

---

## Now — concrete fixes (small, verifiable)

### 1. The NPC "where to find them" directory is stale
`NPC_LOCATIONS`-style hints in `server.js` (~line 4097) have drifted from where
NPCs actually stand (set per room in `client/furniture.js`). Confirmed:
- `npc_apothecary` (Apothecary Vex) → listed in **the Café**, actually in **the
  Arcade**.
- `npc_apprentice` (Apprentice Wren) → listed in **the Arcade**, actually in
  **the Library**.
- `npc_tailor` → listed in **Town Hall**, but no matching NPC is placed there
  (Town Hall has Armorer Beck + Sir Dorran).

Action: audit every directory entry against the actual `kiosksOut.push({ npcId })`
placements and reconcile. Low effort, directly misleads players.

### 2. NPCs with a nameplate but no job
Some NPCs have a name + spot but no shop/interaction of substance (e.g.
**Tinkerer Oswin** in the Arcade and **Old Mabel** have no `NPC_SHOPS` items).
Either give each a real function (shop, repair, rumor/quest hook, mini-service)
or accept them as flavor — but a player who walks up expecting something and
gets nothing is a small letdown repeated across the town.

### 3. "Widow's Watch" — a named landmark with no feature
The upstairs terrace was removed; the name survives as a wall sign in the
Parlor. Either give it a small purpose again (a view, a nightly event, a lore
node) or lean into it as deliberate lore so it doesn't read as a dangling
reference.

---

## Next — bigger bets (retention / growth)

### 4. Liveness when the town is near-empty  ⭐ highest leverage
Analytics show very low concurrency ("1 in town"). A beautiful empty room still
feels empty, and this is the real growth blocker — a *feature* gap, not a
marketing one. Candidate builds:
- **Async presence**: ghosts/footprints/echoes of players who were here
  recently, so a near-empty town feels inhabited.
- **Ambient NPC life**: NPCs that move, chatter, react — rooms that feel lived-in.
- **"While you were away" feed**: what happened in town/your coven since last
  login, surfaced on return.

### 5. The solo → coven on-ramp
Much of the best content is **coven-gated**: the AI séance board, the Manor, the
private world, the weekly Rites. A new solo player can bounce before seeing any
of it. Consider a solo-playable *taste* (a single séance question, a trial Rite
step) so the coven pitch lands after the player has felt the magic, not before.

### 6. A reason to *return* to each room
The interiors look great now but several lean on one NPC/feature (esp. Library,
Parlor). Add a daily/rotating hook per room — a rotating "forbidden book" in the
Library, a nightly séance event in the Parlor, an arcade high-score board,
café daily special — to turn pretty rooms into habits.

### 7. A vanity / cosmetic sink
There's gold + gems and consumable shops, but little to *show off*. Cosmetics —
outfits, titles, coven-Manor decor, a personal home — are usually the strongest
retention + monetization lever in a social game, and they pair perfectly with
the KayKit art library now in place (the furniture set is already a head start
on house/manor decor).

### 8. Turn decorative systems into real ones
The "relics under glass" (Arcade, Parlor) are named with real care but do
nothing. A lightweight **collection / lore codex** (inspect a relic → unlock a
card) would turn exploration into a reason, and reuse art already shipped.

---

## Meta — let the data pick the holes

The Watch dashboard already tracks traffic, a security/event log, and player
counts. The highest-value gaps are the ones the data knows and a code review
can't see:
- Where do new players drop off? (We already caught one onboarding bounce — a
  guest firing out-of-range strikes and leaving at ~36s — and added the
  "move closer" nudge.)
- Which rooms get zero visits? Which NPCs are never interacted with?
- What's the Day-1 / Day-7 return curve, and what did returners do differently?

Action: a dedicated analytics pass to rank the above, and let it reprioritize
this list rather than intuition.

---

## Parking lot (unsorted)

- Mobile combat/controls feel — a lot of casual traffic is likely phone; verify
  the strike/ability loop feels good on touch.
- Economy audit — are there enough gold/gem sinks for engaged players, or does
  currency pile up with nothing to buy?
- Progression ceiling — what does a maxed player chase after the weekly
  crown loop?
