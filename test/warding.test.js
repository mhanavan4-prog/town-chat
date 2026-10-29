// Warding (Tier 3.5) — the Circle of Salt. Salt is a usable item whose 'ward'
// effect cleanses a curse and turns aside new ones for a window. The server's
// guards are inline, so this mirrors their logic against the real data.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { PLANT_CATALOG } = require('../data/world.js');

// ── The salt item ─────────────────────────────────────────────────────────────
const salt = PLANT_CATALOG.salt;
check('salt is a usable item', !!salt, salt);
check('salt casts a ward', salt && salt.effect === 'ward', salt && salt.effect);
check('the ward lasts a real window', salt && salt.durationMs >= 30000, salt && salt.durationMs);

// ── The guard predicates (mirror of the server) ──────────────────────────────
const VULNERABLE_STATUSES = new Set(['wither', 'stumble', 'shrink', 'toad', 'gibberish', 'wolfmark']);
function isWarded(p, now) { return !!(p && p.wardUntil && p.wardUntil > now); }
function debuffBlocked(victim, statusType, now) {
  return isWarded(victim, now) && VULNERABLE_STATUSES.has(statusType);
}

const now = 1000000;
const warded = { wardUntil: now + 30000 };
const bare = { wardUntil: 0 };
const expired = { wardUntil: now - 1 };

check('a ward blocks an incoming hex', debuffBlocked(warded, 'stumble', now) === true);
check('a ward blocks a wither curse', debuffBlocked(warded, 'wither', now) === true);
check('an unwarded victim is still cursed', debuffBlocked(bare, 'stumble', now) === false);
check('an expired ward no longer protects', debuffBlocked(expired, 'stumble', now) === false);
check('a ward does NOT block a non-debuff status (e.g. a buff)', debuffBlocked(warded, 'regen', now) === false);
check('a ward does NOT block a cosmetic (bats)', debuffBlocked(warded, 'bats', now) === false);

// ── The cast: cleanse + set the ward window ──────────────────────────────────
function castCircle(player, now) {
  if (player.activeStatus && VULNERABLE_STATUSES.has(player.activeStatus.type)) player.activeStatus = null;
  player.wardUntil = now + salt.durationMs;
}
const hexed = { activeStatus: { type: 'toad', expiresAt: now + 10000 } };
castCircle(hexed, now);
check('casting the circle cleanses a current curse', hexed.activeStatus === null, hexed.activeStatus);
check('casting the circle opens the ward window', isWarded(hexed, now), hexed.wardUntil);
const buffed = { activeStatus: { type: 'regen', expiresAt: now + 10000 } };
castCircle(buffed, now);
check('casting the circle does NOT strip a beneficial status', buffed.activeStatus !== null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
