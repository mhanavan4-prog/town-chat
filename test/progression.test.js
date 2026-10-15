// Progression-funnel instrumentation (Session N, PR 5): ability.cast (+ by
// class), chapter.complete (+ by class), and the once-per-account furthest-
// chapter milestone (mile.chapterN). In-process mock-socket harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-progress-');

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
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const A = h.analytics;
  const today = () => A.data[A.day()] || {};
  const n = (m) => today()[m] || 0;

  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: charId || 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }
  // Build a detail object + event name that will satisfy a chapter's objective.
  function fireObjective(p, obj) {
    const d = {};
    if (obj.type === 'harvest_specific') { d.itemId = obj.itemId; return h.storyEvent(p, 'harvest_plant', d); }
    if (obj.type === 'talk_npc') { d.npcId = obj.npcId; return h.storyEvent(p, 'talk_npc', d); }
    if (obj.type === 'visit_room') { d.room = obj.room; return h.storyEvent(p, 'visit_room', d); }
    if (obj.type === 'delve_depth') { d.depth = obj.minDepth; return h.storyEvent(p, 'delve_depth', d); }
    const map = { kill_mob: 'kill_mob', harvest_plant: 'harvest_plant', cast_ability: 'cast_ability', craft_potion: 'craft_potion', craft_item: 'craft_item', defeat_world_boss: 'defeat_world_boss' };
    return h.storyEvent(p, map[obj.type] || obj.type, d);
  }

  // ── Ability casts ───────────────────────────────────────────────────────────
  const w = join('Spellslinger', 0); // charId 0 = Witch
  const cls = (h.CLASS_NAMES[0] || 'drifter').toLowerCase();
  const cast0 = n('ability.cast'), castCls0 = n('ability.cast.' + cls);
  h.storyEvent(w.p, 'cast_ability', { abilityId: 'anything' });
  check('an ability cast bumps ability.cast', n('ability.cast') === cast0 + 1, n('ability.cast'));
  check('an ability cast is attributed to the class', n('ability.cast.' + cls) === castCls0 + 1, n('ability.cast.' + cls));

  // ── Chapter completion + furthest-chapter milestone ─────────────────────────
  const line = h.STORYLINES[0];
  check('the Witch has a storyline', !!(line && line.chapters && line.chapters.length), line && line.chapters && line.chapters.length);
  const st = h.getStoryState(w.p);
  st.active = true; st.chapter = 0; st.progress = 0;
  const ch0 = line.chapters[0], target = ch0.objective.target || 1;
  // This player is a guest, so the furthest-chapter milestone lands on
  // guest.chapterN (accounts use mile.chapterN); the dashboard merges both.
  const comp0 = n('chapter.complete'), compCls0 = n('chapter.complete.' + cls), reach0 = n('guest.chapter1');
  for (let i = 0; i < target; i++) fireObjective(w.p, ch0.objective); // last one completes the chapter
  check('completing a chapter bumps chapter.complete', n('chapter.complete') === comp0 + 1, n('chapter.complete'));
  check('chapter completion is attributed to the class', n('chapter.complete.' + cls) === compCls0 + 1, n('chapter.complete.' + cls));
  check('reaching a chapter records a once-per-session milestone', n('guest.chapter1') === reach0 + 1, n('guest.chapter1'));
  check('the chapter actually advanced', st.chapter === 1, st.chapter);

  // The milestone is once-per-session: re-reaching chapter 1 does not double-count.
  const reach1 = n('guest.chapter1');
  h.noteMilestone(w.p, 'chapter1');
  check('the furthest-chapter milestone never double-counts', n('guest.chapter1') === reach1, n('guest.chapter1'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
