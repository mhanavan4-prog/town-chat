// Daily Tarot (Tier 3.5) — the divination daily-draw, now a three-card spread.
// Once per UTC day a witch lays The Past · The Present · What Comes from the
// Major Arcana. Each card falls upright or reversed (its shadow meaning), and a
// short synthesis reads the three together. Flavor-first; a little gold and an
// occasional whispered secret keep it a habit, not a grind. The server picks
// and sends the whole spread, so there is no client-side copy to keep in sync.

const TAROT_CARDS = [
  { key: 'fool',       num: '0',    name: 'The Fool',           emoji: '🃏', reading: 'A leap into the unknown. Begin the thing you have been circling.',               reversed: 'Look before you leap this time — a step taken too soon, or taken blind.' },
  { key: 'magician',   num: 'I',    name: 'The Magician',       emoji: '🪄', reading: 'The tools are already in your hands. Will it into being.',                        reversed: 'The tools are scattered and the focus is missing. Beware sleight of hand.' },
  { key: 'priestess',  num: 'II',   name: 'The High Priestess', emoji: '🔮', reading: 'The answer is beneath the surface. Trust what you already sense.',                 reversed: 'You are ignoring the quiet voice. A secret kept too long begins to curdle.' },
  { key: 'empress',    num: 'III',  name: 'The Empress',        emoji: '🌿', reading: 'Abundance stirs. Tend what you have planted and it will grow.',                    reversed: 'Something you tend is being smothered. Give it room, or give it rest.' },
  { key: 'emperor',    num: 'IV',   name: 'The Emperor',        emoji: '👑', reading: 'Set the structure. Order now is freedom later.',                                   reversed: 'Control has hardened into rigidity. Loosen the grip before it cracks.' },
  { key: 'hierophant', num: 'V',    name: 'The Hierophant',     emoji: '📖', reading: 'The old ways have something to teach. Seek the elder, the book, the rite.',        reversed: 'The old rule no longer fits. This is permission to do it your own way.' },
  { key: 'lovers',     num: 'VI',   name: 'The Lovers',         emoji: '💞', reading: 'A choice of the heart. Choose by what you value, not what you fear.',               reversed: 'A rift, or a choice made from fear. Name what you actually want.' },
  { key: 'chariot',    num: 'VII',  name: 'The Chariot',        emoji: '🏇', reading: 'Hold the reins of two wild things and drive straight. Victory follows resolve.',   reversed: 'The reins have slipped. Slow down and take back the direction.' },
  { key: 'strength',   num: 'VIII', name: 'Strength',           emoji: '🦁', reading: 'Not force but patience tames the beast. Gentle hands, steady heart.',              reversed: 'Forcing it is draining you. Try gentleness, not more effort.' },
  { key: 'hermit',     num: 'IX',   name: 'The Hermit',         emoji: '🕯️', reading: 'Step back from the noise. The lantern you need is your own.',                      reversed: 'You have withdrawn too far. The lantern is meant to be carried back.' },
  { key: 'wheel',      num: 'X',    name: 'Wheel of Fortune',   emoji: '🎡', reading: 'The wheel turns. What was down comes up — be ready to ride it.',                  reversed: 'A turn against you — but the wheel keeps turning. Hold on.' },
  { key: 'justice',    num: 'XI',   name: 'Justice',            emoji: '⚖️', reading: 'The scales find their level. Speak true and the truth holds you up.',             reversed: 'A thing left unsquared. Honesty now spares a reckoning later.' },
  { key: 'hanged',     num: 'XII',  name: 'The Hanged One',     emoji: '🙃', reading: 'Surrender the struggle. Seen upside-down, the knot comes loose.',                 reversed: 'Stalling dressed up as patience. The sacrifice has become avoidance.' },
  { key: 'death',      num: 'XIII', name: 'Death',              emoji: '💀', reading: 'An ending clears the ground. Let the dead thing go and something new roots.',     reversed: 'You are clinging to what is already gone. Let the ending finish.' },
  { key: 'temperance', num: 'XIV',  name: 'Temperance',         emoji: '⚗️', reading: 'Blend, do not force. The slow mixture is the strong one.',                        reversed: 'Something is out of balance — too much, too fast, too hot.' },
  { key: 'devil',      num: 'XV',   name: 'The Devil',          emoji: '⛓️', reading: 'A chain you could slip if you looked at it. What holds you only because you let it?', reversed: 'The chain is loosening. You are seeing the hold for what it is.' },
  { key: 'tower',      num: 'XVI',  name: 'The Tower',          emoji: '🗼', reading: 'What was built on sand comes down. Let it — the fall is the mercy.',              reversed: 'A fall you keep bracing against. Softer to let it come than to prop it up.' },
  { key: 'star',       num: 'XVII', name: 'The Star',           emoji: '⭐', reading: 'After the storm, a clear light. Hope is not naive here; it is earned.',           reversed: 'Faith is thin right now. The light has not left — look up.' },
  { key: 'moon',       num: 'XVIII',name: 'The Moon',           emoji: '🌙', reading: 'Not all is as it seems by this light. Walk slow; trust the path, not the shadows.', reversed: 'The fog is lifting. What frightened you shrinks in daylight.' },
  { key: 'sun',        num: 'XIX',  name: 'The Sun',            emoji: '☀️', reading: 'Warmth and plain good fortune. Step into the open and be seen.',                  reversed: 'Joy delayed, not denied. A cloud passes; the warmth is still there.' },
  { key: 'judgement',  num: 'XX',   name: 'Judgement',          emoji: '📯', reading: 'A reckoning calls you up. Answer it — you are readier than you think.',          reversed: 'A call you keep declining. Stop rehearsing and answer.' },
  { key: 'world',      num: 'XXI',  name: 'The World',          emoji: '🌍', reading: 'A circle closes, whole and complete. Rest here before the next turn.',           reversed: 'So close to whole — one last loose thread. Finish it.' },
];

// The three seats of the spread. The present (center) card carries the counsel.
const TAROT_POSITIONS = [
  { key: 'past',    label: 'The Past',    hint: 'what shaped the moment' },
  { key: 'present', label: 'The Present', hint: 'where you stand now' },
  { key: 'future',  label: 'What Comes',  hint: 'the way it leans' },
];

// Read the three together — one authored line that traces the arc and points to
// the center card as the counsel of the hour. Pure, so the server and the tests
// agree. `spread` is [{ card, reversed }, { card, reversed }, { card, reversed }].
function tarotSynthesis(spread) {
  if (!Array.isArray(spread) || spread.length < 3) return '';
  const nm = (s) => s.card.name + (s.reversed ? ', reversed,' : '');
  const [p, n, f] = spread;
  return `${nm(p)} shaped the ground you stand on; ${nm(n)} is the test of the hour; ` +
    `${nm(f)} is where it wants to go. Heed the middle card and move.`;
}

module.exports = { TAROT_CARDS, TAROT_POSITIONS, tarotSynthesis };
