# Thornreach — Tier 3.4 Phase C, Milestone 1 (client split: prove the pipeline)

_Status: extraction complete and verified green in-sandbox except the browser
smoke test (which needs network the sandbox doesn't have). Finish on your Mac
with the 4 commands in §3, then commit._

---

## 1. What this milestone did

Stood up the **client-bundle pipeline** and moved the **first leaf module** out
of the 21k-line `public/client.js` monolith — proving the pattern end-to-end on
small, low-risk code. `public/client.js` is now a **build artifact**; the source
of truth is the new `client/` tree.

**Build tool:** a **zero-dependency** bundler (`tools/bundle-client.mjs`, plain
Node) rather than esbuild. Reason: esbuild is a native binary that was awkward in
both build environments (no-network sandbox; your Mac's npm gates package
install-scripts). The bundler just concatenates the `client/` ES-module graph
into one IIFE — which is exactly correct here, since every module was carved from
one original closure (top-level names are already unique). No deps, no native
binary, no install-script approval, deterministic everywhere. `build:client` is
the only swap-point if you ever want esbuild's tree-shaking/minification later.

**The slice:** the procedural music/audio subsystem (Web Audio tavern loop) →
`client/audio.js`, a dependency-injection factory in the same style as the
server's `lib/` modules.

- It reads only two things from the app, now **injected**: `getMe()` and
  `setUnlockToast`.
- It exports the handles the rest of the client calls: `ensureAudio`,
  `startMusic`, `stopMusic`, `cycleMusic`, `musicMenuLabel`, plus a
  `musicState()` accessor that preserves the `window.__testDrive.music()` probe
  (the client's `__testHooks` analog).

## 2. Files changed

| File | Change |
|---|---|
| `client/main.js` | **new** — the monolith minus the audio block and minus the old IIFE wrapper (esbuild adds one). Imports `createAudio`, constructs it where the audio block used to sit, keeps every downstream call site unchanged. |
| `client/audio.js` | **new** — the extracted audio factory (216 lines). |
| `tools/bundle-client.mjs` | **new** — the zero-dep bundler (concatenates `client/` → one IIFE). |
| `public/client.js` | now a **generated bundle**. Do not hand-edit — edit `client/*.js` and rebuild. |
| `package.json` | new `build:client` script (`node tools/bundle-client.mjs`); `test:ci` runs `build:client` first. |
| `eslint.config.js` | `public/client.js` is now ignored (it's generated); `client/**/*.js` linted as ES modules with the same global whitelist and `no-undef: error`. |

**Nothing else in the client changed behavior.** Proof: the set of function
definitions before vs after is identical except the one new `createAudio`
factory (689 → 690); every audio function moved (never duplicated); the two
external reads resolve to the exact same `me`/`setUnlockToast`.

## 3. Finish on your Mac (only the browser smoke test is left to run)

No `npm install` needed — the bundler is plain Node, zero deps.

```
npm run build:client        # node bundler: client/*.js -> public/client.js
npm run sync:mobile         # copy the built bundle to the two www/ copies
npm run test:ci             # build -> lint -> typecheck -> parity -> unit -> SMOKE
```

`test:ci` should be fully green, including the browser smoke test. (If smoke
errors with "Executable doesn't exist", run `npx playwright install chromium`
once.) Then:

```
git checkout -b tier34-client-audio
git add client/ tools/bundle-client.mjs public/client.js package.json eslint.config.js \
        ../town-chat-android/www/client.js ../town-chat-ios/www/client.js
git commit -m "Tier 3.4 Phase C M1: client bundle pipeline; extract audio to client/audio.js"
```

> **Why the resync step matters:** `check:parity` requires `public/client.js`
> and the two `www/` copies to be byte-identical. Any client edit → `npm run
> build:client` (regenerates `public/client.js`) → `npm run sync:mobile` (copies
> it to `www/`). Run those two together, in that order, after every client edit
> from now on. (The bundler is deterministic, so a rebuild on your Mac produces
> the same bytes already checked out here — but resync anyway to be safe.)

## 4. In-sandbox verification (already done)

| Step | Result |
|---|---|
| `build:client` (real, zero-dep) | bundled 2 modules → `public/client.js` |
| bundle parses (`node --check`) | PASS |
| `lint` (`no-undef: error` on `client/`) | 0 errors, 0 warnings |
| `typecheck` (`tsc --noEmit`) | PASS |
| `test` (unit) | 14/14 files, all subtests pass |
| `check:parity` | 3 copies identical |
| function-set diff vs original | identical except `+createAudio` |
| `test:smoke` | **deferred to your Mac** (sandbox has no Chromium) |

## 5. Next — Milestone 2 (leaf UIs)

Same recipe, next leaves (each its own PR, leafiest first): `shop` (NPC Buy/Sell,
~3800–3970), `arcade` (cabinets + touch, ~19706–20360), `notify`
(toasts/ceremony, ~4790–4830), `countermeasures` (~4831–5030). Each: move the
block into `client/<name>.js`, inject what it reads, export what the app calls,
`build:client` → `sync:mobile` → `test:ci` green → PR.

Full plan: `THORNREACH-3.4-PHASE-C-CLIENT-SPLIT-ROADMAP.html`.
