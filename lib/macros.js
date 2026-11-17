// ---------------------------------------------------------------------------
// Macros (data/macros.js): kept per account and per class, checked here, cast by the client one ordinary cast at a
// time. Nothing in this file casts anything.
//   store(player)            -> the account's { size, byChar: { [charId]: [macro|null, ...] } } (made if wanting)
//   state(player)            -> what the client is told
//   save(player, slot, m)    -> { ok } or { error }: set or clear one macro
//   upgrade(player)          -> { ok, steps, cost } or { error }: buy the next size
// ---------------------------------------------------------------------------
const { MACROS, MACRO_BARRED_EFFECTS, MACRO_ICONS } = require('../data/macros');

module.exports = function createMacros({ accountOf, catalogFor, unlocksFor, levelOf, balanceOf, spend }) {
  function store(player) {
    const acct = accountOf(player);
    if (!acct) return null;
    if (!acct.macros || typeof acct.macros !== 'object') acct.macros = { size: MACROS.baseSteps, byChar: {} };
    if (!(acct.macros.size >= MACROS.baseSteps)) acct.macros.size = MACROS.baseSteps;
    if (!acct.macros.byChar || typeof acct.macros.byChar !== 'object') acct.macros.byChar = {};
    return acct.macros;
  }
  const sizeOf = (player) => { const s = store(player); return s ? s.size : MACROS.baseSteps; };
  const nextSize = (player) => MACROS.sizes.find((z) => z.steps > sizeOf(player)) || null;

  // which of the class's abilities she may put in a chain: hers, opened by her level, and not one that asks leave
  function usable(player) {
    const cat = catalogFor(player.charId) || {}, lv = unlocksFor(player.charId) || {}, level = levelOf(player) || 1;
    return Object.keys(cat).filter((id) => level >= (lv[id] || 1) && !MACRO_BARRED_EFFECTS.includes(cat[id].effect));
  }

  function listFor(player) {
    const s = store(player);
    const out = [];
    const kept = (s && s.byChar[player.charId]) || [];
    const ok = new Set(usable(player));
    for (let i = 0; i < MACROS.slots; i++) {
      const m = kept[i];
      if (!m || !Array.isArray(m.steps)) { out.push(null); continue; }
      // a step she can no longer cast (an old save, a changed kit) is dropped from what she is shown
      const steps = m.steps.filter((id) => ok.has(id)).slice(0, sizeOf(player));
      out.push(steps.length ? { name: m.name, icon: m.icon, steps } : null);
    }
    return out;
  }

  function state(player) {
    return {
      account: !!accountOf(player),
      slots: MACROS.slots, size: sizeOf(player), next: nextSize(player), gapMs: MACROS.gapMs, nameMax: MACROS.nameMax,
      icons: MACRO_ICONS, barred: MACRO_BARRED_EFFECTS, macros: listFor(player),
    };
  }

  function save(player, slot, m) {
    const s = store(player);
    if (!s) return { error: 'Log into an account to keep macros.' };
    const i = Number(slot);
    if (!Number.isInteger(i) || i < 0 || i >= MACROS.slots) return { error: 'No such macro.' };
    const list = s.byChar[player.charId] || (s.byChar[player.charId] = []);
    while (list.length < MACROS.slots) list.push(null);
    const steps = m && Array.isArray(m.steps) ? m.steps.map((x) => String(x)) : [];
    if (!steps.length) { list[i] = null; return { ok: true, cleared: true }; }
    if (steps.length < 2) return { error: 'A macro is two abilities or more.' };
    if (steps.length > s.size) return { error: `Your macros hold ${s.size} abilities. Longer ones are bought with Moonstones.` };
    if (new Set(steps).size !== steps.length) return { error: 'Each ability once: it could not be cast twice running anyway.' };
    const ok = new Set(usable(player));
    const bad = steps.find((id) => !ok.has(id));
    if (bad) return { error: 'One of those is not an ability you can chain.' };
    const name = String((m && m.name) || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MACROS.nameMax) || `Macro ${i + 1}`;
    const icon = MACRO_ICONS.includes(m && m.icon) ? m.icon : MACRO_ICONS[0];
    list[i] = { name, icon, steps };
    return { ok: true };
  }

  function upgrade(player) {
    const s = store(player);
    if (!s) return { error: 'Log into an account to spend Moonstones.' };
    const nx = nextSize(player);
    if (!nx) return { error: 'Your macros are as long as macros go.' };
    const have = balanceOf(player);
    if (have < nx.cost) return { error: `${nx.steps}-ability macros are ${nx.cost} 💎 — you carry ${have}.` };
    spend(player, nx.cost);
    s.size = nx.steps;
    return { ok: true, steps: nx.steps, cost: nx.cost };
  }

  return { MACROS, store, state, save, upgrade, usable, sizeOf, nextSize };
};
