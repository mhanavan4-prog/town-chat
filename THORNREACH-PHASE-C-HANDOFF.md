# Thornreach — Tier 3.4 Phase C Handoff (client monolith split)

_Updated 14 Jul 2026 (late). Paste into a new session and say "continue from the
Phase C handoff." Everything below is committed on `main` unless noted (the Ember
slice, §1, may still be in review)._

---

## 0. TL;DR — how to resume

We're incrementally splitting the ~21k-line `public/client.js` monolith into
`client/*.js` ES modules. `public/client.js` is now a **build artifact**.

**The loop for every slice:**
1. Pick a self-contained block (a UI panel, a subsystem, or a scene builder).
2. Move it verbatim into `client/<name>.js` as a **dependency-injection factory**
   (`export default function createX(deps){ …; return {api}; }`).
3. Inject what it reads: getters for reassigned/late state, functions/consts by
   reference, and **setters (or get+set) for shared state it writes**;
   `import { Modals }` for open/close on a modal UI.
4. **Wire main:** construct where the block was; destructure the API to the same
   const names the call sites use → no call-site rewiring.
5. `npm run build:client && npm run sync:mobile && npm run test:ci` → all green;
   one module per PR.

**The gate is the seatbelt** — `test:ci` = build → **boot-check** → lint →
typecheck → parity → unit → browser smoke. Three nets carry the load:
- **lint `no-undef: error`** on `client/` — a missed shared var/dep is a loud
  compile error (this caught `builtDungeonTier`).
- **`test:boot`** (`test/eval-boot.mjs`) — runs the bundle's eval-time code in a
  Node `vm` with stubbed browser globals; catches **boot-time TDZ crashes**
  without Chromium (the class that bit moonstones — see §5).
- **function-set diff vs the merged monolith** — must show only the new
  `+createX`, proving nothing was lost or duplicated.

---

## 1. State of play — 18 modules, `main.js` 21,000 → 18,633

| Phase | Status |
|---|---|
| A — data → `data/` (11), B — logic → `lib/` (9) | **DONE** |
| C — `client.js` → `client/` | **IN PROGRESS** |

**Client modules** (infra + UI panels + scene builders):

| Module | Lines | Kind |
|---|---|---|
| `modals.js` | 18 | infra — modal/overlay open-state registry (§4) |
| `collision.js` | 70 | subsystem — collision/room predicates |
| `board.js` / `delve.js` / `coven.js` | 85 / 151 / 255 | Session-L UI (board, weekly delve+locksmith, covens) |
| `shop.js` / `spellbook.js` / `attacks.js` | 154 / 100 / 130 | UI panels (NPC shop, witch spells, attacks) |
| `notif.js` / `consent.js` | 126 / 129 | UI (push settings, camera/mic consent) |
| `legend.js` / `moonstones.js` | 97 / 129 | premium/economy UI (peddler shop, moonstones+gold) |
| `audio.js` | 216 | subsystem — procedural music (Milestone 1) |
| `vault-scene.js` / `cave-scene.js` | 109 / 628 | **3D scene builders** (Bank Vault, Witch Cave) |
| `dungeon-scene.js` / `ember-scene.js` | 236 / 63 | **3D scene builders** (Personal Dungeon, Ember Wastes) |

Plus infra files: `tools/bundle-client.mjs` (bundler), `test/eval-boot.mjs`
(boot-check). Merged through PR #40; Ember is PR #41 (in review).

---

## 2. The build pipeline

`public/client.js` is **generated** by `tools/bundle-client.mjs` — a
**zero-dependency** Node bundler that concatenates the `client/` ES-module graph
into one IIFE (strips import/export, emits modules dependency-first). Chosen over
esbuild because the sandbox can't install esbuild (no network) and the Mac's npm
gates install-scripts — a native binary was awkward in both places.

**Scripts** (`package.json`): `build:client`, `test:boot`, `test:smoke`,
`sync:mobile` (copy bundle to the two mobile `www/`), `check:parity` (3 copies
byte-identical; auto-skips in CI), `test:ci` (whole gate, build first).

**ESLint**: `public/client.js` ignored (generated); `client/**/*.js` linted as ES
modules with `no-undef: error` and the vendored-global whitelist (`THREE`, `FX`,
`LEGEND_FX`, `faceapi`).

---

## 3. Two extraction patterns

**(a) UI panels & subsystems** — inject `send`/`ws`, state getters, helper
functions, `Modals`. Keep shared state's declaration in `main.js`; inject a
getter (and a **setter** if the module writes it — e.g. coven's `setCovenUnread`,
moonstones' get/set on `myMoonstones`).

**(b) 3D scene builders** (the current frontier) — the shape that's working:
- **THREE/FX/LEGEND_FX are globals**, so they're never injected. This is what
  keeps scene-builder dep lists small.
- Inject only the **prop-helpers** the builder calls (`makeStoneTexture`,
  `makeGrassTexture`, `makeTree`, `buildPortalMesh`, …) and any world-constant
  (`VAULT_WORLD`, `DUNGEON_LAYOUTS`).
- The built **scene/camera and kiosk/mob lists are shared state** (read by the
  active-scene checks and render loop), so they stay in `main.js` and the builder
  writes them back through injected **setters** (`setVaultScene`), plus a getter
  where it also reads them (dungeon's `getDungeonScene`, ember's
  `getEmberMobVisuals`).
- **Decoration helpers nested inside a builder move with it for free** — that's
  why 628-line `cave-scene.js` needed only 6 external deps (its 13
  `makePotion/makeSkull/…` are nested in `addCaveWallShelves`).
- Scene builders are called at **runtime** (from the `init` WS handler /
  `initScene`), so their `const` handles are safe from the boot-TDZ trap.

Each slice remains a **content-asserted Python transform** so it can't silently
mangle the 18k-line file.

---

## 4. The modal registry (`client/modals.js`)

~26 scattered overlay booleans became one `Set` keyed by the old flag name:
`Modals.set('npcShopOpen', …)` / `Modals.isOpen('npcShopOpen')` / `Modals.any()`.
Behaviour identical; payoff is each modal UI extracts with **zero guard-rewiring**.
(`templePortalOpen` stays out — world state, not a UI overlay.)

---

## 5. Key gotchas (learned the hard way)

- **⚠ Eval-time TDZ.** A moved function goes from *hoisted* (callable anywhere) to
  a `const` at its construction line. Anything that runs **during initial
  evaluation** and references it *before* that line throws
  `Cannot access 'X' before initialization` at boot. This bit `openMsModal` via
  the `wireActionCluster` IIFE (~line 5716). **Fix:** defer the reference —
  `closeSheetAnd(() => openMsModal())`. `test:boot` now catches this class. The
  same wiring block still has `closeSheetAnd(openPassModal)` — lazy-wrap it when
  town-pass is extracted.
- **Construction ordering:** if module B injects functions from module A, A must
  be constructed **before** B (moonstones before legend).
- **Shared state declared inside a section:** keep the declaration in `main.js`,
  inject a getter/setter — don't move it (`myAttackCatalog`, `covenTableState`,
  `builtDungeonTier`, `lastInventoryState`).
- **Watch for reads, not just writes:** dungeon's `dungeonScene` was written
  *and* read (`if (… && dungeonScene)`) — needed a getter too. The leftover-check
  and lint net catch these.
- `.git/index.lock` recurs — `rm -f .git/index.lock` before git ops. Mobile
  `www/` copies aren't git-tracked, never in `git add`.

---

## 6. Backlog / layout for the future

**The 3D bulk (the remaining mass, ~13k of 18.6k lines) — roughly easy→hard:**
1. **`client/props.js` — the shared mesh/texture-maker library.** DO THIS BEFORE
   THE WILDS. Extract the shared `make*` helpers (`makeTree`, `makeRock`,
   `makeGrassTexture`, `makeGlowTexture`, `makeSignSprite`, `makeNpcNameSprite`,
   `makeHealthBarSprite`, `buildPortalMesh`, `createHumanoid`, …) into one module
   that scene builders **import** from instead of injecting 10-16 helpers each.
   This is the leverage point that makes every remaining scene clean.
2. **The Wilds** (`buildWildsScene` + `addVillageBuildings`/`addUnboundCircleSet`/
   `addThornwardenCamp`/`addGiantWerewolfTree`/`buildWildsNPCs`, ~750 contiguous
   lines) — an orchestrator that calls ~16 helpers, several scattered/nested.
   Tractable once `props.js` exists.
3. **Creatures** (mob visuals, health bars, archetypes) and **player-visuals**
   (rigs, faces, `LEGEND_FX`, equip overlays, spell-status visuals) — the last big
   render chunks. `createHumanoid`/`makeHealthBarSprite`/`makeNpcNameSprite` belong
   here or in `props.js`.
4. **Ember mob functions** (`getOrCreateEmberMobVisual`/`applyEmberMobState`/
   `updateEmberMobVisuals`) — pair with creatures.

**Remaining UI panels (scattered/tangled — lower priority):**
- **bank / auction / inventory cluster** — share `lastInventoryState`/
  `selectedInvSlotIdx`; extract together (biggest UI tangle).
- **journal / skills** — interleaved with the ~24-var shared-state island (~3300).
- **town-pass** — logic spread across 5+ locations (helpers ~2300, buy handlers
  ~18261); needs the line-5748 lazy-wrap.

**End state:** after the 3D bulk, `main.js` is a thin wiring entrypoint that
constructs the modules and holds the shared state + WS/loop plumbing.

---

## 7. Key code locations

- **Bundler** `tools/bundle-client.mjs` · **Boot-check** `test/eval-boot.mjs` ·
  **Registry** `client/modals.js`.
- **main.js imports** (top): one `import createX from './x.js'` per module — add
  each new one here. **Constructions** live where each block was (search
  `const _vault = createVaultScene(`).
- **Shared state still in main** (inject, don't move): `me`, `players`, `world`,
  `walls`, `ws`, `visuals`, the `*Scene`/`*Camera`/`*MobVisuals`/`*KIOSKS` sets,
  `lastInventoryState`, `lastBankState`, `myMoonstones`, the catalogs.
- **Menu wiring IIFE** `wireActionCluster` (~line 5716, eval-time) — lazy-wrap any
  `closeSheetAnd(openXModal)` whose target has become a const.
- **Prop-helper defs** are scattered through the render section (~7000–16000) —
  the raw material for `props.js`.
- **Planning docs**: `THORNREACH-3.4-PHASE-C-CLIENT-SPLIT-ROADMAP.html`,
  `THORNREACH-3.4-PHASE-C-M2-PROGRESS.md`.

---

## 8. Commit / sync flow

```
# after a slice is green locally (test:ci incl. boot-check):
rm -f .git/index.lock
git checkout -b tier34-client-<name>
git add client/<name>.js client/main.js public/client.js
git commit -m "Tier 3.4 Phase C: extract <name> to client/<name>.js"
git push -u origin tier34-client-<name>
# merge on GitHub (CI green), then sync local:
git checkout main && git pull origin main
git branch -D tier34-client-<name> && git fetch --prune
```

Deploy is automatic on merge to `main` (web). One server backs web + iOS +
Android; mobile ships via `sync:mobile` → `npx cap sync` → rebuild.
