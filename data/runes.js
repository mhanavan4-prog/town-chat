// Rune casting (Tier 3.5 → divination) — the counterpart to the daily tarot,
// cast with the Elder Futhark instead of the Major Arcana. Once per UTC day a
// witch casts three staves — The Root · The Crossing · The Outcome — each
// falling bright (upright) or merkstave (its shadow reading), and a short
// synthesis reads the three together. Flavor-first; the server picks and sends
// the whole cast, so there is no client-side copy to keep in sync.
//
// The 24 runes are the three traditional aettir (Freyr's, Hagal's, Tyr's) of
// eight — which maps cleanly onto a three-leg collectible arc (see the codex,
// added separately), the way the Major Arcana's three roads do.

const RUNES = [
  // ── Freyr's Aett ──────────────────────────────────────────────────────────
  { key: 'fehu',     name: 'Fehu',     sym: 'ᚠ', aett: 'freyr', reading: 'Cattle, wealth in motion. Held loosely, it grows; hoarded, it rots.',                 reversed: 'Wealth clutched or leaking away. Mind where it drains before you chase more.' },
  { key: 'uruz',     name: 'Uruz',     sym: 'ᚢ', aett: 'freyr', reading: 'The wild ox — raw vigor and sudden strength. Meet the thing head-on.',                reversed: 'Strength misspent, or turned against yourself. Rein the brute in.' },
  { key: 'thurisaz', name: 'Thurisaz', sym: 'ᚦ', aett: 'freyr', reading: 'The thorn — a sharp defense, a conflict that clears the air. Let it prick.',          reversed: 'A reckless thorn, cutting the wrong hand. Stay the strike a moment.' },
  { key: 'ansuz',    name: 'Ansuz',    sym: 'ᚨ', aett: 'freyr', reading: 'The god-breath — a message, true counsel, the word that lands. Listen for it.',        reversed: 'A lie, or a word misheard. Weigh what you are told twice.' },
  { key: 'raidho',   name: 'Raidho',   sym: 'ᚱ', aett: 'freyr', reading: 'The ride — a journey with purpose, right action in its right order.',                   reversed: 'A road gone crooked, or set out on too soon. Check your bearings.' },
  { key: 'kenaz',    name: 'Kenaz',    sym: 'ᚲ', aett: 'freyr', reading: 'The torch — knowledge kindled, a craft learned, the dark made workable.',              reversed: 'A guttering flame. What you knew no longer lights the way.' },
  { key: 'gebo',     name: 'Gebo',     sym: 'ᚷ', aett: 'freyr', reading: 'The gift — a bond, an exchange that binds two freely. Give, and be given to.',         reversed: 'A gift with a hook in it. Count the cost of what is offered.' },
  { key: 'wunjo',    name: 'Wunjo',    sym: 'ᚹ', aett: 'freyr', reading: 'Joy — harmony, a wish met, the glad company of your own.',                              reversed: 'Joy withheld, discord in the hall. Tend the small sorrows first.' },
  // ── Hagal's Aett ──────────────────────────────────────────────────────────
  { key: 'hagalaz',  name: 'Hagalaz',  sym: 'ᚺ', aett: 'hagal', reading: 'The hail — a disruption you did not call. It passes; the field drinks it. Stand.',     reversed: 'The storm lingers. No way around it — only through, and low.' },
  { key: 'nauthiz',  name: 'Nauthiz',  sym: 'ᚾ', aett: 'hagal', reading: 'Need — the friction that forges. Necessity teaches what ease never could.',            reversed: 'A need ignored. Name the lack before it names you.' },
  { key: 'isa',      name: 'Isa',      sym: 'ᛁ', aett: 'hagal', reading: 'Ice — a standstill, a holding. Do not push the frozen river; wait for the thaw.',       reversed: 'Frozen too long. The stillness has become a hiding place.' },
  { key: 'jera',     name: 'Jera',     sym: 'ᛃ', aett: 'hagal', reading: 'The harvest — the turning year, the reward of work rightly timed. It comes round.',     reversed: 'The reaping is early or late. Let the season finish its work.' },
  { key: 'eihwaz',   name: 'Eihwaz',   sym: 'ᛇ', aett: 'hagal', reading: "The yew — the world-tree's spine. Endurance through the dark passage.",                reversed: 'Endurance fraying. The passage is long; spend your strength slower.' },
  { key: 'perthro',  name: 'Perthro',  sym: 'ᛈ', aett: 'hagal', reading: 'The lot-cup — chance, the hidden, what the dice have not yet shown. Play your hand.',   reversed: 'A secret soured, a gamble gone wrong. Some things stay veiled.' },
  { key: 'algiz',    name: 'Algiz',    sym: 'ᛉ', aett: 'hagal', reading: 'The raised hand — protection, a ward between you and harm. Stand guarded.',            reversed: 'The guard is down. Mind what slips past an open door.' },
  { key: 'sowilo',   name: 'Sowilo',   sym: 'ᛊ', aett: 'hagal', reading: 'The sun — victory, wholeness, the light that scatters doubt. Follow it.',              reversed: 'The sun behind cloud. The win is real but not yet in hand.' },
  // ── Tyr's Aett ────────────────────────────────────────────────────────────
  { key: 'tiwaz',    name: 'Tiwaz',    sym: 'ᛏ', aett: 'tyr',   reading: "Tyr's spear — justice, courage, the vow kept at a cost. Hold the line.",               reversed: 'Zeal misdirected, a vow strained. Be sure the cause is just.' },
  { key: 'berkano',  name: 'Berkano',  sym: 'ᛒ', aett: 'tyr',   reading: 'The birch — birth and growth, a thing sheltered and tended into being.',               reversed: 'Growth stunted, a tending neglected. Something needs more care.' },
  { key: 'ehwaz',    name: 'Ehwaz',    sym: 'ᛖ', aett: 'tyr',   reading: 'The horse — partnership, trusted movement, two who go better paired.',                  reversed: 'A partnership out of step. Rebuild the trust before the ride.' },
  { key: 'mannaz',   name: 'Mannaz',   sym: 'ᛗ', aett: 'tyr',   reading: 'The self — your place among kin, the human measure. Know yourself plainly.',            reversed: 'Self-deception, or standing too alone. Look outward; ask for the hand.' },
  { key: 'laguz',    name: 'Laguz',    sym: 'ᛚ', aett: 'tyr',   reading: 'Water — the flow, the deep intuition that carries what the mind cannot.',               reversed: 'The current confuses. Do not trust every pull of feeling.' },
  { key: 'ingwaz',   name: 'Ingwaz',   sym: 'ᛜ', aett: 'tyr',   reading: 'The sealed seed — potential gathered, a thing gestating toward its hour.',              reversed: 'The seed sits idle. What is ready to begin is being held back.' },
  { key: 'dagaz',    name: 'Dagaz',    sym: 'ᛞ', aett: 'tyr',   reading: 'The dawn — breakthrough, the hinge of night and day, a clear new light.',               reversed: 'The dawn delayed. Hold on; the night does not get the last word.' },
  { key: 'othala',   name: 'Othala',   sym: 'ᛟ', aett: 'tyr',   reading: 'The homestead — inheritance, what is truly yours, the ground you belong to.',           reversed: 'Clinging to the old, or cut from your roots. Tend what is actually yours.' },
];

// The three staves of a cast. The crossing (center) carries the counsel.
const RUNE_POSITIONS = [
  { key: 'root',     label: 'The Root',     hint: 'what underlies this' },
  { key: 'crossing', label: 'The Crossing', hint: 'what tests you now' },
  { key: 'outcome',  label: 'The Outcome',  hint: 'the way it leans' },
];

// The three aettir — the collectible arc (the codex records each rune the first
// time it falls; completing an aett is a leg, all three the full Futhark).
const RUNE_AETTIR = [
  { id: 'freyr', name: "Freyr's Aett", lore: 'The first eight — cattle and ox, thorn and gift; the runes of the world and its getting.' },
  { id: 'hagal', name: "Hagal's Aett", lore: 'The middle eight — hail and need, ice and sun; the runes of what befalls and what endures.' },
  { id: 'tyr',   name: "Tyr's Aett",   lore: 'The last eight — the spear and the birch, the horse and the hearth; the runes of self and belonging.' },
];

// Read the three together — one authored line tracing the cast, pointing to the
// center stave as the counsel of the hour. Pure, so server and tests agree.
// `cast` is [{ rune, reversed }, { rune, reversed }, { rune, reversed }].
function runeSynthesis(cast) {
  if (!Array.isArray(cast) || cast.length < 3) return '';
  const nm = (s) => s.rune.name + (s.reversed ? ' reversed' : '');
  const [r, c, o] = cast;
  return `${nm(r)} is the root of it; ${nm(c)} is the stave that crosses you now; ` +
    `${nm(o)} is where it falls. Mind the middle rune and act with it.`;
}

module.exports = { RUNES, RUNE_POSITIONS, RUNE_AETTIR, runeSynthesis };
