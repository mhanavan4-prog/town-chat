// Content filter (Session O — open-launch moderation).
//
// A deliberately TARGETED blocklist of hate slurs and the few hard terms we
// never want in a global, anonymous chat that brand-new players drop straight
// into. This is NOT a broad profanity nanny: ordinary swearing is allowed —
// the game's tone is witchy, not sanitized — so mild words are intentionally
// absent. The list targets slurs and hate, and is meant to be tuned: add or
// remove entries in BLOCKLIST as moderation experience dictates.
//
// Matching is evasion-aware but conservative, to avoid false positives (the
// classic "Scunthorpe problem" where an innocent word contains a bad
// substring):
//   1. the text is lowercased and common leet substitutions are folded
//      (1->i 3->e 0->o 4->a 5->s 7->t $->s @->a 8->b 9->g);
//   2. each blocked term is matched with OPTIONAL separators allowed between
//      its letters, so "n i g g e r", "n.i.g.g.e.r" and "n_i_g_g_e_r" are
//      caught as well as the plain word;
//   3. the whole run is bounded by non-alphanumeric lookarounds, so a term
//      never fires inside a longer innocent word ("Scunthorpe", "class",
//      "assassin", "cockpit", "analysis" all stay clean).
//
// The module exposes only booleans/samples — it never emits or amplifies the
// terms themselves beyond a masked sample for the private moderation log.

// Core hate slurs and hard terms. Kept lowercase, plain letters (leet folding
// happens on the INPUT, not here). Intentionally compact — quality over a long
// list that invites false positives.
const BLOCKLIST = [
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'tranny', 'kike', 'spic',
  'chink', 'gook', 'wetback', 'coon', 'dyke', 'paki', 'beaner', 'cunt',
  'rapist', 'pedo', 'pedophile', 'molester'
];

// A few terms above are short enough that the separator-tolerant match could,
// in theory, graze an innocent spaced phrase. These are matched ONLY as a
// solid word (no inter-letter separators allowed) to keep them tight.
const SOLID_ONLY = new Set(['fag', 'coon', 'dyke', 'spic', 'gook', 'paki', 'pedo']);

const LEET = { '1': 'i', '!': 'i', '3': 'e', '0': 'o', '4': 'a', '5': 's', '$': 's', '7': 't', '@': 'a', '8': 'b', '9': 'g' };

function foldLeet(s) {
  let out = '';
  for (const ch of String(s).toLowerCase()) out += (LEET[ch] || ch);
  return out;
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Build one regex per term. Non-alphanumeric lookarounds bound the match so it
// can't live inside a longer word; between-letter [\W_]* allows evasion via
// spaces/punctuation (except for the SOLID_ONLY short terms).
const PATTERNS = BLOCKLIST.map((term) => {
  const chars = term.split('').map(escapeRe);
  const sep = SOLID_ONLY.has(term) ? '' : '[\\W_]*';
  const body = chars.join(sep);
  return { term, re: new RegExp('(?<![a-z0-9])' + body + '(?![a-z0-9])', 'i') };
});

// Returns the matched term (for the moderation log) or null. Operates on the
// leet-folded, lowercased text.
function matchBlocked(text) {
  if (!text) return null;
  const folded = foldLeet(text);
  for (const { term, re } of PATTERNS) if (re.test(folded)) return term;
  return null;
}

function isBlocked(text) { return matchBlocked(text) !== null; }

// A privacy-preserving sample for the audit log: first letter + asterisks, so a
// moderator sees roughly what tripped the filter without the log storing a full
// slur in plaintext.
function maskSample(term) {
  if (!term) return '';
  return term[0] + '*'.repeat(Math.max(1, term.length - 1));
}

module.exports = { BLOCKLIST, matchBlocked, isBlocked, maskSample, foldLeet };
