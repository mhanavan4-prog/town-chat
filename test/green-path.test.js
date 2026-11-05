// The Green Path has to mean what it says, and be finishable.
//
// Two playtest reports:
//  - "i just kept planting rue over and over again" completed "Sow a nightshade
//    of your own" — the objective only checked that SOMETHING was planted.
//  - the final chapter gates on level 20, which the level cap made unreachable.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-greenpath-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const { XP_THRESHOLDS, MAX_LEVEL, GREEN_PATH, HERB_BANDS, greenPathQualifies } = h;
  const { PLANTABLE_HERBS } = require('../data/garden');
  const { POTION_RECIPES } = require('../data/gameConstants');

  // ── The level cap ─────────────────────────────────────────────────────────
  // Walk the real level-up rule to see how high a player can actually get.
  let level = 1, points = 0;
  const MAX = MAX_LEVEL; // the server's own cap, not a copy of it
  const xp = XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
  while (level < MAX && xp >= XP_THRESHOLDS[level]) { level++; points++; }
  const topGate = Math.max(...GREEN_PATH.map((c) => c.requiresLevel || 1));
  check('the hardest Green Path gate is reachable', level >= topGate, { reachable: level, needs: topGate });
  check('every XP threshold in the table is usable', level === XP_THRESHOLDS.length,
    { reachable: level, thresholds: XP_THRESHOLDS.length });
  // data/skills.js documents "~19 points for life" at the cap — keep them agreed.
  check('reaching the cap earns the 19 skill points the design assumes', points === 19, points);

  // ── Objectives mean what they say ─────────────────────────────────────────
  const nightshade = GREEN_PATH.find((c) => /nightshade/i.test(c.objective.label));
  check('the nightshade chapter asks for a herb band', !!(nightshade && nightshade.objective.requires), nightshade && nightshade.objective);
  check('planting rue does NOT satisfy it', !greenPathQualifies(nightshade.objective, { herb: 'rue' }));
  check('planting belladonna does', greenPathQualifies(nightshade.objective, { herb: 'belladonna' }));
  check('planting nothing does not', !greenPathQualifies(nightshade.objective, null));

  const baneBrew = GREEN_PATH.find((c) => /baneful draught/i.test(c.objective.label));
  const hedgeBrew = GREEN_PATH.find((c) => /hedge remedy/i.test(c.objective.label));
  const byId = (id) => POTION_RECIPES.find((r) => r.id === id);
  check('a healing brew does not pass for a baneful draught', !greenPathQualifies(baneBrew.objective, { recipe: byId('regen_brew') }));
  check('a baneful brew does', greenPathQualifies(baneBrew.objective, { recipe: byId('mandrake_draught') }));
  check('a baneful brew does not pass for the hedge remedy', !greenPathQualifies(hedgeBrew.objective, { recipe: byId('mandrake_draught') }));
  check('a hedge brew does', greenPathQualifies(hedgeBrew.objective, { recipe: byId('rue_water') }));
  // Unfiltered chapters keep accepting anything.
  const anyBrew = GREEN_PATH.find((c) => /any remedy/i.test(c.objective.label));
  check('an unfiltered chapter still accepts anything', greenPathQualifies(anyBrew.objective, { recipe: byId('regen_brew') }));

  // ── Every filtered chapter is actually completable ────────────────────────
  // A filter that nothing can satisfy would be worse than the bug it fixes.
  const impossible = [];
  for (const c of GREEN_PATH) {
    const o = c.objective;
    if (!o.requires) continue;
    const band = HERB_BANDS[o.requires] || [];
    if (o.type === 'garden_plant' && !band.some((hb) => PLANTABLE_HERBS.includes(hb))) impossible.push(c.title + ': no sowable herb in band');
    if (o.type === 'garden_brew' && !POTION_RECIPES.some((r) => (r.ingredients || []).some((i) => band.includes(i.id)))) impossible.push(c.title + ': no recipe uses the band');
  }
  check('every herb-band objective can be satisfied', impossible.length === 0, impossible);

  // A chapter can only demand herbs the player could already have: the band's
  // herbs must be obtainable before that chapter, not handed out by it.
  const tooEarly = [];
  for (let i = 0; i < GREEN_PATH.length; i++) {
    const o = GREEN_PATH[i].objective;
    if (!o.requires) continue;
    const band = HERB_BANDS[o.requires] || [];
    const earlierRewards = GREEN_PATH.slice(0, i).flatMap((c) => (c.itemRewards || []).map((r) => r.itemId));
    if (!band.some((hb) => earlierRewards.includes(hb))) tooEarly.push(GREEN_PATH[i].title + ' needs ' + o.requires + ' herbs it is never given');
  }
  check('no chapter demands a herb band it has not handed out yet', tooEarly.length === 0, tooEarly);

  // ── The player is told which herbs count ──────────────────────────────────
  const unclear = GREEN_PATH.filter((c) => c.objective.requires).filter((c) => {
    const w = h.objectiveWhere(c.objective) || '';
    const band = HERB_BANDS[c.objective.requires] || [];
    return !band.every((id) => {
      const m = h.ITEM_CATALOG[id] || h.PLANT_CATALOG[id];
      return w.includes((m && m.name) || id);
    });
  }).map((c) => c.title);
  check('the directions name every herb that qualifies', unclear.length === 0, unclear);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 500);
