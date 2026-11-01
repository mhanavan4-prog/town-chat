# Blueprint — The Green Path (gardening expansion)

> A botanical questline that runs parallel to the main campaign. Nine chapters,
> each unlocking a rarer seed than the last, with seeds also **found** in the
> world (rare mob drops, foraging) and new potions brewed from every harvest.
> Status: **blueprint / not built.** This document is the plan, not code.

## 1. Vision & pillars

Gardening today is a tidy side-loop (plant a herb you hold, wait, harvest more
— `data/garden.js`). The Green Path turns it into a **progression system with
its own story**, so a player can chase "my garden" the way they chase their
build.

Three pillars:

1. **Earn, don't buy.** Seeds come from play — chapter rewards, rare drops,
   foraging — never from Moonstones. (Moonstones stay on convenience like the
   existing *grow-now* rush. This keeps faith with "no pay-to-win, ever.")
2. **Each tier matters.** A rarer seed grows a plant that is worth more *and*
   unlocks a better potion — so the ladder always has a next rung.
3. **It compounds.** Every tier is one data entry: a seed, a plant, a potion,
   a drop. Once the system is in, adding plants forever is cheap.

## 2. What it builds on (already in the codebase)

| System | File(s) | Reuse |
|---|---|---|
| Garden beds, moon-tier yield, grow timer | `data/garden.js`, garden handlers in `server.js` | Plant/grow/harvest/rush loop is done; add new plantables + per-seed grow times |
| Plant catalog | `data/world.js` (`PLANT_CATALOG`) | New seeds/herbs are entries here |
| Potions | `data/gameConstants.js` (`POTION_RECIPES`), `craft_potion` handler | New recipes consume Green-Path herbs |
| Story chapters | `data/quests.js`, the chapter system (`storyEvent`, `story_begin`, journal, chapter rewards incl. +1 skill point) | The Green Path is a second storyline that rides the same engine |
| Loot | `LOOT_TABLES`, `rollPendingLoot`, mob pools (`mobs`/`mobs2`/`mobs3`/`emberMobs`/dungeon) | Seed drops are loot-table entries |

**Key insight:** almost none of this needs new engine code. The Green Path is
mostly *data* plus a thin "green quest" tracker modeled on the existing story.

## 3. Seed rarity tiers

Nine chapters, three rarity bands. Each seed has a grow time (rarer = longer),
a base yield value, and a signature potion.

| Tier | Chapters | Example seeds | Grow time | Where it comes from |
|---|---|---|---|---|
| **Common garden** | 1–3 | Dawnpetal, Mistroot, Emberleaf | 30–60 min | Chapter reward + common forage |
| **Wild & rare** | 4–6 | Gravebloom, Moonthistle, Witch-ivy | 1–2 h | Chapter reward + **rare mob drops** |
| **Mythic** | 7–9 | Hollowbloom, Starcap, Heartroot | 3–6 h | Chapter reward + **boss/elite drops** + lunar mutation |

Yield still scales with the **moon phase at planting** (existing `MOON_YIELD`),
so the "plant as the moon fills" skill carries all the way up.

## 4. The nine-chapter storyline

Questgiver: a new NPC — **Mother Yarrow, the Hedgewitch** (west-side garden,
near Herbalist Finn). Each chapter gates on player level and the previous
chapter, mirrors the main story's structure (intro → objective → outro +
reward), and pays a seed packet.

1. **A Handful of Earth** (Lv 1) — sow your first bed. *Reward: Dawnpetal seeds.*
2. **The First Cutting** (Lv 3) — harvest 3 beds. *Reward: Mistroot seeds + a potion recipe.*
3. **Reading the Moon** (Lv 5) — harvest a bed planted under a waxing/full moon. *Reward: Emberleaf.*
4. **What the Wilds Hide** (Lv 8) — forage/kill in the Wilds until a **Gravebloom seed** drops. *Reward: Gravebloom + recipe.*
5. **The Thistle Witch** (Lv 11) — brew a Tier-2 potion and deliver it. *Reward: Moonthistle.*
6. **Ivy and Iron** (Lv 14) — grow Witch-ivy and clear a dungeon tier with its potion active. *Reward: Witch-ivy + recipe.*
7. **Bloom in the Hollow** (Lv 17) — a **Hollowbloom seed** drops from a Wilds elite/boss. *Reward: Hollowbloom.*
8. **Catch a Falling Star** (Lv 19) — harvest a Starcap (mythic grow time; plan around the moon). *Reward: Starcap + recipe.*
9. **The Heartroot** (Lv 20) — the capstone: grow Heartroot and brew the **Draught of the Green Path**. *Reward: a cosmetic title-adjacent flourish (earned, not sold) + a permanent garden perk.*

Chapter rewards escalate like the main story (XP, gold, the seed, sometimes a
recipe) and — consistent with the recent change — **+1 skill point per chapter**
could be mirrored, OR replaced with a Green-Path-specific reward (an extra
garden bed, a faster-grow blessing) to keep the two tracks distinct.

## 5. Where rare seeds come from (beyond chapters)

Three sources so the garden stays fed between chapters:

- **Rare mob drops.** Add seed entries to the Wilds loot tables (`mobs2`,
  `mobs3`, `emberMobs`, dungeon) at low rates — e.g. Gravebloom ~2% off Wilds
  mobs, Hollowbloom ~0.5% off elites, Starcap only off bosses. This makes
  hunting feed gardening and vice-versa.
- **Foraging up-tier.** The existing forage-luck stat (Hedgecraft, Green Witch,
  familiars) can roll a rare seed on a harvest, so the garden stat tree already
  built pays into this.
- **Lunar mutation (mythic hook).** A planted rare bed harvested under a **full
  blood moon** has a small chance to yield a mythic seed — ties gardening to the
  moon/season systems already live.

## 6. New potions

Every tier's herb anchors a recipe (`POTION_RECIPES` + the cauldron). Keep them
**sidegrades/consumables**, never permanent power, to match the crafting-tree
rule. Examples:

- **Dawnpetal Tonic** (T1) — small out-of-combat heal.
- **Mistroot Philtre** (T1) — brief move-speed, for travel.
- **Gravebloom Elixir** (T2) — a timed lifesteal buff (pairs with combat).
- **Moonthistle Draught** (T2) — forage-luck buff for a gathering session.
- **Hollowbloom Brew** (T3) — a short, strong damage-taken reduction (a panic button).
- **Draught of the Green Path** (capstone) — a signature buff that stacks a
  little of everything for a few minutes; the "I finished the garden" trophy.

## 7. Data model (new/extended)

- `PLANT_CATALOG`: +9 seeds/herbs (id, name, icon, forage/plant metadata).
- `data/garden.js`: per-seed grow time (`GROW_MS_BY_SEED`), the `PLANTABLE_HERBS`
  list widened as chapters unlock seeds (gate plantability on seeds owned).
- `POTION_RECIPES`: +~8 recipes.
- `LOOT_TABLES`: seed entries on the right mob pools.
- **New:** `data/greenPath.js` — the 9-chapter catalog (giver, level gate,
  objective type, target, reward), modeled on `data/quests.js` / the story arc.
- Per-account state: `greenPathChapter` (progress), `seedsUnlocked` (which seeds
  you may plant) — stored like the existing story/skill progress.

## 8. Balance & monetization guardrails

- Seeds are **earned or found**; Moonstones never buy a seed, a harvest, or a
  potion. Convenience only (the grow-now rush already exists).
- Potions are consumables/sidegrades under the relic ceiling — no permanent power.
- Mythic grow times (3–6 h) are the natural brake on the top tier; the grow-now
  rush is the premium release valve for the impatient, priced per bed as today.

## 9. Build order (slice it)

Ship a **thin vertical slice first**, then widen tier by tier:

1. **MVP (one PR):** `data/greenPath.js` with **Chapter 1–2 only**, Mother
   Yarrow NPC + the green-quest tracker (reuse the quest/story UI), one new seed
   (Dawnpetal) with its grow time, and **one** potion recipe. Prove the whole
   loop end-to-end: talk → quest → seed → plant → harvest → brew.
2. **Rare-drop system:** add seed loot entries + the forage-up-tier roll.
3. **Tiers 2–3 content:** chapters 3–9, the remaining seeds/potions, the lunar
   mutation, the capstone reward.
4. **Polish:** a Green-Path page in the Journal, a garden "almanac" of seeds
   you've discovered (a collection hook).

Each step is testable with the existing harness (quest/story tests, crafting
integrity test, garden test) — the same green pipeline every PR has used.
