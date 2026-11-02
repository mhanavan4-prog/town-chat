# Blueprint — The Hearth Path (kitchen witchery expansion)

> The kitchen-witch parallel to the garden's Green Path. Kitchen witchery was a
> tidy four-tea side-loop; the Hearth Path turns it into a **collection system
> organised by the seven planetary days** of the witch's week, brewed from the
> real herbs you grow on the Green Path, with a Teas Almanac to fill.
> Status: **Slices 1–3 COMPLETE.** Slice 1: 16 teas across all 7 planetary days,
> each day ruling a stat, a two-page kitchen panel (Brew / Almanac), discovery
> tracking. Slice 2: greater two-herb draughts + the capstone **The Witches'
> Brew**, gated by steeping a tea from each of the seven days. Slice 3: **sabbat
> teas** — a brew for each of the eight sabbats, steepable only while its season
> turns (tied to the Wheel of the Year). The authoritative catalogue lives in
> `data/teas.js`.

## 1. Pillars (mirroring the Green Path)

1. **Grow it, brew it.** Most teas steep a Green Path herb (chamomile, lavender,
   yarrow, rue…), so the garden finally feeds the kettle — one loop feeds another.
2. **Correspondence is the throughline.** Each planetary day rules one stat, so
   "brew on Mars-day for strength" is a real, learnable pattern — and brewing on
   a tea's own day steeps it ×1.5 longer (the existing day-bonus).
3. **It compounds.** Every tea is one data entry: id, herb, day, stat, lore. The
   Almanac turns brewing into collecting.
4. **Cosmetic-safe + lore-true.** Buffs are gentle and timed (the existing teaBuff
   slot); baneful Poison-Path herbs are never brewed — you don't drink nightshade.

## 2. The planetary days (the witch's week)

| Day | Planet | Rules (stat) |
|---|---|---|
| Sunday | ☉ The Sun | warmth, vitality & healing — **vitality** |
| Monday | ☽ The Moon | intuition, dreams & the harvest — **forage** |
| Tuesday | ♂ Mars | strength, courage & the edge — **power** |
| Wednesday | ☿ Mercury | swiftness, wit & the quick road — **swift** |
| Thursday | ♃ Jupiter | fortune, plenty & good luck — **xp** |
| Friday | ♀ Venus | love, mending & life drawn back — **leech** |
| Saturday | ♄ Saturn | warding, binding & protection — **guard** |

`data/teas.js` `PLANETS` is the authoritative day→stat map; `TEAS` is the
catalogue. The four original teas keep their ids (Hearthmoon, Mugwort,
Gingerroot, Clovermint).

## 3. What it builds on (already in the codebase)

| System | Reuse |
|---|---|
| `brew_tea` handler + `teaBuff` slot | Brew/consume/sip/buff loop is done; new teas are data |
| Green Path herbs (`data/greenPath.js`, `PLANT_CATALOG`) | New teas' ingredients — the garden→kettle link |
| Garden Almanac UI (`almCat`/`almGrid`/`gardenTabs`) | The Teas Almanac reuses the same collection page |
| Valid buff stats (vitality/forage/power/swift/xp/leech/guard) | Each planetary day picks one |

Almost no new engine code — the Hearth Path is data plus a two-page panel and a
`teasBrewed` discovery list on the account.

## 4. Runway (future slices)

- **A Hearth Path questline** — chapters that unlock tea families day by day, the
  way the Green Path's nine chapters gate its plants (ride the same story engine).
- **A hearth-witch NPC** — a tea-mentor in town or the Wilds, the kitchen's
  Mother Yarrow, with a chapter-aware greeting.
- **Rarer brews** — multi-herb recipes, a capstone "Witches' Brew", seasonal teas
  tied to the sabbats.
- **New ingredients** — foraged mushrooms/roots beyond the garden for variety.
