// ---------------------------------------------------------------------------
// Sabbat sigils — the eight festivals of the Wheel of the Year, drawn as the
// traditional monoline witch-marks (the ones you see on a wheel chart) rather
// than emoji: Yule's hung banner, Ostara's sprouting egg, Beltane's rising
// tree, Litha's twin solar spirals, Lughnasadh's domed sheaf, Mabon's horned
// harvest, Samhain's woven knot, Imbolc's downward broom. Monoline so they read
// as one hand; drawn on a 0 0 44 44 grid, keyed by sabbat key and merged into
// UI_ICONS under a 'sabbat_' prefix (uiIcon('sabbat_yule') etc.).
// ---------------------------------------------------------------------------

const sbS = (inner) =>
  `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" ` +
  `stroke="#f3e7cb" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" class="uiIcon">${inner}</svg>`;

// A small cross/tassel, used for Yule's hanging marks.
const sbCross = (x, y, r) =>
  `<path d="M${x - r} ${y} H${x + r} M${x} ${y - r} V${y + r}" stroke-width="1.5"/>`;

const SABBAT_ICONS = {
  // Yule — the Longest Night: a hung banner with its row of tassels.
  yule: sbS(`
    <path d="M10 11 H34"/>
    <path d="M12 11 V16 M32 11 V16"/>
    ${sbCross(16, 19, 1.7)}${sbCross(22, 19, 1.7)}${sbCross(28, 19, 1.7)}
    ${sbCross(19, 25, 1.7)}${sbCross(25, 25, 1.7)}
    ${sbCross(22, 31, 1.7)}
  `),
  // Ostara — the Balance of Spring: the egg with two sprouting curls.
  ostara: sbS(`
    <circle cx="22" cy="26" r="8"/>
    <path d="M18.5 18.5 q-4 -1.5 -3.5 -5 q0.4 -2.3 2.4 -1 q1.4 0.9 0.2 2.3"/>
    <path d="M25.5 18.5 q4 -1.5 3.5 -5 q-0.4 -2.3 -2.4 -1 q-1.4 0.9 -0.2 2.3"/>
  `),
  // Beltane — the Bright Fire: the rising maypole tree, branches to the sun.
  beltane: sbS(`
    <path d="M22 9 V34"/>
    <path d="M22 16 L15.5 10.5 M22 16 L28.5 10.5"/>
    <path d="M22 22 L15.5 16.5 M22 22 L28.5 16.5"/>
    <path d="M22 28 L16 23 M22 28 L28 23"/>
  `),
  // Litha — the Sun at its Height: twin solar spirals over a stem.
  litha: sbS(`
    <path d="M22 15 V33"/>
    <path d="M22 17 Q13.5 17 13.5 10.5 Q13.5 7 16.8 7 Q19.5 7 19.2 9.8 Q19 11.6 16.8 11.4"/>
    <path d="M22 17 Q30.5 17 30.5 10.5 Q30.5 7 27.2 7 Q24.5 7 24.8 9.8 Q25 11.6 27.2 11.4"/>
  `),
  // Lughnasadh — the First Harvest: the domed sheaf on a central pole.
  lughnasadh: sbS(`
    <path d="M11 29 H33"/>
    <path d="M12 29 A10 10 0 0 1 32 29"/>
    <path d="M22 13 V34"/>
  `),
  // Mabon — the Second Harvest: the horned mark, humps over a crossed stem.
  mabon: sbS(`
    <path d="M13 26 V19 Q13 14.5 17 14.5 Q21 14.5 21 19 V26"/>
    <path d="M21 19 Q21 14.5 25 14.5 Q29 14.5 29 20 Q29 24 25.5 26"/>
    <path d="M17 26 V34"/>
    <path d="M13.5 30 H20.5"/>
  `),
  // Samhain — the Witches' New Year: the woven knot of the thinning veil.
  samhain: sbS(`
    <path d="M16 11 V33" stroke-width="1.9"/>
    <path d="M28 11 V33" stroke-width="1.9"/>
    <path d="M11 16 H33" stroke-width="1.9"/>
    <path d="M11 28 H33" stroke-width="1.9"/>
    <path d="M11 16 Q11 11 16 11 M28 11 Q33 11 33 16 M33 28 Q33 33 28 33 M16 33 Q11 33 11 28" fill="none" stroke-width="1.9"/>
  `),
  // Imbolc — the First Stirring: the besom, stem over a downward sweep.
  imbolc: sbS(`
    <path d="M22 9 V30"/>
    <path d="M22 30 L15.5 23 M22 30 L28.5 23"/>
    <path d="M22 22 L16.5 17 M22 22 L27.5 17"/>
  `),
};

export { SABBAT_ICONS };
