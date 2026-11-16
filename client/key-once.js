// ---------------------------------------------------------------------------
// One press of a key is one press.
// A held key repeats, and the browser is meant to mark every repeat (event.repeat) so a toggle can ignore them.
// Safari on a Mac with Caps Lock on has been seen not to: Escape then opened and shut the menu several times
// from one press. So a toggle key is counted by hand: once it is down, further keydowns for it are repeats until
// it comes up. A keyup can be lost (the window loses focus mid-press), so a key not heard from for a while is
// taken to be up again: repeats arrive many times a second, so a long silence means a new press.
// ---------------------------------------------------------------------------

// how long a key may be silent before its next keydown counts as a new press (ms)
export const PRESS_QUIET_MS = 700;

export function createPressOnce(now = () => Date.now()) {
  const down = {};   // key -> when it was last heard from
  return {
    // true if this keydown is a repeat of a press already counted
    repeat(key, flagged) {
      const t = now(), last = down[key];
      const held = last != null && t - last < PRESS_QUIET_MS;
      down[key] = t;
      return !!flagged || held;
    },
    up(key) { delete down[key]; },
    clear() { for (const k of Object.keys(down)) delete down[k]; },
  };
}
