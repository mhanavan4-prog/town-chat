# Blueprint — The Cunning Folk (deepening the real-lore layer)

> Thornreach already has more genuine witchcraft in it than most games that
> advertise it: eight sabbats with their own rites, planetary-day
> correspondences, real moon phases driving real rituals, an herbal taxonomy
> that follows actual folk categories, tarot, runes, pendulum, scrying,
> ancestor work. The vocabulary is here.
>
> What is thin is the **verbs**. Six Witch Paths exist and all six are a single
> stat bonus. The Hearth Witch's blurb says *"your threshold is warded and your
> home holds"* — and is +8% damage resist. The Sea Witch *"moves with the tide"*
> — and is +8% move speed. The traditions behind both names are full of things
> a person actually **did**, and none of those things are in the game yet.
>
> Status: **IN PROGRESS.** A (Callers at the Door) and E (Reading the Leaves)
> are built. The rest are proposals, ordered by value at the bottom.

---

## 1. The thesis

A real village witch was not a class. She was a **job**. Cunning folk —
England's term; there are equivalents everywhere — were hired by neighbours to
find stolen goods, name a thief, un-bewitch a sick cow, break a curse laid by
somebody else, protect a threshold, deliver a charm. They were paid. They had
competitors. They were feared a little and consulted often.

Thornreach casts the player as a witch and then gives them monsters to fight.
The single biggest accuracy gap is not a missing herb or a missing festival —
it is that **nobody in town ever hires you to do witchcraft.**

Everything below follows from that.

---

## 2. Three tiers of "real", and saying which is which

"As accurate as possible" only means something if the game is honest about
provenance. Three tiers, and the game should know which it is using:

| Tier | What it means | Examples already in Thornreach |
|---|---|---|
| **Archaeological / documentary** | Physical artifacts, trial records, manuscripts. Verifiable. | Baneful herbs and their folk associations |
| **Folk tradition** | Attested practice, orally transmitted, regionally varied | Rowan-and-red-thread, hagstones, omens |
| **Modern revival** | Assembled 1900s–1960s from older parts | The Wheel of the Year as an eight-fold set, "esbat", circle-casting |

The Wheel of the Year is the clearest case. The eight sabbats as *one calendar*
is a mid-20th-century synthesis (Gardner and Ross Nichols), even though every
individual festival in it is genuinely old. The game currently presents all
eight flatly. **Saying so is an upgrade, not a disclaimer** — the Codex can
carry a provenance line per entry, and a player who learns that Samhain is
Iron Age and the eight-fold wheel is 1958 has learned something true and
interesting.

This also sets the line for the Poison Path. The folklore is the content:
what belladonna *meant*, what people believed, what trial records claim. The
preparation of toxic plants is never the content — no methods, no quantities,
no routes. The existing data files already hold this line; it should be written
down as a rule rather than left to instinct.

---

## 3. The proposals

### A. The Cunning Woman's Work — *the missing job* ✅ BUILT

> Shipped as **Callers at the Door**, the Town Board's first tab. Eight
> callers (`data/callers.js`), three at the door per day; each working is
> done with the pendulum / cards / staves / bowl plus a hand-over from the
> garden or Hazel's cauldron, and finishes with the tale, the real lore, its
> provenance tier and a source line.

**The lore.** Cunning folk's actual trade, documented in court records and
chapbooks across England from the 1500s to the 1900s: thief-detection,
recovering stolen property, un-bewitching livestock, counter-magic against
another's curse, love charms, protective charms sold by the piece. Hired, paid,
and distinct from the "witch" who was accused.

**The gap.** The Town Board gives you bounties. It never gives you a *client*.

**The mechanic.** A new Board category — **Callers at the Door**. A townsperson
asks for a working, and the working is a real one:

- *"Something's got into my milk cow."* → diagnose, then counter-charm
- *"My wife's ring is gone and I think I know who."* → a sieve-and-shears or
  key-and-book divination names a direction, not a person
- *"There's been a mark scratched on my lintel."* → identify whose work it is
- *"My boy won't sleep."* → a charm bag, hung at the bed

Each is solved by **using systems the game already has** — the pendulum to
dowse, the tarot for a reading, the garden for the herb, the cauldron for the
charm. That is the point: it makes the existing divination tools *load-bearing*
instead of flavour.

**Why it is the top pick.** It costs no new subsystems. It turns six existing
toys into tools, and it is the one thing that would make a player feel like a
village witch rather than an adventurer in a hat.

---

### B. Threshold & Hearth — *apotropaic housecraft*

**The lore.** Genuinely archaeological, and startlingly common:

- **Witch bottles** — roughly 200 recovered in England. Buried under hearths and
  thresholds, filled with counter-charm material to turn a curse back on its
  sender. The Greenwich bottle (c. 1680s) is intact and well published.
- **Hexafoils / daisy wheels** — compass-drawn six-petalled marks scratched on
  beams, doorframes and church porches to snare harm. Thousands survive.
- **Concealed shoes** — a single worn shoe walled up near a chimney or door.
  Over 1,900 recorded by the Northampton Museum index.
- **Besom at the threshold**, iron at the door, salt at the sill.

**The gap.** The game has player cottages, buildings with real beams, and a
Hearth Witch path whose entire content is a damage-resist number.

**The mechanic.** Make the *house* a magical object.

- Brew and **bury a witch bottle** beneath your cottage hearth → a standing ward
  with a real failure state (it is *consumed* when it turns something)
- **Scribe a hexafoil** on a doorframe (the compass-drawn construction is a
  lovely little minigame — six arcs, one radius)
- **Conceal a shoe** in the chimney — permanent, one per house, a collector's beat
- Ward strength is **visible on the building**, which the wall-decor system can
  already place correctly

This gives the Hearth Path an actual practice, and gives housing a reason to be
revisited.

---

### C. The Tree Alphabet — *ogham, and the name you already chose*

**The lore.** Ogham is a real Early Medieval Irish script, c. 4th–6th century,
cut on standing stones. The medieval tree-names tradition (*Auraicept na
n-Éces*, the *Bríatharogam* kennings) attaches a tree to each letter.

**The gap — and a gift already in the game.** Thornreach's wood materials map
almost one-to-one onto the first ogham letters:

| Letter | Tree | Already in game |
|---|---|---|
| Beith | Birch | `birch_bark` |
| Luis | Rowan | `rowan_berry` |
| Sail | Willow | `willow_frond` |
| Duir | Oak | `hex_acorn` |
| Straif | Blackthorn | `blackthorn` |
| Ailm | Pine | `pine_pitch` |
| **Coll** | **Hazel** | **Hazel — the witch at the cauldron** |

Coll is the letter of wisdom; the hazel of knowledge over Connla's Well, whose
nuts the Salmon of Wisdom eats, is one of the better-known images in Irish
myth. **The game's brewing teacher is already named for the ogham letter of
knowledge.** Whether that was deliberate or not, it is worth making real.

**The mechanic.** Ogham **few-staves** as a third divination system beside tarot
and runes — but one you *carve* rather than draw, from the wood you gathered.
Carve a stave from blackthorn and you get Straif's meaning; the wood you had to
go and find determines the reading you can take. It makes the Wilds' tree
materials matter and gives Hazel a second teaching role.

---

### D. Planetary Hours — *deepening what already exists*

**The lore.** The classical and medieval system: day and night are each divided
into twelve **unequal** hours (long in summer daylight, short in winter), and
each hour is ruled by a planet in Chaldean order, cycling continuously. The
day's first hour gives the day its planet — which is precisely *why* the
planetary week runs Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn.

**The gap.** `data/teas.js` already uses planetary **days** beautifully. The
hours are the other half of the same real system, and the game's day/night
cycle is already a 20-minute arc that could carry them.

**The mechanic.** A small **Hour of the Day** readout beside the moon phase.
Brewing in a matching *hour* as well as a matching *day* gives a further bonus —
a reason to look at the clock, and a true one. The nice part is that explaining
the mechanic teaches the player why Wednesday is Mercury's.

---

### E. Reading the Leaves — *tasseomancy, nearly free* ✅ BUILT

> Every cup drunk (brewed, or a friend's gift) leaves dregs readable once for
> two hours: one sign of 26 from A Highland Seer's dictionary, placed rim /
> side / bottom for soon / later / far off, with place-dependent meanings where
> the seer gives them. Signs collect into a Leaves page of the Almanac; a new
> caller ("No Letter from America") is worked with a cup.

**The lore.** Tea-leaf reading as a popular practice follows tea into Europe in
the 1600s–1700s, with a large Victorian literature of symbol dictionaries
(ring = marriage, anchor = safe harbour, serpent = an enemy).

**The gap.** Thornreach has an entire tea system — brewed, planetary, beautiful
— and the cup is thrown away at the end of it.

**The mechanic.** After drinking, **read the cup**. One free symbol per tea, from
a Victorian-accurate symbol list, feeding the existing omen system. Costs almost
nothing to build, closes a loop that is already open, and it is the single most
*characterful* thing on this list.

---

### F. Knots, and Selling the Wind — *the Sea Witch's actual trade*

**The lore.** Attested across Scotland, the Isle of Man and Scandinavia into the
19th century: witches sold sailors a cord with **three knots**. Undo the first
for a fair breeze, the second for a strong wind, the third at your peril. The
**Witch's Ladder** found in a Wellington, Somerset attic in 1878 — a cord worked
with feathers — is the best-known physical knot-charm.

**The gap.** The Sea Witch path is +8% move speed.

**The mechanic.** **Cord magic** as a craftable, with knot-work as the verb:
bind an effect into a cord now, release it later. Three knots, three
magnitudes, and a real cost to the third. It is the only system here that
stores power *for later*, which is mechanically distinct from everything the
game currently does.

---

### G. The Nine Herbs Charm — *a real recipe as a capstone*

**The lore.** From the *Lacnunga*, an Old English manuscript of c. 1000 AD: a
metrical charm naming nine herbs against poison and infection — mugwort,
plantain, lamb's cress, nettle, betony, chamomile, crab apple, chervil, fennel.
It is one of the oldest surviving written herbal charms in English, and it is
*recited* as well as compounded.

**The gap.** The Green Path is complete and its capstone is the Draught of the
Green Path (belladonna + henbane + mandrake). A second capstone from the
*gentle* end would balance it — the Cottage Garden's own masterwork.

**The mechanic.** A nine-ingredient brew, gated on growing the full cottage
band, that **recites**: the charm's own words surface as you brew. Thornreach
already has mugwort and chamomile; the remaining seven are an obvious, pretty
expansion of the Cottage Garden plant list.

---

## 4. Rules for keeping it accurate

1. **Name the tier.** Codex entries carry provenance: artifact, attested
   practice, or modern revival. Never present the third as the first.
2. **Folklore is the content; preparation is not.** For the Poison Path:
   what it meant, who believed it, what the records say. Never methods,
   quantities or routes.
3. **Region beats "generic witch."** "Rowan and red thread" is Scottish.
   Witch bottles are English. Ogham is Irish. Saying so is richer than
   flattening it into one pan-European soup.
4. **Let the sources show.** A citation line in the Codex — *Lacnunga*,
   c. 1000; Wellington, 1878; Northampton Museum shoe index — costs one line
   and buys enormous credibility.

---

## 5. Order of work

| | Proposal | Why here |
|---|---|---|
| 1 | **A — The Cunning Woman's Work** | Biggest thematic gap; reuses six systems already built |
| 2 | **E — Reading the Leaves** | Smallest build on the list, closes an open loop |
| 3 | **B — Threshold & Hearth** | Gives the Hearth Path a practice; housing gains a reason |
| 4 | **C — The Tree Alphabet** | Materials already exist; pays off Hazel's name |
| 5 | **F — Knots & the Wind** | Gives the Sea Path a practice; a genuinely new mechanic |
| 6 | **D — Planetary Hours** | Deepens teas and rites; needs the day/night work first |
| 7 | **G — Nine Herbs Charm** | A gentle capstone, once the Cottage Garden grows |

The through-line, if only one thing is taken from this document: **give the six
Witch Paths verbs.** Each one is named for a real tradition full of things
people did. Right now each is a number.
