// Standing on things. A collider can carry a `top`: the height of the thing it stands for. Anything no taller than a
// jump can be jumped onto and stood on; anything taller (or with no top) is a wall, as before.
//
// The rule in one place, so it is the same for a crate, a gravestone and a rock:
//   - you are blocked by a topped collider unless your feet are at its top or above (collision.js `collides`)
//   - while your body overlaps one, you stand at its top (collision.js `perchAt`)
//   - step off, and you fall
// Everyone else is drawn by the same rule: a body overlapping a topped collider can only be standing on it.
//
// The game's own mechanics; nothing here is from the record.

export const PERCH_REACH = 30;  // the tallest thing a jump from the ground gets onto (a jump rises 34)
export const PERCH_STEP = 2;    // how far below a top your feet may be and still clear it
export const PERCH_FALL = 260;  // falling speed off an edge, world units a second

// The top to give a collider for a thing `height` tall: its height if a jump reaches it, else none (a wall).
export function perchTop(height) {
  return Number.isFinite(height) && height >= 4 && height <= PERCH_REACH ? Math.round(height) : 0;
}

export const PERCH_CATCH = 16; // coming down within this much of a top, you land on it (so a running jump does not sail over a crate)

export function createPerch({ jumpHeight, jumpDuration }) {
  let h = 0;      // where my feet are, above the ground
  let base = 0;   // where they were when I jumped
  const arc = (t, mult) => Math.sin(Math.PI * Math.min(1, Math.max(0, t / jumpDuration))) * jumpHeight * (mult || 1);
  return {
    // Where my feet are, above the ground.
    feet(jumping, t, mult) { return jumping ? base + arc(t, mult) : h; },
    // What I am standing on (not counting a jump's rise): the camera follows this, not every hop.
    standing(jumping) { return jumping ? base : h; },
    takeoff() { base = h; },
    reset() { h = 0; base = 0; },
    // Once a frame, after moving. `target` is the top under me (0 for the ground). Returns true when a jump should
    // end now because I have come down onto something.
    step(dt, jumping, t, target, mult) {
      if (jumping) {
        h = base + arc(t, mult);
        if (t > jumpDuration / 2 && target > 0 && h <= target + PERCH_CATCH) return true; // the fall below finishes it
        return false;
      }
      if (h > target) h = Math.max(target, h - PERCH_FALL * dt); // off an edge, or the last of a landing
      else h = target;                                           // level, or a step up that collision let through
      base = h;
      return false;
    },
  };
}
