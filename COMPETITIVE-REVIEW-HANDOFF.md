# Thornreach — Competitive Review Handoff

**Session date:** Sunday, July 12, 2026 (afternoon) · **Owner:** Michael (mhanavan4)
**What was asked:** find the top ten mobile dungeon & quest games and review/compare them to Thornreach, across gameplay & content depth, monetization & pricing, retention & progression, and mobile UX & onboarding. "Top ten" = blend of commercial scale and quality. Deliverable: interactive HTML report.

**No code was touched this session** — research and deliverables only.

---

## Where everything lives (durable copies)

1. **Cowork artifact gallery → "thornreach-vs-top10"** — the interactive dashboard, reopenable from the Claude desktop sidebar any time, in any session.
2. **`~/Desktop/town-chat/thornreach-vs-top10.html`** — the same dashboard as a self-contained file; opens in any browser, no internet needed. (Untracked by git; move or delete freely.)
3. **`~/Desktop/town-chat/COMPETITIVE-REVIEW-HANDOFF.md`** — this file.
4. A short dated note was appended to `HANDOFF.md` (Session K) so future Claude sessions inherit the context.

The cloud session workspace itself is ephemeral — don't rely on it; the three files above are the record.

---

## The Top 10 (July 2026, all verified live)

| # | Game | One-liner | Key number |
|---|------|-----------|------------|
| 1 | Genshin Impact (HoYoverse, 2020) | Open-world quest ARPG; Luna era, permanent Moon region | $335M mobile IAP 2025 |
| 2 | Dungeon & Fighter Mobile (Nexon/Tencent, 2022/24) | Manual belt-scroll dungeon crawler with real town-hub chat culture; CN/KR only | ~$2.5B in first 7 months (CN) |
| 3 | Honkai: Star Rail (HoYoverse, 2023) | Turn-based quest RPG; best roguelike dungeon mode; zero multiplayer | $423M mobile 2025 |
| 4 | Solo Leveling: Arise (Netmarble, 2024) | The dungeon-gate action fantasy; all instanced, all solo | 50M players / $139M in 6 months |
| 5 | RAID: Shadow Legends (Plarium, 2019) | Dungeon-farming squad RPG; record revenue, most-resented monetization | $1B+ lifetime; Metacritic user 2.3 |
| 6 | Archero 2 (Habby, 2025) | One-thumb roguelite dungeon runs; monetization-efficiency king | ~$27M/month, >$11 per download |
| 7 | Summoners War (Com2uS, 2014) | 12 years of rune-dungeon farming + a real esport; first-ever pity added Apr 2026 | $3B+ lifetime |
| 8 | Diablo Immortal (Blizzard/NetEase, 2022) | Production ceiling + ethics floor; Westmarch hub, 8p raids, Warlock class Jun 2026 | ~$404M lifetime mobile (est.) |
| 9 | AFK Journey (Lilith/Farlight, 2024) | Idle squad RPG with roguelike labyrinth; dual platform GOTY 2024 | $185M+ lifetime |
| 10 | Old School RuneScape (Jagex, mobile 2018) | 180 handcrafted quests, no MTX, record 2025–26 popularity | 240,851 record concurrents |

Runners-up: Torchlight: Infinite, Wuthering Waves, Soul Knight Prequel, Shattered Pixel Dungeon, Capybara Go!

## Scores (editorial, 1–10, consistent rubric — full rationale in the dashboard)

| Game | Depth | Fairness | Hooks | Mobile UX | Overall |
|------|-------|----------|-------|-----------|---------|
| Old School RuneScape | 10 | 9 | 9.5 | 6 | **8.6** |
| Genshin Impact | 10 | 6 | 9 | 7 | **8.0** |
| Honkai: Star Rail | 8.5 | 6.5 | 8.5 | 8 | **7.9** |
| AFK Journey | 7.5 | 5 | 8.5 | 9 | **7.5** |
| DnF Mobile | 9 | 5 | 8 | 7.5 | **7.4** |
| Archero 2 | 7 | 3.5 | 8.5 | 9.5 | **7.1** |
| Summoners War | 8 | 5 | 8.5 | 6.5 | **7.0** |
| Solo Leveling: Arise | 8 | 4 | 7.5 | 8 | **6.9** |
| Diablo Immortal | 8.5 | 3 | 7.5 | 8.5 | **6.9** |
| **Thornreach** | **5** | **9.5** | **5.5** | **7** | **6.8** |
| RAID: Shadow Legends | 7.5 | 2.5 | 9 | 7.5 | **6.6** |

Top-10 medians: Depth 8.3 · Fairness 5.0 · Hooks 8.5 · Mobile UX 7.8. Thornreach wins fairness outright, is close on touch UX, and trails on depth + hooks — which are buildable.

## Key findings

**Moats (protect):**
- Chat-first social design exists nowhere in the top 10. Only DnF's town hubs and OSRS's Grand Exchange come close — and both are huge partly because of it. DnF's formula has never shipped in English: the Western "social dungeon town" lane is empty.
- The fairness charter (no gacha, no energy, stat-capped legendaries, $9.99 ceiling) is the OSRS pole of the market — the one that's growing. Say "no gacha, no odds, nothing pay-to-win — ever" in the store listing.
- Instant web join (URL → playing) vs 1–52GB installs; nobody in the ten can match it. One shared world across web/phone/desktop matches the industry's cross-platform wave.

**Gaps (fix):**
- Content volume (~2h × 5 campaigns vs 30–1,000h) → out-rotate, don't out-author.
- No live-ops calendar beyond Peddler Mondays; no push notifications, login streaks, leaderboards, or guild-like groups.
- Dungeons T1–T4 are unnamed and invisible in the store listing — yet dungeons are the genre hook.
- JSON-file + ephemeral-host backend is friends-scale; a store launch needs a real database.
- Controller support is now table stakes for the desktop build.

**Market context:** mobile RPG revenue −17.3% (2024); mid-tier gacha is dying (Tarisland, Dragonheir, Abyss of Dungeons shutdowns). The growing poles: fairness-first community games (OSRS) and tight dungeon-run loops (Archero 2). Thornreach's lane sits between them, unoccupied.

## The steal list (proven patterns → Thornreach's tone)

1. **Roguelike weekly "delve" mode** on the existing 4 dungeon tiers, seeded weekly, pick-1-of-3 boons mid-run (HSR/AFK/Archero 2/DnF all proved it — cheapest infinite content). ← biggest single lever
2. **Quick-delve session shape:** a 3–5 min run reachable in two taps (Archero 2's bus-stop loop).
3. **Name the dungeons** + give each a signature boss and lore plaque; put them on store screenshots (Solo Leveling's gates).
4. **Guilt-free return:** bank offline harvest/quest-cooldown progress into a "while you were gone" letter (AFK Journey).
5. **Covens:** 8-player persistent groups, shared bank tab, claimable tavern table (Diablo's Warbands, minus everything else).
6. **A Leagues-style temporary event:** month-long "Blood Moon" town with twisted rules + cosmetic trophies (OSRS).
7. **Co-op boss hunts** scaled for parties (Summoners War rift raids / Genshin domains).
8. **Three calendar beats:** Peddler Monday + weekend hunt tournament + monthly festival (RAID's cadence, none of its menace).
9. **Onboarding compression:** visible win in the first 20 minutes; Journal names the next goal (Solo Leveling post-EVOLUTION).
10. **$4.99/30-day "Resident Pass"** alongside the $2.99 day pass — Welkin-shaped, the best-liked IAP format in the genre; same venues-only scope.

## When you're back — suggested next moves

1. Skim the dashboard's **Playbook** section (artifact gallery → thornreach-vs-top10), then pick 2–3 steal-list items to build first. My suggested order: **#3 named dungeons** (a content/naming pass, no new systems) → **#4 welcome-back letter** (small, big feel) → **#1 delve mode** (the big build) → **#10 resident pass** (IAP config + one product in each store console, alongside the 3 Moonstone products still on your queue from Session I).
2. If store launch is getting close, the backend-durability gap (real DB) is the one that bites first.
3. Useful next-session prompts: *"Read COMPETITIVE-REVIEW-HANDOFF.md and implement the named-dungeons pass"* · *"...implement the weekly delve mode"* · *"...add the 30-day Resident Pass product."*

## Method & caveats

Research run July 12, 2026 by parallel agents; every game verified live via 2+ sources; revenue/download figures are third-party estimates (Sensor Tower, AppMagic, Niko Partners via trade press) unless store-listed; DnF figures are CN/KR-market only. Scores are editorial judgments from the cited evidence — a structured opinion for planning, not an industry metric. Full source links live in the dashboard's Sources section.
