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

### Session D, final round — HUD: hint un-buried + desktop ☰ menu

`public/index.html` + `public/client.js` only (server untouched; mobile `www/` copies drift further).

- **"Press F" hint vs level bar (user-reported):** `#interactHint` sat at `bottom:96px`, `#xpStrip` at
  `bottom:90px` — same center column, same z-index, strip drew on top. Hint moved to `bottom:132px`
  (clears the ~30px strip; `cmPrompt` at 150px is z-30 and urgent, so its rare overlap wins by
  design). touchMode hint position (236px right-side) unaffected. Verified by bounding boxes at
  Ranger Mara's kiosk: hint 627–668, strip 684–710.
- **Desktop ☰ menu (user request — "like the phone version"):** the six left-HUD chips
  (Inventory/Spellbook/Attacks/Journal/Skills/Drive) are retired on ALL platforms (`#leftHudButtons`
  display:none; buttons stay in the DOM — reveal/badge logic still writes to them). New `#pcMenuBtn`
  ("☰ Menu", chip-styled, top:64 left:16, hidden in touchMode) opens the SAME `#menuSheet` as mobile.
  Sheet CSS is now shared: centered card on desktop, classic bottom sheet in touchMode
  (`body.touchMode #menuSheetCard` override); added `:hover` states for mouse. Esc closes the sheet
  (new first-priority branch in the global keydown modal chain — otherwise Esc would "leave
  building" through the open menu). Keyboard shortcuts (I/J/K/H/P…) unchanged.
- **Skills theme bug (user-reported):** `#skillsBtn` was never in the chip style selector group
  (Session B oversight) — added, with a gold border tint, though the chips are now hidden anyway.
- **Skill-point badge:** `updateSkillsBadge()` now mirrors the unspent count onto `#pcMenuBadge`
  (on the ☰ chip) and `#menuSkillsBadge` (on the sheet's 🌟 Skills row, both platforms).
- Verified: Playwright 19/19 (chip row gone, sheet opens/centers, menu→Skills/Inventory work, Esc
  closes sheet, hint/strip boxes disjoint, mobile sheet + ☰ unchanged and bottom-anchored, no JS
  errors both platforms) + `npm test` 7/7.
- Harness note: old QA scripts that clicked `#skillsBtn`/`#inventoryBtn` directly will need to go
  through the ☰ menu (`#pcMenuBtn` → `#menuSkills` etc.) or call the open functions.

---

## ⏱️ SESSION D WRAP-UP — PICK UP HERE
**Written Friday, July 10, 2026 at 11:37 PM EDT (2026-07-11 03:37 UTC), end of Session D.
Addendum 11:58 PM EDT — read the ⚠️ below FIRST.**

**⚠️ RESOLVED (Session E, ~12:15 AM):** the revert turned out to hit `public/index.html`,
`public/client.js`, and `HANDOFF.md` (all back to pre-Session-D bytes) while `server.js` survived —
consistent with a partial `git restore`/checkout or an editor stale-buffer save; exact cause unknown
(ask Michael what ran at ~11:56 PM if it happens again). All three were restored from the cloud
workspace copies and re-committed to the folder. Lesson recorded: `device_list_dir` byte sizes can
be STALE/wrong on this Mac (iCloud Desktop sync suspected) — always verify by staging content, never
trust listing sizes alone.

**Everything shipped this session, in order:** (1) `town-chat-desktop` — online-only Electron
installer project, delivered as a zip in the conversation (NOT in this repo; Michael unzips to
`~/Desktop/town-chat-desktop`, then `npm install` + `npm run dist:mac|win|linux` per its
BUILD-DESKTOP.md). (2) Witchy THORNREACH join screen + passcode field hidden unless the town is
warded. (3) Welcome modal + mobile menu renamed Lanternside Bay/Town Chat → Thornreach; welcome
step 2 platform-aware (mobile says "tap the glowing prompt"). (4) Wilds night mobs ×3 (8→24).
(5) Returning-player character select (roster cards via new `POST /api/characters` + `prog.characters`
/`prog.lastCharId`). (6) "Press F" hint un-buried from the XP strip; PC HUD chips replaced by the
mobile-style ☰ menu (`#pcMenuBtn` → shared `#menuSheet`); skills-button theme bug fixed. Full
details in the Session D sections above. All tested: latest `npm test` 7/7, audit-playthrough clean,
Playwright suites 13/13 + 14/14 + 19/19.

**State of the folder:** `server.js`, `public/index.html`, `public/client.js`, `HANDOFF.md` all
current on disk with everything above. Git: Michael was given `git add … && git commit && git push`
commands after each round — **next session, run `git status` first** to see what he actually pushed;
anything still dirty is safe to commit as one batch. Render auto-deploys from `main` (assumed).

**Open threads, highest value first:**
1. **Deployed-server URL still unknown.** Michael thinks it's his Render site; never provided the
   `….onrender.com` URL. When he supplies it: bake it into `town-chat-desktop/main.js` →
   `DEFAULT_SERVER_URL` (currently `''`, so the launcher asks). Also confirm his Render plan —
   free tier cold-starts and wipes the flat-JSON saves on redeploy (see DEPLOY-SERVER.md; Fly/Railway
   configs are ready in this folder if he wants to migrate).
2. **Desktop app first build** — needs him to unzip + `npm install` + `npm start` on his Mac; icon
   currently a generated pentacle; offer stands to reuse the exact mobile icon if he connects the
   `town-chat-ios` folder (`resources/icon-1024.png`).
3. **Mobile `www/` re-sync** — `town-chat-ios`/`town-chat-android` still carry the pre-Session-D
   client. At next app rebuild: copy `public/index.html` + `public/client.js` over each `www/`,
   re-apply the 3 mobile diffs (config.js + mobile-payments.js script tags, local three.min.js,
   `SERVER_ORIGIN` plumbing — see Session C notes), then `npx cap sync`.
4. **QA harness scripts** that clicked `#skillsBtn`/`#inventoryBtn` chips must now go through
   `#pcMenuBtn` → `#menuSkills`/`#menuInventory` (chips are display:none everywhere).
5. Housekeeping: `_to_delete/` (incl. the node_modules.tgz transfer tarball) is safe to trash.

**Sandbox recipe (worked all session):** npm registry blocked → stage `node_modules` via
`device_bash` tar into `_to_delete/` + `device_stage_files`; three.min.js r128 via sparse git clone
(github reachable); Playwright at `/opt/pw-browsers/chromium` with
`NODE_PATH=/home/claude/.npm-global/lib/node_modules`; kill test servers with
`pkill -f "node server.js"` (env-var patterns never match); join-screen test hook: `?testdrive=1`.

---

## Session E (2026-07-11, ~12:00–12:45 AM EDT, same conversation) — the witchy round

`public/index.html` + `public/client.js` (server untouched; mobile `www/` drift grows). Also
re-delivered `thornreach-desktop.zip` (launcher star fix baked in).

1. **Revert recovery** — see the resolved ⚠️ in the wrap-up above.
2. **Perfect pentagram** (user request): the join-screen/launcher sigil's hand-plotted star path was
   lopsided (bottom legs pinched). Replaced with exact 72° geometry, tips on the r=44 ring:
   `M50 6 L75.86 85.6 L8.15 36.4 L91.85 36.4 L24.14 85.6 Z` (order 0→2→4→1→3). Playwright verifies
   all 5 vertices are within 0.004 of the ring. Desktop `build/icon.png` was already correct
   (generated with real trig) — only the two inline SVGs were wrong.
3. **Every interior is now witchy** (user request — "like the two paid buildings and the cave").
   All via the existing `INTERIOR_THEMES` override machinery + four NEW `lightsStyle`s in
   `getInteriorScene()`; every kiosk/NPC/seat keeps its exact position & id, dressing only:
   - **cafe → "The Cauldron Café"** — ember amber; `lantern` style (chained witch-lanterns);
     bubbling green cauldron by the bar, herb bundles on the beams, pumpkin stack, witchy paintings.
   - **library → "The Midnight Archive"** — violet/indigo; `candle` style (floating candle
     clusters); rune ring floor decal, four hovering books, crystal ball on the reading table.
   - **hall → "The Coven Court"** — crimson/gold; `brazier` style (iron tripod braziers); great
     pentacle floor inlay under the council table ringed by 13 candles (3 lit, as tradition demands).
   - **bank → "The Gilded Vault"** — gold/verdigris; `vaultlamp` style (gilded candelabras,
     pale-green flames); "The Auditor" raven on a marble perch; paintings retitled.
   Arcade/Parlor/cave untouched. Palette spread: cave purple · arcade starlight · parlor ghost-green
   · café ember · archive violet · court crimson · vault gold.
4. **Witchy daylight** (user request): `SKY_DAY` 0x8fd0ef → **0x9b93c9** (mauve), `AMBIENT_DAY` →
   0xe6dcf5, sun tinted amber (0xffe2b8). Trees darkened bluish-green with every ~5th a plum
   **thornwood** (deterministic from position — same forest for every client). Shrubs darkened.
   Six **fairy rings** of red-cap mushrooms added outdoors (client-only, walk-through, no
   colliders), the one at (2450, 820) fae-touched with a violet glow. Night palette untouched.
5. Verified: witchy suite 12/12 (pentagram radii, forced-day outdoor render, all four interiors
   entered + NPC hint proximity, zero JS errors) + `npm test` 7/7.
   **Testing gotchas learned:** indoor player coords are WORLD-anchored (building corner + local),
   NOT render-space — use `interiorKiosks()[].world` for teleports; the client day/night clock is
   plain `Date.now() % CYCLE_MS` (40-min cycle), so `addInitScript` shifting `Date.now` forces the
   phase for screenshots.

6. **Item audit (all 83 items)** — every ITEM_CATALOG + PLANT_CATALOG entry checked for unique
   icon / witchy description / theme fit (deliverable: `item-audit.md` in the chat). Fixed: 11 icon
   collisions (24 items) → all 83 icons unique (map in the report; both server & client catalogs
   changed in sync — a scripted checker verified ids/names/icons match and desc coverage is 100%);
   18 missing descs added; ~30 bland descs rewritten witchy; **bug: the five Wildlands quest-reward
   items (lumber_bundle/stone_block/iron_ingot/druid_stone/hollow_shard) existed only server-side —
   the client couldn't render them; now added client-side.** NO names/ids/stats/effects changed
   (quest text references names). Reported-not-changed misfits for Michael to decide: Hard Drive 💽
   (feature-wide rename candidate: "Whisper Box"), Wizard Hat (→ Crooked Hat?), the generic starter
   six, chalice/helm icon compromises, and a caution that some new icons are recent Unicode
   (🫙🩻🪢🦬🌠🥷) — verify on older phones.

7. **"Leave the town" (log out to start screen)** — new `#menuLogout` row in the shared ☰ sheet
   (both platforms). Two-tap confirm (arms for 3s, turns red "⚠️ Tap again to leave"), then clears
   `tc_live_resume`/`tc_resume` from sessionStorage (else the fresh page would silently resume
   straight back into town), closes the WS, and `location.reload()`s — the one guaranteed-clean way
   back to the join screen in a join-once-per-page client. `tc_account` survives, so returning
   players land on their character roster. Verified 8/8 (arm ≠ leave, leave lands on join screen, no
   auto-resume, stash cleared).
8. **Portal-plaza declutter (user report)** — `decor_46` (lamppost), `decor_57` (noticeboard) and
   `decor_58` (bench) sat stacked in a ~110-unit patch right behind the Wilds portal (1600,700).
   Spread in `WORLD.natureDecor` (server.js): lamppost → (1720,540), noticeboard → (1480,430) beside
   Town Hall's door, bench → (1795,760) rot −0.5 by the flower patch. All ≥200 from the portal;
   spots verified clear of other decor (≥90) by script. NOTE: `test/gen-scenery.cjs` regenerates
   this array — if it's ever re-run, re-apply these three positions (comment left in the array).

Open next: Michael's Render URL for the desktop app; mobile www re-sync; the git push of Sessions
D+E (one batch: `git add server.js public/index.html public/client.js HANDOFF.md`); his verdict on
the item-name misfits above.

---

## Session F (2026-07-11, morning) — THE FULL TIER-3 UPGRADE (KayKit assets + lighting overhaul)

The "tier 3" plan from a lost conversation turned out to be: **swap the procedural look for KayKit
asset packs** (Kay Lousberg, kaylousberg.com — the "cute" style Michael remembered; all CC0) plus a
full lighting/post-processing overhaul. Michael confirmed the KayKit lineup render before the swap.
Everything below is CLIENT-ONLY — `server.js` untouched this session.

### What shipped
1. **KayKit characters replace the procedural humanoids** (players AND town/wilds/interior NPCs):
   Witch→Mage, Werewolf→Barbarian, Mystic→Rogue_Hooded, Knight→Knight, Wanderer→Rogue
   (`public/kk/*.glb`, ~3.6MB each, fully rigged). Real skeletal animation via AnimationMixer:
   Idle / Walking_A / Running_A (speed-scaled), class-flavored attack one-shots mapped from the old
   `attackAnimType` contract ('slash'/'cast'/'punch' → KayKit clips in `kkAttackClip()`),
   Sit_Chair_Idle when seated, Sit_Floor_Idle for meditate, Death_A on death. NPC updaters drive
   Walking/Interact/Sit_Floor_Idle (torchkeepers pray). Static interior NPCs idle-breathe via the
   central `KK.tick()` (all mixers tick there; player visuals' mixers removed on destroy).
2. **KayKit buildings replace the six box shells** (`public/kk/bld/`, Medieval Hexagon Pack scaled
   up ~4x — looks great): cafe→tavern_red, library→church_blue, arcade→home_B_yellow,
   lounge→tower_A_green, hall→castle_red, bank→blacksmith_yellow. Collision unchanged (same
   footprint rects); model rotated so its baked door faces `getDoorSide(b)`; the old door SLAB is
   invisible on KayKit buildings (model has its own) but stays registered in `lockVisuals` so
   lock-state signs still work. Name/lock signs float above the model height (`userData.kkHeight`).
3. **KayKit props via PROP_BUILDERS** (same server decor positions & colliders): bench→
   bench_decorated, lamppost→post_lantern (LAMP_GLOWS contract preserved with two sprites),
   well→building_well_blue, fence→Halloween fence. Crate/barrel/haybale/stump/log/noticeboard/stall
   stay procedural.
4. **Set dressing (client-only, walk-through, fairy-ring precedent)**: jack-o'-lantern pairs at
   every building door, a fenced graveyard + crypt behind the Town Hall, a candle shrine at the
   fae-touched fairy ring; Wilds gets a crooked arch gate at the portal approach, 8 scattered dead
   trees, grave markers near the ritual circle (`kkTownDressing`/`kkWildsDressing`).
5. **GFX module (lighting/post/quality)** — the `GFX` IIFE near `initScene`:
   - PCFSoft shadow maps: the shared outdoor sun/moon cast (they migrate town↔wilds; `.target`s +
     sky group added to the swap lists); the shadow box follows the player (`GFX.beforeRender`);
     static scenes get a one-time fitted box. Meshes are auto-tagged per scene by an incremental
     children scan (transparent/additive/Basic materials and flat ground planes don't cast).
   - Post chain (medium/high): RenderPass → UnrealBloom (strength breathes 0.34→0.76 with night) →
     grade (saturation 1.07 + vignette) → FXAA. **Color pipeline stays LINEAR + NoToneMapping — the
     authored palette survives untouched** (ACES/sRGB was tried and washed everything; don't redo it).
   - Ambience: two twinkling star layers + drifting clouds + moon halo (one sky group riding the
     camera, migrates with the lights); firefly clusters (fairy rings/portal/plaza + 5 Wilds spots)
     fade in at night.
   - **Quality tiers** via ☰ menu row `#menuGraphics` ("✨ Graphics"): Auto(→High desktop / Medium
     touch) / Low / Medium / High, persisted `tc_gfx`, URL override `?gfx=low|medium|high|auto` for
     QA. Low = classic pipeline (no shadows/composer). Switching re-configures shadow maps + sweeps
     `material.needsUpdate`.
6. **Asset pipeline**: `KK` module (top of client.js) preloads everything from `/kk` at page load;
   the join button waits for it (max 12s, "Summoning…") then proceeds; **every KayKit piece falls
   back to the classic procedural builder if its file fails**, so a broken asset can never brick the
   town. `presetOverride` callers (Ember Wastes humanoid mobs) intentionally keep the classic builder.
7. **Equipment on KayKit rigs**: weapon/ring/boots parent to skeleton bones (`handslotr/l`,
   `footl/r`) via scale-compensating wrappers (`_equipParent`); equipping a weapon hides the class's
   embedded KayKit hand-prop (staff/sword/knife) and restores it on unequip; hats ride the `head`
   bone; the chest overlay is SKIPPED on KayKit models (looks wrong on chibi bodies — stats
   unaffected). Embedded prop meshes are curated per class in `KK.KEEP`.
8. New first-party files (all must be committed): `public/fx.js` (r128 post-processing bundle, MIT),
   `public/GLTFLoader.js`, `public/SkeletonUtils.js` (r128 examples), `public/three.min.js` (r128 —
   now self-hosted fallback actually exists in the repo), `public/kk/**` (~19MB, 40 files, CC0 —
   license headers in the packs; credit Kay Lousberg somewhere visible if you like, not mandatory).

### Verified (all in-sandbox, headless)
`npm test` 7/7 · `audit-playthrough` clean · zero page errors across: day/night town, night Wilds,
cafe interior, two players mutually visible with walk anims, mobile 390×844 touch UI (auto-Medium),
`?gfx=low`. Shadows/stars/fireflies/lamp glows confirmed in screenshots (delivered in chat).

### Known gaps / next session
- **Mobile `www/` re-sync is now REQUIRED before any app rebuild** — index.html/client.js changed
  AND the new files (fx.js, loaders, kk/) must be copied into both apps' `www/` (plus the 3 mobile
  diffs from Session C).
- Not visually spot-checked (code-only): death anim on a real kill, equip-attach look on live bones,
  interior kiosk NPC poses in every room. Cosmetic-only risk; check on the live site.
- Interiors have no shadow-casting light (ambient+points by design) — optional polish: one soft
  directional per interior.
- Plaza torch flames follow the SERVER clock, so forced-night client screenshots can show them
  unlit — not a bug.
- Headless FPS is SwiftShader (~4fps, meaningless). Real-GPU perf unmeasured; the scene is light,
  but if a weak laptop stutters, Low tier restores the old pipeline.
- The old `#skillsBtn` chips etc. remain hidden (Session D); harness `lib.cjs` gained a `gfx` opt.
- Sandbox gotchas added this session: the Bash tool's default 2-min timeout kills long Playwright
  runs (pass a longer tool timeout); `~` in the shell is /root while file tools write /home/claude
  (symlinked now); SwiftShader makes joins take 30-60s each.

### Session F, later — stair fix + self-aligning buildings + bank rebuild (user-reported)

Michael hit two things on the live build: players clipped through the KayKit buildings' entrance
stairs, and the bank (blacksmith model) "looks like an anvil, not a door". Fixes, all client-only:

- **Stair ramps:** `kkMeasureStairs()` raycasts each placed building model at build time and records
  the real stair height profile outside the door; the `outside` branch of `getFloorHeight()` now
  walks players AND NPCs up that profile (same mechanism as the Temple ramp). No colliders changed.
- **Self-aligning models (`kkAutoAlign`)**: the models' baked door faces vary per model (tavern's
  door faces +X natively, etc.). Instead of hand-tuned per-model rotations, each building now tries
  all four rotations at build time, raycasts for stoop/step mass at the game's door gap, keeps the
  best rotation, then slides the model along the wall so the detected steps center on the doorway.
  Verified: all six doors sit dead-center on their paths.
- **Bank model swap:** blacksmith → **gold church** (`building_church_yellow`) — big centered arched
  door + steps, reads "institution". The blacksmith files were dropped from `public/kk/bld/`
  (`git rm` any previously-committed `building_blacksmith_*` if git flags them); `building_church_yellow.*`
  added. If Michael ever prefers a commerce look, `building_market_yellow` (open stall front) was
  tested and works — one manifest line.
- Door-flanking pumpkins moved outward (off the stairs, beside them).
- Re-verified: `npm test` 7/7 · all six door approaches + bank walk-in · zero page errors.

---

*Last updated Saturday, July 11, 2026, morning — end of Session F (the full tier-3 upgrade). If you
add to the project, append a short dated note here so the next session inherits it.*
