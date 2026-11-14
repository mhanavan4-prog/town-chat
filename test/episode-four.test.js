// Episode IV for every class (data/quests.js chapters 13-15): what each Episode III left owing, paid. Hazel comes out
// to the ring; the Old Wolf gets his name back; the forty-second gets hers; Dorran restores the leaf; the open road
// gets a market; the Sixth Rite gets its ending. Every place a chapter sends you to is one already in the world.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ep4-test-');
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
const { STOPS_BY_ID } = require('../data/droveRoad');
const { ASH_SPOTS } = require('../data/emberTown');
const { EMBER_LORE_BY_ID } = require('../data/emberLore');
const { BYWAYS_BY_ID } = require('../data/byways');
const { FOLK } = require('../data/ashFolk');

const ALL = [0, 1, 2, 3, 4, 5];
const ep = (c) => STORYLINES[c].chapters.slice(12, 15);
check('every class has three chapters more (fifteen in all), each with its telling before and after, its level and its pay',
  ALL.every((c) => STORYLINES[c].chapters.length === 15 && ep(c).every((ch) => ch.intro.length > 300 && ch.outro.length > 350 && ch.requiresLevel === 17 && ch.xpReward >= 200 && ch.goldReward >= 120 && ch.title)));
check('ids are the class\'s own, 13 to 15, and none is used twice', ALL.every((c) => ep(c).every((ch, i) => new RegExp('^[a-z]+' + (13 + i) + '$').test(ch.id))) && new Set(Object.values(STORYLINES).flatMap((l) => l.chapters.map((ch) => ch.id))).size === 90);
check('the last of each pays the most, and leaves something in the hand', ALL.every((c) => ep(c)[2].xpReward > ep(c)[1].xpReward && ep(c)[2].itemRewards && ep(c)[2].itemRewards.length));
check('every place a chapter sends you to says where it is', ALL.every((c) => ep(c).every((ch) => ch.objective.where && ch.objective.where.length > 40)));
const rooms = ALL.flatMap((c) => ep(c).filter((ch) => ch.objective.type === 'visit_room').map((ch) => ch.objective.room));
const isThere = (r) => r === 'witch_ring' || r === 'crypt'
  || (/^field_/.test(r) && (FINDS_BY_ID[r.slice(6)] || Object.keys(FINDS_BY_ID).some((id) => id.split('_')[0] === r.slice(6))))
  || (/^ash_/.test(r) && ASH_SPOTS[r.slice(4)]) || (/^lore_/.test(r) && EMBER_LORE_BY_ID[r.slice(5)])
  || (/^drove_/.test(r) && STOPS_BY_ID[r.slice(6)]) || (/^byway_/.test(r) && BYWAYS_BY_ID[r.slice(6)]);
check('and each is a thing that is already there: the ring, the crypt, a find on the field, a spot in Ashminster, a stone, a stop on the drove road', rooms.length === 17 && rooms.every(isThere), rooms.filter((r) => !isThere(r)));
check('no chapter of the episode is a count of things killed: each is somewhere to go and something to find out', ALL.every((c) => ep(c).every((ch) => ch.objective.type !== 'kill_mob')));
// each pays what its own Episode III left owing
check('the Witch: Hazel said "I am coming with you", and comes; the five are the five of the ring', /I am coming with you/.test(STORYLINES[0].chapters[11].outro) && /I said I would come/.test(ep(0)[0].intro) && FIVE.slice(1).every((w) => ep(0)[0].outro.includes(w.name.split(' ')[0])));
check('the Werewolf: the name the weather took off the rowan post is found, in the baggage ledger that is on the field', /a name that the weather has had/.test(STORYLINES[1].chapters[10].outro) && /ledger/.test(FINDS_BY_ID.wagons.says || FINDS_BY_ID.wagons.blurb || JSON.stringify(FINDS_BY_ID.wagons)) && /Bracken/.test(ep(1)[1].outro) && /BRACKEN\. CAME HOME\./.test(ep(1)[2].outro));
check('the Mystic: the ones who "want to stay" are stood down, and the forty-second, promised the sky, remembers her name under it', /Some want to stay/.test(STORYLINES[2].chapters[11].outro) && /stood down/.test(ep(2)[0].intro) && /show me the sky/.test(ep(2)[2].intro) && /Alys/.test(ep(2)[2].outro));
check('the Knight: Dorran, who asked to be shown the way, is; the cut leaf is written back; "the tenth has not been chosen" is answered', /asks you to show him the way/.test(STORYLINES[3].chapters[11].outro) && /show me the way/.test(ep(3)[0].intro) && /restored by the hand of Brother Dorran/.test(ep(3)[1].outro) && /the tenth has not been chosen/.test(ep(3)[2].intro) && /keep a lamp/.test(ep(3)[2].outro));
check('the Wanderer: the road marked OPEN gets its miles, its need-fire and its market', /OPEN/.test(STORYLINES[4].chapters[11].outro) && /VII/.test(ep(4)[0].outro) && /need|rubbing wood/.test(ep(4)[1].intro) && /a real market/.test(ep(4)[2].outro) && /Old Mabel/.test(ep(4)[2].outro));
check('the Necromancer: "how it is supposed to end" is learned from the sexton, and written on the struck page', /how it is supposed to end/.test(STORYLINES[5].chapters[10].outro) && /Wat/.test(ep(5)[1].outro) && /struck page/.test(ep(5)[1].outro) && /its ending in it/.test(ep(5)[2].outro));
check('the people in it are the people who are there: Wat the sexton and Nan at the well', FOLK.some((f) => f.id === 'wat' && /sexton/.test(f.name)) && FOLK.some((f) => f.id === 'nan' && /well/.test(f.name)) && /Nan from the well/.test(ep(4)[2].outro));
// what the chapters say of real practice is what the game already cites elsewhere
{ const wat = FOLK.find((f) => f.id === 'wat');
  check('the passing bell and its tellers (three, six, nine, then the years) are as the sexton\'s board cites them', /three strokes for a child, three times two for a woman, three times three for a man/.test(wat.lore.join(' ')) && /Canons Ecclesiastical of 1604/.test(wat.source) && /nine strokes for a man/.test(ep(2)[1].intro) && /Six for a woman/.test(ep(2)[2].intro) && /three for a child/.test(ep(2)[2].intro));
  check('sin-eating and the need-fire are the record their own stones give', EMBER_LORE_BY_ID.sin.tier === 'record' && STOPS_BY_ID.needfire.tier === 'record' && /eat bread over the dead/.test(ep(5)[0].intro) && /driven through the smoke/.test(ep(4)[1].intro)); }

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
  const done = (s) => s.lastOfType('story_chapter_complete');
  // go up to the thing a chapter names and press on it, the way the client does
  function goTo(P, room) {
    if (room === 'witch_ring') { at(P.p, RING.x + 100, RING.y); say(P.s, { type: 'ring_use', id: FIVE[0].id }); return; }
    if (room === 'crypt') { at(P.p, 3000, 5000, 'wilds'); say(P.s, { type: 'enter_crypt' }); return; }
    if (/^field_/.test(room)) { const id = FINDS_BY_ID[room.slice(6)] ? room.slice(6) : Object.keys(FINDS_BY_ID).find((k) => k.split('_')[0] === room.slice(6)); const f = FINDS_BY_ID[id]; at(P.p, f.x + 30, f.y); say(P.s, { type: 'field_use', id }); return; }
    if (/^ash_/.test(room)) { const a = ASH_SPOTS[room.slice(4)]; at(P.p, a.x + 20, a.y + 20); say(P.s, { type: 'ash_use', id: room.slice(4) }); return; }
    if (/^lore_/.test(room)) { const e = EMBER_LORE_BY_ID[room.slice(5)]; at(P.p, e.x + 20, e.y); say(P.s, { type: 'ember_lore_use', id: room.slice(5) }); return; }
    if (/^drove_/.test(room)) { const d = STOPS_BY_ID[room.slice(6)]; at(P.p, d.x + 20, d.y, 'wilds'); say(P.s, { type: 'drove_use', id: room.slice(6) }); return; }
  }
  const NAMES = ['Firsthand', 'Bracken', 'Alys', 'Tenth', 'Marketday', 'Fourlines'];
  for (const c of ALL) {
    const P = join(NAMES[c], c);
    let ok = true; const why = [];
    for (let i = 0; i < 3; i++) {
      setChapter(P.p, 12 + i);
      const obj = ep(c)[i].objective;
      if (obj.type === 'talk_npc') { at(P.p, ASH_SPOTS.anchoress.x + 20, ASH_SPOTS.anchoress.y + 30); say(P.s, { type: 'ash_use', id: 'anchoress' }); }
      else goTo(P, obj.room);
      if (chapterOf(P.p) !== 13 + i) { ok = false; why.push(ep(c)[i].id); }
    }
    const d = done(P.s);
    check(`${STORYLINES[c].title}: its three chapters are each completed by going to the place and pressing on it`, ok, why);
    check('  and the last completes the whole story', chapterOf(P.p) === 15 && d && d.storyComplete === true && d.totalChapters === 15 && /THE STORY IS COMPLETE/.test(d.message), d && d.message);
    const st = P.s.lastOfType('story_state');
    check('  after which the journal shows fifteen done and nothing left', st && st.storyline.complete === true && st.storyline.arc.length === 15 && st.storyline.arc.every((a) => a.state === 'done'));
  }
  // the things themselves still do what they did: a stone already read, a spot far off
  { const P = join('Farfrom', 5); setChapter(P.p, 12);
    const e = EMBER_LORE_BY_ID.sin; at(P.p, e.x + 2000, e.y); say(P.s, { type: 'ember_lore_use', id: 'sin' });
    check('pressing from far off finds nothing', chapterOf(P.p) === 12);
    at(P.p, e.x + 20, e.y, 'wilds'); say(P.s, { type: 'ember_lore_use', id: 'sin' });
    check('nor from the wrong side of the portal', chapterOf(P.p) === 12);
    at(P.p, e.x + 20, e.y); say(P.s, { type: 'ember_lore_use', id: 'sin' }); h.getProgress(P.p).story[5] = { chapter: 12, progress: 0, active: true };
    say(P.s, { type: 'ember_lore_use', id: 'sin' });
    check('a stone already read still counts as the place found', chapterOf(P.p) === 13, chapterOf(P.p)); }
  { const P = join('Notyet', 4); setChapter(P.p, 12); h.getProgress(P.p).story[4].active = false;
    const d = STOPS_BY_ID.milestone; at(P.p, d.x + 20, d.y, 'wilds'); say(P.s, { type: 'drove_use', id: 'milestone' });
    check('a chapter not begun is not completed by wandering past its place', chapterOf(P.p) === 12); }
  { const st = (() => { const P = join('Arrow', 4); setChapter(P.p, 12); return h.storyStatePayload ? h.storyStatePayload(P.p) : null; })();
    if (st) check('the waypoint for a drove-road chapter points at the Wilds, and for a thing in Ashminster at the town where the portal is', st.storyline.chapter.goal.room === 'wilds' && h.objectiveGoal({ type: 'visit_room', room: 'ash_frith' }).room === 'outside' && h.objectiveGoal({ type: 'visit_room', room: 'lore_sin' }).room === 'outside');
    else check('the waypoint for a drove-road chapter points at the Wilds, and for a thing in Ashminster at the town where the portal is', h.objectiveGoal({ type: 'visit_room', room: 'drove_milestone' }).room === 'wilds' && h.objectiveGoal({ type: 'visit_room', room: 'ash_frith' }).room === 'outside' && h.objectiveGoal({ type: 'visit_room', room: 'lore_sin' }).room === 'outside'); }
  check('and for the crypt, at the Wilds, where the tombs are', h.objectiveGoal({ type: 'visit_room', room: 'crypt' }).room === 'wilds');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 1500);
