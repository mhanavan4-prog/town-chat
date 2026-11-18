// Key rebinding. The game reads keys by name all over the place (e.key === 'f'),
// so nothing there is changed: this sits in front of it. When a key the player
// has chosen for an action is pressed, the press is swallowed and replayed as
// the action's ordinary key. A key whose action has moved away, and which was
// not given to anything else, does nothing.
//
// Arrow keys, the number row (the ability bar), Escape and Enter are fixed.

// [ordinary key, what it does]. ' ' is Space.
const KEY_ACTIONS = [
  ['w', 'Walk forward'], ['s', 'Walk back'], ['a', 'Turn left'], ['d', 'Turn right'],
  ['q', 'Sidestep right'], ['e', 'Sidestep left'], [' ', 'Jump, and climb on the besom'],
  ['f', 'Use, talk, open'], ['r', 'Strike the nearest foe'], ['g', 'Ride the besom'],
  ['i', 'Pack'], ['j', 'Journal'], ['k', 'Skills'], ['o', 'Friends and players online'],
  ['t', 'Emotes'], ['b', 'Bless the nearest player'], ['h', 'Controls'],
];
const KEY_FIXED = /^(escape|enter|tab|arrowup|arrowdown|arrowleft|arrowright|shift|control|alt|meta|capslock|contextmenu|dead|process|unidentified|[0-9]|-|=|f[0-9]+)$/;

const normKey = (k) => (k === 'Spacebar' ? ' ' : String(k == null ? '' : k).length === 1 ? String(k).toLowerCase() : String(k).toLowerCase());
const keyLabel = (k) => (k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1));
const keyAllowed = (k) => !!k && !KEY_FIXED.test(normKey(k));

// binds: { ordinaryKey: chosenKey }. Only real changes are kept.
function cleanBinds(binds) {
  const out = {}, used = new Set();
  const known = new Set(KEY_ACTIONS.map((a) => a[0]));
  for (const [def, to] of Object.entries(binds || {})) {
    const k = normKey(to);
    if (!known.has(def) || !keyAllowed(k) || k === def || used.has(k)) continue;
    used.add(k); out[def] = k;
  }
  return out;
}
const boundKey = (binds, def) => (binds && binds[def]) || def;

// Give `def` the key `key`. If another action holds that key, the two swap.
function rebind(binds, def, key) {
  const k = normKey(key);
  if (!keyAllowed(k)) return { binds: cleanBinds(binds), error: 'That key is kept for something else.' };
  const next = { ...cleanBinds(binds) };
  const mine = boundKey(next, def);
  const holder = KEY_ACTIONS.map((a) => a[0]).find((d) => d !== def && boundKey(next, d) === k);
  if (holder) { if (mine === holder) delete next[holder]; else next[holder] = mine; }
  if (k === def) delete next[def]; else next[def] = k;
  return { binds: cleanBinds(next), swapped: holder || null };
}

// What a pressed key should become: an ordinary key, itself (null), or nothing ('').
function translateKey(binds, pressed) {
  const k = normKey(pressed);
  const b = binds || {};
  for (const def of Object.keys(b)) if (b[def] === k) return def;      // chosen for an action: becomes that action's key
  if (b[k] !== undefined) return '';                                    // its action moved away and nothing took it
  return null;
}

// A key label as printed in the game's help ("W/S", "F", "Space"), re-worded for
// the keys now in use. Text that is not made only of rebindable keys ("1–9",
// "hold C", "Drag") is given back unchanged.
function relabelKeys(text, binds) {
  const known = new Set(KEY_ACTIONS.map((a) => a[0]));
  const parts = String(text).split('/');
  const keys = parts.map((p) => { const t = p.trim(); return /^space$/i.test(t) ? ' ' : t.length === 1 ? t.toLowerCase() : null; });
  if (!keys.every((k) => k !== null && known.has(k))) return text;
  return keys.map((k) => keyLabel(boundKey(binds, k))).join('/');
}

// Puts the translation in front of every other key handler on the page.
function installKeyRemap(getBinds, isTyping) {
  const replay = (e, key) => {
    const ev = new KeyboardEvent(e.type, { key, code: '', bubbles: true, cancelable: true, repeat: e.repeat, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
    ev.__remapped = true;
    (e.target || document).dispatchEvent(ev);
  };
  const onKey = (e) => {
    if (e.__remapped || e.ctrlKey || e.metaKey || e.altKey) return;
    const binds = getBinds();
    if (!binds || !Object.keys(binds).length) return;
    if (isTyping(e)) return;
    const to = translateKey(binds, e.key);
    if (to === null) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (to !== '') replay(e, to);
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
}

export { KEY_ACTIONS, normKey, keyLabel, keyAllowed, cleanBinds, boundKey, rebind, translateKey, installKeyRemap, relabelKeys };
