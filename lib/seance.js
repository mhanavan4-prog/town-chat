'use strict';
// The Séance Board — coven ritual (Tier 3.5, Phase 2: server plumbing).
//
// A coven gathers in the manor, pays an offering, and asks the dark a question.
// A planchette spells out a reply, letter by letter, broadcast in sync to every
// member present. In this phase the reply comes from a hand-written FALLBACK
// bank — no live AI yet (that is Phase 3, which swaps pickAnswer() for an LLM
// call guarded by the same sanitize() + fallback path).
//
// This module is PURE: no timers, no sockets, no persistence, no server state.
// The server owns the timers, the broadcasting and the cooldown record; it calls
// these helpers. Keeping it pure keeps it unit-testable.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const WORDS = ['YES', 'NO', 'GOODBYE'];

// Cryptic, in-world answers. Short, uppercase, board-spellable. Tie to the
// Hollow / Hazel / the sealed door lore so the board feels part of the story.
const FALLBACK_LINES = [
  'THE DOOR HOLDS',
  'NOT YET',
  'SHE SLEEPS BELOW',
  'FIVE HANDS NO MORE',
  'COUNT THE GRAVES',
  'SOON',
  'WE REMEMBER YOU',
  'THE SEAL IS THIN',
  'ASK HAZEL',
  'THE HOLLOW WAKES',
  'FORTY TWO VOICES',
  'LEAVE A LIGHT ON',
  'IT IS COLD HERE',
  'YOU ARE NOT ALONE',
  'YES',
  'NO',
];

// A small blocklist is a safety net even though Phase 2 answers come from the
// curated bank above. Phase 3's LLM output passes through sanitize() with this.
const DEFAULT_BLOCKLIST = [];

// ── Lore hints (Phase 4) ────────────────────────────────────────────────────
// A fraction of séances drop a REAL clue tied to the main story — the sealed
// door, Hazel the fifth ritualist, the Hollow, the forty-two voices. Each hint
// has a `seed` (a secret handed to the spirit to reveal cryptically when the AI
// is on) and a `line` (a curated, board-spellable fallback spelled directly
// when the AI is off or declines). Both routes still pass sanitize().
const LORE_HINTS = [
  { seed: 'The fifth ritualist, Hazel, never died — she holds the seal shut beneath the Wilds.', line: 'HAZEL IS THE FIFTH HAND' },
  { seed: 'The seal on the Hollow is weakening after five hundred years.', line: 'THE SEAL IS FAILING' },
  { seed: 'There are forty-two voices among the towns dead, one more than there are graves.', line: 'FORTY TWO NOT FORTY ONE' },
  { seed: 'There is a sealed door beneath the Wilds that the old Circle still guards.', line: 'A DOOR UNDER THE WILDS' },
  { seed: 'The Hollow is gathering the dead it has taken to build itself a body.', line: 'IT BUILDS A BODY' },
  { seed: 'The cave entrance is where the rabbits refuse to graze, in the north-west Wilds.', line: 'WHERE RABBITS WILL NOT GRAZE' },
  { seed: 'The old Circle had five ritualists; four have graves, the fifth does not.', line: 'FOUR GRAVES NOT FIVE' },
  { seed: 'The knights order was founded to guard the door, not the roads.', line: 'THE WATCH GUARDS A DOOR' },
  { seed: 'Every werewolf in the valley traces back to one first bite the night the seal shattered.', line: 'ONE BITE STARTED ALL' },
  { seed: 'The deepest floors of the delve open onto the throat the Hollow carved below.', line: 'GO DEEPER TO FIND IT' },
];

const CONFIG = {
  MIN_MEMBERS: 2,            // members present in the manor to begin
  OFFERING_GOLD: 25,         // cost to light the board
  COOLDOWN_MS: 30 * 60 * 1000, // per-coven cooldown
  BUILDUP_MS: 1800,          // "opening the channel" — hides generation latency
  TRAVEL_MS: 650,            // planchette glide per glyph
  DWELL_MS: 300,             // pause on each landed glyph
  SPACE_MS: 320,             // pause between words
  CLOSE_MS: 900,             // hold before sliding to GOODBYE / resting
  MAX_CHARS: 48,             // hard cap on spelled length
  HINT_CHANCE: 0.08,         // chance a séance drops a real story hint (rare, so
  HINT_CHANCE_BLOODMOON: 0.15, // most séances answer the coven's own question)
};

function normalizeMessage(text) {
  return String(text == null ? '' : text)
    .toUpperCase()
    .replace(/\s+/g, ' ')        // any whitespace (tabs, newlines) -> one space
    .replace(/[^A-Z0-9 ]/g, '')  // then drop anything off the board
    .replace(/ +/g, ' ')         // collapse gaps left by stripped punctuation
    .trim();
}

// Safety gate: map arbitrary text to the board charset and reject on a blocklist
// hit. Returns the clean, spellable message, or null if nothing survives or it
// is blocked. Phase 3 runs LLM output through this before a single letter lights.
function sanitize(text, opts) {
  const o = opts || {};
  const blocklist = o.blocklist || DEFAULT_BLOCKLIST;
  const maxChars = o.maxChars || CONFIG.MAX_CHARS;
  const norm = normalizeMessage(text);
  if (!norm) return null;
  const squished = norm.replace(/ /g, '');
  for (const bad of blocklist) {
    const b = normalizeMessage(bad).replace(/ /g, '');
    if (b && squished.includes(b)) return null;
  }
  return norm.length > maxChars ? normalizeMessage(norm.slice(0, maxChars)) : norm;
}

// Build the ordered planchette steps for a message. Each step is one of:
//   { kind: 'glyph', glyph: 'A', char: 'A' }   letter or digit
//   { kind: 'word',  glyph: 'YES', char: 'YES' } whole-word corner / GOODBYE
//   { kind: 'space', glyph: null,  char: ' ' }   gap between words
// A whole message of exactly YES / NO / GOODBYE slides to that one spot (like a
// real board). Any other message spells out, then closes on GOODBYE.
function buildSteps(message) {
  const norm = normalizeMessage(message);
  const squished = norm.replace(/ /g, '');
  if (squished === 'YES') return { message: 'YES', steps: [{ kind: 'word', glyph: 'YES', char: 'YES' }], closed: false };
  if (squished === 'NO') return { message: 'NO', steps: [{ kind: 'word', glyph: 'NO', char: 'NO' }], closed: false };
  if (squished === 'GOODBYE') return { message: 'GOODBYE', steps: [{ kind: 'word', glyph: 'GOODBYE', char: 'GOODBYE' }], closed: true };
  const steps = [];
  for (const ch of norm) {
    if (ch === ' ') steps.push({ kind: 'space', glyph: null, char: ' ' });
    else steps.push({ kind: 'glyph', glyph: ch, char: ch });
  }
  if (steps.length) steps.push({ kind: 'word', glyph: 'GOODBYE', char: '', close: true });
  return { message: norm, steps, closed: steps.length > 0 };
}

// Relative timing (ms from the end of the buildup) for each step, so the server
// can schedule broadcasts and every client animates in lockstep.
function scheduleFor(steps, cfg) {
  const c = cfg || CONFIG;
  let t = 0;
  let prevGlyph = null;
  return steps.map((s) => {
    if (s.kind === 'space') {
      t += c.SPACE_MS;
      return { ...s, atMs: t };
    }
    if (s.close) {
      t += c.CLOSE_MS;
      return { ...s, atMs: t };
    }
    // a repeated glyph needs a visible nudge, so give it a touch more time
    const repeat = s.glyph && s.glyph === prevGlyph;
    t += c.TRAVEL_MS + (repeat ? Math.round(c.TRAVEL_MS * 0.45) : 0) + c.DWELL_MS;
    prevGlyph = s.glyph;
    return { ...s, atMs: t, repeat: !!repeat };
  });
}

// Phase 2 answer: a line from the fallback bank. Phase 3 replaces this with an
// LLM call whose result is run through sanitize() and falls back here on reject.
function pickAnswer(opts) {
  const o = opts || {};
  const rng = o.rng || Math.random;
  const lines = o.lines || FALLBACK_LINES;
  if (!lines.length) return 'GOODBYE';
  return lines[Math.floor(rng() * lines.length)];
}

// Should this séance carry a real story hint? Pure: pass the roll and chance.
function shouldHint(rng, chance) {
  const r = (rng || Math.random)();
  const c = chance != null ? chance : CONFIG.HINT_CHANCE;
  return r < c;
}

// Pick a lore hint ({ seed, line }). Pure: pass an rng for determinism.
function pickLoreHint(opts) {
  const o = opts || {};
  const rng = o.rng || Math.random;
  const hints = o.hints || LORE_HINTS;
  if (!hints.length) return null;
  return hints[Math.floor(rng() * hints.length)];
}

// Pure gating check for starting a ritual. Returns { ok: true } or
// { ok: false, reason, ... } with enough detail for a clear client message.
function canStart(state) {
  const s = state || {};
  const enabled = s.enabled !== false;
  const minMembers = s.minMembers != null ? s.minMembers : CONFIG.MIN_MEMBERS;
  const offeringCost = s.offeringCost != null ? s.offeringCost : CONFIG.OFFERING_GOLD;
  const cooldownMs = s.cooldownMs != null ? s.cooldownMs : CONFIG.COOLDOWN_MS;
  const membersPresent = s.membersPresent || 0;
  const gold = s.gold || 0;
  const lastAt = s.lastAt || 0;
  const now = s.now || Date.now();

  if (!enabled) return { ok: false, reason: 'disabled' };
  if (!s.inCoven) return { ok: false, reason: 'not_in_coven' };
  if (!s.inManor) return { ok: false, reason: 'not_in_manor' };
  if (s.active) return { ok: false, reason: 'already_active' };
  if (membersPresent < minMembers) return { ok: false, reason: 'need_members', need: minMembers, have: membersPresent };
  if (gold < offeringCost) return { ok: false, reason: 'cannot_afford', need: offeringCost, have: gold };
  if (lastAt && now - lastAt < cooldownMs) return { ok: false, reason: 'cooldown', retryMs: cooldownMs - (now - lastAt) };
  return { ok: true };
}

module.exports = {
  LETTERS,
  DIGITS,
  WORDS,
  FALLBACK_LINES,
  DEFAULT_BLOCKLIST,
  LORE_HINTS,
  CONFIG,
  normalizeMessage,
  sanitize,
  buildSteps,
  scheduleFor,
  pickAnswer,
  shouldHint,
  pickLoreHint,
  canStart,
};
