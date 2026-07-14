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

### DONE — the modal-state registry (`client/modals.js`)

**Landed this session.** Replaced **26** scattered overlay booleans
(`npcShopOpen`, `bankModalOpen`, `arcadeModalOpen`, inventory/journal/skills/
spellbook/attacks panels, the four consent dialogs, board/delve/coven/notif/
locksmith, …) with one `Set`-based registry keyed by the old flag name:

```
// client/modals.js
const open = new Set();
export const Modals = {
  set(name, isOpen) { isOpen ? open.add(name) : open.delete(name); },
  isOpen(name) { return open.has(name); },
  any() { return open.size > 0; },
};
```

Sets became `Modals.set('npcShopOpen', true/false)`; reads became
`Modals.isOpen('npcShopOpen')`. Guards kept their exact subsets (e.g.
`anyOverlayOpen()` still ORs its specific list, now via `isOpen`) — behaviour is
identical, this was purely a **storage swap**. `templePortalOpen` was left as-is
(it's world state from the server, not a UI overlay).

Done via a content-asserted, sentinel-isolated transform (50 sets + 183 reads).
The safety net was decisive: removing every flag declaration means any missed
reference is a **lint `no-undef` error**, and lint came back **0/0** — proof the
conversion was complete. Full gate green (build → node --check → lint →
typecheck → unit 14/14 → parity); smoke on your Mac as usual.

**This unblocks the bulk of the remaining client UI:** shop, arcade, bank,
auction, witch-shop, werewolf-shop, notifications, spellbook, attacks, inventory,
journal, skills — each can now extract into its own module and just call
`Modals.set('itsFlag', …)` internally, with **zero guard-rewiring** at
extraction time (the guards already reference the registry).

## Sequence from here

1. ~~`modals.js` registry refactor~~ — **DONE this session.**
2. **Next:** the UI leaves as clean moves now that flags are centralized —
   `shop` (smallest), then `arcade`, `bank`, `auction`, the consent dialogs, etc.
   Each: move the render/handlers into `client/<name>.js`, call
   `Modals.set('itsFlag', …)` internally, inject `send`/state it reads.
3. Computational leaves in parallel anytime: `day/night`'s `getDayNightState`,
   finishing `collision` (pull in the wall-geometry once interiors modularize).

## Commit note (modals registry — this session's uncommitted change)

M1 (audio + pipeline) and collision are already merged to `main` (PR #24). The
**modals registry** is the new uncommitted change. On your Mac:

```
rm -f .git/index.lock                                      # if the lock is stuck
npm run build:client && npm run sync:mobile && npm run test:ci   # green incl. smoke

git checkout -b tier34-client-modals
git add client/modals.js client/main.js public/client.js THORNREACH-3.4-PHASE-C-M2-PROGRESS.md
git commit -m "Tier 3.4 Phase C: centralize 26 modal/overlay flags into client/modals.js"
git push -u origin tier34-client-modals
```

Then open the PR. (`public/client.js` is the rebuilt bundle; the mobile `www/`
copies aren't git-tracked, so they're not in the add list.)
