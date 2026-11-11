// ---------------------------------------------------------------------------
// A clootie well in the Wilds: a spring under a thorn hung with rags, west of
// the portal. A caller asks for a cloot tied there the old way, and the old
// way is done for real: choose the cloth on the Board (wool or cotton; a
// polyester ribbon is refused, as Forestry and Land Scotland asks), then go to
// the well in the Wilds, go round it three times sunways ("from east to west",
// as Martin Martin had it on Skye in 1703), and tie the cloot on the thorn.
// The server follows the rounds from your steps (lib/callers.js clootMove):
// sunways in this world is east, then south, then west.
// ---------------------------------------------------------------------------
const CLOOTIE_WELL = { x: 2900, y: 8300 };   // the spring, in the south-west of the Wilds, a long walk west of the portal
const CLOOTIE_RING = { min: 45, max: 260 };   // how near the spring a round has to be walked
const CLOOTIE_ROUNDS = 3;

const CLOOT_CLOTHS = [
  { key: 'wool', label: 'A strip of pure wool, from an old shawl', ok: true },
  { key: 'cotton', label: 'A strip of plain cotton, from a worn shirt', ok: true },
  { key: 'polyester', label: 'A bright polyester ribbon', ok: false,
    why: "Not that one. It won't rot: Forestry and Land Scotland, who keep the clootie well at Munlochy, ask for cloots that are 'small, appropriate and biodegradable', and 'Pure wool or pure cotton are best for the environment.'" },
];

const CLOOT_USE = "Choose the cloth here. Then go to the clootie well in the south-west of the Wilds, a long walk west of the portal: go round it three times sunways, east, then south, then west, and tie the cloot on the thorn (press the interact key at the spring).";

const CLOOTIE_LORE = "Rag wells are old in the record. In 1618 Dr Patrick Anderson wrote of wells 'all tapestried about with old rags, as certaine signes and sacraments' (Mackinlay). On Skye Martin Martin saw folk drink at a well and then 'move thrice round the well, proceeding sunways from east to west', and leave 'some small offering' (1703). At Craigie Well near Munlochy Bay they came 'early in the morning of the first Sunday in May', 'everyone took care to have a drink', and 'No one went away without leaving a thread, or patch of cloth on a large briar bush near the spring' (Mackinlay, 1893). At Madron in Cornwall a Mr Couch, quoted by Hunt, 'observed the custom of hanging rags on the thorns' (1865). On the Isle of Man, 'When the cloth had rotted away the cure was supposed to be effected' (Moore, 1890), and in Scotland the same is said now; and Dr Gregor recorded the warning: 'Whoever carried off one, of such relics contracted the disease of the one who left it.' At St Mary's Well, Culloden, the Ordnance Survey wrote in 1868 that 'People resorted there for cures and attached rags, threads, etc in repayment.'";
const CLOOTIE_SOURCE = 'J. M. Mackinlay, Folklore of Scottish Lochs and Springs (1893), chs. XII and XVII · M. Martin, A Description of the Western Islands of Scotland (1703) · R. Hunt, Popular Romances of the West of England, 2nd series (1865), "Holy Wells" · Ordnance Survey Name Book (1868), via Canmore 14208 · Forestry and Land Scotland, "Munlochy Clootie Well" and "Culloden" · Drinking Water Inspectorate, "Protecting your private water supply" · Scottish Outdoor Access Code';

// Sunways in this world: x runs east, y runs south, so east -> south -> west
// is the angle atan2(dy, dx) increasing.
function clootieAngle(x, y) { return Math.atan2(y - CLOOTIE_WELL.y, x - CLOOTIE_WELL.x); }
function clootieNear(x, y) { const d = Math.hypot(x - CLOOTIE_WELL.x, y - CLOOTIE_WELL.y); return d >= CLOOTIE_RING.min && d <= CLOOTIE_RING.max; }
// One step round the well: st = { a, turn } (turn in radians, + is sunways).
function clootieTurn(st, x, y) {
  if (!clootieNear(x, y)) return { a: null, turn: st ? st.turn : 0 };
  const a = clootieAngle(x, y);
  if (!st || st.a === null || st.a === undefined) return { a, turn: st ? st.turn : 0 };
  let d = a - st.a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return { a, turn: st.turn + d };
}

module.exports = { CLOOTIE_WELL, CLOOTIE_RING, CLOOTIE_ROUNDS, CLOOT_CLOTHS, CLOOT_USE, CLOOTIE_LORE, CLOOTIE_SOURCE, clootieAngle, clootieNear, clootieTurn };
