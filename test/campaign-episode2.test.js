// Episode II — the three endgame campaign chapters (7–9) added to every class,
// and the new objective types that thread them through the Delve, the
// Artificer's Workshop, and the World Boss. Guards the data shape and drives
// each new objective→story wiring through the real server paths.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ep2-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const LINES = h.STORYLINES, CAT = h.ITEM_CATALOG;
  const EP2_OBJ = new Set(['delve_depth', 'craft_item', 'defeat_world_boss']);

  // ── Data integrity: every class gained chapters 7–9 ──
  const classes = Object.keys(LINES);
  check('all five classes have 9 chapters now', classes.every(k => LINES[k].chapters.length === 9), classes.map(k => LINES[k].chapters.length));
  let badReward = null, badGate = null, missingText = null, ep2Types = new Set();
  for (const k of classes) {
    const chs = LINES[k].chapters;
    for (let i = 6; i < 9; i++) {
      const c = chs[i];
      ep2Types.add(c.objective.type);
      for (const r of (c.itemRewards || [])) if (!CAT[r.itemId]) badReward = `${c.id}:${r.itemId}`;
      if (!c.intro || !c.outro || !c.title || !c.objective.label) missingText = c.id;
      if (!(c.requiresLevel > chs[i - 1].requiresLevel)) badGate = `${c.id} gate ${c.requiresLevel} !> ${chs[i - 1].requiresLevel}`;
    }
  }
  check('Episode II rewards all reference real items', !badReward, badReward);
  check('every Episode II chapter has full narrative + objective', !missingText, missingText);
  check('Episode II level gates keep climbing', !badGate, badGate);
  check('Episode II uses the three new objective types', [...ep2Types].every(t => EP2_OBJ.has(t)), [...ep2Types]);

  // ── Live wiring ──
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId }));
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    const prog = h.getProgress(p); prog.level = 18; if (!prog.story) prog.story = {};
    return { s, p };
  }
  function setChapter(p, idx) { const prog = h.getProgress(p); prog.story[p.charId] = { chapter: idx, progress: 0, active: true }; }
  function chapterOf(p) { return h.getProgress(p).story[p.charId].chapter; }

  // ch7 — delve_depth, gated at minDepth 5 ──────────────────────────────────
  const A = join('Delver', 0); // Witch
  setChapter(A.p, 6); // index 6 = chapter 7 (w7)
  h.noteDelveDepth(A.p, 3); // too shallow — must not credit
  check('a shallow Delve run does not advance ch7', chapterOf(A.p) === 6 && h.getProgress(A.p).story[A.p.charId].progress === 0);
  h.noteDelveDepth(A.p, 5); // reaches the required depth
  check('reaching Delve floor 5 completes ch7', chapterOf(A.p) === 7, chapterOf(A.p));

  // ch8 — craft_item, through the real workshop_craft handler ────────────────
  const B = join('Smith', 1); // Werewolf
  setChapter(B.p, 7); // index 7 = chapter 8 (b8), target 3
  const invB = h.getInventory(B.p);
  for (let i = 0; i < 3; i++) { h.addItemToAccount(invB, 'fur_scrap', 3); h.addItemToAccount(invB, 'animal_pelt', 1); B.s.emit('message', JSON.stringify({ type: 'workshop_craft', recipeId: 'cured_leather' })); }
  check('forging 3 items at the Workshop completes ch8', chapterOf(B.p) === 8, chapterOf(B.p));

  // ch9 — defeat_world_boss, through the real boss kill ──────────────────────
  const C = join('Vanquisher', 3); // Knight
  setChapter(C.p, 8); // index 8 = chapter 9 (k9)
  const boss = h.worldBossMod._forceSpawn();
  C.p.room = 'wilds'; C.p.x = boss.x; C.p.y = boss.y; C.p.isDead = false;
  const res = h.worldBossMod.worldBossHit(C.p, boss.maxHealth + 1000); // one-shot for the test
  check('the killing blow registers', res && res.dead, res);
  check('slaying the World Boss completes the campaign (ch9)', chapterOf(C.p) === 9, chapterOf(C.p));
  const done = C.s.lastOfType('story_chapter_complete');
  check('the finale fires a story-complete ceremony', done && done.storyComplete === true, done && done.storyComplete);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
