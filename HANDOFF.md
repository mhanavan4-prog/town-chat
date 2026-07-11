# Thornreach — Session Handoff / Context

**Read this first if you're a Claude session picking up this project.** It records what's been
built, the current state of the code, how to get running in the sandbox, and where the traps are.
Each session starts with no memory, so this file is the memory.

Owner: Michael (mhanavan4). Repo: `github.com/mhanavan4-prog/town-chat`, branch `main`.
Local path on his Mac: `~/Desktop/town-chat` (connect this folder via the desktop app).

---

## What the project is

**Town Chat / "Thornreach"** — a 3D multiplayer browser town (Node + Express + `ws` +
Three.js). Everyone walks around as a humanoid; each building is its own chatroom. There are five
playable **classes** (Witch, Werewolf, Mystic, Knight, Wanderer), each with a 12–15 ability kit and
a six-chapter story campaign, plus a Wilds zone, night mobs, a bank + auction economy, a Stripe
"Town Pass" paywall, an arcade with mini-games, and a fully separate mobile (touch) build.

- `server.js` (~6.8k lines) — authoritative game server, WebSocket handlers, all game logic.
- `public/client.js` (~15k lines) — the whole client: Three.js rendering, movement, UI, WS.
- `public/index.html` — join screen, HUD, all modal markup + CSS.
- `test/*.test.js` — `npm test` (node:test, mock sockets). `test/audit-playthrough.cjs` is a
  full completability audit (not part of `npm test`; run it manually).

Design notes baked into the codebase: **no movement anti-cheat by design** (client-trusted movement,
self-enforced speed effects); **no database** — state is flat gitignored JSON files
(`accounts.json`, `bankAccounts.json`, `playerProgress.json`, `inventories.json`, etc.); the campaign's
**~2-hour pacing is intentional and enforced by a test** in `newfeatures.test.js` (don't "fix" it by
boosting chapter/quest XP — that breaks the pacing test on purpose).

---

## What's been done (chronological)

### Session A — full playthrough & review
Played all 5 characters through their campaigns + the world/economy/pass/PvP/mobile via a headless
Playwright harness driving the real client. Produced a pros/cons review. **Two real bugs found & fixed:**

1. **Invisible bench/barrel colliders** (user-reported "invisible object near Torchkeeper Cora"). Cause:
   `client.js` declared `makeBench` and `makeBarrel` **twice each** (outdoor props + interior versions);
   JS keeps the later declaration, so outdoor benches/barrels rendered at NaN coords — invisible but
   still colliding. Fix: renamed the outdoor builders to `makeBenchProp` / `makeBarrelProp` and pointed
   `PROP_BUILDERS` at them. (There are no other duplicate-declaration shadows — I swept for them.)
2. **Stored XSS in party chat.** Room chat escaped `< >` via `sanitizeText`, but the `party_chat` path
   did not, and the client rendered party messages with `innerHTML` → a party member could run JS in
   another member's browser (account-token theft). Fix: server now runs party text through
   `sanitizeText`; client `appendPartyChatLine` renders with `textContent`/`createElement`, never innerHTML.

Deliverables from that session (downloaded by the user, not in repo):
the playthrough pros/cons review (delivered in Session A, before the app was renamed to Thornreach).

### Session B — skill system, stats panel, and fixes for every review con
Built the class skill system + a character stats panel + gave equipment real stats, then fixed every
con from the review. **All shipped and tested.** Deliverable: `Skill-System-and-Con-Fixes.md`.

---

## The systems added in Session B (architecture)

### Class skill trees  (server.js + client.js + index.html)
- **Data:** `SKILL_CATALOG` (server.js) — 5 classes × 6 skills; each skill `{id,name,icon,desc,effect}`.
  `SKILL_MAX_RANK = 3`. Per-rank magnitudes in `SKILL_STAT_PER_RANK`. Effects: `power` (dmg),
  `guard` (defense), `vitality` (max HP), `haste` (cooldowns), `swift` (speed), `leech` (lifesteal),
  `mending` (out-of-combat regen, skill-only), `forage` (harvest yield), `sage`→`xp`.
- **Storage:** `prog.skills[charId] = { skillId: rank }` in `playerProgress.json`. The point pool
  (`prog.skillPoints`) is account-wide (shared across classes), allocations are per-class.
- **Handlers:** `skill_state` (request), `skill_allocate` (spend 1, validated by charId), `skill_respec`
  (refund the class's points). `skillStatePayload()` sends the tree + points + `statBlock`.
- **Client UI:** `#skillsModal` + `#skillsBtn` (HUD), `K` key, mobile `#menuSkills`. `renderSkills()`.
  `mySkillState`, `mySkillSpeedMult` (movement reads this — the one client-applied effect).

### Equipment stats + character stats panel (the "see my stats / preview swaps" feature)
- Equipment was **purely cosmetic** before. Now `EQUIP_STATS` (server.js) gives every equippable item
  real stat contributions in the SAME vocabulary as skills. Campaign relics are top-tier per slot.
- **Combined getter:** `statContrib(player, key) = skillStatContrib + gearStatContrib`. Every effect
  getter (`outgoingDamageMult`, `incomingDamageMult`, `playerMaxHealth`, `abilityCooldownFor`,
  `skillLifestealFrac`, `skillXpMult`, `skillSpeedMult`, `skillHarvestExtraChance`) reads it.
- **Hooks (where effects actually bite):** damage → `applyDamage` (covers melee + all abilities);
  defense → `absorbIncomingDamage` (PvP + mobs); max HP → all 6 `Math.min(100,…)` health caps were
  changed to `Math.min(playerMaxHealth(p),…)`; cooldowns → both cast handlers; XP → `grantXP`;
  harvest → the `harvest` handler; lifesteal → `applySkillLifesteal` in `applyDamage`; speed → client
  movement loop; regen → `tickPlayerStatusHealth`.
- **`computeStatBlock(player, equipOverride?)`** returns the skill-vs-gear split + finals, and can
  preview a hypothetical swap without mutating the player. Sent in `skill_state.statBlock`; the
  `equipStats` catalog is sent once in `init` so the client previews swaps locally.
- **Client UI:** `#invTabStats` (📊 Stats tab in inventory) → `renderStats()`; equip preview in the
  item action panel → `renderEquipPreview()`. HUD heart shows `hp/maxHp` when maxHP > 100.

### Con fixes (Session B)
- **#4 grind (intentional!):** added **Rested XP** — `REST_MS` 10 min/session at `REST_XP_MULT` 1.5,
  gated by `REST_COOLDOWN_MS` 2h per account (`prog.lastRestedAt`). Does NOT touch campaign/quest XP,
  so the pacing test still passes. Client shows a `#xpStripRested` countdown.
- **#5 pass timer "23h 60m":** `passTimeLeftLabel()` now floors minutes instead of rounding.
- **#6 anti-cheat (targeted):** `ABILITY_MAX_RANGE = 900` passed to `applyDamage` in both ability
  damage branches (was unranged → cross-map sniping); `bank_open` now requires `player.room === 'bank'`.
  (Full movement anti-cheat intentionally NOT added — contradicts the design.)
- **#7 persistence/auth:** `atomicWriteJson()` (temp-file + rename) for all 8 JSON stores;
  login/registration rate-limit `LOGIN_FAIL_LIMIT` 8 / `LOGIN_FAIL_WINDOW_MS` 5 min per IP.
- **#8 onboarding:** first-run `#welcomeModal` (4-step throughline), `tc_welcome_seen` in localStorage,
  hands off to the existing controls modal.
- **#9 Twilio:** corrected the Text-tab credential note (`#twilioTrustNote`) to say creds pass through
  the game server and to recommend a scoped API Key. Server never logs credentials (verified).

---

## Current state / what's on disk

**Modified & delivered to the Mac (all committed-ready):** `server.js`, `public/client.js`,
`public/index.html`, `test/newfeatures.test.js` (2 assertions updated with comments because they
assumed the old "equipment is cosmetic" contract).

**Testing status (all green):** `npm test` 7/7 · `node test/audit-playthrough.cjs` 213/213 ·
skill server test 36/36 · skill UI 60/60 · stats UI 10/10.

**To apply the build:** restart the server (`server.js`) + refresh the browser (client/html).

**Git:** on `main`, remote `origin`. `.env` is gitignored (holds a real `sk_test_` Stripe key — never
commit it). `.env.example` is tracked and currently clean. As of last check there was also an
untracked `test/resume.test.js` (a legit live-resume test).

---

## Getting running in a fresh sandbox (this took real effort — read before redoing)

The Anthropic sandbox **blocks the npm registry** (`registry.npmjs.org` → 403 "host not in allowlist"),
so `npm install` fails. Workarounds used:

1. **node_modules:** the deps (`express`, `ws`, `dotenv`, `stripe` + transitive) were tarred from the
   user's machine (`device_bash` → `tar czf`), staged in, and extracted. Easiest path in a new
   session: stage `node_modules` from the user's `~/Desktop/town-chat/node_modules` via the device
   bridge, or ask them to run `npm install` locally and stage the result.
2. **Three.js:** `public/three.min.js` (r128) is the CDN fallback the client needs when offline. Get it
   via `git clone --depth 1 --branch r128 --filter=blob:none --sparse https://github.com/mrdoob/three.js`
   then `git sparse-checkout set build` → copy `build/three.min.js` into `public/`. (GitHub IS reachable
   through the git proxy; the npm registry and generic CDNs are not.)
3. Then `node server.js` runs. `npm test` works without three.js (mock sockets).

## The QA harness (ephemeral — lived in the cloud `~/harness`, not in the repo)

I drove the real client headlessly with Playwright (`/opt/pw-browsers/chromium`) against the running
server. If you need it again, rebuild these:
- **`qa-server.cjs`** — wraps `server.js` with a mutable day/night clock and an HTTP **side channel on
  :3999**: `/shift-to?min=`, `/offset`, `/grant-xp?name=&xp=`, `/heal?name=`, `/state?name=`, `/mobs`,
  `/night`. (Supports `GAME_PORT`/`SIDE_PORT` env for a 2nd isolated instance.)
- **`lib.cjs`** — `newPlayer()` helper: launches a context, joins (guest or account), dismisses the
  welcome+controls modals, exposes `td()`/`send()`/`go()`/`shot()`/etc. Reads `GAME_PORT`/`SIDE_PORT`.
- The client exposes a test hook at **`?testdrive=1`** → `window.__testDrive` (teleport, me(), send(),
  interiorKiosks(), etc.). Only present with that query param.
- Test scripts written: `play-class.cjs` (full campaign per class), `skills-ui.cjs`, `stats-ui.cjs`,
  `skills-server.test.cjs`, `social.cjs`, `economy.cjs`/`economy2.cjs`, `auction-ws.cjs`, `passflow.cjs`
  (needs `test/stripe-mock-server.cjs` on :3001), `mobile.cjs`, `portraits.cjs`, `xss-probe.cjs`.

**Gotcha:** background `node server.js` sometimes needs the harness's own background-task mechanism to
stay alive; a fresh `?testdrive=1` context has no localStorage, so the first-run welcome modal now
appears and must be dismissed (the `newPlayer` helper already does this).

---

## Caveats & things NOT done (candidate next steps)

- Campaign pacing is deliberately ~2h (test-enforced). If the user wants it shorter, that means
  lowering the level gates / `XP_THRESHOLDS` AND updating the pacing test — a real design change, ask first.
- Persistence is still flat JSON — fine on a real VM, lost on an ephemeral host redeploy (Render free
  tier). A real DB is the long-term fix; not done.
- Anti-cheat is intentionally partial (economy + ability range only); movement stays client-trusted.
- The live Stripe redirect can't be exercised in-sandbox (no outbound to Stripe); it's covered against a
  mock (`test/stripe-mock-server.cjs` + `test/qa-pass-flow.cjs`).
- Skill/stat balance numbers (8% dmg/rank, +12 HP/rank, gear values in `EQUIP_STATS`) are a first pass —
  easy to retune in one place if playtesting says so.

---

---

## Session C — App Store / Play Store packaging

Packaged the game for the iOS and Android stores as **Capacitor** wrappers (two Desktop folders:
`town-chat-ios`, `town-chat-android`), while the `town-chat` web build keeps Stripe for PC. All three
clients connect to ONE shared server (multiplayer = one town).

**Server changes (in town-chat/server.js — shared backend for all clients):**
- `/api/verify-iap` endpoint — validates an Apple StoreKit receipt (legacy verifyReceipt, prod→sandbox
  fallback) or Google Play purchase token (service-account JWT signed with built-in `crypto` →
  Play Developer API), then grants the SAME pass as Stripe via `grantForSession`. **Built-ins only,
  no new npm deps.** Config env: `APPLE_IAP_SHARED_SECRET`, `APPLE_BUNDLE_ID`, `GOOGLE_PLAY_PACKAGE`,
  `GOOGLE_SERVICE_ACCOUNT_JSON`, `IAP_PRODUCT_ID` (default `town_pass_24h`).
- **CORS** on `/api/*` (mobile apps call cross-origin from capacitor://localhost).
- **`DATA_DIR`** env — the 8 JSON stores now live under `process.env.DATA_DIR || __dirname` so a host
  can mount a persistent volume (e.g. `/data`). Default unchanged for local/PC.
- Deploy config added: `Dockerfile`, `fly.toml`, `.dockerignore`, `DEPLOY-SERVER.md` (recommends
  Fly.io / Railway / VPS; NOT serverless or Render-free — needs persistent WS + disk).

**Mobile client (each app's www/ = copy of public/ with 3 diffs — PC public/ untouched):**
- `client.js`: added `SERVER_ORIGIN`/`apiUrl()`/`wsUrl()` (points WS + all `/api` fetches at
  `window.TOWNCHAT_SERVER` from config.js; empty = same-origin for web), and an IAP hook at the top of
  `startPassCheckout()` (`window.TOWNCHAT_IAP.buyPass` overrides Stripe when present).
- `index.html`: loads local `three.min.js` first (offline), then `config.js` + `mobile-payments.js`.
- `config.js` (per platform): sets `TOWNCHAT_SERVER`, `TOWNCHAT_PLATFORM`, `TOWNCHAT_IAP_PRODUCT`,
  (android) `TOWNCHAT_ANDROID_PKG`. **User must fill in TOWNCHAT_SERVER after deploying.**
- `mobile-payments.js`: cordova-plugin-purchase (CdvPurchase v13) → StoreKit/Play Billing → posts
  receipt/token to `/api/verify-iap`. Requires the player to be logged into a game account (pass
  follows the account). ⚠️ receipt-field extraction is the one thing untestable off-device.
- Each folder also has: `capacitor.config.json` (appId `com.thornreach.game`), `package.json`,
  `resources/` (witchy pentacle icon 1024 + splash 2732, generated from `mobile/assets/witch-*.svg` via sharp),
  `BUILD-IOS.md`/`BUILD-ANDROID.md`, `STORE-LISTING.md`, `PRIVACY-POLICY.md`, `README.md`.

**Verified:** the mobile www renders + joins over a cross-origin WebSocket + the IAP hook fires
(headless smoke test). NOT verified (impossible from here): native compile, signing, real IAP.
The native `ios/`/`android/` folders are generated on the user's Mac via `npx cap add`.

**If regenerating the mobile builds:** the icon/splash SVGs + rasterizer are in `~/mobile/assets`
(cloud, ephemeral); the 3 client diffs are described above.

---

*Last updated at the end of Session C. If you add to the project, append a short dated note here so the
next session inherits it.*
