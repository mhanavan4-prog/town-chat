# Thornreach — Tier 3.4 Phase C Handoff (client monolith split)

_Updated 14 Jul 2026. Paste into a new session and say "continue from the Phase C
handoff." Everything below is committed on `main` unless noted._

---

## 0. TL;DR — how to resume

We're incrementally splitting the 21k-line `public/client.js` monolith into
`client/*.js` ES modules. `public/client.js` is now a **build artifact**.

**The loop for every slice:**
1. Pick a self-contained block (a UI panel or subsystem).
2. Move it verbatim into `client/<name>.js` as a **dependency-injection factory**
   (`export default function createX(deps){ …; return {api}; }`).
3. Inject what it reads (getters for reassigned state, functions by reference);
   `import { Modals }` for open/close; keep the same names at call sites so main
   needs no rewiring.
4. `npm run build:client && npm run sync:mobile && npm run test:ci` → all green.
5. One module per PR. Branch `tier34-client-<name>`, commit, push, merge, pull.

**The gate is the seatbelt** — `test:ci` runs build → lint → typecheck → unit →
browser smoke → parity. Lint's `no-undef: error` on `client/` is the key net:
because a moved symbol's declaration is gone from main, any missed reference is a
loud compile error, not a silent bug.

---

## 1. State of play

| Frontier | Status | Result |
|---|---|---|
| Phase A — data → `data/` | **DONE** | 11 modules |
| Phase B — logic → `lib/` | **DONE** | 9 modules (persistence, webpush, moonstones, calendar, leaderboards, auctions, covens, dungeons, delve) |
| Phase C — `client.js` → `client/` | **IN PROGRESS** | see below |

**Client modules extracted so far** (`main.js`: 21,000 → 20,525 lines):

| Module | Lines | What it is |
|---|---|---|
| `client/audio.js` | 216 | procedural music/Web-Audio (Milestone 1 — proved the pipeline) |
| `client/collision.js` | 70 | collision & room predicates (injected getters for world/walls/lore/delve) |
| `client/modals.js` | 18 | **the modal/overlay open-state registry** (see §4) |
| `client/shop.js` | 154 | NPC shop UI (first clean UI-panel extraction) |
| `client/spellbook.js` | 100 | Witch spellbook UI |

Merged PRs: #24 (pipeline + audio + collision), #25 (modals), #26 (shop),
#27 (spellbook).

---

## 2. The build pipeline

`public/client.js` is **generated** by `tools/bundle-client.mjs` — a
**zero-dependency** Node bundler that concatenates the `client/` ES-module graph
into one IIFE. It's correct here because every module was carved from one
original closure, so top-level names are already unique; the bundler just strips
`import`/`export` syntax and emits modules dependency-first.

**Why not esbuild:** the sandbox can't install it (no network) and your Mac's npm
gates package install-scripts — a native binary was awkward in both places. The
zero-dep bundler needs no install, no native binary, is deterministic across
machines, and is plenty (the whole client ships as one closure anyway; no
tree-shaking needed). `build:client` is the only swap-point if you ever want
esbuild's minification/sourcemaps later.

**Scripts** (`package.json`):
- `build:client` = `node tools/bundle-client.mjs` (client/ → public/client.js)
- `sync:mobile` = copy the built bundle to the two `www/client.js` mobile copies
- `test:ci` = `build:client` **first**, then lint → typecheck → check:parity →
  unit → test:smoke
- `check:parity` = the 3 client.js copies are byte-identical (skips in CI where
  the mobile repos aren't checked out)

**ESLint** (`eslint.config.js`): `public/client.js` is **ignored** (it's the
bundle); `client/**/*.js` is linted as ES modules with `no-undef: error` and the
vendored-global whitelist (`THREE`, `FX`, `LEGEND_FX`, `faceapi`).

---

## 3. The extraction recipe (repeatable)

Each slice is done as a **content-asserted Python transform** (see the scratch
scripts used per slice) so it can never silently mangle the 20k-line file:

1. **Scope it:** find the block's exact boundaries; list every symbol it *reads*
   from outside (→ injected deps) and every symbol *outside* that reads its
   internals (→ must export, or expose an accessor).
2. **Move verbatim** into `client/<name>.js` inside a `createX(deps)` factory.
   The only edits to the moved body are swapping each external read for its
   injected form (e.g. `ws.send(` → `send(`, `world` → `getWorld()`).
3. **Inject:** reassigned/late state via getters (`getWorld: () => world`);
   plain functions/consts by reference; `import { Modals }` for open/close.
4. **Wire main:** construct where the block was, destructure the API to the
   **same const names** the call sites already use → no call-site rewiring
   (except genuinely shared internals, which get a small accessor — e.g. shop's
   `refreshShopSellTab`).
5. **Verify:** `node --check` (syntax) + lint (`no-undef` catches misses) +
   typecheck + unit + parity + a **function-set diff vs the merged monolith**
   (must show only the `+createX` factory, proving nothing was lost/duplicated).

---

## 4. The modal registry (`client/modals.js`)

The single most important enabler for UI extraction. ~26 scattered overlay
booleans (`npcShopOpen`, `bankModalOpen`, `arcadeModalOpen`, the panels, the
consent dialogs, …) were replaced with one `Set` keyed by the old flag name:

```
Modals.set('npcShopOpen', true|false)   // was:  npcShopOpen = true|false
Modals.isOpen('npcShopOpen')            // was:  npcShopOpen
Modals.any()                            // handy for future guard simplification
```

Guards (`anyOverlayOpen()` and ~4 inline ones) kept their exact subsets, now via
`isOpen` — behaviour identical, pure storage swap. **Payoff:** a modal UI's flag
no longer leaks as a free variable, so each panel extracts with **zero
guard-rewiring** — it just calls `Modals.set('itsFlag', …)` internally.
(`templePortalOpen` was deliberately left out — it's server-driven world state,
not a UI overlay.)

---

## 5. Key findings & gotchas

- **`client.js` is one IIFE**, not global scope. That's why a bundler (single
  closure output) fits and a naive ordered-`<script>` split does not.
- **The bank/auction/inventory cluster is coupled via shared state.** The Bank &
  Auction section *declares* `lastInventoryState` (17 external refs),
  `selectedInvSlotIdx` (6), `lastBankState` (5) — app-wide state the inventory
  UI also uses. Extract these three panels **together, after** lifting that
  shared state into a `client/core.js`. Don't try them as isolated slices.
- **The build is load-bearing** — `build:client` is the *first* step of
  `test:ci` so a broken bundle fails CI loudly.
- **Determinism:** the bundler is pure string concatenation, so a rebuild on any
  machine is byte-identical. Still run `build:client` → `sync:mobile` together
  after every client edit so `check:parity` stays green.
- **`.git/index.lock`** recurs in this setup — `rm -f .git/index.lock` before any
  git op if it's stuck.
- **Mobile `www/client.js` copies are NOT git-tracked** (the mobile folders
  aren't repos), so they're never in the `git add` list; they matter only for a
  Capacitor build.

---

## 6. What's next (prioritized backlog)

**Clean UI-panel leaves** (same shape as shop/spellbook — each its own PR):
- `attacks` — Werewolf/Wanderer analog of spellbook; same targeting/cooldown
  deps (`armTargeting`, `actionOnCooldown`, `startActionCooldown`,
  `buildEmojiCursor`, `cancelTargeting`, `SWORD_CURSOR`). Likely the next-cleanest.
- `journal`, `skills` — panel UIs.
- consent dialogs (`witchConsent`, `werewolfConsent`, `spellConsent`,
  `howlConsent`) and the `witchShop`/`werewolfShop` panels.
- `board`, `delve`, `coven`, `notif`, `locksmith` (the multi-declared cluster),
  `ms` (moonstones), `legend`, `pass`, `emoteWheel`, `mobileChat`, `arcade`.

**The `core` state-lift** (bigger, unlocks the most): move the shared client
state — `lastInventoryState`, `lastBankState`, `selectedInvSlotIdx`,
`lastAuctionListings`, `me`, `players`, `world`/`walls`, `visuals`, catalogs — into
`client/core.js` that the feature modules import from. **This is the prerequisite
for the bank/auction/inventory cluster** and eventually lets `main.js` become a
thin wiring entrypoint.

**Later (the bulk of the 20k lines):** the scene builders (town/wilds/cave/bank/
ember/dungeon), `creatures`, `props`, `player-visuals`, then `net`/`loop`/`core`
last.

---

## 7. Key code locations

- **Bundler:** `tools/bundle-client.mjs`. **Registry:** `client/modals.js`.
- **main.js imports** (top of file): `createAudio`, `createCollision`, `Modals`,
  `createShop`, `createSpellbook` — add each new `create*` here.
- **Construction sites** live where each block used to be (search
  `const _shop = createShop(` etc.).
- **Shared state still in main** (inject, don't move yet): `me`, `players`,
  `world`, `walls`, `ws`, `lastInventoryState`, `lastBankState`,
  `selectedInvSlotIdx`, `visuals`, `ITEM_CATALOG`, `SPELL_CATALOG`.
- **Planning docs:** `THORNREACH-3.4-PHASE-C-CLIENT-SPLIT-ROADMAP.html` (the
  overall plan), `THORNREACH-3.4-PHASE-C-M2-PROGRESS.md` (M2 + registry notes).

---

## 8. Commit / sync flow

```
# after a slice is green locally:
rm -f .git/index.lock
git checkout -b tier34-client-<name>
git add client/<name>.js client/main.js public/client.js
git commit -m "Tier 3.4 Phase C: extract <name> to client/<name>.js"
git push -u origin tier34-client-<name>
# merge on GitHub, then sync local:
git checkout main && git pull origin main
git branch -D tier34-client-<name> && git fetch --prune
```

Deploy is automatic on merge to `main` (web). One server backs web + iOS +
Android. Mobile ships via `sync:mobile` → `npx cap sync` → rebuild.
