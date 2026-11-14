'use strict';
// Ashminster, living in (data/ashFolk.js): who has come back to the town, for
// this player, and what each does. Kirsty sells knots of wind (her stall is a
// shop: server.js NPC_SHOPS npc_windseller); Wat rings the passing bell with
// you once a day; Nan's dressed well mends you once a day. Before someone is
// back, their place says it is empty.
const { FOLK, FOLK_BY_ID, ASH_FOLK } = require('../data/ashFolk');

const KNIGHT = 3;   // the Knight's storyline (data/quests.js STORYLINES[3]); k10..k12 are chapters 10..12

module.exports = function createAshFolk({ send, grantXP, getProgress, playerMaxHealth, hasQuest = () => false, remark = () => null, acctOf = () => null, now = () => Date.now() }) {
  const day = () => Math.floor(now() / 86400000);
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });

  // What this player has done that brings people back.
  function stages(player) {
    let prog = null;
    try { prog = getProgress(player); } catch (e) { prog = null; }
    const done = (prog && prog.questsDone) || {};
    const knight = (prog && prog.story && prog.story[KNIGHT] && prog.story[KNIGHT].chapter) || 0;
    const ash = (prog && prog.ashminster) || {};
    return {
      arrived: knight >= 10 || !!ash.arrived,
      heard: knight >= 11 || !!ash.spoke || !!done.isolt_field,
      watched: knight >= 12 || !!done.isolt_watch,
    };
  }
  const back = (player) => { const s = stages(player); return FOLK.filter((f) => s[f.after]).map((f) => f.id); };
  const isBack = (player, id) => back(player).includes(id);
  const payload = (player) => ({ type: 'ash_folk', back: back(player) });

  // Marks kept on the account for the stages that are not quests.
  function mark(player, key) {
    let prog = null;
    try { prog = getProgress(player); } catch (e) { return false; }
    if (!prog) return false;
    const a = prog.ashminster || (prog.ashminster = {});
    if (a[key]) return false;
    a[key] = true;   // whoever this brings back is announced by watch() on the next tick
    return true;
  }
  // Someone new has come back: tell her, and redraw the town for her.
  function announce(player) {
    const list = back(player), f = FOLK_BY_ID[list[list.length - 1]];
    if (f) say(player, f.back, 'folk_return');
    send(player.ws, payload(player));
  }

  const dailyOf = (player) => {
    const holder = acctOf(player) || player;
    if (!holder.ashFolkDay || holder.ashFolkDay.day !== day()) holder.ashFolkDay = { day: day(), bell: false, well: false };
    return holder.ashFolkDay;
  };
  const board = (player, f) => send(player.ws, { type: 'vh_board', title: `${f.icon} ${f.name}`, epithet: f.tier === 'record' ? 'In the record' : 'Folk tradition', lines: [...f.lore, `Source: ${f.source}`, f.note] });

  // Wat's bell and Nan's well. (Kirsty's stall opens as a shop; see shopShut.)
  function use(player, id) {
    const f = FOLK_BY_ID[String(id || '')];
    if (!f || !player || player.isDead || player.room !== 'ember_wastes') return false;
    if (Math.hypot(player.x - f.x, player.y - f.y) > ASH_FOLK.range) { say(player, 'Go up to it.'); return false; }
    if (!isBack(player, f.id)) { say(player, f.empty); return false; }
    { const r = remark(player, f.id); if (r) say(player, `${f.icon} ${r}`); }   // a word on how your story ended, once (data/epilogues.js); and then the bell, or the well, as on any day
    const d = dailyOf(player);
    // done for today: a job, if they have one for you (data/quests.js), else the history of it
    const after = () => { if (hasQuest(player, f.npcId)) send(player.ws, { type: 'ash_quest', npcId: f.npcId, npcName: `${f.icon} ${f.name.split(',')[0]}` }); else board(player, f); };
    if (f.id === 'wat') {
      if (d.bell) { after(); return false; }
      d.bell = true;
      grantXP(player, ASH_FOLK.bellXp);
      say(player, `${f.says} (+${ASH_FOLK.bellXp} XP)`, 'passing_bell');
      return true;
    }
    if (f.id === 'nan') {
      if (d.well) { after(); return false; }
      d.well = true;
      const max = playerMaxHealth(player);
      player.health = Math.min(max, player.health + Math.round(max * ASH_FOLK.wellHeal));
      say(player, f.says, 'well_drink');
      return true;
    }
    board(player, f);
    return false;
  }

  // Kirsty's stall: shut (with a word why) unless she is back and you are at it.
  function shopShut(player, npcId, tell) {
    const f = FOLK.find((x) => x.npcId === npcId);
    if (!f) return false;
    const here = player.room === 'ember_wastes' && Math.hypot(player.x - f.x, player.y - f.y) <= ASH_FOLK.range;
    if (here && isBack(player, f.id)) return false;
    if (tell) say(player, here ? f.empty : 'Go up to the stall.');
    else send(player.ws, { type: 'shop_error', message: 'Nobody is at the stall.' });
    return true;
  }

  // On the server's tick, for everyone in the Wastes: has anyone come back since we last looked?
  function watch(players) {
    for (const p of players) {
      if (!p || p.room !== 'ember_wastes' || !p.ws) continue;
      const n = back(p).length;
      if (p.ashFolkN != null && n > p.ashFolkN) announce(p);
      p.ashFolkN = n;
    }
  }

  return { watch, stages, back, isBack, payload, mark, announce, use, shopShut, board };
};
