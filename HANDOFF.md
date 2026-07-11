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

## Session D (2026-07-11) — Desktop app (installable Mac/Windows/Linux game)

Built **`town-chat-desktop`** (delivered as a zip; unzip to Desktop alongside `town-chat-ios`/`-android`):
an **online-only Electron wrapper** — a hardened shell that connects to the deployed shared server, so
desktop players are in the SAME town as web/mobile. **No game code is bundled**: the window loads the live
client from the server, so redeploying the server updates every installed desktop player automatically.
The app only needs rebuilding for shell changes (launcher/icon/window behavior).

- `main.js` — launcher window (has the preload API) + game window (sandboxed, NO preload/Node;
  `window.open` → system browser; camera/fullscreen/pointerLock permitted for the selfie shop etc.).
  Auto-connects straight into town when a server address is known (baked `DEFAULT_SERVER_URL` or one the
  player saved); **Cmd/Ctrl+L** returns to the launcher to change servers. Stripe checkout is untouched —
  same in-window redirect on the server's own origin as a browser tab.
- `launcher.html` — one-card launcher (enter/remember the town address), styled to the game palette
  (forest bg, #9ee37d→#5ee7c0→#7ad9ff gradient), pentacle sigil.
- `package.json` — electron ^41 + electron-builder ^26 (versions verified current July 2026). Targets:
  mac dmg **universal** (unsigned, `identity: null`), win **nsis x64**, linux **AppImage x64**.
  appId `com.thornreach.game` (matches mobile). Icon `build/icon.png` = generated 1024px mint pentacle.
- `BUILD-DESKTOP.md` — exact Mac commands (`npm install`, `npm run dist:mac|win|linux`), Gatekeeper/
  SmartScreen notes for unsigned builds, and the proper signing/notarization path for later.
- **Verified in-sandbox:** launcher renders clean under Playwright (no JS errors, empty-URL guard, IPC
  wiring via stub). Electron itself can't run here (npm registry blocked) — `npm start` on the Mac is the
  real first run. Also verified along the way: the client's local `three.min.js` fallback works offline
  (r128 fetched via git sparse checkout; a copy exists only in the cloud sandbox, NOT added to the repo).

Decisions this session:
- **Online-only at Michael's request** (mid-session change): a full "Host a local town" mode — bundled
  `server.js` forked via Electron `utilityProcess` + an env-gated `FREE_TOWN_PASS` flag in server.js
  (single choke point `hasTownPass()`, plus `lockedRooms: []` in `/api/config` + init) — was built AND
  smoke-tested (10/10, boot + guest join + unlocked rooms), then **removed**: he doesn't want localhost
  towns with free passes. **`server.js` on the Mac was NOT modified this session** (the flag existed only
  in the sandbox copy). If local/LAN hosting is ever wanted again, this design works and npm test stayed
  7/7 with it.
- **Server status is unconfirmed:** Michael believes the deployed server is his **Render** site (URL not
  yet provided; check his browser history for `….onrender.com`). `fly.toml` still has the placeholder app
  name, so Fly was likely never used. ⚠️ DEPLOY-SERVER.md warns Render's FREE tier cold-starts and loses
  the flat-JSON saves on redeploy — worth confirming his plan and migrating per DEPLOY-SERVER.md if it's
  free tier. `DEFAULT_SERVER_URL` in `main.js` is `''` — bake his URL in when known (players can also type
  it once in the launcher; it's remembered).
- Housekeeping: `_to_delete/node_modules.tgz` in the town-chat folder is a leftover transfer tarball from
  this session (device_bash can't delete files) — safe to trash with the rest of `_to_delete/`.

### Session D, later — witchy join-screen redesign + passcode field removal

`public/index.html` + `public/client.js` updated (**web build only** — the mobile apps' `www/` copies
still carry the OLD join screen; re-sync those two files next time the apps are rebuilt).

- New Thornreach front door: opaque night scene behind the card (`#jsNight`: vw/vh box-shadow
  starfields, waning-crescent moon, drifting fog blobs, rising embers, pine-silhouette SVG), violet
  card with pentacle sigil, class names under the five `charOption` talismans, button text
  "ENTER THE TOWN", `<title>` renamed Town Chat → Thornreach. Title font is *Cinzel Decorative* via a
  Google Fonts `<link>` with Georgia/serif fallback (the sandbox blocks the font CDN, so sandbox
  screenshots show the fallback — the live site gets the engraved face).
- **All element ids kept** (`nameInput`/`joinBtn`/`.charOption[data-char]`/tabs/account fields) — the
  QA-harness contract is intact, and `showResumeUi` still finds `.card`. New CSS is strictly scoped
  under `#joinScreen` (plus `#jsNight` + `js*` keyframes), inserted right after the `.charOption`
  rules; the shared `.overlay/.card/.title/.btn` used by in-game modals are untouched. A
  `prefers-reduced-motion` block stops the ambience animations.
- **Passcode field is no longer always-visible** (this was the user request): `#passInput` now sits
  inside hidden `#passRow`. `client.js`'s `join_error` handler reveals the row when a server refuses
  with a /passcode/i message (i.e. `TOWN_PASSWORD` towns), swaps in a friendlier "This town is
  warded…" line, and focuses the input; retry with the right passcode then joins. Open towns never
  see the field. **Zero server changes.**
- Verified: Playwright 13/13 (open-town guest join with picked class, class-select toggle, account
  tab, 390px mobile fit, warded-town reveal → successful passcode join), `npm test` 7/7.
- Also renamed the two remaining player-visible old-name strings in `index.html`: the first-run
  welcome modal ("Welcome to Lanternside Bay" → "Welcome to Thornreach", subtitle now "edge of the
  Wilds") and the mobile ☰ menu header ("Town Chat" → "Thornreach"). Verified in a live join.
- Welcome modal step 2 is now platform-aware (same `MOBILE_UI` pattern as the controls modal):
  desktop says "press **F** at the townsfolk", touch says "walk up to a townsperson and **tap the
  glowing prompt that pops up**". Spans `#welcomeQuestDesktop`/`#welcomeQuestMobile` toggled in
  `openWelcomeModal()` (client.js). Verified on both viewports.
- To see it live: restart the local server / redeploy (the deployed host serves `public/` as-is).

### Session D, later still — 3× Wilds mobs + returning-player character select

**`server.js` changed for the first time this session** (plus `public/index.html` + `public/client.js`;
mobile `www/` copies drift further — re-sync at next app rebuild). The FREE_TOWN_PASS prototype was
fully reverted from the working copy BEFORE these edits (verified byte-identical to the Mac's server.js
first), so the only server deltas are the two features below.

- **Wilds density:** `MOB2_SPAWNS` went 8 → 24 points (6 each of shade_stalker / bog_brute /
  night_howler / will_o_wisp) — the user found the 10k×10k Wilds "sparse at night". New points sit on
  the same 1000×1000 design grid (scaled by `WILDS_SCALE`), spread to corners/midfield, all clear of
  the portal landing at (500,880). Verified over the wire: `wildlife_state.mobs2.length === 24`.
  Note: `wildlife_state` broadcasts every 150ms to everyone, so +16 mobs ≈ +2KB/tick — fine at this
  scale. Respawn/aggro/loot all reuse the per-mob fields; no other logic touched.
- **Character roster ("continue as …"):** accounts now remember what they played.
  - Server: join handler records `prog.characters[charId] = {firstPlayedAt, lastPlayedAt}` +
    `prog.lastCharId` for account joins (guests untouched). New `POST /api/characters` {token} →
    {username, color, level, lastCharId, characters:[{charId, lastPlayedAt, chapter}]} sorted
    newest-first; stale token → 401 (sessions are in-memory and die on restart — the 401 makes the
    client fall back to the login form instead of silently guesting).
  - Client: `#charRoster` in the Account tab — witchy "continue as" cards (mini avatar, "Name the
    Class", shared account Level, per-class campaign Chapter, LAST PLAYED tag), auto-shown when a
    saved login exists (roster fetch on load / after login+register). Card click selects that class;
    "＋ New character" flips back to the classic picker (label swaps to "choose a calling for your new
    character"); logged-in state hides the username/password form (log out brings it back). Guests and
    characterless accounts see the classic picker unchanged. NOTE: level/XP/skill points are SHARED
    per account (per-class: campaign + skill allocations) — cards show the shared level by design.
  - Join payload/protocol unchanged — "continue" is just joining with that charId.
- Verified: Playwright 14/14 roster flows (fresh visit, register, play, re-login roster, last-played
  tag, continue-as rejoin, new-character toggle, saved-token auto-roster) + wire mob count 24 +
  `npm test` 7/7 + `audit-playthrough` completability clean.
- Sandbox gotcha for future sessions: `pkill -f "DATA_DIR=..."` never matches (env vars aren't in the
  cmdline) — kill test servers with `pkill -f "node server.js"`.

---

*Last updated at the end of Session D. If you add to the project, append a short dated note here so the
next session inherits it.*
