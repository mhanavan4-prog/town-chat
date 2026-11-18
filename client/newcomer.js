// What a first-time player is told, and when. Pure: main.js feeds it what it knows and shows what comes back.
//
// There is one guide: First Steps (server.js FIRST_STEPS). On a desktop it is the card in the corner; on a phone the
// card is folded to a pill to keep it out of the thumb's way, so the step in hand is shown as one always-on line in
// the story tracker instead. Both say the same thing.
//
// All of this is the game's own teaching, not lore: there is nothing from the record here.

// Below this level, dying to a creature is met with a reassurance (it costs nothing; say so).
export const GENTLE_DEATH_BELOW = 5;
// Doors that lead somewhere a low-level character will die at once, and the level they are built for. First picks.
export const DOOR_WARNINGS = {
  crypt: { level: 8, name: 'the crypt', why: 'Its Warden hits hard and does not tire.' },
  ember: { level: 12, name: 'the Ember Wastes', why: 'Every creature there is hostile, and so is every other player.' },
};

// How to do each step, by hand (d: keyboard and mouse, m: touch).
export const FIRST_STEP_HINTS = {
  struck:    { d: 'Walk up to the practice scarecrow by the square and press R (or click it).', m: 'Walk up to the practice scarecrow by the square and tap the sword.' },
  talked:    { d: 'Walk up to a glowing townsperson and press F to talk.',              m: 'Walk up to a glowing townsperson and tap the prompt that appears.' },
  ability:   { d: 'Press 1 to use your first ability — your hotbar runs along the bottom.', m: 'Tap an ability on the right to use it.' },
  story:     { d: 'Press J for your Journal and begin Chapter 1.',                      m: 'Tap here to begin Chapter 1.' },
  killed:    { d: 'Night creatures roam after dark — press R, or click one, to strike.', m: 'Night creatures roam after dark — tap one to strike.' },
  harvested: { d: 'Take the north portal to the Wilds, then click a plant to harvest it.', m: 'Take the north portal to the Wilds, then tap a plant to harvest it.' },
};
export function firstStepHint(id, touch) { const h = FIRST_STEP_HINTS[id]; return h ? (touch ? h.m : h.d) : ''; }

// Which step to point at now. Creatures only come out after dark, so by day "fell a night creature" cannot be
// done: someone who arrives in daylight is pointed past it to whatever else is left, and comes back to it at
// nightfall. Only when it is the last thing left by day is it shown, with how long there is to wait.
// when: { night, msToNight }
export function firstStepNow(steps, when) {
  const left = (steps || []).filter((s) => !s.done);
  if (!left.length) return null;
  if (when && !when.night && left[0].id === 'killed' && left.length > 1) return left.find((s) => s.id !== 'killed');
  return left[0];
}
export function firstStepHintNow(id, touch, when) {
  if (id === 'killed' && when && !when.night) {
    const mins = Math.max(1, Math.round((when.msToNight || 0) / 60000));
    return `Creatures only come out after dark. Night falls in about ${mins} minute${mins === 1 ? '' : 's'}: look around until then, and they will find you.`;
  }
  return firstStepHint(id, touch);
}

// The always-on line: the First Step in hand. null when there is nothing to say: First Steps is done or was never
// given, or the card itself is on show (`card`: a desktop).
// k: { steps: [{ id, label, icon, done }], done, touch, card }
export function newcomerNextStep(k) {
  if (!k || k.done || k.card || !Array.isArray(k.steps) || !k.steps.length) return null;
  const cur = firstStepNow(k.steps, k.when);
  if (!cur) return null;
  const n = k.steps.filter((s) => s.done).length;
  return { id: cur.id, title: `🏮 First Steps · ${n}/${k.steps.length}`, text: `${cur.icon} ${cur.label}. ${firstStepHintNow(cur.id, k.touch, k.when)}`, action: cur.id === 'story' ? 'begin' : '' };
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
