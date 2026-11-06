// Hazel's cauldron must offer every recipe the server will accept.
//
// Playtest report: the Green Path's final chapter could not be finished because
// Hazel had no nightshade brews in her menu. The recipes existed — including
// draught_of_the_green_path, the exact one the chapter's own outro names — but
// the client kept a SECOND, hand-maintained copy of the recipe list, and it had
// drifted by 21: every cottage, hedge and Poison Path brew the garden grows.
//
// The list ships from the server now. These checks hold that line, and hold the
// questline to the stronger promise: that each garden band has something to
// brew, so no chapter can ask for a brew that does not exist.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-brew-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const { POTION_RECIPES, HEDGE_SEED_DROPS, BANE_SEED_DROPS } = require('../data/gameConstants');
const { GREEN_PATH } = require('../data/greenPath');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  const s = makeMockSocket('Brewer'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Brewer', charId: 0 }));
  const init = s.lastOfType('init');

  // ── The menu is the catalog ───────────────────────────────────────────────
  check('init ships the recipe book', Array.isArray(init && init.potionRecipes), typeof (init && init.potionRecipes));
  const shipped = (init.potionRecipes || []).map((r) => r.id);
  const missing = POTION_RECIPES.map((r) => r.id).filter((id) => !shipped.includes(id));
  check(`all ${POTION_RECIPES.length} brewable recipes reach the client`, missing.length === 0, missing);

  // Every shipped recipe must be renderable: a result the catalog can name, and
  // ingredients it can name too, or the menu row comes out blank.
  const C = h.ITEM_CATALOG;
  const unnameable = (init.potionRecipes || []).filter((r) => !C[r.result] || (r.ingredients || []).some((i) => !C[i.id]));
  check('every recipe names a result and ingredients the catalog knows', unnameable.length === 0, unnameable.map((r) => r.id));

  // ── The questline can actually be finished ────────────────────────────────
  // A chapter that asks for a brew from a herb band needs at least one recipe
  // using that band, or it is an objective with no action that satisfies it.
  const bands = {
    hedge: HEDGE_SEED_DROPS.map((d) => d.itemId),
    bane: BANE_SEED_DROPS.map((d) => d.itemId),
  };
  const brewChapters = GREEN_PATH.filter((c) => c.objective.type === 'garden_brew' && c.objective.requires);
  check('the Green Path has brew chapters that name a herb band', brewChapters.length > 0);
  for (const ch of brewChapters) {
    const band = bands[ch.objective.requires] || [];
    const usable = (init.potionRecipes || []).filter((r) => (r.ingredients || []).some((i) => band.includes(i.id)));
    check(`${ch.id} "${ch.title}" has ${usable.length} brew(s) in Hazel's menu that satisfy it`, usable.length > 0, ch.objective);
    // And the server's own qualifier has to agree — the menu offering it is no
    // use if greenPathQualifies turns it away.
    const accepted = usable.filter((r) => h.greenPathQualifies(ch.objective, { recipe: r }));
    check(`  …and the server accepts ${accepted.length} of them for ${ch.id}`, accepted.length > 0, usable.map((r) => r.id));
  }

  // The chapter outro names a specific draught; it should be real and offered.
  const named = (init.potionRecipes || []).find((r) => r.id === 'draught_of_the_green_path');
  check('the Draught of the Green Path the finale names is in the menu', !!named, shipped.filter((x) => x.includes('green')));

  // ── Every garden plant is worth growing ───────────────────────────────────
  // A plant that nothing brews is a dead end in a questline whose whole point
  // is growing it.
  const { GREEN_PATH_CATEGORIES } = require('../data/greenPath');
  const brewed = new Set();
  for (const r of init.potionRecipes || []) for (const i of r.ingredients || []) brewed.add(i.id);
  const deadEnds = [];
  for (const cat of GREEN_PATH_CATEGORIES) for (const p of cat.plants) if (!brewed.has(p.id)) deadEnds.push(cat.id + '/' + p.id);
  check('every Green Path plant is used by at least one brew', deadEnds.length === 0, deadEnds);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
