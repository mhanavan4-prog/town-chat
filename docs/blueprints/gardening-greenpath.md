# Blueprint — The Green Path (gardening expansion)

> A botanical questline that runs parallel to the main campaign. Nine chapters,
> each unlocking a rarer plant than the last, drawn from **real witchcraft
> herbalism** and organized by traditional category — the gentle **Cottage
> Garden**, the **Hedge & Wild**, and the baneful **Poison Path**. Plants are
> also **found** in the world (rare mob drops, foraging) and new potions are
> brewed from every harvest.
> Status: **COMPLETE — all nine chapters built.** Every plant in the
> `GREEN_PATH_CATEGORIES` taxonomy (Cottage Garden, Hedge & Wild, Poison Path) is
> growable and brewable with its own hand-drawn icon, across a 9-chapter account-
> wide questline. Rare seeds (Mugwort, Yarrow) drop from Wilds mobs and open the
> Hedge band; the capstone is the Draught of the Green Path. Remaining work is
> polish only (a Journal page / almanac; an optional Mother Yarrow NPC).
>
> The full plant catalogue, by category, is the authoritative list in
> `data/greenPath.js` (`GREEN_PATH_CATEGORIES`). This document is the plan around
> it.

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

## 3. The plant categories (real witchcraft herbalism)

Nine chapters, three traditional categories that also serve as the rarity bands.
Each plant is a **real herb from folk witchcraft**, with its traditional
correspondence; each has a grow time (rarer = longer), a base yield value, and a
signature potion. The categories climb in power and danger, so the taxonomy and
the progression are the same ladder.

| Category | Band | Chapters | Real plants | Grow time | Where it comes from |
|---|---|---|---|---|---|
| **The Cottage Garden** — everyday healing & hearth-cunning | common | 1–3 | **Chamomile, Calendula**, Comfrey, Lemon Balm, Feverfew, Lavender | 30–60 min | Chapter reward + common forage |
| **The Hedge & Wild** — warding & crossing the hedge to see | rare | 4–6 | Mugwort, Vervain, Yarrow, Wormwood, Rue, St. John's Wort, Rowan | 1–2 h | Chapter reward + **rare mob drops** |
| **The Poison Path** — the baneful herbs, the witch's dark art | mythic | 7–9 | Belladonna, Henbane, Mandrake, Wolfsbane, Datura, Hemlock, Foxglove, Black Hellebore | 3–6 h | Chapter reward + **boss/elite drops** + lunar mutation |

**The Poison Path is the climax** and the most evocative category — nightshades
and baneful roots steeped in real witch-lore (the "flying ointment" herbs:
belladonna, henbane, mandrake, datura). In-game they brew *debuffs, baneful
draughts and trance effects* — never anything depicting real-world harm or
preparation; the fantasy is the folklore, not a recipe.

Yield still scales with the **moon phase at planting** (existing `MOON_YIELD`),
so the "plant as the moon fills" skill carries all the way up — fitting, since
the baneful herbs are traditionally gathered by the moon.

## 4. The nine-chapter storyline

Narrator: **Mother Yarrow, the Hedgewitch.** In the MVP she is a *voice* in the
garden panel (her outro toasts hand you the next seeds) rather than a walk-up
NPC — the garden actions themselves are the objectives, so no new dialogue UI is
needed. She can graduate to a proper west-side NPC (near Herbalist Finn) when the
later categories ship. Each chapter gates on player level and the previous
chapter, and pays a seed packet (plus XP/gold).

*Cottage Garden (common):*
1. **A Handful of Earth** (Lv 1) — sow your first bed. *Reward: Chamomile.* ✅ built
2. **The First Cutting** (Lv 3) — harvest 3 beds. *Reward: Calendula.* ✅ built
3. **Hearth and Healing** (Lv 5) — brew any remedy at Hazel's cauldron. *Reward: the rest of the cottage garden — Comfrey, Lemon Balm, Feverfew, Lavender (each with its own brew).* ✅ built

*The Hedge & Wild (rare):*
4. **Crossing the Hedge** (Lv 8) — find a wild herb cutting out in the Wilds (loot a Mugwort/Yarrow drop). *Reward: Vervain.* ✅ built
5. **The Warding Herbs** (Lv 11) — harvest five times to stock your warding herbs. *Reward: Wormwood + Rue (each with its own charm/brew).* ✅ built
6. **Bitter Sight** (Lv 14) — brew a hedge remedy at the cauldron. *Reward: St. John's Wort + Rowan — completes the Hedge & Wild band.* ✅ built

*The Poison Path (mythic / baneful):*
7. **The Beautiful Lady** (Lv 17) — tend the dark beds (harvest 7×); Mother Yarrow unlocks the baneful herbs. *Reward: Belladonna + Henbane.* ✅ built
8. **The Screaming Root** (Lv 19) — sow a nightshade of your own. *Reward: Mandrake + Wolfsbane + Datura (incl. the Flying Ointment brew).* ✅ built
9. **The Witch's Garden** (Lv 20) — the capstone: brew a baneful draught (the final working). *Reward: Hemlock, Foxglove, Black Hellebore — and the **Draught of the Green Path** recipe (Belladonna + Henbane + Mandrake). Completes the nine-chapter path.* ✅ built

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

Every plant anchors a recipe (`POTION_RECIPES` + the cauldron), each drawn from
the herb's real correspondence. Keep them **sidegrades/consumables**, never
permanent power, to match the crafting-tree rule. Examples:

- **Chamomile Tisane** (Cottage) — a steady heal (restores 90 HP). ✅ built
- **Calendula Salve** (Cottage) — a brief regen-over-time, skin-mending lore.
- **Mugwort Dream-Draught** (Hedge) — a divination/forage-luck buff for a gathering session.
- **Yarrow Ward** (Hedge) — a timed damage-reduction, the "staunching, courage" herb.
- **Rue Cleansing Philtre** (Hedge) — strips curses/debuffs (the grace-herb, curse-breaker).
- **Flying Ointment** (Poison Path) — a trance/levitation *cosmetic* buff (belladonna/henbane/mandrake lore; purely visual flight-feel, no power).
- **Draught of the Green Path** (capstone) — a signature buff that stacks a
  little of everything for a few minutes; the "I finished the garden" trophy.

## 7. Data model (new/extended)

- `PLANT_CATALOG` (`data/world.js`): the real herbs (id, name, icon, use-effect).
  **Non-wild Green-Path plants live at the tail of the catalog** so foraged
  plants keep their `wdecor_<i>_<n>` ids and wild-scatter positions stable, and
  are added to `NON_WILD_CONSUMABLES` in `server.js` so they never scatter.
  *(Built: chamomile, calendula, chamomile_tisane.)*
- `data/garden.js`: `PLANTABLE_HERBS` widened as chapters unlock plants (built:
  chamomile, calendula). Later: per-plant grow time (`GROW_MS_BY_SEED`), gate
  plantability on plants owned.
- `POTION_RECIPES` (`data/gameConstants.js`): one recipe per plant (built:
  chamomile_tisane).
- `LOOT_TABLES`: plant-drop entries on the right mob pools (Hedge & Poison tiers).
- `data/greenPath.js` — **built.** `GREEN_PATH` (the chapter list: title, band,
  level gate, objective type/target, outro, rewards) and `GREEN_PATH_CATEGORIES`
  (the authoritative real-plant taxonomy with per-plant lore).
- Per-account state: `prog.greenPath = { chapter, progress }` — stored like the
  existing story/skill progress; surfaced in the garden panel, auto-advancing
  off the plant/harvest handlers. *(Built.)*

## 8. Balance & monetization guardrails

- Seeds are **earned or found**; Moonstones never buy a seed, a harvest, or a
  potion. Convenience only (the grow-now rush already exists).
- Potions are consumables/sidegrades under the relic ceiling — no permanent power.
- Mythic grow times (3–6 h) are the natural brake on the top tier; the grow-now
  rush is the premium release valve for the impatient, priced per bed as today.

## 9. Build order (slice it)

Ship a **thin vertical slice first**, then widen tier by tier:

1. **MVP (one PR):** ✅ **done.** `data/greenPath.js` with **Chapters 1–2**
   (Cottage Garden), the green-quest tracker surfaced *inside the garden panel*
   (no new NPC/dialogue UI — garden actions ARE the objectives), Chamomile and
   Calendula as plantables, and the Chamomile Tisane recipe. The loop is proven
   end-to-end: sow → harvest → chapter reward (seeds) → plant/brew.
2. **Rare-drop system:** ✅ **done.** `WILDS_SEED_DROPS` — Mugwort & Yarrow drop
   from the overworld Wilds pools (never town/dungeon), each growable and brewable.
3. **Finish the Cottage Garden:** ✅ **done.** Chapter 3 ("Hearth and Healing")
   introduces Comfrey, Lemon Balm, Feverfew and Lavender with a brew each; its
   objective (`garden_brew`) hooks the cauldron. All six cottage herbs are live.
4. **Art for the whole library:** ✅ **done.** Every plant in all three categories
   has a hand-drawn icon (`client/ui-icons.js`), dormant until its item ships.
5. **Hedge & Wild content:** ✅ **done.** Chapters 4–6 — ch.4 keys off *finding*
   a wild cutting (a `seed_found` hook on the loot grant), then Vervain, Wormwood,
   Rue, St. John's Wort and Rowan arrive as grown/brewed warding herbs.
6. **Poison Path content:** ✅ **done.** Chapters 7–9 — the eight baneful herbs,
   each with a trance/warding brew, and the capstone Draught of the Green Path.
   The nine-chapter questline is complete.
7. **Polish:** a Green-Path page in the Journal, a garden "almanac" of plants
   you've discovered (a collection hook), each with its real-world lore.

Each step is testable with the existing harness (quest/story tests, crafting
integrity test, garden test) — the same green pipeline every PR has used.
