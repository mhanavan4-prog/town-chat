// The menu, opened up as you rise (level gates). A new arrival sees a short menu; the rest is added in bands,
// each with a line saying what is new. Nothing is taken away from play by this: a gated entry is only kept off
// the menu, and anything the game itself sends you to (a line written in the daybook, say) opens its entry early.
// Levelling itself is untouched.
export const MENU_GATES = {
  2: ['menuWardrobe', 'menuTitles', 'menuFamiliar', 'menuTarot', 'menuBoard', 'menuCrier'],
  4: ['menuGarden', 'menuHome', 'menuKitchen', 'menuBook', 'menuPath', 'menuPractices', 'menuCodex'],
  7: ['menuScry', 'menuPendulum', 'menuRunes', 'menuOgham', 'menuCords', 'menuOldWays', 'menuDaybook'],
  10: ['menuMoonWell', 'menuAncestor', 'menuRelease', 'menuGuise', 'menuCharmBook', 'menuCoven'],
  13: ['menuDelve', 'menuLoadout', 'menuAchievements'],
};
const KEY = 'tc_menu_early';
const early = (() => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return new Set(); } })();
const label = (el) => (el.childNodes[0] && el.childNodes[0].nodeType === 3 ? el.childNodes[0].textContent : el.textContent).trim();

export function menuGateLevel(id) {
  for (const lvl of Object.keys(MENU_GATES)) if (MENU_GATES[lvl].includes(id)) return +lvl;
  return 1;
}
// Hide what is above `level`; return the names of what `level` itself has just opened (for the notice).
export function applyMenuGates(level, doc = document) {
  const lv = Math.max(1, level | 0), fresh = [];
  for (const lvl of Object.keys(MENU_GATES)) for (const id of MENU_GATES[lvl]) {
    const el = doc.getElementById(id); if (!el) continue;
    const locked = lv < +lvl && !early.has(id);
    el.classList.toggle('lvlLocked', locked);
    if (+lvl === lv && !early.has(id)) fresh.push(label(el));
  }
  return fresh;
}
// The game has pointed at an entry before its level: show it from now on.
export function openMenuEarly(id, doc = document) {
  if (early.has(id)) return;
  early.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...early])); } catch (e) { /* private window: it lasts the visit */ }
  const el = doc.getElementById(id); if (el) el.classList.remove('lvlLocked');
}

// Words in a notice that mean the game is pointing at an entry: a line written in the daybook, a coven's
// invitation, a title earned. Seeing one opens that entry, whatever your level.
const POINTERS = [
  [/your daybook/i, 'menuDaybook'], [/\bcoven\b/i, 'menuCoven'], [/\bDelve\b/, 'menuDelve'], [/\btitle\b/i, 'menuTitles'],
  [/\bfamiliar\b/i, 'menuFamiliar'], [/\bgarden\b/i, 'menuGarden'], [/\bcottage\b|\byour home\b/i, 'menuHome'], [/Charm Book/i, 'menuCharmBook'],
  [/Collection Log/i, 'menuAchievements'], [/\bCodex\b/, 'menuCodex'], [/Commonplace Book/i, 'menuBook'],
];
export function menuPointedAt(text, doc = document) {
  const t = String(text || '');
  if (/New in your menu/.test(t)) return;
  for (const [re, id] of POINTERS) if (re.test(t)) openMenuEarly(id, doc);
}
