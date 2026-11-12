// The Knight's third episode, at Ashminster in the Ember Wastes, and the
// anchoress's two quests, against the real server.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ashstory-test-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
require('../server.js');
const { STORYLINES, QUEST_CATALOG } = require('../data/quests');
const { TITLES } = require('../data/titles');
const { EMBER_TOWN: T, ASH_SPOTS, ANCHORESS } = require('../data/emberTown');

const K = STORYLINES[3].chapters;
check('the Knight has twelve chapters; the other classes keep their nine', K.length === 12 && [0, 1, 2, 4, 5].every((c) => STORYLINES[c].chapters.length === 9));
check('the third episode: find Ashminster, speak at the squint, lay fifteen to rest', K[9].objective.type === 'visit_room' && K[9].objective.room === 'ashminster' && K[10].objective.type === 'talk_npc' && K[10].objective.npcId === 'npc_anchoress' && K[11].objective.type === 'kill_mob' && K[11].objective.target === 15);
check('each new chapter has its telling before and after, its level, and its pay', K.slice(9).every((c) => c.intro.length > 150 && c.outro.length > 150 && c.requiresLevel === 17 && c.xpReward > 0 && c.goldReward > 0 && c.title));
check('it keeps to the story the first two episodes told: the Order, the witches it had hunted, Hazel, and the page cut out', /leaf was cut out/.test(K[9].intro) && /five women it had been hunting/.test(K[10].outro) && /Hazel cut the one over the door/.test(K[10].outro) && /we were not ashamed of you/.test(K[10].outro) && /daisy wheel/.test(K[11].outro));
check('the anchoress says the same thing to everyone at her squint', /stopped, here, at this wall/.test(ANCHORESS.says[2]) && /five women the Order had been hunting/.test(ANCHORESS.says[2]));
const f = QUEST_CATALOG.isolt_field, w = QUEST_CATALOG.isolt_watch;
check('her two quests: one to do again, one long one done once that follows it and gives a title that exists', f && w && f.npcId === 'npc_anchoress' && !f.oneTime && f.type === 'kill_mob' && f.target === 10 && w.oneTime === true && w.requiresQuestDone === 'isolt_field' && w.target === 25 && w.grantsTitle === 'frith_keeper' && TITLES.frith_keeper && /Ashminster/.test(TITLES.frith_keeper.from));

setTimeout(() => {
  const h = global.__testHooks;
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
  const setChapter = (p, idx) => { h.getProgress(p).story[p.charId] = { chapter: idx, progress: 0, active: true }; };
  const chapterOf = (p) => h.getProgress(p).story[p.charId].chapter;

  const A = join('Oathkeeper', 3);
  setChapter(A.p, 9);
  Object.assign(A.p, { room: 'ember_wastes', isDead: false, x: 10000, y: 18600 });
  h.ashminster.tick([A.p]);
  check('standing at the arrival portal is not finding Ashminster', chapterOf(A.p) === 9);
  Object.assign(A.p, { x: T.x, y: T.y + 1900 }); h.ashminster.tick([A.p]);
  check('walking into the town completes "The Mother-House"', chapterOf(A.p) === 10, chapterOf(A.p));
  check('the next chapter waits to be taken up, as every chapter does', h.getProgress(A.p).story[3].active === false);
  setChapter(A.p, 10); // she takes it up in her Journal
  Object.assign(A.p, { x: ASH_SPOTS.anchoress.x + 20, y: ASH_SPOTS.anchoress.y + 30 });
  A.s.emit('message', JSON.stringify({ type: 'ash_use', id: 'anchoress' }));
  check('speaking at the squint completes "The Ninth Anchoress"', chapterOf(A.p) === 11, chapterOf(A.p));
  setChapter(A.p, 11);
  for (let i = 0; i < 14; i++) h.storyEvent(A.p, 'kill_mob', { pool: 'ember_mob', mobType: 'ash_wraith' });
  check('fourteen is not fifteen', chapterOf(A.p) === 11 && h.getProgress(A.p).story[3].progress === 14);
  A.s.sent.length = 0;
  h.storyEvent(A.p, 'kill_mob', { pool: 'ember_mob', mobType: 'ash_wraith' });
  const done = A.s.lastOfType('story_chapter_complete');
  check('the fifteenth completes the episode, and with it the Knight\'s whole story', chapterOf(A.p) === 12 && done && done.storyComplete === true, done && done.storyComplete);

  // a Witch who walks the same road has her own story untouched by it, and is still given the anchoress's work
  const B = join('Hedgewitch', 0);
  setChapter(B.p, 3);
  Object.assign(B.p, { room: 'ember_wastes', isDead: false, x: T.x, y: T.y + 1900 }); h.ashminster.tick([B.p]);
  Object.assign(B.p, { x: ASH_SPOTS.anchoress.x + 20, y: ASH_SPOTS.anchoress.y + 30 });
  for (let i = 0; i < ANCHORESS.says.length + 2; i++) B.s.emit('message', JSON.stringify({ type: 'ash_use', id: 'anchoress' }));
  check('another class is not moved on in her own story by any of it', chapterOf(B.p) === 3);
  check('and after the anchoress has said her piece she is offered work', B.s.lastOfType('ash_quest') && B.s.lastOfType('ash_quest').npcId === 'npc_anchoress');
  B.s.sent.length = 0; B.s.emit('message', JSON.stringify({ type: 'quest_talk', npcId: 'npc_anchoress' }));
  const offer = B.s.sent.find((m) => /quest/.test(m.type));
  check('the quest she is offered is "Lay the Field"', offer && JSON.stringify(offer).includes('Lay the Field'), offer && offer.type);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
