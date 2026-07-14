// ---------------------------------------------------------------------------
// Modal / overlay open-state registry (Tier 3.4 Phase C). Replaces ~26 scattered
// boolean flags (npcShopOpen, bankModalOpen, arcadeModalOpen, ...) with one Set
// keyed by the old flag name. Removing those free variables is what lets each
// modal UI extract into its own module without its open-flag leaking into the
// shared input guards (anyOverlayOpen() and friends).
//   was:  npcShopOpen = true         ->  Modals.set('npcShopOpen', true)
//   was:  if (npcShopOpen) ...        ->  if (Modals.isOpen('npcShopOpen')) ...
// Semantics are identical: a name absent from the Set reads as false.
// ---------------------------------------------------------------------------
const openSet = new Set();

export const Modals = {
  // set(name, isOpen) — returns isOpen so `x = Modals.set(...)` still yields the value.
  set(name, isOpen) { if (isOpen) openSet.add(name); else openSet.delete(name); return isOpen; },
  isOpen(name) { return openSet.has(name); },
  any() { return openSet.size > 0; },
};
