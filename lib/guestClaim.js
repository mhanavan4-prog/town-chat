'use strict';

// Seamless guest -> account carry-over.
//
// When a guest registers an account in-game, we want the character they have
// been playing (level, xp, skills, quests, inventory) to continue under the
// new account instead of starting from scratch. This module holds the one
// risky piece — moving a guest's live progress into an account's store — so it
// can be unit-tested in isolation from the WebSocket server.
//
// The single hard safety rule: we only ever adopt INTO a brand-new account
// that has no character progress of its own. That makes the operation
// impossible to misuse to clobber an established account's data, no matter
// what token is presented.

function accountHasProgress(progress) {
  return !!(
    progress &&
    progress.characters &&
    typeof progress.characters === 'object' &&
    Object.keys(progress.characters).length > 0
  );
}

// Mutates the passed-in stores. Returns:
//   { ok:false }                     - bad input, caller should refuse
//   { ok:true, already:true }        - account already has progress; left untouched
//   { ok:true, changed:true }        - guest state adopted into the account
function adoptGuestInto(opts) {
  opts = opts || {};
  const { playerProgress, inventories, accountKey, guestProgress, guestInventory } = opts;
  if (!playerProgress || !accountKey) return { ok: false };

  // Never overwrite an account that already has character progress.
  if (accountHasProgress(playerProgress[accountKey])) {
    return { ok: true, already: true, changed: false };
  }

  let changed = false;
  if (guestProgress) {
    playerProgress[accountKey] = guestProgress;
    changed = true;
  }
  if (inventories && guestInventory) {
    inventories[accountKey] = guestInventory;
    changed = true;
  }
  return { ok: true, already: false, changed };
}

module.exports = { adoptGuestInto, accountHasProgress };
