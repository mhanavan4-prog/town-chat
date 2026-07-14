// Full-game completability audit — drives every campaign chapter (all 5
// classes) and every side quest through the REAL server handlers, with a
// controlled clock (night forced) so hostile pools exist. Reports anything
// unfinishable, any world-inventory shortfalls (plants vs quest targets
// under the 24h regrow cooldown), and any silent dead-ends.
// Run manually: node test/audit-playthrough.cjs   (not part of npm test)
process.env.PORT = '0';

function makeMockSocket(label) {
  return {
    label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    allOfType(t) { return this.sent.filter(m => m.type === t); }
  };
}

const findings = [];
const notes = [];
let checks = 0, failures = 0;
function expect(desc, cond, detail) {
  checks++;
  if (!cond) { failures++; findings.push(`✗ ${desc}${detail ? ' — ' + detail : ''}`); }
}

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const H = global.__testHooks;

  // Freeze the clock at NIGHT so mob pools are live.
  const realNow = Date.now;
  let fakeNow = Math.floor(realNow() / H.CYCLE_MS) * H.CYCLE_MS + H.DAY_MS + 60000;
  Date.now = () => fakeNow;
  const tick = (ms) => { fakeNow += ms; };

  const join = (name, charId = 3) => {
    const s = makeMockSocket(name);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name, charId }));
    const init = s.lastOfType('init');
    return { s, id: init.id, p: H.players.get(init.id), world2: init.world2 };
  };

  // ── 1. World inventory: plants vs demands under the 24h regrow ──────────
  const probe = join('Prober', 0);
  const wildsPlants = {};
  for (const d of probe.world2.natureDecor || []) {
    wildsPlants[d.type] = (wildsPlants[d.type] || 0) + 1;
  }
  const plantCounts = Object.entries(wildsPlants).filter(([t]) => !['tree', 'shrub', 'flower', 'rock'].includes(t));
  notes.push(`Wilds plant instances: ${plantCounts.map(([t, n]) => `${t}:${n}`).join(', ')}`);

  const demands = []; // [{source, itemId, qty}]
  for (const [_qid, q] of Object.entries(H.QUEST_CATALOG)) {
    if (q.type === 'harvest_specific') demands.push({ source: `side quest "${q.name}"`, itemId: q.targetItemId, qty: q.target });
  }
  for (const [_cid, line] of Object.entries(H.STORYLINES)) {
    for (const ch of line.chapters) {
      if (ch.objective.type === 'harvest_specific') demands.push({ source: `${line.title} — "${ch.title}"`, itemId: ch.objective.itemId, qty: ch.objective.target });
    }
  }
  for (const d of demands) {
    const have = wildsPlants[d.itemId] || 0;
    expect(`world stocks enough ${d.itemId} for ${d.source} in one day (${have} plants vs ${d.qty} needed, 24h regrow)`,
      have >= d.qty, `only ${have} instance(s) exist`);
  }

  // ── helpers to drive objectives through real paths ──────────────────────
  const killTownMob = (p) => {
    const m = H.mobs[0];
    m.dead = false; m.health = 1; m.scaredUntil = 0;
    p.room = 'outside'; p.x = m.x; p.y = m.y;
    const r = H.applyDamage(p, 'mob', m.id, 10, 100);
    return r.ok && r.dead;
  };
  // Session M creature hunts — drive a kill_creature objective by finding a
  // creature of the target type across the Wilds pools and felling it (reviving
  // one if the population is exhausted, since we only care about completability).
  const CRIT_POOL = {
    embermoth: 'animal2', thistlehog: 'animal2', duskfawn: 'animal2', mirefowl: 'animal2', rabbit: 'animal2',
    bramble_boar: 'mob3', mossback_tortoise: 'mob3', gravewing_crow: 'mob3',
    fen_hexer: 'mob2', rot_swarm: 'mob2', barrow_maw: 'mob2', gloom_bat: 'mob2', old_marrowe: 'mob2',
  };
  const POOL_LIST = () => ({ animal2: H.animals2, mob2: H.mobs2, mob3: H.mobs3 });
  const POOL_FIELD = { animal2: 'critterType', mob2: 'mobType', mob3: 'mobType' };
  const killWildsCreature = (p, type) => {
    const targetType = CRIT_POOL[type];
    if (!targetType) return false;
    const list = POOL_LIST()[targetType];
    const field = POOL_FIELD[targetType];
    const c = list.find(x => x[field] === type && !x.dead) || list.find(x => x[field] === type);
    if (!c) return false;
    c.dead = false; c.health = 1; c.emerged = true; c.scaredUntil = 0;
    p.room = 'wilds'; p.x = c.x; p.y = c.y;
    const r = H.applyDamage(p, targetType, c.id, 10, 100);
    return r.ok && r.dead;
  };
  let plantCursor = 0;
  const harvestWildsPlant = (sock, p, world2, specificType) => {
    const all = (world2.natureDecor || []).filter(d => !['tree', 'shrub', 'flower', 'rock'].includes(d.type));
    const pool = specificType ? all.filter(d => d.type === specificType) : all;
    for (let i = 0; i < pool.length; i++) {
      const d = pool[(plantCursor + i) % pool.length];
      sock.emit('message', JSON.stringify({ type: 'move', x: d.x, y: d.y, room: 'wilds' }));
      const before = sock.allOfType('harvest_result').length;
      sock.emit('message', JSON.stringify({ type: 'harvest', decorId: d.id }));
      if (sock.allOfType('harvest_result').length > before) {
        plantCursor = (plantCursor + i + 1) % Math.max(1, pool.length);
        return true;
      }
    }
    return false;
  };
  const castAbility = (sock, p, charId, times) => {
    let done = 0;
    const catalog = charId === 0 ? H.SPELL_CATALOG : H.ATTACK_CATALOGS[charId];
    const safe = Object.entries(catalog).filter(([id, ab]) =>
      ['ward', 'heal', 'selfheal', 'buff', 'regen'].includes(ab.effect) || (!ab.dmgMin && ab.effect !== 'camera' && !ab.needsTarget));
    const ids = (safe.length ? safe : Object.entries(catalog)).map(([id]) => id);
    for (let i = 0; i < times * 3 && done < times; i++) {
      p.spellCooldowns = {}; p.attackCooldowns = {}; p.lastStrikeAt = 0;
      const id = ids[i % ids.length];
      const before = (sock.allOfType('spell_result').length + sock.allOfType('attack_result').length);
      sock.emit('message', JSON.stringify(charId === 0
        ? { type: 'cast_spell', spellId: id }
        : { type: 'cast_attack', attackId: id }));
      if ((sock.allOfType('spell_result').length + sock.allOfType('attack_result').length) > before) done++;
      tick(200);
    }
    return done >= times;
  };

  // ── 2. All 18 side quests ────────────────────────────────────────────────
  for (const [qid, q] of Object.entries(H.QUEST_CATALOG)) {
    const { s, p, world2 } = join('SQ_' + qid.slice(0, 10), 4);
    // An NPC can carry several jobs now (Session M rotation) and surfaces one
    // at a time. Cool down this NPC's EARLIER quests so the one under test is
    // the one offered — every quest stays reachable, just not simultaneously.
    const prog = H.getProgress(p);
    prog.questCooldowns = prog.questCooldowns || {};
    for (const other of (H.QUEST_BY_NPC[q.npcId] || [])) { if (other === qid) break; prog.questCooldowns[other] = fakeNow; }
    s.emit('message', JSON.stringify({ type: 'quest_talk', npcId: q.npcId, npcName: q.npcName }));
    const offer = s.lastOfType('quest_offer');
    expect(`"${q.name}" (${q.npcId}) is offered on talk`, offer && offer.questId === qid, JSON.stringify(offer));
    if (!offer || offer.questId !== qid) continue;
    s.emit('message', JSON.stringify({ type: 'quest_accept', npcId: q.npcId }));
    expect(`"${q.name}" accepts`, !!s.lastOfType('quest_started'));
    let ok = true;
    for (let i = 0; i < q.target && ok; i++) {
      if (q.type === 'kill_mob') ok = killTownMob(p);
      else if (q.type === 'kill_creature') ok = killWildsCreature(p, q.targetCreature);
      else if (q.type === 'harvest_plant') ok = harvestWildsPlant(s, p, world2);
      else if (q.type === 'harvest_specific') ok = harvestWildsPlant(s, p, world2, q.targetItemId);
      else { ok = false; findings.push(`? "${q.name}" has unhandled type ${q.type}`); }
      tick(400);
    }
    expect(`"${q.name}" objective is drivable (${q.type} ×${q.target})`, ok);
    expect(`"${q.name}" completes with rewards`, !!s.lastOfType('quest_complete'));
    // Re-talk while on cooldown must give feedback, not silence
    s.emit('message', JSON.stringify({ type: 'quest_talk', npcId: q.npcId, npcName: q.npcName }));
    const re = s.lastOfType('quest_offer');
    expect(`"${q.name}" re-talk on cooldown still answers something`, !!re, 'silent NPC after completing their quest');
  }

  // quest_cancel unsticks a player
  {
    const { s, p } = join('Canceller', 2);
    const anyKill = Object.entries(H.QUEST_CATALOG).find(([, q]) => q.type === 'kill_mob');
    s.emit('message', JSON.stringify({ type: 'quest_talk', npcId: anyKill[1].npcId }));
    s.emit('message', JSON.stringify({ type: 'quest_accept', npcId: anyKill[1].npcId }));
    s.emit('message', JSON.stringify({ type: 'quest_cancel' }));
    expect('quest_cancel frees the active slot', p.activeQuest === null && !!s.lastOfType('quest_cancelled'));
  }

  // ── 3. All 5 campaigns, chapter by chapter ──────────────────────────────
  const talkChapter = (s, npcId) => s.emit('message', JSON.stringify({ type: 'quest_talk', npcId }));
  for (let charId = 0; charId < 5; charId++) {
    const line = H.STORYLINES[charId];
    const { s, p, world2 } = join('CAMP' + charId, charId);
    H.grantXP(p, 3000); // clear every level gate up front; gate math itself is covered by the pacing tests
    for (let chIdx = 0; chIdx < line.chapters.length; chIdx++) {
      const ch = line.chapters[chIdx];
      const completesBefore = s.allOfType('story_chapter_complete').length;
      s.emit('message', JSON.stringify({ type: 'story_begin' }));
      const started = s.lastOfType('story_state');
      // A visit-chapter begun while already standing in the target room
      // completes instantly (by design) — "began" = active OR already done.
      const begun = (started && started.storyline.active === true)
        || s.allOfType('story_chapter_complete').length > completesBefore;
      expect(`[${line.title}] ch${chIdx + 1} "${ch.title}" begins`, begun,
        JSON.stringify(s.lastOfType('story_error')));
      const o = ch.objective;
      let ok = true;
      if (o.type === 'talk_npc') { talkChapter(s, o.npcId); }
      else if (o.type === 'visit_room') { s.emit('message', JSON.stringify({ type: 'move', x: 100, y: 100, room: o.room })); }
      else if (o.type === 'kill_mob') { for (let i = 0; i < o.target && ok; i++) { ok = killTownMob(p); tick(9000); } }
      else if (o.type === 'harvest_plant') { for (let i = 0; i < o.target && ok; i++) { ok = harvestWildsPlant(s, p, world2); tick(400); } }
      else if (o.type === 'harvest_specific') { for (let i = 0; i < o.target && ok; i++) { ok = harvestWildsPlant(s, p, world2, o.itemId); tick(400); } }
      else if (o.type === 'cast_ability') { ok = castAbility(s, p, charId, o.target); }
      else if (o.type === 'craft_potion') {
        // Real path: gather the cheapest recipe's herbs, then brew at the cauldron.
        ok = harvestWildsPlant(s, p, world2, 'healing_herb') && harvestWildsPlant(s, p, world2, 'healing_herb');
        s.emit('message', JSON.stringify({ type: 'move', x: 400, y: 400, room: 'witch_cave' }));
        s.emit('message', JSON.stringify({ type: 'witch_craft', recipeId: 'health_potion_ii' }));
        ok = ok && !!s.lastOfType('witch_craft_result');
        if (!ok) findings.push(`  craft detail: ${JSON.stringify(s.lastOfType('witch_craft_error'))}`);
      }
      else { ok = false; findings.push(`? unknown objective type ${o.type}`); }
      expect(`[${line.title}] ch${chIdx + 1} objective drivable (${o.type} ×${o.target})`, ok);
      expect(`[${line.title}] ch${chIdx + 1} completes`,
        s.allOfType('story_chapter_complete').length > completesBefore,
        `stuck at ${JSON.stringify((s.lastOfType('story_update') || {}).progress)} / ${o.target}`);
    }
    const done = s.lastOfType('story_state');
    expect(`[${line.title}] campaign flagged complete`, done && done.storyline.complete === true);
    const relic = line.chapters[5].itemRewards[0].itemId;
    expect(`[${line.title}] relic ${relic} granted`, H.getInventory(p).slots.some(x => x && x.itemId === relic));
  }

  // ── 4. Probes ────────────────────────────────────────────────────────────
  // Pass-locked NPCs: their quests exist behind the Town Pass by design.
  for (const npcId of ['npc_apprentice', 'npc_tinkerer', 'npc_noble']) {
    // QUEST_BY_NPC maps to a LIST of quests per NPC now (Session M rotation).
    for (const qid of (H.QUEST_BY_NPC[npcId] || [])) {
      notes.push(`ℹ️ "${H.QUEST_CATALOG[qid].name}" (${npcId}) lives in a Town Pass building — bonus content behind the paywall (by design; campaign never requires it).`);
    }
  }
  // quest_talk has no server-side range check (client gates by proximity)
  notes.push('ℹ️ quest_talk/story talk objectives have no server-side range check — consistent with the game\'s existing trust model (client enforces proximity).');

  Date.now = realNow;
  console.log('\n════════ AUDIT RESULT ════════');
  console.log(`checks: ${checks}, failures: ${failures}`);
  for (const n of notes) console.log(n);
  if (findings.length) { console.log('\nFINDINGS:'); for (const f of findings) console.log(f); }
  else console.log('\nNo completability failures found.');
  process.exit(failures ? 1 : 0);
}, 200);
