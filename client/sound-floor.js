// The sound floor: nothing a player does should be met with silence.
//
// Most actions already bring a sound of their own (a door, a coin, a harvest,
// or one the server sends with its reply). This is the net under the rest: when
// a player presses a button or uses a thing in the world, and no sound of any
// kind has been asked for a moment later, a soft one is played. Because it
// waits and looks first, it never doubles a sound that was already there.

const INTERACT_QUIET_MS = 450;   // long enough for the server's reply to bring its own sound
const CLICK_QUIET_MS = 140;      // a button's own sound is asked for at once, or not at all

// asked(): how many sounds have been asked for so far. play(id, vol). later(fn, ms).
// `since`: the count taken BEFORE the action ran. An action that plays its own
// sound at once (a portal, a door) has already raised the count by the time the
// floor is asked for, so counting from afterwards would miss it and double it.
function createSoundFloor(asked, play, later) {
  return function soundFloor(id, ms, vol, since) {
    const before = since != null ? since : asked();
    later(() => { if (asked() === before) play(id, vol); }, ms);
  };
}

// What counts as a press worth a sound: a real control, not the game canvas,
// not text being typed into, not a control that is switched off.
function clickWantsSound(target) {
  if (!target || typeof target.closest !== 'function') return false;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return false;
  const el = target.closest('button, [role="button"], [role="tab"], .menuRow, .tab, .gtab, .charOption, summary, a[href]');
  if (!el) return false;
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
  return true;
}

export { INTERACT_QUIET_MS, CLICK_QUIET_MS, createSoundFloor, clickWantsSound };
