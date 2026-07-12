# Session L — every con from the top-10 review, answered

**Sunday, July 12, 2026 · the "fix every con you possibly can" round.**
Source: `thornreach-vs-top10.html` (Session K). Scope confirmed with Michael: all core fixes
**plus** all four extras (SQLite layer, Resident Pass, web push, Blood Moon).

**Verification: `npm test` 12/12 suites (102 new server checks) · audit-playthrough 213/213 ·
34/34 live browser UI sweep · 9/9 app-shell smoke per app · zero page errors anywhere.**

---

## The scorecard the review gave us, and what changed

| Review finding | What now exists |
|---|---|
| **Depth 5/10** — "~2h × 5 campaigns vs 30–1,000h. Don't out-author — out-rotate." | **The Weekly Delve**: a seeded roguelike mode that reshuffles every Monday (2 twist-rules/week from a deck of 8), built entirely from existing dungeons — clear a floor, draft 1-of-3 boons, descend; every 3rd floor wakes a boss. Infinite content, ~zero new art. Plus 4 **named dungeons** with lore plaques and signature bosses. |
| **Hooks 5.5/10** — "no events, seasons, push, or guilds yet… give the streaks a board in the town square and a phone notification when the moon rises." | **The Town Board** (physical kiosk + weekly hunt/boss/delve/tournament boards, top-3 paid in gold, permanent honors shelf) · **login streaks** with escalating purses · the **while-you-were-gone letter** · **a real calendar**: Peddler Monday + Weekend Hunt Tournament (Fri 18:00→Sun 24:00 UTC) + monthly Hearthmoon Festival (+25% XP) + the **Blood Moon** every 13th night (red sky, harder mobs, +50% XP, shard drops → craftable circlet) · **actual Web Push**: "🌕 The moon rises over Thornreach" on your phone's browser, rate-limited to ~1/day, offline players only. |
| **No social groups** | **Covens** — up to 8 accounts: private chat channel, shared 12-slot bank tab + gold (used at the Gilded Vault, with a deed log), leader/kick/invite flows, and a claimable table at the Cauldron Café that wears your sigil for 24h. |
| **Backend durability** — "JSON files on an ephemeral host is friends-scale; a store launch needs a real database." | **One embedded SQLite database** (`thornreach.db`) via Node's built-in driver — zero new dependencies, transactional writes, auto-migrates every existing JSON save on first boot, exports plain-text `.json.bak` backups every 15 min. Node <22 or `PERSIST_FORCE_JSON=1` falls back to the old files transparently. Dockerfile bumped to node:22. |
| **Dungeons unnamed & invisible in the store listing** | T1–T4 are now **The Rootcellar, The Weeping Crypts, The Howling Forge, The Starless Deep** — entry toasts, location pill, lore plaques at the door, and bosses: Old Gnawbone the Rat King, Widow Silk, Cindermaw, The Pale Sovereign. STORE-LISTING.md rewritten dungeon-first. |
| **Co-op bosses** — "party-scaled dungeon bosses make your parties matter" | Bosses grow **+60% health per extra player in the room** the moment they engage (kite-proof: a ranged opener counts), and a kill pays every living party member 60% of the XP. Applies in the named dungeons and delve boss floors. |
| **Mobile UX 7/10 — "no controller"** | **Gamepad support**: left stick uses the same camera-relative steering as the touch joystick, right stick orbits, A interact / X strike / bumpers cast / Start menu. Works on desktop + web. |
| **Onboarding** — "a visible win inside the first 20 minutes" | **First Steps**: three tiny tracked goals (talk / harvest / fell one creature), each celebrated the moment it lands, 25 gold at the end, retired forever once done. |
| **Monetization** — "$4.99/30-day resident pass… the single best-liked IAP shape in mobile" | **The Resident Pass** — $4.99 / 30 days, same two venues (nothing new gated, ever), sold beside the day pass on web (Stripe) and wired for both app stores (`town_pass_30d`). |
| **Discoverability** — "the store-page story the top 10 can't tell" | Join screen now says it out loud: **"No gacha · No energy · Nothing pay-to-win — ever."** STORE-LISTING.md rewritten (subtitle: *"Dungeons with friends. No gacha — ever."*), with a dungeon-led screenshot shot-list and a 15-second "URL to playing" clip storyboard. |

## Two real bugs found and fixed along the way

1. **Stale-move room flips (pre-existing, latent).** A movement packet already in flight when the
   server teleports you (dungeon token, portals — and now delve entry) still carried your OLD
   room, and applying it yanked you back out server-side: you'd stand in the dungeon unable to
   hit anything, invisible to its mobs. Every server-initiated teleport now locks the room
   against disagreeing packets, and dungeon rooms are fully move-authoritative.
2. **The Android app couldn't sell Moonstones.** `town-chat-android/www/mobile-payments.js` was
   still the old single-product version from Session C. Both apps now ship the canonical
   payments module (day pass + Resident Pass + all three Moonstone packs).

## What's on your side of the counter

1. **Push the repo** (one batch — the new client requires the new server):
   `cd ~/Desktop/town-chat && git add server.js public/client.js public/index.html public/sw.js Dockerfile DEPLOY-SERVER.md HANDOFF.md SESSION-L-REPORT.md test/sessionl.test.js test/persistence.test.js test/newfeatures.test.js && git commit -m "Session L: competitive-review build-out" && git push`
2. **Store consoles, when convenient:** create `town_pass_30d` ($4.99 consumable) in App Store
   Connect + Play Console — alongside the three Moonstone products still queued from Session I.
   The app folders' `www/` are already current; next ship needs the usual `npx cap sync` + bump.
3. **Render:** make sure a persistent disk is mounted at `DATA_DIR` (see DEPLOY-SERVER.md).
   SQLite makes saves crash-proof; only the disk itself keeps them redeploy-proof.

## What was deliberately left alone

The ~2-hour campaign pacing (the review's own advice: out-rotate, don't out-author — the Delve
is that answer), movement anti-cheat (a design choice), native FCM/APNs push for the store apps
(no transport in Capacitor builds without new plugins — the in-game toggle says so honestly),
and a month-long Leagues-style parallel town (the Blood Moon calendar beat is the right-sized
version; a full Leagues season would be its own project).
