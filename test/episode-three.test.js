// Episode III for every class (data/quests.js chapters 10-12): each class's own story carried out into the
// Ember Wastes, to places that are already there. The Knight's is in test/ashminster-story.test.js.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ep3-test-');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const { STORYLINES } = require('../data/quests');
const { FINDS_BY_ID } = require('../data/emberField');
const { RING, FIVE } = require('../data/witchRing');
const { GATE } = require('../data/droveRoad');
const { EMBER_TOWN: T, ASH_SPOTS } = require('../data/emberTown');

const OTHERS = [0, 1, 2, 4, 5];
const ep = (c) => STORYLINES[c].chapters.slice(9);
check('every class has three chapters more, each with its telling before and after, its level and its pay', OTHERS.every((c) => ep(c).length === 3 && ep(c).every((ch) => ch.intro.length > 150 && ch.outro.length > 150 && ch.requiresLevel === 17 && ch.xpReward > 0 && ch.goldReward > 0 && ch.title && ch.objective.label)));
check('ids are the class\'s own and none is used twice', new Set(Object.values(STORYLINES).flatMap((l) => l.chapters.map((ch) => ch.id))).size === 72);
check('every place a chapter sends you to says where it is', OTHERS.every((c) => ep(c).every((ch) => ch.objective.type === 'kill_mob' || (ch.objective.where && ch.objective.where.length > 40))));
const rooms = OTHERS.flatMap((c) => ep(c).filter((ch) => ch.objective.type === 'visit_room').map((ch) => ch.objective.room));
check('and each is a place that is there: Ashminster, the ring, the gate, or a thing on the field', rooms.every((r) => r === 'ashminster' || r === 'witch_ring' || r === 'march_gate' || (/^field_/.test(r) && (FINDS_BY_ID[r.slice(6)] || Object.keys(FINDS_BY_ID).some((id) => id.split('_')[0] === r.slice(6))))), rooms);
check('each keeps to its own story: Hazel and the five; Dex and the Old Wolf; the forty-second; Mabel\'s map; the Sixth', /Four of us got graves/.test(ep(0)[0].intro) && /Old Wolf/.test(ep(1)[0].intro) && /forty-second/.test(ep(2)[0].intro) && /Mabel/.test(ep(4)[0].intro) && /wrote your rite/.test(ep(5)[0].intro));
check('the Witch hears from Isolt the same history the Knight does, from the other side', /held this door three nights/.test(ep(0)[1].outro) && /hunted your five/.test(ep(0)[1].outro));

require('../server.js');
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
  const at = (p, x, y, room = 'ember_wastes') => Object.assign(p, { room, x, y, isDead: false, instance: '' });
  const say = (s, m) => s.emit('message', JSON.stringify(m));

  // the Witch: the ring, the squint, the bottle
  const W = join('Fifthhand', 0);
  setChapter(W.p, 9);
  at(W.p, RING.x + 3000, RING.y); say(W.s, { type: 'ring_use', id: FIVE[0].id });
  check('pressing from far outside the ring finds nothing', chapterOf(W.p) === 9);
  at(W.p, RING.x + 100, RING.y); say(W.s, { type: 'ring_use', id: FIVE[0].id });
  check('the Witch: a hand to the ring from inside it completes "Five Worn Places"', chapterOf(W.p) === 10, chapterOf(W.p));
  setChapter(W.p, 10);
  at(W.p, ASH_SPOTS.anchoress.x + 20, ASH_SPOTS.anchoress.y + 30); say(W.s, { type: 'ash_use', id: 'anchoress' });
  check('speaking at the squint completes "What the Knights Held"', chapterOf(W.p) === 11, chapterOf(W.p));
  setChapter(W.p, 11);
  const bottle = FINDS_BY_ID.bottle;
  at(W.p, bottle.x + 40, bottle.y); say(W.s, { type: 'field_use', id: 'bottle' });
  const done = W.s.lastOfType('story_chapter_complete');
  check('and the witch-bottle completes her story', chapterOf(W.p) === 12 && done && done.storyComplete === true);

  // the Mystic's chapel, found on a day its find was already made
  const M = join('Listener', 2);
  const chapel = FINDS_BY_ID.chapel;
  at(M.p, chapel.x + 30, chapel.y); say(M.s, { type: 'field_use', id: 'chapel' });   // searched today, before the chapter
  setChapter(M.p, 11);
  say(M.s, { type: 'field_use', id: 'chapel' });
  check('the Mystic: going into the chapel counts even when it was already searched today', chapterOf(M.p) === 12, chapterOf(M.p));

  // the Necromancer: either barrow
  const N = join('Sixth', 5);
  setChapter(N.p, 10);
  const barrow = FINDS_BY_ID.barrow_west;
  at(N.p, barrow.x + 30, barrow.y); say(N.s, { type: 'field_use', id: 'barrow_west' });
  check('the Necromancer: either knight\'s barrow completes "A Knight\'s Barrow"', chapterOf(N.p) === 11, chapterOf(N.p));

  // the Wanderer: through the gate
  const V = join('Roadkeeper', 4);
  setChapter(V.p, 9);
  h.setTemplePortal(true);
  at(V.p, GATE.wilds.x - 40, GATE.wilds.y, 'wilds'); say(V.s, { type: 'march_gate' });
  check('the Wanderer: going through the March gate completes "Through the March Gate"', V.p.room === 'ember_wastes' && chapterOf(V.p) === 10, chapterOf(V.p));
  setChapter(V.p, 10);
  at(V.p, T.x, T.y + 1900); h.ashminster.tick([V.p]);
  check('and walking into Ashminster, the next', chapterOf(V.p) === 11, chapterOf(V.p));

  // the Werewolf: Ashminster, then the rowan post, then twelve
  const B = join('Firstlink', 1);
  setChapter(B.p, 10);
  const rowan = FINDS_BY_ID.rowan;
  at(B.p, rowan.x + 30, rowan.y); say(B.s, { type: 'field_use', id: 'rowan' });
  check('the Werewolf: the rowan post completes "Rowan and Red Thread"', chapterOf(B.p) === 11, chapterOf(B.p));
  setChapter(B.p, 11);
  for (let i = 0; i < 12; i++) h.storyEvent(B.p, 'kill_mob', { pool: 'ember_mob', mobType: 'ash_wraith' });
  check('and twelve laid to rest, the last', chapterOf(B.p) === 12);

  const server = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
  check('the waypoint does not point wrongly at places in the Wastes: it points at the town, and the gate\'s at the Wilds', /obj\.room === 'witch_ring' \|\| \/\^field_\/\.test\(obj\.room \|\| ''\)\) return \{ kind: 'room', room: 'outside' \}/.test(server) && /obj\.room === 'march_gate'\) return \{ kind: 'room', room: 'wilds' \}/.test(server));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
