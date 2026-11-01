# Blueprint — Player Housing (a witch's cottage)

> A personal, decoratable home each player owns — furnish it, grow a window-box,
> and let covenmates visit. The highest-retention, best-compounding big feature
> for a cozy witch-town, and the next big home for the cosmetic/premium runway.
> Status: **blueprint / not built — direction locked.**
>
> **Decisions locked (Nov 2026):**
> - **Instanced, not a shared plot town.** Each player owns a private instanced
>   cottage (reusing the Manor's per-account instancing). Infinite scale, no plot
>   scarcity, no griefing; the "quiet town" feel comes from a cozy instanced lane
>   + visiting, not a contested shared map.
> - **Free to own, premium to decorate.** Every player gets a free starter
>   cottage (the retention hook must reach everyone). Money monetizes the
>   furniture/theme runway — expression, never access, never stats. (No pay-to-win.)
> - **Assets:** the connected KayKit collection includes a **Furniture Bits**
>   pack, so real furniture models are available — but per §3d we still start with
>   tinted primitives and swap meshes in incrementally.
> - **Build order unchanged:** persistence + placement (with a test) FIRST, before
>   any rendering (§6).

## 1. Vision & pillars

Thornreach already nails *who you are* (class, pacts, familiar, cosmetics) and
*what you do* (quests, hunting, gardening). It's missing **a place that's
yours** — the single strongest daily-return hook cozy MMOs have.

Pillars:

1. **Yours and personal.** An account-owned interior you arrange freely. Not a
   coven room — your own cottage (the coven manor stays the shared space).
2. **Expression over power.** Furniture is cosmetic. No stat furniture, ever —
   same rule as the rest of the game. This is where the cosmetic runway goes
   next: every piece is a reward, a craft, or a tasteful premium sink.
3. **Social.** Friends and covenmates can *visit*. A home nobody sees is half a
   feature; being able to show it off is the retention multiplier.
4. **Sliceable.** Ship one room with a dozen pieces, then widen. Never big-bang.

## 2. The MVP slice (ship this first)

One PR that proves the whole loop, deliberately tiny:

- **One room.** A single fixed-size interior (a new room id, e.g. `cottage`),
  entered from a door in town or a menu button ("Go Home").
- **A starter furniture set** (~10 pieces): rug, table, chair, bed, bookshelf,
  cauldron, candle, wall-hanging, potted plant, window.
- **Place & save.** Drag a piece onto a grid, rotate, remove; the layout
  persists per account.
- **Solo only** at first (visiting comes in slice 2).

If that loop feels good, everything after is width, not new risk.

## 3. Core systems

### a. The space (instancing)
A per-account interior instance, reached the way the coven manor already
instances rooms (`server.js` uses `player.instance` + room ids; manor bedrooms
are account-scoped). Your cottage is `room: 'cottage'`, `instance: <accountKey>`
— so each player's home is private, and a visitor is simply placed into the
owner's instance.

### b. Furniture catalog (data)
`data/furniture.js` — each piece: `{ id, name, icon, footprint (w×h cells),
model/sprite key, source }`. `source` is how you get it: `craft`, `quest`,
`drop`, `premium`, or `default`. This mirrors how looks/dyes/auras already
declare their source, so the economy stays legible.

### c. Placement & persistence (the scary part — prototype first)
- A **grid** (say 10×10 cells) is far simpler and less buggy than free
  placement; snapping also reads as tidy, not fiddly. Start grid.
- Per-account state: `home: { pieces: [{ id, x, y, rot }], shell }`. Validate
  server-side on every placement (piece owned, cell free, in bounds) — the same
  "server owns the truth" discipline as inventory/skills.
- This is the one genuinely new persistence shape, so **build and migrate it
  first**, with a test, before any rendering. (You've seen how careful the
  save-migration has to be — do it on day one, not at the end.)

### d. Rendering (client)
A new interior scene, same low-poly language as dungeons/manor
(`client/dungeon-scene.js` is the closest model). Furniture meshes are built the
way familiars/props are (`client/familiars.js`, `PROP_BUILDERS`). Start with
re-tinted primitives; swap in nicer meshes over time.

### e. Visiting (slice 2)
"Visit" from a friend/coven roster drops you into their instance, view-only
(you can't move their furniture). Owners get a toggle: private / coven / public.
Respect the existing mute/privacy rules.

## 4. Furniture as a content runway

The reason housing is the *best* big feature: it never runs out of follow-ups,
and each is a small PR that fits the pattern already proven:

- **Earned:** quest and chapter rewards, rare-drop décor (a boss trophy for the
  wall), Green-Path plants you can pot at home (ties the two features together).
- **Crafted:** extend the Artificer tree (`data/craftingTree.js`) with a
  furniture line — a gold/material sink that gives crafting a cosmetic payoff.
- **Premium:** tasteful themed sets for Moonstones (a "Hallow" set at Samhain, a
  "Yule" set in winter) — seasonal, collectible, zero power. Same buy-on-pick,
  account-wide pattern as name colors / coats / auras.

## 5. Ties to the rest of the game

- **Gardening:** a window-box or indoor pot lets you grow a herb at home — a
  natural crossover with the Green Path, and a reason to decorate functionally.
- **Covens:** home visits deepen the social loop the manor started; a future
  "coven street" of members' cottages is a natural expansion.
- **Cosmetics:** your aura/coat/name-color already express you in the world;
  the cottage expresses you in a space. Same philosophy, new surface.

## 6. Build order

1. **Persistence + MVP room** (grid, 10 starter pieces, place/save, solo) —
   with the migration and a placement test in the same PR.
2. **Visiting** + the private/coven/public toggle.
3. **Furniture runway:** the crafted furniture line (gold sink), then the first
   earned drops, then the first premium themed set.
4. **Crossover polish:** window-box gardening, a "home" button in the HUD, a
   coven roster "visit" action.

## 7. Risks & how to defuse them

| Risk | Defusal |
|---|---|
| New persistence shape / migration bugs | Build + test it in slice 1, before rendering; validate every placement server-side |
| Placement feels fiddly on mobile | Grid-snap, big tap targets, one-finger drag; you play on mobile, so test there first |
| Scope creep into a full editor | Hard-cap the MVP to one room + ~10 pieces; widen only after it's fun |
| Art load (every piece needs a mesh) | Start with tinted primitives; upgrade meshes incrementally, like familiars |
| Power creep via "stat furniture" | Never. Furniture is cosmetic, full stop — same rule as the whole game |
