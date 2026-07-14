# Thornreach — Tier 3.4 Phase C, Milestone 2 (progress)

_Slices are extracted on top of M1 in the working tree. Same gate, same rules._

---

## Slice done this session: `client/collision.js`

Extracted the **collision & room predicates** from the monolith into a DI
factory — `rectOverlap` (internal), `collides`, `collidesIndoor`, `roomAt`,
`pokeRoomTag`, `roomLabel`, and the `PLAYER_R` constant (read by 7 movement
sites, so it's exported). Four reassigned/late globals are injected as getters:
`getWorld`, `getWalls`, `getDungeonLore`, `getDelveState`.

The wall-**geometry** builders (`buildWalls`, `getDoorSide`, `getDoorWorldPos`,
and the shared `buildWallsForOne`) **stayed in main** — interior-building code
also calls them, so moving them now would drag in a second concern. They can
join `collision.js` in a later pass.

**Verified (real build, in-sandbox):** build bundles 3 modules → `public/client.js`;
`node --check` passes; lint 0/0; typecheck passes; unit 14/14; parity identical;
function-set vs the original monolith is unchanged except the two new factory
wrappers (`+createAudio`, `+createCollision`). Only `test:smoke` is deferred to
your Mac (sandbox has no Chromium).

Files: **new** `client/collision.js`; **changed** `client/main.js` (import +
construct + destructure; predicates removed), `public/client.js` + the two
`www/` copies (rebuilt/synced).

## The important finding: modal-open flags are systemic coupling

I scoped the roadmap's suggested M2 leaves (shop, arcade, notify,
countermeasures) and hit a wall that reshapes the plan:

- **`shop` / `arcade` and every other modal UI** own a boolean like
  `npcShopOpen` / `arcadeModalOpen`. Each of those is **read in ~6 shared
  "is any modal open?" guard expressions** scattered through the input/interaction
  code (they enumerate ~15 modal flags: `npcShopOpen || arcadeModalOpen ||
  bankModalOpen || …`). Extracting one modal cleanly means its private flag can
  no longer be read by those guards.
- **`notify`** (toasts) is spread across several interdependent blocks
  (`appendSystemChatLine` needs `systemChatNotif`, `setUnlockToast`, and
  `renderChatLog`, each defined elsewhere) — not a single leaf.

**So the UI-panel slices are gated on a small enabling refactor**, not more
moves. That's the natural next step:

### Recommended next step — a modal-state registry (a refactor, its own PR)

Replace the ~15 scattered `xModalOpen` booleans with one small module:

```
// client/modals.js
const open = new Set();
export const Modals = {
  set(name, isOpen) { isOpen ? open.add(name) : open.delete(name); },
  isOpen(name) { return open.has(name); },
  any() { return open.size > 0; },
};
```

Then each modal does `Modals.set('npcShop', true/false)` instead of
`npcShopOpen = …`, and every guard becomes `… || Modals.any()` (or
`Modals.isOpen('npcShop')` where a specific check is needed). Pure refactor,
no behavior change, fully gated. **Once it lands, shop / arcade / bank / auction
/ witch-shop / werewolf-shop / notifications all become clean leaf extractions**
— which is the bulk of the remaining client UI.

## Sequence from here

1. `modals.js` registry refactor (unblocks all modal UIs) — **do this next**.
2. Then the UI leaves as clean moves: `shop`, `arcade`, `bank`, `auction`, …
3. Computational leaves in parallel anytime: finish `collision` (pull in the
   wall-geometry once interiors are also modularized), `day/night`'s
   `getDayNightState`, etc.

## Commit note (working tree currently holds M1 + this slice)

Because the sandbox can't commit (`.git/index.lock`, no network), M1 (audio +
pipeline) and this collision slice are **stacked uncommitted** in the working
tree. On your Mac, run the gate then commit — either as one Phase C batch:

```
npm run build:client && npm run sync:mobile && npm run test:ci   # all green incl. smoke
git checkout -b tier34-client-phase-c
git add client/ tools/bundle-client.mjs public/client.js package.json eslint.config.js \
        ../town-chat-android/www/client.js ../town-chat-ios/www/client.js
git commit -m "Tier 3.4 Phase C: client bundle pipeline; extract audio + collision"
```

…or as two commits if you want the history split (stage `client/audio.js` +
pipeline files first, then `client/collision.js`). Future slices can be
one-PR-each once you're driving the gate on your machine between them.
