// Rune casting (Tier 3.5 → divination) — the counterpart to the daily tarot,
// cast with the Elder Futhark instead of the Major Arcana. Once per UTC day a
// witch casts three staves — The Root · The Crossing · The Outcome — each
// falling bright (upright) or merkstave (its shadow reading), and a short
// synthesis reads the three together. Flavor-first; the server picks and sends
// the whole cast, so there is no client-side copy to keep in sync.
//
// The 24 runes are the three aettir of eight (as on the 6th-century Vadstena
// bracteate; the names Freyr's, Hagal's and Tyr's are later Icelandic usage),
// which maps cleanly onto a three-leg collectible arc. Readings follow the Old
// English, Norwegian and Icelandic rune poems where they can. `same: true`
// marks the nine runes that look the same upside down: they never fall
// reversed (the reversed reading is a 20th-century convention, and even it
// gives these none).

const RUNES = [
  // ── Freyr's Aett ──────────────────────────────────────────────────────────
  { key: 'fehu',     name: 'Fehu',     sym: 'ᚠ', aett: 'freyr', reading: 'Cattle, wealth in motion. Held loosely, it grows; hoarded, it rots.',                 reversed: 'Wealth clutched or leaking away. Mind where it drains before you chase more.' },
  { key: 'uruz',     name: 'Uruz',     sym: 'ᚢ', aett: 'freyr', reading: 'The wild ox — raw vigor and sudden strength. Meet the thing head-on.',                reversed: 'Strength misspent, or turned against yourself. Rein the brute in.' },
  { key: 'thurisaz', name: 'Thurisaz', sym: 'ᚦ', aett: 'freyr', reading: 'The thorn — a sharp defense, a conflict that clears the air. Let it prick.',          reversed: 'A reckless thorn, cutting the wrong hand. Stay the strike a moment.' },
  { key: 'ansuz',    name: 'Ansuz',    sym: 'ᚨ', aett: 'freyr', reading: 'The god, or the mouth: the source of speech (the rune poems give both). A true word is coming; listen, then say it.',        reversed: 'A lie, or a word misheard. Weigh what you are told twice.' },
  { key: 'raidho',   name: 'Raidho',   sym: 'ᚱ', aett: 'freyr', reading: 'The ride — a journey with purpose, right action in its right order.',                   reversed: 'A road gone crooked, or set out on too soon. Check your bearings.' },
  { key: 'kenaz',    name: 'Kenaz',    sym: 'ᚲ', aett: 'freyr', reading: 'The torch — knowledge kindled, a craft learned, the dark made workable.',              reversed: 'A guttering flame. What you knew no longer lights the way.' },
  { key: 'gebo', same: true,     name: 'Gebo',     sym: 'ᚷ', aett: 'freyr', reading: 'The gift — a bond, an exchange that binds two freely. Give, and be given to.',         reversed: 'A gift with a hook in it. Count the cost of what is offered.' },
  { key: 'wunjo',    name: 'Wunjo',    sym: 'ᚹ', aett: 'freyr', reading: 'Joy — harmony, a wish met, the glad company of your own.',                              reversed: 'Joy withheld, discord in the hall. Tend the small sorrows first.' },
  // ── Hagal's Aett ──────────────────────────────────────────────────────────
  { key: 'hagalaz', same: true,  name: 'Hagalaz',  sym: 'ᚺ', aett: 'hagal', reading: 'The hail — a disruption you did not call. It passes; the field drinks it. Stand.',     reversed: 'The storm lingers. No way around it — only through, and low.' },
  { key: 'nauthiz', same: true,  name: 'Nauthiz',  sym: 'ᚾ', aett: 'hagal', reading: 'Need — the friction that forges. Necessity teaches what ease never could.',            reversed: 'A need ignored. Name the lack before it names you.' },
  { key: 'isa', same: true,      name: 'Isa',      sym: 'ᛁ', aett: 'hagal', reading: 'Ice — a standstill, a holding. Do not push the frozen river; wait for the thaw.',       reversed: 'Frozen too long. The stillness has become a hiding place.' },
  { key: 'jera', same: true,     name: 'Jera',     sym: 'ᛃ', aett: 'hagal', reading: 'The harvest — the turning year, the reward of work rightly timed. It comes round.',     reversed: 'The reaping is early or late. Let the season finish its work.' },
  { key: 'eihwaz', same: true,   name: 'Eihwaz',   sym: 'ᛇ', aett: 'hagal', reading: 'The yew, hard and fast in the earth and a guardian of flame, says the Old English poem. Endure through the dark.',                reversed: 'Endurance fraying. The passage is long; spend your strength slower.' },
  { key: 'perthro',  name: 'Perthro',  sym: 'ᛈ', aett: 'hagal', reading: 'Peorð, play and laughter in the hall, says the Old English poem; nobody now knows what it was. What is hidden is still in play.',   reversed: 'The game goes sour. Some things stay hidden, and should.' },
  { key: 'algiz',    name: 'Algiz',    sym: 'ᛉ', aett: 'hagal', reading: 'The elk-sedge, a reed that wounds the hand that grasps it (Old English poem). Guard yourself, and do not snatch.',            reversed: 'You have grasped at something sharp. Let go, and mind the cut.' },
  { key: 'sowilo', same: true,   name: 'Sowilo',   sym: 'ᛊ', aett: 'hagal', reading: 'The sun — victory, wholeness, the light that scatters doubt. Follow it.',              reversed: 'The sun behind cloud. The win is real but not yet in hand.' },
  // ── Tyr's Aett ────────────────────────────────────────────────────────────
  { key: 'tiwaz',    name: 'Tiwaz',    sym: 'ᛏ', aett: 'tyr',   reading: "Týr, the one-handed god, who gave his hand to bind the wolf. The vow kept at a cost. Hold the line.",               reversed: 'Zeal misdirected, a vow strained. Be sure the cause is just.' },
  { key: 'berkano',  name: 'Berkano',  sym: 'ᛒ', aett: 'tyr',   reading: 'The birch — birth and growth, a thing sheltered and tended into being.',               reversed: 'Growth stunted, a tending neglected. Something needs more care.' },
  { key: 'ehwaz',    name: 'Ehwaz',    sym: 'ᛖ', aett: 'tyr',   reading: 'The horse — partnership, trusted movement, two who go better paired.',                  reversed: 'A partnership out of step. Rebuild the trust before the ride.' },
  { key: 'mannaz',   name: 'Mannaz',   sym: 'ᛗ', aett: 'tyr',   reading: 'The self — your place among kin, the human measure. Know yourself plainly.',            reversed: 'Self-deception, or standing too alone. Look outward; ask for the hand.' },
  { key: 'laguz',    name: 'Laguz',    sym: 'ᛚ', aett: 'tyr',   reading: 'Water, the sea that frightens sailors and will not answer the bridle (Old English poem). Go with the current, carefully.',               reversed: 'The current confuses. Do not trust every pull of feeling.' },
  { key: 'ingwaz', same: true,   name: 'Ingwaz',   sym: 'ᛜ', aett: 'tyr',   reading: 'Ing, who went east over the waves with his wagon behind him (Old English poem). A thing set going that will come round again.',              reversed: 'The thing set going stalls. What is ready to begin is being held back.' },
  { key: 'dagaz', same: true,    name: 'Dagaz',    sym: 'ᛞ', aett: 'tyr',   reading: 'The dawn — breakthrough, the hinge of night and day, a clear new light.',               reversed: 'The dawn delayed. Hold on; the night does not get the last word.' },
  { key: 'othala',   name: 'Othala',   sym: 'ᛟ', aett: 'tyr',   reading: 'The homestead — inheritance, what is truly yours, the ground you belong to.',           reversed: 'Clinging to the old, or cut from your roots. Tend what is actually yours.' },
];

// The three staves of a cast. The crossing (center) carries the counsel.
const RUNE_POSITIONS = [
  { key: 'root',     label: 'The Root',     hint: 'what underlies this' },
  { key: 'crossing', label: 'The Crossing', hint: 'what tests you now' },
  { key: 'outcome',  label: 'The Outcome',  hint: 'the way it leans' },
];

// The three aettir — the collectible arc (the codex records each rune the first
// time it falls; completing an aett is a leg that pays a purse, and carving all
// three — the whole Futhark — earns the Runecaster aura). Parallel to the tarot's
// Fool's Journey. `gold` is the purse for finishing the aett; the member runes are
// read off RUNES by their `aett`, so there is one list to keep.
const RUNE_AETTIR = [
  { id: 'freyr', name: "Freyr's Aett", lore: 'The first eight — cattle and ox, thorn and gift; the runes of the world and its getting.', gold: 70 },
  { id: 'hagal', name: "Hagal's Aett", lore: 'The middle eight — hail and need, ice and sun; the runes of what befalls and what endures.', gold: 110 },
  { id: 'tyr',   name: "Tyr's Aett",   lore: 'The last eight — the god and the birch, the horse and the homestead; the runes of self and belonging.', gold: 170 },
];

// The keys of the runes that make up one aett, in Futhark order — the codex's
// per-leg roster, derived from RUNES so membership lives in one place.
function aettKeys(aettId) { return RUNES.filter((r) => r.aett === aettId).map((r) => r.key); }

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

// Where all this really comes from — shown with every cast.
const RUNE_PROVENANCE = {
  tier: 'revival',
  line: "The Elder Futhark is real: 24 runes, cut in rows of eight on the 6th-century Vadstena bracteate. Their names are reconstructions, and the readings here follow the Old English, Norwegian and Icelandic rune poems where they can. Casting runes to read them, and reading them reversed, are 20th-century (popularised by Ralph Blum, 1982); the lots Tacitus describes (Germania 10, AD 98) were marked slips of wood, not proven runes.",
  source: 'The Old English Rune Poem; Tacitus, Germania 10; R. I. Page, Runes (1987)',
};

module.exports = { RUNES, RUNE_POSITIONS, RUNE_AETTIR, RUNE_PROVENANCE, aettKeys, runeSynthesis };
