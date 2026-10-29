// Daily Tarot (Tier 3.5) — the divination daily-draw. Once per UTC day a witch
// turns a card from the Major Arcana for a reading, a little gold, and the
// occasional whispered secret. Flavor-first (the reading is the point); the
// reward is small so it's a habit, not a grind. The server sends the whole card
// to the client, so there is no client-side copy to keep in sync.

const TAROT_CARDS = [
  { key: 'fool',        name: 'The Fool',            emoji: '🃏', reading: 'A leap into the unknown. Begin the thing you have been circling.' },
  { key: 'magician',    name: 'The Magician',        emoji: '🪄', reading: 'The tools are already in your hands. Will it into being.' },
  { key: 'priestess',   name: 'The High Priestess',  emoji: '🔮', reading: 'The answer is beneath the surface. Trust what you already sense.' },
  { key: 'empress',     name: 'The Empress',         emoji: '🌿', reading: 'Abundance stirs. Tend what you have planted and it will grow.' },
  { key: 'emperor',     name: 'The Emperor',         emoji: '👑', reading: 'Set the structure. Order now is freedom later.' },
  { key: 'hierophant',  name: 'The Hierophant',      emoji: '📖', reading: 'The old ways have something to teach. Seek the elder, the book, the rite.' },
  { key: 'lovers',      name: 'The Lovers',          emoji: '💞', reading: 'A choice of the heart. Choose by what you value, not what you fear.' },
  { key: 'chariot',     name: 'The Chariot',         emoji: '🏇', reading: 'Hold the reins of two wild things and drive straight. Victory follows resolve.' },
  { key: 'strength',    name: 'Strength',            emoji: '🦁', reading: 'Not force but patience tames the beast. Gentle hands, steady heart.' },
  { key: 'hermit',      name: 'The Hermit',          emoji: '🕯️', reading: 'Step back from the noise. The lantern you need is your own.' },
  { key: 'wheel',       name: 'Wheel of Fortune',    emoji: '🎡', reading: 'The wheel turns. What was down comes up — be ready to ride it.' },
  { key: 'justice',     name: 'Justice',             emoji: '⚖️', reading: 'The scales find their level. Speak true and the truth holds you up.' },
  { key: 'hanged',      name: 'The Hanged One',      emoji: '🙃', reading: 'Surrender the struggle. Seen upside-down, the knot comes loose.' },
  { key: 'death',       name: 'Death',               emoji: '💀', reading: 'An ending clears the ground. Let the dead thing go and something new roots.' },
  { key: 'temperance',  name: 'Temperance',          emoji: '⚗️', reading: 'Blend, do not force. The slow mixture is the strong one.' },
  { key: 'devil',       name: 'The Devil',           emoji: '⛓️', reading: 'A chain you could slip if you looked at it. What holds you only because you let it?' },
  { key: 'tower',       name: 'The Tower',           emoji: '🗼', reading: 'What was built on sand comes down. Let it — the fall is the mercy.' },
  { key: 'star',        name: 'The Star',            emoji: '⭐', reading: 'After the storm, a clear light. Hope is not naive here; it is earned.' },
  { key: 'moon',        name: 'The Moon',            emoji: '🌙', reading: 'Not all is as it seems by this light. Walk slow; trust the path, not the shadows.' },
  { key: 'sun',         name: 'The Sun',             emoji: '☀️', reading: 'Warmth and plain good fortune. Step into the open and be seen.' },
  { key: 'judgement',   name: 'Judgement',           emoji: '📯', reading: 'A reckoning calls you up. Answer it — you are readier than you think.' },
  { key: 'world',       name: 'The World',           emoji: '🌍', reading: 'A circle closes, whole and complete. Rest here before the next turn.' },
];

module.exports = { TAROT_CARDS };
