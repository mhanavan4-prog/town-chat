// ---------------------------------------------------------------------------
// The besom you ride: a reward for reaching the twentieth level.
// Sit on it and ride about the town, the Wilds and the Ember Wastes, faster than walking and a little off the
// ground. It is for getting about, not for fighting: striking or casting puts you on your feet, and so does
// being hit (you are knocked off it). Under a roof, or underground, there is no room for it.
// The Old Ways' besom (lib/oldWays.js) is a different thing and stays as it was: a broom you make, that carries
// you by night to a far landing.
// ---------------------------------------------------------------------------

const MOUNT = {
  level: 20,          // the level that gives it
  speed: 1.6,         // walking pace times this, while riding
  hover: 26,          // how far off the ground you ride (world units)
  top: 1400,          // as high as she can take it (world units): up through the clouds (620 to 980) and out above them
  clear: 260,         // above this she is over the roofs and the trees, and nothing on the ground stops her
  climb: 260,         // units a second, up or down
};

const MOUNT_LORE = {
  tier: 'record',
  lore: 'The first pictures of women riding broomsticks are in the margin of Martin Le Franc\'s Le Champion des Dames, made about 1451.',
  source: 'Martin Le Franc, Le Champion des Dames (BnF fr. 12476, c.1451).',
  note: 'Those women are flying to a sabbat. Riding a besom about the place by day, as a way of getting around, is the game\'s.',
};

module.exports = function createBesomMount({ send, levelOf, openRooms, broadcastRoom = () => {} }) {
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });
  const tell = (player) => {
    send(player.ws, { type: 'besom_mount', on: !!player.mounted, level: MOUNT.level, speed: MOUNT.speed, hover: MOUNT.hover, top: MOUNT.top, clear: MOUNT.clear, climb: MOUNT.climb });
    broadcastRoom(player.room, { type: 'besom_mount_seen', id: player.id, on: !!player.mounted });
  };
  const earned = (player) => (levelOf(player) || 1) >= MOUNT.level;

  function mount(player, on) {
    if (!player || !player.ws) return false;
    if (!on) { if (player.mounted) { player.mounted = false; player.besomAlt = 0; tell(player); } return true; }
    if (player.isDead) return false;
    if (!earned(player)) { say(player, `🧹 The besom is yours at Level ${MOUNT.level}.`); return false; }
    if (!openRooms.has(player.room)) { say(player, '🧹 There is no room for it in here. Ride it outside.'); return false; }
    if (player.seated) { say(player, '🧹 Stand up first.'); return false; }
    if (!player.mounted) { player.mounted = true; tell(player); }
    return true;
  }

  // Off it, for a reason: 'hit' (knocked off), 'fight' (you struck or cast), 'room' (went somewhere it can't go),
  // 'dead'. Quiet unless you were knocked off.
  function dismount(player, why) {
    if (!player || !player.mounted) return false;
    player.mounted = false;
    player.besomAlt = 0;
    tell(player);
    if (why === 'hit') say(player, '🧹 You are knocked off your broom.', 'thud');
    return true;
  }

  // How high she says she is riding: kept within what the broom can do, for others to see her there.
  function altitude(player, alt) {
    if (!player || !player.mounted) return false;
    const a = Number(alt);
    if (!Number.isFinite(a)) return false;
    player.besomAlt = Math.round(Math.max(MOUNT.hover, Math.min(MOUNT.top, a)));
    return true;
  }
  // what others are told: false, or how high she rides
  const seenAt = (player) => (riding(player) ? (player.besomAlt || MOUNT.hover) : false);

  // whether others should see this player on it (never under a roof, whatever went astray)
  const riding = (player) => !!(player && player.mounted && openRooms.has(player.room) && !player.isDead);

  // the level-up that gives it
  function onLevel(player, from, to) {
    if (from < MOUNT.level && to >= MOUNT.level) {
      say(player, `🧹 Level ${MOUNT.level}: the besom is yours to ride. Press G (or Ride the besom in the menu) when you are out of doors. ${MOUNT_LORE.lore} (${MOUNT_LORE.note})`, 'besom_ride');
      return true;
    }
    return false;
  }

  return { MOUNT, MOUNT_LORE, mount, dismount, riding, earned, onLevel, altitude, seenAt };
};
module.exports.MOUNT = MOUNT;
module.exports.MOUNT_LORE = MOUNT_LORE;
