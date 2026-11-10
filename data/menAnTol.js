// ---------------------------------------------------------------------------
// The Crick-stone: a Mên-an-Tol in the Wilds, crawled through for real.
//
// A holed stone set on its edge between two uprights, in a line running east
// and west, its hole facing north and south. The cure, as the Cornish record
// has it: "Through this the sufferer was drawn nine times against the sun—or,
// if a man, he was to crawl through the hole nine times" (Hunt, 1865), and
// "crameing (crawling on all fours) nine times through the hole in the centre
// stone, going against the sun's course" (Bottrell, 1873).
//
// How "against the sun" is walked here: through the hole from the south, and
// back round the stones by the west (a loop the sun's way round would come
// back by the east). That loop runs against the sun: up through the middle,
// west, down the west side, east to the start. The server follows the steps:
// a pass through the hole is a crossing of the stone's line within the hole;
// a way back is a crossing outside the stones. Coming back by the east is
// with the sun, and Bottrell says why that won't do: "going against the sun
// will backen a disease".
//
// The stones are drawn twice life size: the real hole is about half a metre
// across, too small for a player to crawl through here.
// ---------------------------------------------------------------------------
const MEN_AN_TOL = { x: 5100, y: 7800 };
const MEN_HOLE = 20;        // half-width of the hole, world units (a player is 28 across)
const MEN_STONE = 52;       // half-width of the holed stone
const MEN_UPRIGHT = 150;    // the uprights stand this far either side
const MEN_REACH = 420;      // walks further off than this are forgotten
const MEN_TIMES = 9;

// One step of a crawler. st = { side, count, expect } where side is 'S' or
// 'N' (which side of the stones' line you were last on). Returns { st, event }
// with event null or 'through', 'wrongway', 'sunwise', 'done'.
function menAnTolStep(st, x, y) {
  const u = x - MEN_AN_TOL.x, v = y - MEN_AN_TOL.y; // v > 0 is south
  if (Math.hypot(u, v) > MEN_REACH) return { st: null, event: null };
  const side = v > 0 ? 'S' : 'N';
  if (!st) return { st: { side, count: 0, expect: side === 'S' ? 'through' : 'round' }, event: null };
  if (side === st.side) return { st, event: null };
  const next = { ...st, side };
  const inHole = Math.abs(u) < MEN_HOLE;
  if (inHole && side === 'N') {            // through the hole, south to north
    if (st.expect !== 'through') return { st: { ...next, expect: 'round' }, event: null };
    next.count = st.count + 1; next.expect = 'round';
    return { st: next, event: next.count >= MEN_TIMES ? 'done' : 'through' };
  }
  if (inHole && side === 'S') return { st: { ...next, expect: 'through' }, event: 'wrongway' };
  if (Math.abs(u) < MEN_STONE) return { st: next, event: null }; // over the stone itself: the client walls it, ignore
  if (side === 'S') {                      // back to the south side, round the stones
    if (u > 0 && st.count > 0) return { st: { side, count: 0, expect: 'through' }, event: 'sunwise' };
    return { st: { ...next, expect: 'through' }, event: null };
  }
  return { st: { ...next, expect: 'round' }, event: null }; // went round to the north without crawling
}

const MEN_AN_TOL_XP = 30;
const MEN_AN_TOL_LORE = "The holed stone near Lanyon in West Penwith, 'commonly called by the peasantry the crick-stone' (Hunt, 1865). 'Through this the sufferer was drawn nine times against the sun—or, if a man, he was to crawl through the hole nine times.' Bottrell (1873) has it 'crameing (crawling on all fours) nine times through the hole in the centre stone, going against the sun's course, for the cure of lumbago, scatica, and other \"cricks\" and pains in the back', and 'Young children were also put through it to ensure them healthy growth'; for 'going against the sun will backen a disease'. Hunt's later edition (1903) has scrofulous children 'passed naked through the Men-an-tol three times, and then drawn on the grass three times against the sun', so the count is not settled. In 1749 a farmer told Borlase he had known 'many persons who had crept through this hole for pains in their back and limbs' (as printed in Stukeley's memoirs). The stones themselves are older than any of it, Late Neolithic to Middle Bronze Age, and one upright is thought to have been moved in the last few hundred years (Historic England).";
const MEN_AN_TOL_PINS = "Hunt (1903): 'If two brass pins are carefully laid across each other on the top edge of this stone, any question put to the rock will be answered, by the pins acquiring, through some unknown agency, a peculiar motion.' Borlase found 'two pins lying cross each other' on it in 1749, and left them. (In the game, whether the pins stir is chance.)";
const MEN_AN_TOL_PRACTICAL = "The practical half. For a bad back, the NHS says to 'stay active and try to continue with your daily activities', and 'do not stay in bed for long periods of time'; it 'often improves on its own within a few weeks'. Call 999 or go to A&E if there is 'pain, tingling, weakness or numbness in both legs' or 'a loss of feeling around your genitals or anus'. For children's bones, a lack of vitamin D 'can lead to bone deformities such as rickets', and the NHS says 'Children aged 1 to 4 years old should be given a daily supplement containing 10 micrograms of vitamin D'. And the real Mên-an-Tol is a scheduled monument (list entry 1004641): 'It is a criminal offence to destroy or damage a scheduled monument either intentionally or through recklessness' (Historic England).";
const MEN_AN_TOL_SOURCE = 'R. Hunt, Popular Romances of the West of England, 2nd series (1865), "Rickets, or a Crick in the Back", and 3rd ed. (1903), "The Men-an-tol" · W. Bottrell, Traditions and Hearthside Stories of West Cornwall, 2nd series (1873), "The Crick-Stone, or Men-an-tol" · W. Borlase, letter to W. Stukeley (1749), in The Family Memoirs of the Rev. William Stukeley (1883) · Historic England, scheduled monument 1004641, and "Scheduled Monuments: A Guide for Owners and Occupiers" · NHS, "Back pain" and "Vitamin D"';

module.exports = { MEN_AN_TOL, MEN_HOLE, MEN_STONE, MEN_UPRIGHT, MEN_REACH, MEN_TIMES, menAnTolStep, MEN_AN_TOL_XP, MEN_AN_TOL_LORE, MEN_AN_TOL_PINS, MEN_AN_TOL_PRACTICAL, MEN_AN_TOL_SOURCE };
