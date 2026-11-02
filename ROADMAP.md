# Thornreach — Roadmap & Open Threads

A living list of gaps, loose threads, and bets worth making. Not a spec — a
place to park ideas so they don't live only in chat. Reprioritize freely.

Last reviewed: 2026-11-02.

> **State of play:** the **entire** Oct-22 numbered list has shipped — #1–#8, with
> #2 softened to "ongoing habit." Even #4, the "while you were away" feed, exists
> (the Session L **welcome letter**). Since the last review, three large systems
> that weren't on the list at all also landed: the **Green Path** (gardening), the
> **Hearth Path** (kitchen witchery), and **player housing**. The old list is
> cleared; the live questions are in **"new bets worth taking now"** at the bottom.

---

## Recently shipped (context)

### Big systems since the last review

- **Player housing** (PRs #688–#696) — every account owns an instanced **cottage**:
  furnish it on an 8×8 grid (persistence + placement, server-authoritative),
  **step inside** a cozy 3D room that renders your layout, unlock finer decor from
  a Moonstone **decor shop** (cosmetic only), and let **covenmates visit** (a
  browse list) or **invite anyone online** (a direct invite). Collision, wall-snap
  and sizing all playtested. Surfaced on the landing page + FAQ (#696). _This is
  roadmap #7 — the vanity/cosmetic sink — fully realized._
- **The Hearth Path** — kitchen witchery expansion (PRs #697–#702) — the parallel
  to the Green Path. 24 teas organised by the **seven planetary days**, brewed
  from the real herbs you grow; **greater** two-herb draughts + the **Witches'
  Brew** capstone (gated by the collection); **sabbat teas** that turn with the
  Wheel of the Year; hand-drawn **tea icons** (no emoji); a seven-chapter
  **questline** voiced by Old Mabel that earns the Hearthfire aura; and Old
  Mabel's progress-aware greeting in the kitchen panel.
- **The Green Path** — gardening expansion (PRs around the Green Path batch) —
  a nine-chapter real-witchcraft gardening questline (Cottage Garden → Hedge &
  Wild → Poison Path), a **Garden Almanac** collection page, 21 hand-drawn plant
  icons, **rare seed drops** from the Wilds, and **Mother Yarrow** as a walk-up
  NPC on her own garden plot with a chapter-aware greeting + the Verdant aura
  capstone.
- **Daily/nightly room hooks + collection codices** (roadmap #6 + #8) — every
  interior now has its own reason to return, each with a collectible title:
  the **Café daily special** (`data/cafeSpecials.js`), the **Starlight Arcade**
  daily high-scores, the **Midnight Archive**'s book-of-the-day + **Forbidden
  Shelf codex** (`data/forbiddenBooks.js` → *Reader of the Forbidden Shelf*), the
  **Phantom Parlor**'s nightly vigil + register (`data/parlorSpirits.js` →
  *Keeper of the Midnight Vigil*), and the **Reliquary** — inspect the
  relics-under-glass to collect them (`data/relics.js` → *Keeper of the
  Reliquary*).
- **Solo → coven on-ramp** (roadmap #5) — a **solo séance** (`solo_seance_start`,
  one per account) lets a new player taste the coven's AI séance magic before
  committing to a coven.

### Earlier (pre-Oct-22 context)

- **NPC directory reconciled** (#485), **NPC voices** (#496), **Widow's Watch
  lore node** (#497), **ambient NPC life** (#498), a **mobile performance pass**
  (#490–#495), the **Ashblood Trials** PvP arc (#486), per-room World Chat tabs
  (#488) + area voice echoes (#489), all five **building interiors reskinned**
  with KayKit furniture, café polish, a static-prop frustum-cull fix, and the
  covens marketing page.

---

## Now — concrete fixes (small, verifiable)

### 1. ✅ DONE (PR #485) — NPC "where to find them" directory reconciled

### 2. ✅ MOSTLY DONE — NPCs with a nameplate but no job
The two called out both have real functions now: **Tinkerer Oswin** gives the
*Oswin's Springs* quest, and **Old Mabel** gives *Mabel's Posies* + the
Wanderer's *Gray Road* arc **and** mentors the whole Hearth Path brewing
questline (with a progress-aware greeting in the kitchen). Combined with NPC
voices (#496) + ambient barks (#498), the "walk up and get nothing" gap is
closed for the named NPCs. _Open only as an ongoing habit: give any future
named NPC a function, not just a nameplate._

### 3. ✅ DONE (PR #497) — "Widow's Watch" is now a lore node

---

## Next — bigger bets (retention / growth)

### 4. ✅ DONE — "While you were away" feed
Shipped as the **welcome letter** (`buildWelcomeLetter`, Session L; the code
cites "roadmap #4"). After an 8h+ absence, returning players get a letter modal
(`welcome_letter` → `openLetterModal`) that counts what regrew, which side
quests cooled down, whether the Midnight Peddler rotated stock, the login streak
+ purse, the calendar ahead, and **coven news** — your coven's weekly-board rank
and whether it's holding the Champions' Table — plus gentle nudges toward the
daily/nightly rooms. A gift on the doormat, never a guilt trip.

### 5. ✅ DONE — The solo → coven on-ramp
Shipped as the **solo séance**: a one-time solo taste of the coven's AI séance
board, so the coven pitch lands after a player has felt the magic.

### 6. ✅ DONE — A reason to return to each room
Shipped across all four interiors: Café daily special, Arcade daily high-scores,
Midnight Archive book-of-the-day + Forbidden Shelf codex, Phantom Parlor nightly
vigil — each with a collectible title.

### 7. ✅ DONE — A vanity / cosmetic sink
Shipped as **player housing** (own + furnish a cottage, a premium decor shop,
visiting), on top of the existing wardrobe looks, dyes, auras and titles, and
the two questline auras (Verdant, Hearthfire). Expression, never power.

### 8. ✅ DONE — Turn decorative systems into real ones
Shipped as the **Reliquary** (inspect the relics-under-glass → lore card +
*Keeper of the Reliquary*) and the **Forbidden Shelf codex** in the Archive.

---

## New bets worth taking now

With the whole Oct-22 list cleared, the live questions:

- **Liveness, still #1 by data** — concurrency is the real growth ceiling, and
  the biggest lever left. The welcome letter, async phantom presence, ambient
  barks and away-nudges all help a returning/solo player; the next step is
  *connecting* players across sessions: cross-session matchmaking nudges ("3
  covenmates were on an hour ago"), scheduled town events people can plan around,
  or shared async goals a coven chips at over a week.
- **Economy audit** — with housing's decor shop, the Hearth/Green Path reward
  herbs, and the auction house, re-check whether gold/Moonstones have enough
  sinks for an engaged player, or whether currency still piles up.
- **Endgame / progression ceiling** — what a maxed player chases after the weekly
  crown loop. The two questlines (Green + Hearth) added mid-game depth; the top
  end is still mostly the weekly coven crown.
- **Tie the new systems together** — the garden already feeds the kettle; next,
  let housing, gardening and brewing cross-pollinate (grow decor plants, display
  a brewed-teas shelf in your cottage, a garden plot at home).
- **Mobile combat/controls feel** — still worth a dedicated touch pass given how
  much traffic is phone.

---

## Meta — let the data pick the holes

The Watch dashboard tracks traffic, a security/event log, and player counts. The
highest-value gaps are the ones the data knows and a code review can't see:
- Where do new players drop off? (We caught one onboarding bounce already — a
  guest firing out-of-range strikes and leaving at ~36s — and added the "move
  closer" nudge.)
- Which rooms get zero visits now that each has a daily hook? Which NPCs are
  never interacted with?
- What's the Day-1 / Day-7 return curve, and what did returners do differently?

Action: a dedicated analytics pass to rank the above, and let it reprioritize
this list rather than intuition.
