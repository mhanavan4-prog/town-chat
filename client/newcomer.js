// What a first-time player is told, and when. Pure: main.js feeds it what it knows and shows what comes back.
//
// All of this is the game's own teaching, not lore: there is nothing from the record here.

// The "what next" line stops at this level: by then the player has fought, begun the story and levelled twice.
export const GUIDE_UNTIL_LEVEL = 3;
// Below this level, dying to a creature is met with a reassurance (it costs nothing; say so).
export const GENTLE_DEATH_BELOW = 5;
// Doors that lead somewhere a low-level character will die at once, and the level they are built for. First picks.
export const DOOR_WARNINGS = {
  crypt: { level: 8, name: 'the crypt', why: 'Its Warden hits hard and does not tire.' },
  ember: { level: 12, name: 'the Ember Wastes', why: 'Every creature there is hostile, and so is every other player.' },
};

// The one line a newcomer sees: the next thing worth doing. null when there is nothing to say (or they are past it).
// k: { level, struck (ever landed a blow), story: { active, complete, waiting (a chapter ready to begin), title }, touch }
export function newcomerNextStep(k) {
  if (!k || (k.level || 1) >= GUIDE_UNTIL_LEVEL) return null;
  if (!k.struck) {
    return { id: 'strike', title: '🧭 First steps', text: k.touch
      ? 'Walk up to the practice scarecrow by the square and tap the sword.'
      : 'Walk up to the practice scarecrow by the square and press R (or click it).' };
  }
  const s = k.story;
  if (s && !s.complete && !s.active && s.waiting) {
    return { id: 'story', title: '🧭 What next', text: `Begin your story: ${s.title || 'Chapter 1'}. ${k.touch ? 'Tap here.' : 'Click here, or press J for your Journal.'}`, action: 'begin' };
  }
  return null; // a chapter is under way: the story tracker itself says what to do
}

// Should this door stop and warn first? Returns the warning, or null to let them through.
export function doorWarning(door, level) {
  const d = DOOR_WARNINGS[door];
  if (!d || (level || 1) >= d.level) return null;
  return { text: `⚠️ ${d.name[0].toUpperCase() + d.name.slice(1)} is meant for Level ${d.level} and up (you are Level ${level || 1}). ${d.why} Use the door again to go in anyway.`, level: d.level };
}

// The line under "You are a ghost" for someone new, when a creature (not a player) did it.
export function gentleDeathLine(level, byPlayer) {
  if (byPlayer || (level || 1) >= GENTLE_DEATH_BELOW) return null;
  return 'Nothing is lost: your gold, your pack and your level are as you left them. Rise when you are ready and try again.';
}
