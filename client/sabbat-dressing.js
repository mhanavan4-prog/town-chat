// ---------------------------------------------------------------------------
// Seasonal cottage dressing — the cottage turns with the Wheel of the Year. Each
// sabbat gives the room a soft light tint, a drifting particle (blossom, leaves,
// snow, embers…) and a one-line note named when you step inside. Cosmetic and
// automatic; it follows the live season (data/seasons.js on the server, read
// here from calendarState.season.key). Keyed by sabbat key.
//   light    — a gentle PointLight colour that washes the room for the season
//   accent   — the particle colour
//   particle — 'snow' | 'petals' | 'leaves' | 'embers' | 'sparks' | 'motes'
//   rise     — true if the particle drifts up (fire/spirit), else it falls
//   count    — how many motes
//   note     — the in-fiction line shown on entering your own cottage
// ---------------------------------------------------------------------------

export const SABBAT_DRESSING = {
  imbolc:     { label: 'Imbolc',     light: 0xbcd0e8, accent: 0xeaf2ea, particle: 'motes',  rise: false, count: 36, note: 'the first snowdrops at the sill' },
  ostara:     { label: 'Ostara',     light: 0xbfe6c8, accent: 0xf3c6e0, particle: 'petals', rise: false, count: 58, note: 'blossom drifting in on a spring draught' },
  beltane:    { label: 'Beltane',    light: 0xffb060, accent: 0xff7a3a, particle: 'embers', rise: true,  count: 54, note: 'the bright fire high in the hearth' },
  litha:      { label: 'Litha',      light: 0xffe08a, accent: 0xffd76a, particle: 'motes',  rise: false, count: 48, note: 'midsummer gold hanging in the air' },
  lughnasadh: { label: 'Lughnasadh', light: 0xe8c878, accent: 0xe8c05a, particle: 'motes',  rise: false, count: 48, note: 'the first grain-dust of the harvest' },
  mabon:      { label: 'Mabon',      light: 0xe0a860, accent: 0xd0702e, particle: 'leaves', rise: false, count: 54, note: 'fallen leaves gathered by the door' },
  samhain:    { label: 'Samhain',    light: 0xb79ae0, accent: 0x9a7ad0, particle: 'sparks', rise: true,  count: 44, note: 'candle-sparks, and the veil gone thin' },
  yule:       { label: 'Yule',       light: 0xa9c8ff, accent: 0xe4ecff, particle: 'snow',   rise: false, count: 72, note: 'soft snow past the frosted windows' },
};

// The dressing for a sabbat key, or null when there's no live season.
export function dressingFor(key) { return (key && SABBAT_DRESSING[key]) || null; }

// Particle sizes read right per kind: flakes/petals/leaves larger, motes/sparks small.
export function dressingPointSize(kind) {
  if (kind === 'snow' || kind === 'petals' || kind === 'leaves') return 5;
  return 3;
}
