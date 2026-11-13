// Ashminster, living in (data/ashFolk.js, lib/ashFolk.js): people come back to
// the town as your own story there goes on, and each takes up a trade.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ashfolk-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const { FOLK, ASH_FOLK } = require('../data/ashFolk');
const S = require('../lib/emberSolids');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

check('three come back, one for each thing done: arriving, being heard, standing the watch', FOLK.length === 3 && ['arrived', 'heard', 'watched'].every((k) => FOLK.some((f) => f.after === k)));
check('each is in the record, with a source and a note on where the game goes beyond it', FOLK.every((f) => f.tier === 'record' && f.lore.length >= 2 && f.source && f.note && f.empty && f.back));
check('each stands clear of the town\'s walls', FOLK.every((f) => !S.blocked(f.x, f.y, 30)));

require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('a'); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', name: 'Ashwalker' }));
  const p = h.players.get(s.lastOfType('init').id);
  const prog = h.getProgress(p);
  const by = Object.fromEntries(FOLK.map((f) => [f.id, f]));
  const at = (f, dy = 60) => Object.assign(p, { room: 'ember_wastes', x: f.x, y: f.y + dy, isDead: false });

  check('at first the town is empty', h.ashFolk.back(p).length === 0);
  at(by.wat); s.sent.length = 0; s.emit('message', JSON.stringify({ type: 'ash_folk_use', id: 'wat' }));
  check('before he is back, his place says it is empty', s.sent.some((m) => m.type === 'toast' && /Nobody has rung it/.test(m.message)));
  s.emit('message', JSON.stringify({ type: 'npc_shop_open', npcId: 'npc_windseller' }));
  check('and Kirsty\'s stall is shut', !s.lastOfType('npc_shop_state'));

  // arriving brings Kirsty: told on the next tick
  h.ashFolk.watch([p]);
  h.ashFolk.mark(p, 'arrived'); s.sent.length = 0; h.ashFolk.watch([p]);
  check('come to Ashminster and the wind-seller comes back, and you are told', h.ashFolk.back(p).join() === 'kirsty' && s.sent.some((m) => m.type === 'toast' && /Kirsty Halcrow has come back/.test(m.message)) && s.lastOfType('ash_folk').back.join() === 'kirsty');
  at(by.kirsty); s.emit('message', JSON.stringify({ type: 'npc_shop_open', npcId: 'npc_windseller' }));
  const shop = s.lastOfType('npc_shop_state');
  check('her stall opens, with knots of wind', shop && shop.items.some((it) => it.id === 'wind_knot'));

  // the knot: only in a storm, and it is spent
  h.addItemToAccount(h.getInventory(p), 'wind_knot', 2);
  const slot = () => h.getInventory(p).slots.findIndex((x) => x && x.itemId === 'wind_knot');
  const count = () => h.getInventory(p).slots.filter((x) => x && x.itemId === 'wind_knot').reduce((a, x) => a + (x.qty || 1), 0);
  h.emberStorm.force('calm', 600000);
  s.emit('message', JSON.stringify({ type: 'use_item', slotIdx: slot() }));
  check('in clear air the knot stays tied', count() === 2 && !s.lastOfType('wind_knot'));
  h.emberStorm.force('storm', 60000);
  s.emit('message', JSON.stringify({ type: 'use_item', slotIdx: slot() }));
  check('in an ash storm it is loosed and blows the ash back off you for a minute', count() === 1 && s.lastOfType('wind_knot') && s.lastOfType('wind_knot').ms === ASH_FOLK.knotMs);
  h.emberStorm.force('calm', 600000);

  // being heard brings Wat; standing the watch brings Nan
  prog.questsDone = { ...(prog.questsDone || {}), isolt_field: true };
  h.ashFolk.watch([p]);
  check('lay the field for Isolt and the sexton comes back', h.ashFolk.isBack(p, 'wat'));
  at(by.wat); s.sent.length = 0; s.emit('message', JSON.stringify({ type: 'ash_folk_use', id: 'wat' }));
  check('ring the passing bell with him, once a day', s.sent.some((m) => m.type === 'toast' && /nine tellers/.test(m.message)));
  s.sent.length = 0; s.emit('message', JSON.stringify({ type: 'ash_folk_use', id: 'wat' }));
  check('again that day, the history of it', s.sent.some((m) => m.type === 'vh_board' && /Wat Ellery/.test(m.title)) && !s.sent.some((m) => m.type === 'toast' && /nine tellers/.test(m.message)));
  prog.story = { ...(prog.story || {}), 3: { chapter: 12, progress: 0, active: false } };
  h.ashFolk.watch([p]);
  check('the Knight who has stood the watch has all three back', h.ashFolk.back(p).join() === 'kirsty,wat,nan');
  p.health = 5; at(by.nan); s.emit('message', JSON.stringify({ type: 'ash_folk_use', id: 'nan' }));
  check('the dressed well mends you', p.health > 5);

  // their work (data/quests.js): offered once they are back, and done by what they ask
  const q = require('../data/quests');
  const CAT = q.QUEST_CATALOG || q;
  check('each has a job', ['kirsty_storm', 'wat_graves', 'nan_petals'].every((id) => CAT[id] && FOLK.some((f) => f.npcId === CAT[id].npcId)));
  prog.level = 10;
  const s2 = makeMockSocket('b'); connHandler(s2); s2.emit('message', JSON.stringify({ type: 'join', name: 'Newcomer' }));
  const p2 = h.players.get(s2.lastOfType('init').id); h.getProgress(p2).level = 10;
  s2.emit('message', JSON.stringify({ type: 'quest_talk', npcId: 'npc_sexton', npcName: 'Wat' }));
  check('nobody gets Wat\'s job before he is back for them', s2.lastOfType('quest_offer') && s2.lastOfType('quest_offer').questId === null);
  at(by.wat); s.sent.length = 0; s.emit('message', JSON.stringify({ type: 'ash_folk_use', id: 'wat' }));
  check('rung for today, he offers his job instead of the history', s.sent.some((m) => m.type === 'ash_quest' && m.npcId === 'npc_sexton'));
  s.emit('message', JSON.stringify({ type: 'quest_accept', npcId: 'npc_sexton' }));
  check('taken on, it says where', s.lastOfType('quest_started') && /track/.test(s.lastOfType('quest_started').where));
  for (let k = 0; k < 3; k++) h.advanceQuestProgress(p, 'event', 'field_find');
  check('three finds on the field and it is done', !p.activeQuest && prog.questsDone.wat_graves === true);
  s.emit('message', JSON.stringify({ type: 'quest_talk', npcId: 'npc_windseller', npcName: 'Kirsty' }));
  s.emit('message', JSON.stringify({ type: 'quest_accept', npcId: 'npc_windseller' }));
  h.advanceQuestProgress(p, 'event', 'field_find');
  check('Kirsty\'s wants a storm, not a find', p.activeQuest && p.activeQuest.questId === 'kirsty_storm' && p.activeQuest.progress === 0);
  h.advanceQuestProgress(p, 'event', 'storm_weathered');
  check('a storm weathered and it is done', !p.activeQuest && prog.questsDone.kirsty_storm === true);
  check('the storm and the field tell the quests', /advanceQuestProgress\(p, 'event', 'storm_weathered'\)/.test(read('server.js')) && /advanceQuestProgress\(player, 'event', 'field_find'\)/.test(read('server.js')));

  const scene = read('client/ember-scene.js'), main = read('client/main.js');
  const m = scene.match(/const ASH_FOLK = (\[[^\n]*\]);/);
  check('the client stands them where the server does', m && JSON.stringify(JSON.parse(m[1])) === JSON.stringify(FOLK.map(({ id, name, icon, charId, x, y, facing }) => ({ id, name, icon, charId, x, y, facing }))));
  check('the client shows only who is back, and opens Kirsty\'s stall as a shop', /folk\[id\]\.visible = ashFolkBack\.has\(id\)/.test(main) && /npcId: 'npc_windseller'/.test(main) && /_emberStorm\.clear\(msg\.ms/.test(main));
  check('the knot is in both item lists', /wind_knot: +\{ name: 'Knot of Wind'/.test(read('data/itemCatalog.js')) && /wind_knot: +\{ name: 'Knot of Wind'/.test(main));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
