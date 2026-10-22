// The Reliquary (roadmap #8 — turn the decorative relics-under-glass into a
// real collection). The eight relics displayed in the Starlight Arcade and the
// Phantom Parlor were named with care but did nothing; now each can be inspected
// (walk up, press F) to read its lore card, which logs it to the player's
// Reliquary. Inspect all eight and earn "Keeper of the Reliquary." Static lore,
// no rotation — the pull is completing the set and the writing itself. The ids
// and names line up with the pedestals in client/furniture.js.

const RELICS = [
  // ── The Starlight Arcade ──────────────────────────────────────────────
  {
    id: 'scrying_orb',
    name: 'Scrying Orb',
    room: 'the Starlight Arcade',
    text: 'A sphere of cold blue glass that shows not the future but the present, honestly, which is far rarer and far less welcome. Apprentices were forbidden to look into it after one too many caught their own reflection doing something they had not yet decided to do. It is kept under glass less to protect the orb than to protect the room from it.'
  },
  {
    id: 'star_grimoire',
    name: 'Star Grimoire',
    room: 'the Starlight Arcade',
    text: 'An open book whose pages rewrite themselves to match tonight\'s sky, so that it is always current and never finished. Every witch who has tried to copy it out has found their fair copy blank by morning — the Grimoire does not wish to be duplicated, only consulted. The constellation on the left page is one no almanac names. The right page is always a little ahead.'
  },
  {
    id: 'starforged_blade',
    name: 'Starforged Blade',
    room: 'the Starlight Arcade',
    text: 'Quenched in meltwater under a new moon and never once drawn in anger, which is the only reason it still gleams. The smith who made it is said to have forged it to cut one specific thing, told no one what, and took the secret down with her. It hums, very faintly, when the real moon is full — as if remembering an appointment it has not yet been asked to keep.'
  },
  {
    id: 'moon_relic',
    name: 'Moon Relic',
    room: 'the Starlight Arcade',
    text: 'A silver crescent with two motes forever trailing it, carved from a stone that fell the night the Seal was first raised. Hold it and the back of your hand aches as though remembering a tide. The two motes are said to be the nights the moon went missing from the sky — kept here, on their leash, so they can never go missing again.'
  },
  // ── The Phantom Parlor ────────────────────────────────────────────────
  {
    id: 'phantom_lantern',
    name: 'Phantom Lantern',
    room: 'the Phantom Parlor',
    text: 'An iron cage holding a green flame that gives no heat, casts no shadow, and has never once gone out. The Parlor keeps it lit for the guests who arrive after closing and cannot find the door — the light, they say, is kind to the recently lost. Pass your hand through the bars and the flame leans toward you, curious, the way a cat considers a stranger who might be staying.'
  },
  {
    id: 'spirit_bell',
    name: 'Spirit Bell',
    room: 'the Phantom Parlor',
    text: 'A small green bell with a clapper that hangs a hair\'s breadth from the rim, close enough that it rings on nights when nothing in this world has touched it. The old staff kept a ledger of its ringings against the next morning\'s news and swore the correlation was exact. The ledger is lost. The bell is still listening, and still, occasionally, replying.'
  },
  {
    id: 'bound_spirit',
    name: 'Bound Spirit',
    room: 'the Phantom Parlor',
    text: 'A stoppered jar with a single pale wisp turning slowly inside, and a lid that no one has been brave or foolish enough to test in a hundred years. The card beneath it reads only "DO NOT OPEN — he is calmer this way, and so are we." Whether the spirit is prisoner or guest is a question the Parlor declines to settle. On quiet nights the wisp presses to the glass, as if to read your face, and remembers it.'
  },
  {
    id: 'seance_planchette',
    name: 'Séance Planchette',
    room: 'the Phantom Parlor',
    text: 'The teardrop of wood and glass that rode the great board on the night the Parlor first spoke to the other side — and, the regulars insist, kept moving for a full minute after every hand had been lifted away. It is retired now, under glass, out of respect: a tool that has learned to work without you is a tool you stop holding. Look through its little window and the grain of the table beneath seems to spell something, just before you blink.'
  }
];

module.exports = { RELICS };
