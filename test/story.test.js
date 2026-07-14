// Runs the Knight's entire 6-chapter campaign end-to-end against the real
// server.js handlers (mock sockets), plus spot-checks every other class's
// storyline shape and the new wave of side quests.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-story-test-');

function makeMockSocket(label) {
  return {
    label,
    OPEN: 1,
    readyState: 1,
    sent: [],
    _handlers: {},
    on(event, cb) { this._handlers[event] = cb; },
    send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) {
      for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i];
      return null;
    },
    allOfType(type) { return this.sent.filter(m => m.type === type); }
  };
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name); }
}

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const hooks = global.__testHooks;

  // --- Storyline data sanity for all 5 classes ---
  check('all 5 classes have a storyline', [0, 1, 2, 3, 4].every(c => hooks.STORYLINES[c]));
  check('every storyline has 6 chapters', [0, 1, 2, 3, 4].every(c => hooks.STORYLINES[c].chapters.length === 6));
  let badChapters = 0;
  for (const line of Object.values(hooks.STORYLINES)) {
    for (const ch of line.chapters) {
      if (!ch.title || !ch.intro || !ch.outro || !ch.objective || !ch.objective.type ||
          !ch.objective.label || !(ch.objective.target > 0) || !(ch.xpReward > 0)) badChapters++;
    }
  }
  check('every chapter has title/intro/outro/objective/rewards', badChapters === 0);
  check('every finale grants a class item', [0, 1, 2, 3, 4].every(c => {
    const last = hooks.STORYLINES[c].chapters[5];
    return last.itemRewards && last.itemRewards.length > 0;
  }));

  // --- The Knight's campaign, end to end ---
  const knight = makeMockSocket('knight');
  connHandler(knight);
  knight.emit('message', JSON.stringify({ type: 'join', name: 'SirTest', charId: 3 }));
  const knightId = knight.lastOfType('init').id;
  const player = hooks.players.get(knightId);

  let st = knight.lastOfType('story_state');
  check('story_state arrives on join', !!st && !!st.storyline);
  check('Knight gets The Hollow Oath at chapter 1, not yet begun',
    st.storyline.title === 'The Hollow Oath' && st.storyline.chapterIndex === 0 && st.storyline.active === false);

  // Events before beginning the chapter must not advance anything.
  knight.emit('message', JSON.stringify({ type: 'npc_hint_talk', npcId: 'npc_knight' }));
  check('objective events before Begin do nothing', knight.lastOfType('story_state').storyline.chapterIndex === 0);

  // Chapter 1: talk to Sir Dorran.
  knight.emit('message', JSON.stringify({ type: 'story_begin' }));
  check('story_begin starts the chapter', !!knight.lastOfType('story_chapter_started') &&
    knight.lastOfType('story_state').storyline.active === true);
  knight.emit('message', JSON.stringify({ type: 'npc_hint_talk', npcId: 'npc_knight' }));
  let complete = knight.lastOfType('story_chapter_complete');
  check('chapter 1 (talk to Sir Dorran) completes', !!complete && complete.chapterTitle === 'Orders from No One');
  check('chapter completion grants XP', !!knight.lastOfType('xp_gain'));
  st = knight.lastOfType('story_state');
  check('journal advances to chapter 2, inactive until begun', st.storyline.chapterIndex === 1 && st.storyline.active === false);

  // --- Level gates: chapter 2 requires Level 2 — an under-leveled Begin
  // must bounce with a story_error and leave the chapter inactive.
  knight.emit('message', JSON.stringify({ type: 'story_begin' }));
  check('under-leveled story_begin is rejected with story_error', !!knight.lastOfType('story_error'));
  check('rejected begin leaves the chapter inactive', knight.lastOfType('story_state').storyline.active === false);
  check('story_state exposes the gate to the Journal',
    knight.lastOfType('story_state').storyline.chapter.requiresLevel === 2 &&
    knight.lastOfType('story_state').storyline.chapter.levelOk === false);

  // Level the knight the honest way (XP), then chapters open. Gates are
  // [1,2,3,4,6,8] — pushing straight to Level 8 covers the whole run so
  // the rest of this test can keep exercising objectives, not grinding.
  hooks.grantXP(player, hooks.XP_THRESHOLDS[7]); // cumulative XP for L8
  check('XP grant levels the player to 8+', hooks.getProgress(player).level >= 8);

  // Chapter 2: kill 6 (kills simulated through the same storyEvent the real
  // mob-death path in applyDamage calls).
  knight.emit('message', JSON.stringify({ type: 'story_begin' }));
  check('story_begin passes once the gate is met', knight.lastOfType('story_state').storyline.active === true);
  for (let i = 0; i < 6; i++) hooks.storyEvent(player, 'kill_mob', { pool: 'mob', mobType: 'night_howler' });
  check('kill chapter sends progress updates along the way', knight.allOfType('story_update').length >= 5);
  complete = knight.lastOfType('story_chapter_complete');
  check('chapter 2 (Proof of Steel) completes after 6 kills', !!complete && complete.chapterTitle === 'Proof of Steel');

  // Chapter 3: visit the library via a real move message.
  knight.emit('message', JSON.stringify({ type: 'story_begin' }));
  knight.emit('message', JSON.stringify({ type: 'move', x: player.x, y: player.y, room: 'library' }));
  complete = knight.lastOfType('story_chapter_complete');
  check('chapter 3 (visit the Library) completes on entering', !!complete && complete.chapterTitle === 'The Archive Lies');

  // Chapter 4: cast 8 knightly arts via real cast_attack messages.
  knight.emit('message', JSON.stringify({ type: 'story_begin' }));
  const arts = ['oath_of_iron', 'field_dressing', 'steadfast_march', 'rallying_wrath', 'heralds_muster', 'banner_of_dread'];
  for (const a of arts) knight.emit('message', JSON.stringify({ type: 'cast_attack', attackId: a }));
  // two more casts — reuse after their cooldowns would block; use distinct self casts by
  // resetting cooldowns the way a waiting player would experience anyway.
  player.attackCooldowns = {};
  knight.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'oath_of_iron' }));
  knight.emit('message', JSON.stringify({ type: 'cast_attack', attackId: 'field_dressing' }));
  complete = knight.lastOfType('story_chapter_complete');
  check('chapter 4 (Drills at Dusk) completes after 8 casts', !!complete && complete.chapterTitle === 'Drills at Dusk');

  // Chapter 5: visit the bank.
  knight.emit('message', JSON.stringify({ type: 'story_begin' }));
  knight.emit('message', JSON.stringify({ type: 'move', x: player.x, y: player.y, room: 'bank' }));
  complete = knight.lastOfType('story_chapter_complete');
  check('chapter 5 (The Vault Ledger) completes at the Bank', !!complete && complete.chapterTitle === 'The Vault Ledger');

  // Chapter 6: 12 more kills → campaign complete + Dread Helm.
  knight.emit('message', JSON.stringify({ type: 'story_begin' }));
  for (let i = 0; i < 12; i++) hooks.storyEvent(player, 'kill_mob', { pool: 'mob2', mobType: 'shade_stalker' });
  complete = knight.lastOfType('story_chapter_complete');
  check('chapter 6 (Purge the Breach) completes', !!complete && complete.chapterTitle === 'Purge the Breach');
  check('campaign completion is flagged', complete && complete.storyComplete === true);
  st = knight.lastOfType('story_state');
  check('story_state reports the campaign complete', st.storyline.complete === true);
  const inv = hooks.getInventory(player);
  check('finale grants the Dread Helm', inv.slots.some(s => s && s.itemId === 'dread_helm'));

  // Progress is per-class: rejoining as a different class starts fresh.
  const witch = makeMockSocket('witch');
  connHandler(witch);
  witch.emit('message', JSON.stringify({ type: 'join', name: 'HexTest', charId: 0 }));
  const wSt = witch.lastOfType('story_state');
  check('a different class gets its own storyline at chapter 1',
    wSt.storyline.title === 'The Fifth Hand' && wSt.storyline.chapterIndex === 0);

  // Witch chapter 1 completes through the real quest_talk path (Scholar Lyra).
  witch.emit('message', JSON.stringify({ type: 'story_begin' }));
  witch.emit('message', JSON.stringify({ type: 'quest_talk', npcId: 'npc_lyra', npcName: 'Scholar Lyra' }));
  check('Witch chapter 1 (talk to Lyra) completes via quest_talk',
    !!witch.lastOfType('story_chapter_complete'));

  // --- Side quests wave two: hint/shop NPCs now give quests ---
  const newGivers = ['npc_bartender', 'npc_scholar', 'npc_apothecary', 'npc_tailor', 'npc_armorer',
    'npc_patron', 'npc_apprentice', 'npc_tinkerer', 'npc_noble', 'npc_knight', 'npc_guard'];
  const byNpc = {};
  for (const [qid, q] of Object.entries(hooks.QUEST_CATALOG)) byNpc[q.npcId] = qid;
  check('all 11 building NPCs have a side quest', newGivers.every(n => byNpc[n]));

  const adventurer = makeMockSocket('adv');
  connHandler(adventurer);
  adventurer.emit('message', JSON.stringify({ type: 'join', name: 'Quester', charId: 4 }));
  adventurer.emit('message', JSON.stringify({ type: 'quest_talk', npcId: 'npc_guard' }));
  const offer = adventurer.lastOfType('quest_offer');
  check('Guard Petra offers her quest', offer && offer.questId === byNpc['npc_guard']);
  adventurer.emit('message', JSON.stringify({ type: 'quest_accept', npcId: 'npc_guard' }));
  check('quest accepted', !!adventurer.lastOfType('quest_started'));
  const advPlayer = hooks.players.get(adventurer.lastOfType('init').id);
  for (let i = 0; i < 5; i++) hooks.advanceQuestProgress(advPlayer, 'kill_mob', null);
  check('side quest completes with rewards', !!adventurer.lastOfType('quest_complete'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
