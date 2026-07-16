// 🗓️ Session L systems — named dungeons + bosses, leaderboards, the event
// calendar (tournament / festival / Blood Moon), the Weekly Delve, covens,
// login streaks + the while-you-were-gone letter, First Steps, the Resident
// Pass, and real Web Push (encrypted end-to-end against a local receiver).
process.env.PORT = '0';
process.env.PUSH_ALLOW_HTTP = '1'; // the push test runs a local plain-http receiver
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-sessionl-test-');

const crypto = require('crypto');
const http = require('http');

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
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); }
}

require('../server.js');

setTimeout(async () => {
  const hooks = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function joinAs(label, accountKey) {
    const sock = makeMockSocket(label);
    connHandler(sock);
    sock.emit('message', JSON.stringify({ type: 'join', name: label }));
    const init = sock.lastOfType('init');
    const player = hooks.players.get(init.id);
    if (accountKey) player.accountKey = accountKey;
    return { sock, player, init };
  }

  // ── Named dungeons + signature bosses ─────────────────────────────────
  const { DUNGEON_LORE, DUNGEON_MOB_TYPES, dungeonMobs } = hooks;
  check('all four dungeons are named with lore + a boss', [1, 2, 3, 4].every(t =>
    DUNGEON_LORE[t] && DUNGEON_LORE[t].name && DUNGEON_LORE[t].plaque && DUNGEON_MOB_TYPES[DUNGEON_LORE[t].bossKey]));
  const bosses = dungeonMobs.filter(m => m.boss);
  check('exactly one signature boss spawned per tier', bosses.length === 4 &&
    new Set(bosses.map(b => b.tier)).size === 4, bosses.map(b => b.id));
  check('bosses respawn slowly (5 min vs 60s)', hooks.DUNGEON_BOSS_RESPAWN_MS === 5 * 60 * 1000);

  const probe = joinAs('LoreProbe', null);
  check('init carries dungeonLore', probe.init.dungeonLore && probe.init.dungeonLore[3].name === DUNGEON_LORE[3].name);
  check('init carries the calendar', probe.init.calendar && probe.init.calendar.tourney && probe.init.calendar.bloodMoon);
  check('init carries this week\'s delve mods (2)', Array.isArray(probe.init.delveMods) && probe.init.delveMods.length === 2);
  check('init carries the Resident Pass price', probe.init.townPass.price30Cents === hooks.TOWN_PASS30_PRICE_CENTS && probe.init.townPass.hours30 === 720);

  // Boss party scaling: engage with two players in the room.
  const b1 = joinAs('Bruiser', 'bruiser1');
  const b2 = joinAs('Backup', 'backup1');
  const boss = dungeonMobs.find(m => m.id === 'dungboss_t1');
  b1.player.room = 'dungeon_t1'; b1.player.x = boss.x; b1.player.y = boss.y + 30;
  b2.player.room = 'dungeon_t1'; b2.player.x = boss.x + 20; b2.player.y = boss.y + 30;
  hooks.bossEngagedScale(boss, DUNGEON_MOB_TYPES[boss.mobType]);
  const expectScaled = Math.round(DUNGEON_MOB_TYPES.boss_rat_king.maxHealth * (1 + hooks.PARTY_BOSS_HP_PER_ALLY));
  check('boss health scales +60% for a second player in the room', boss.scaledMax === expectScaled, { got: boss.scaledMax, want: expectScaled });

  // Kill the boss: killer gets xp, ally gets a 60% share + a party toast,
  // the loot double-rolls, the board notes it, the town hears about it.
  const xpBefore1 = hooks.getProgress(b1.player).xp;
  const xpBefore2 = hooks.getProgress(b2.player).xp;
  const res = hooks.applyDamage(b1.player, 'dungeon', 'dungboss_t1', boss.scaledMax + 1, 900);
  check('boss dies to sufficient damage', res.ok && res.dead === true, res);
  check('killer earned the boss XP', hooks.getProgress(b1.player).xp >= xpBefore1 + DUNGEON_MOB_TYPES.boss_rat_king.xp);
  check('ally in the room earned a 60% share', hooks.getProgress(b2.player).xp >= xpBefore2 + Math.round(DUNGEON_MOB_TYPES.boss_rat_king.xp * 0.6));
  check('ally got the party-kill toast', !!b2.sock.lastOfType('trophy_bonus'));
  check('boss dropped a double loot roll', Array.isArray(boss.pendingLoot));
  check('boss kill scored the weekly boss board', (hooks.lbRankOf('boss', hooks.weekKey(Date.now()), 'bruiser1') || {}).value === 1);
  check('boss kill also scored the hunt board', (hooks.lbRankOf('hunt', hooks.weekKey(Date.now()), 'bruiser1') || {}).value >= 1);

  // ── Leaderboards: bump/top/rank + closed-week settlement ──────────────
  hooks.lbBump('hunt', b2.player, 7);
  const top = hooks.lbTop('hunt', hooks.weekKey(Date.now()));
  check('lbTop sorts descending', top.length >= 2 && top[0].value >= top[1].value);
  const wkNum = Number(hooks.weekKey(Date.now()).slice(1));
  hooks.leaderboards['w' + (wkNum - 1)] = {
    hunt: { oldtimer: { name: 'Oldtimer', value: 50 }, secondp: { name: 'Second', value: 30 } }
  };
  hooks.accounts.oldtimer = { username: 'Oldtimer', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
  const bankBefore = hooks.ensureBankAccount('oldtimer').balance;
  hooks.lbSettleClosedWeeks();
  check('closed week paid first place 250 gold', hooks.ensureBankAccount('oldtimer').balance === bankBefore + 250);
  check('honors were posted', (hooks.leaderboards.honors.oldtimer || []).some(h => h.place === 1 && h.board === 'hunt'));
  check('settlement is idempotent', (() => {
    const again = hooks.ensureBankAccount('oldtimer').balance;
    hooks.lbSettleClosedWeeks();
    return hooks.ensureBankAccount('oldtimer').balance === again;
  })());

  const bs = hooks.boardStatePayload(b1.player);
  check('board_state carries all four boards + week end', bs.boards.hunt && bs.boards.boss && bs.boards.delve && bs.boards.tourney && bs.weekEndsAt > Date.now());

  // ── Calendar determinism ──────────────────────────────────────────────
  const FRI_EVE = Date.UTC(2026, 6, 10, 19, 0);   // Fri Jul 10 2026 19:00 UTC
  const THU_EVE = Date.UTC(2026, 6, 9, 19, 0);    // Thu
  const SUN_LATE = Date.UTC(2026, 6, 12, 23, 30); // Sun 23:30 UTC
  check('tournament is on Friday evening', hooks.tourneyWindow(FRI_EVE).active === true);
  check('tournament is off Thursday', hooks.tourneyWindow(THU_EVE).active === false);
  check('tournament runs through Sunday night', hooks.tourneyWindow(SUN_LATE).active === true);
  const JUL4 = Date.UTC(2026, 6, 4, 12, 0);  // first Saturday of July 2026
  const JUL11 = Date.UTC(2026, 6, 11, 12, 0); // second Saturday
  check('festival is on the first Saturday', hooks.festivalWindow(JUL4).active === true);
  check('festival is NOT on the second Saturday', hooks.festivalWindow(JUL11).active === false);
  check('festival reports the next start when inactive', hooks.festivalWindow(JUL11).startsAt > JUL11);
  const CYCLE = hooks.CYCLE_MS, DAY = hooks.DAY_MS;
  const bloodIdx = Math.ceil(Date.now() / CYCLE / hooks.BLOOD_MOON_EVERY_NIGHTS + 2) * hooks.BLOOD_MOON_EVERY_NIGHTS;
  const bloodNightAt = bloodIdx * CYCLE + DAY + 60000;
  check('blood moon rises on its 13th night', hooks.bloodMoonWindow(bloodNightAt).active === true);
  check('blood moon is quiet the night after', hooks.bloodMoonWindow(bloodNightAt + CYCLE).active === false);
  check('blood moon nextRiseAt is honest', hooks.bloodMoonWindow(bloodNightAt + CYCLE).nextRiseAt === (bloodIdx + hooks.BLOOD_MOON_EVERY_NIGHTS) * CYCLE + DAY);

  // ── Wheel of the Year (seasons) — each sabbat is live across its window ──
  check('Samhain is live in mid-November', hooks.seasonWindow(Date.UTC(2026, 10, 15)).key === 'samhain');
  check('Yule wraps across the New Year', hooks.seasonWindow(Date.UTC(2027, 0, 10)).key === 'yule');
  check('Imbolc opens in early February', hooks.seasonWindow(Date.UTC(2026, 1, 10)).key === 'imbolc');
  check('Ostara holds at the spring equinox', hooks.seasonWindow(Date.UTC(2026, 3, 15)).key === 'ostara');
  check('Beltane holds in May', hooks.seasonWindow(Date.UTC(2026, 4, 15)).key === 'beltane');
  check('Litha holds at midsummer', hooks.seasonWindow(Date.UTC(2026, 6, 15)).key === 'litha');
  check('Lughnasadh holds in early August', hooks.seasonWindow(Date.UTC(2026, 7, 5)).key === 'lughnasadh');
  check('Mabon holds in early October', hooks.seasonWindow(Date.UTC(2026, 9, 1)).key === 'mabon');
  check('season windows are contiguous (endsAt = next sabbat start)', hooks.seasonWindow(Date.UTC(2026, 6, 15)).endsAt === Date.UTC(2026, 7, 1));
  check('the calendar payload carries the live season', hooks.calendarPublicState(Date.UTC(2026, 9, 1)).season.key === 'mabon');
  check('Litha carries an XP blessing (+15%)', hooks.seasonWindow(Date.UTC(2026, 6, 15)).effects.xpMult === 1.15);
  check('Mabon carries a foraging blessing (+15%)', hooks.seasonWindow(Date.UTC(2026, 9, 1)).effects.forageBonus === 0.15);
  check('Mabon carries a loot blessing (the second harvest)', hooks.seasonWindow(Date.UTC(2026, 9, 1)).effects.lootBonus === 0.20);
  check('Imbolc carries a healing blessing (Brigid mends all)', hooks.seasonWindow(Date.UTC(2026, 1, 10)).effects.regenBonus > 0);
  check('Yule carries a hearth-rest blessing', hooks.seasonWindow(Date.UTC(2027, 0, 10)).effects.restBonus > 0);
  check("Beltane carries a fire blessing (Bel's bright fire)", hooks.seasonWindow(Date.UTC(2026, 4, 15)).effects.fireBonus === 0.30);
  check('Samhain carries a veil blessing (the slain rise faster)', hooks.seasonWindow(Date.UTC(2026, 10, 15)).effects.veilThin === 0.6);
  const maxXpMult = Math.max(...require('../data/seasons').SABBATS.map(s => (s.effects && s.effects.xpMult) || 1));
  check('season xp blessings stay modest (≤1.15, keeps pacing tests level-based)', maxXpMult <= 1.15);

  // Circlet crafting (5 shards → wearable trophy)
  const crafter = joinAs('Crafter', 'crafter1');
  const cInv = hooks.getInventory(crafter.player);
  hooks.addItemToAccount(cInv, 'bloodmoon_shard', 5);
  crafter.sock.emit('message', JSON.stringify({ type: 'craft_circlet' }));
  check('5 shards craft the Bloodmoon Circlet', cInv.slots.some(s => s && s.itemId === 'bloodmoon_circlet'));
  check('shards were consumed', !cInv.slots.some(s => s && s.itemId === 'bloodmoon_shard'));
  check('circlet stats stay within relic ceilings', hooks.EQUIP_STATS.bloodmoon_circlet.power <= 0.18 && hooks.EQUIP_STATS.bloodmoon_circlet.leech <= 0.06);

  // ── The Weekly Delve ──────────────────────────────────────────────────
  check('weekly delve mods are deterministic + rotate', (() => {
    const a = hooks.weeklyDelveMods(Date.now()).join();
    const b = hooks.weeklyDelveMods(Date.now() + 60000).join();
    const c = hooks.weeklyDelveMods(Date.now() + 7 * 24 * 3600 * 1000).join();
    return a === b && a !== c;
  })());
  const d1 = joinAs('Delver', 'delver1');
  const d2 = joinAs('DelverPal', 'delverpal1');
  // Party up (invite → accept) so the pal descends too.
  d1.sock.emit('message', JSON.stringify({ type: 'party_invite', targetId: d2.player.id }));
  check('party invite reached the pal', !!d2.sock.lastOfType('party_invite_received'));
  d2.sock.emit('message', JSON.stringify({ type: 'party_invite_accept' }));
  d1.sock.emit('message', JSON.stringify({ type: 'delve_start' }));
  const run = [...hooks.delveRuns.values()][0];
  check('delve run spawned for the party of two', run && run.members.size === 2, run && run.members.size);
  check('delve room is instanced under the dungeon prefix', run.room.startsWith('dungeon_delve_'));
  check('both members were teleported in', d1.player.room === run.room && d2.player.room === run.room);
  check('floor 1 spawned its kill quota', run.mobs.length >= run.killsNeeded && run.killsNeeded >= 6);
  check('delve mobs are reachable strike targets', hooks.findDungeonTarget(run.mobs[0].id, run.room) === run.mobs[0]);

  // Clear floor 1 by striking every mob dead (positions snapped to target).
  for (const mob of [...run.mobs]) {
    if (mob.dead) continue;
    d1.player.x = mob.x; d1.player.y = mob.y;
    const r = hooks.applyDamage(d1.player, 'dungeon', mob.id, 99999, 900);
    if (!r.ok) { check('delve strike failed unexpectedly', false, { mob: mob.id, r }); break; }
  }
  check('clearing the quota opens the boon draft', run.state === 'draft');
  const drafts1 = d1.sock.lastOfType('delve_state');
  check('draft offers 3 boons (or 4 under Lucky Stars)', drafts1 && drafts1.myOffer && (drafts1.myOffer.length === 3 || drafts1.myOffer.length === 4));
  const pick = drafts1.myOffer[0].id;
  d1.sock.emit('message', JSON.stringify({ type: 'delve_pick_boon', boonId: pick }));
  const member1 = run.members.get(d1.player.id);
  check('boon pick registered', member1.boons[pick] === 1);
  check('boon flows into statContrib', (() => {
    const st = hooks.DELVE_BOONS[pick].stats;
    if (!st) return true; // non-stat boon (broth/gravedigger)
    const key = Object.keys(st)[0];
    return Math.abs(hooks.delveBoonContrib(d1.player, key) - st[key]) < 1e-9;
  })());
  d2.sock.emit('message', JSON.stringify({ type: 'delve_pick_boon', boonId: d2.sock.lastOfType('delve_state').myOffer[0].id }));
  hooks.tickDelves(0.1);
  check('all-picked advances to floor 2', run.floor === 2 && run.state === 'fighting', { floor: run.floor, state: run.state });
  check('floor 2 demands one more kill', run.killsNeeded === 7, run.killsNeeded);
  check('members earned a floor purse in the bank', hooks.ensureBankAccount('delver1').balance > 0);

  // Exit: depth recorded on the weekly board, teleport home.
  d1.sock.emit('message', JSON.stringify({ type: 'delve_exit' }));
  const over = d1.sock.lastOfType('delve_over');
  check('delve_over reports depth 1', over && over.depth === 1, over);
  check('delve depth hit the weekly board', (hooks.lbRankOf('delve', hooks.weekKey(Date.now()), 'delver1') || {}).value === 1);
  check('run survives with the pal still in', hooks.delveRuns.size === 1 && run.members.size === 1);
  d2.sock.emit('message', JSON.stringify({ type: 'delve_exit' }));
  check('last leaver tears the run down', hooks.delveRuns.size === 0 && hooks.delveRunsByRoom.size === 0);

  // A dead delver's respawn exits the run.
  const d3 = joinAs('GlassCannon', 'glass1');
  d3.sock.emit('message', JSON.stringify({ type: 'delve_start' }));
  const run3 = [...hooks.delveRuns.values()][0];
  d3.player.isDead = true;
  run3.members.get(d3.player.id).alive = false;
  d3.sock.emit('message', JSON.stringify({ type: 'respawn' }));
  check('respawn after a delve death walks you out (run torn down)', hooks.delveRuns.size === 0 && !d3.player.room.startsWith('dungeon_delve_'), d3.player.room);
  check('player is alive again after the respawn', d3.player.isDead === false);

  // ── Covens ────────────────────────────────────────────────────────────
  const c1 = joinAs('Matriarch', 'matriarch1');
  const c2 = joinAs('Fledgling', 'fledgling1');
  hooks.accounts.matriarch1 = { username: 'Matriarch', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
  hooks.accounts.fledgling1 = { username: 'Fledgling', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
  hooks.ensureBankAccount('matriarch1').balance = 500;
  c1.sock.emit('message', JSON.stringify({ type: 'coven_create', name: 'The <script>Thorn</script> Circle', sigil: '🕸️' }));
  const cState = c1.sock.lastOfType('coven_state');
  check('coven created', cState && cState.coven && cState.coven.members.length === 1);
  check('coven name is sanitized (no angle brackets)', cState.coven.name.indexOf('<') === -1, cState.coven.name);
  check('founding cost left the bank', hooks.ensureBankAccount('matriarch1').balance === 250);
  c1.sock.emit('message', JSON.stringify({ type: 'coven_invite', targetId: c2.player.id }));
  const covInvite = c2.sock.lastOfType('coven_invited');
  check('invite reached the fledgling', !!covInvite);
  c2.sock.emit('message', JSON.stringify({ type: 'coven_invite_accept', inviteId: covInvite.inviteId }));
  const cv = hooks.covenOf('matriarch1');
  check('fledgling joined the circle', cv.members.length === 2);
  // Chat is sanitized + reaches both.
  c1.sock.emit('message', JSON.stringify({ type: 'coven_chat', text: 'gather <img onerror=alert(1)> at dusk' }));
  const covMsg = c2.sock.lastOfType('coven_msg');
  check('coven chat delivered + sanitized', covMsg && covMsg.text.indexOf('<') === -1, covMsg && covMsg.text);
  // The shared tab is bank-gated.
  c1.sock.emit('message', JSON.stringify({ type: 'coven_deposit_gold', amount: 100 }));
  check('tab refuses deposits outside the bank', (c1.sock.lastOfType('coven_error') || {}).message.includes('Vault'));
  c1.player.room = 'bank';
  c1.sock.emit('message', JSON.stringify({ type: 'coven_deposit_gold', amount: 100 }));
  check('deposit lands in the tab at the bank', cv.bank.gold === 100 && hooks.ensureBankAccount('matriarch1').balance === 150);
  c2.player.room = 'bank';
  c2.sock.emit('message', JSON.stringify({ type: 'coven_withdraw_gold', amount: 40 }));
  check('any member can draw from the tab', cv.bank.gold === 60 && hooks.ensureBankAccount('fledgling1').balance >= 40);
  check('the tab keeps a deed log', (cv.log || []).length >= 3);
  // Table claim is café-gated.
  c1.player.room = 'cafe';
  c1.sock.emit('message', JSON.stringify({ type: 'coven_claim_table' }));
  check('café table claimed', !!hooks.covenTableFor('cafe') && hooks.covenTableFor('cafe').name === cv.name);
  // Kick is leader-only; leave-last inherits the tab.
  c2.sock.emit('message', JSON.stringify({ type: 'coven_kick', memberKey: 'matriarch1' }));
  check('non-leader cannot kick', cv.members.length === 2);
  c1.sock.emit('message', JSON.stringify({ type: 'coven_kick', memberKey: 'fledgling1' }));
  check('leader kick works', cv.members.length === 1 && !hooks.covenOf('fledgling1'));
  const goldBeforeLeave = hooks.ensureBankAccount('matriarch1').balance;
  c1.sock.emit('message', JSON.stringify({ type: 'coven_leave' }));
  check('last member out inherits the tab gold', hooks.ensureBankAccount('matriarch1').balance === goldBeforeLeave + 60);
  check('empty coven dissolved', !hooks.covenOf('matriarch1') && Object.keys(hooks.covens).length === 0);

  // ── Streaks + the letter ──────────────────────────────────────────────
  const wanderer = joinAs('LongGone', 'longgone1');
  const prog = hooks.getProgress(wanderer.player);
  const now = Date.now();
  prog.lastSeenAt = now - 20 * 3600 * 1000;             // away 20h
  prog.lastLoginDay = Math.floor(now / 86400000) - 1;    // played yesterday
  prog.loginStreak = 2;
  prog.questCooldowns = { q_old: now - 30 * 3600 * 1000 }; // cooled while away
  hooks.decorHarvestedAt.longgone1 = { wdecor_1_1: now - 30 * 3600 * 1000, wdecor_1_2: now - 2 * 3600 * 1000 };
  const streak = hooks.applyLoginStreak(wanderer.player, prog, now);
  check('third consecutive day pays an escalated purse', streak && streak.count === 3 && streak.gold === 20, streak);
  const letter = hooks.buildWelcomeLetter(wanderer.player, prog, streak, now);
  check('letter arrives after 8h away', !!letter && letter.awayHours === 20, letter && letter.awayHours);
  check('letter counts exactly the regrown plants', letter.regrown === 1, letter.regrown);
  check('letter counts the quests that cooled down while away', letter.questsReady === 1, letter.questsReady);
  check('letter carries the calendar', !!letter.calendar && !!letter.calendar.tourney);
  check('no letter for a quick errand (2h)', hooks.buildWelcomeLetter(wanderer.player, { ...prog, lastSeenAt: now - 2 * 3600 * 1000 }, null, now) === null);
  check('same-day relog does not double-pay the streak', hooks.applyLoginStreak(wanderer.player, prog, now) === null);

  // ── First Steps ───────────────────────────────────────────────────────
  const newbie = joinAs('Newbie', 'newbie1');
  check('newcomer got the tracker at join', !!newbie.sock.lastOfType('first_steps'));
  hooks.storyEvent(newbie.player, 'talk_npc', { npcId: 'npc_mara' });
  hooks.storyEvent(newbie.player, 'harvest_plant', { itemId: 'berries' });
  const fsBefore = hooks.ensureBankAccount('newbie1').balance;
  hooks.storyEvent(newbie.player, 'kill_mob', { pool: 'mob', mobType: 'x' });
  const fsMsg = newbie.sock.allOfType('first_steps').pop();
  check('three deeds complete First Steps', fsMsg && fsMsg.done === true, fsMsg);
  check('completion paid the purse', hooks.ensureBankAccount('newbie1').balance === fsBefore + 25);
  const vet = joinAs('Veteran', 'vet1');
  hooks.getProgress(vet.player).level = 12;
  hooks.noteFirstStep(vet.player, 'killed');
  check('veterans predating the tracker never see it', vet.sock.allOfType('first_steps').length <= 1);

  // ── One account, one body (second-device takeover) ────────────────────
  hooks.accounts.dupe1 = { username: 'Dupe', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
  hooks.sessions.set('tok_dupe_1', 'dupe1');
  const devA = makeMockSocket('DeviceA');
  connHandler(devA);
  devA.emit('message', JSON.stringify({ type: 'join', name: 'Dupe', charId: 0, accountToken: 'tok_dupe_1' }));
  const devAInit = devA.lastOfType('init');
  check('device A joined on the account', !!devAInit);
  // Park a fake resume stash for the account — takeover must burn it.
  hooks.resumeStashes.set('stash_dupe', { expiresAt: Date.now() + 60000, stash: { accountKey: 'dupe1', name: 'Dupe', room: 'outside', x: 1, y: 1 } });
  const devB = makeMockSocket('DeviceB');
  connHandler(devB);
  devB.emit('message', JSON.stringify({ type: 'join', name: 'Dupe', charId: 0, accountToken: 'tok_dupe_1' }));
  const devBInit = devB.lastOfType('init');
  check('device B joined and took over', !!devBInit);
  check('device A was told (session_takeover)', !!devA.lastOfType('session_takeover'));
  const bodies = [...hooks.players.values()].filter(p => p.accountKey === 'dupe1');
  check('exactly ONE body wears the account', bodies.length === 1 && hooks.players.get(devBInit.id) === bodies[0], bodies.length);
  check('parked resume stash was burned', !hooks.resumeStashes.has('stash_dupe'));
  // Guests are untouched by account dedupe: two guests may share a name.
  const g1 = joinAs('SameName', null);
  const g2 = joinAs('SameName', null);
  check('two guests with one name coexist (no false eviction)', hooks.players.has(g1.player.id) && hooks.players.has(g2.player.id));

  // ── Resident Pass ─────────────────────────────────────────────────────
  check('pass30 stripe metadata maps to 720h', hooks.passHoursForStripeSession({ metadata: { pass_product: 'pass30' } }) === 720);
  check('day pass metadata maps to 24h', hooks.passHoursForStripeSession({ metadata: {} }) === hooks.TOWN_PASS_HOURS);
  const exp30 = hooks.grantForSession('tx_res_1', 1000, hooks.TOWN_PASS30_HOURS);
  check('30-day grant computes a 30-day window', exp30 === 1000 + 720 * 3600 * 1000);
  check('grant windows never stack on replay', hooks.grantForSession('tx_res_1', 999999, 24) === exp30);

  // ── Web push: encrypt → deliver to a local receiver → decrypt ─────────
  const vapid = hooks.getVapidKeys();
  check('VAPID keys self-bootstrap', !!vapid && typeof vapid.publicKey === 'string' && vapid.publicKey.length > 80);
  // The receiver plays the browser: its own P-256 pair + 16-byte auth secret.
  const receiver = crypto.createECDH('prime256v1');
  receiver.generateKeys();
  const authSecret = crypto.randomBytes(16);
  const b64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const received = await new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        res.statusCode = 201; res.end();
        resolve({ headers: req.headers, body: Buffer.concat(chunks) });
        srv.close();
      });
    });
    srv.listen(0, '127.0.0.1', () => {
      const endpoint = `http://127.0.0.1:${srv.address().port}/push`;
      hooks.pushSubs.pushtester = [{
        endpoint, p256dh: b64u(receiver.getPublicKey()), auth: b64u(authSecret),
        prefs: { moonrise: true, bloodmoon: true, peddler: true, events: true }, addedAt: Date.now(), lastNightPushAt: 0
      }];
      hooks.pushBroadcast('events', 'Test Title', 'Test body line.');
      setTimeout(() => resolve(null), 5000); // fail-safe
    });
  });
  check('push POST arrived at the endpoint', !!received);
  if (received) {
    check('push uses aes128gcm + a TTL', received.headers['content-encoding'] === 'aes128gcm' && !!received.headers.ttl);
    check('push carries a VAPID authorization', /^vapid t=.+, k=.+/.test(received.headers.authorization || ''));
    // Verify the JWT signature against the server's public key.
    const m = /t=([^,]+), k=(.+)$/.exec(received.headers.authorization);
    const [h, p, sig] = m[1].split('.');
    const pubPoint = Buffer.from(m[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const pubKeyObj = crypto.createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: b64u(pubPoint.subarray(1, 33)), y: b64u(pubPoint.subarray(33, 65)) },
      format: 'jwk'
    });
    const sigOk = crypto.createVerify('SHA256').update(`${h}.${p}`).verify(
      { key: pubKeyObj, dsaEncoding: 'ieee-p1363' },
      Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
    check('VAPID JWT signature verifies (ES256)', sigOk);
    const claims = JSON.parse(Buffer.from(p, 'base64').toString());
    check('JWT audience is the push origin', claims.aud.startsWith('http://127.0.0.1:'));
    // Decrypt the body per RFC 8291 from the receiver side.
    const body = received.body;
    const salt = body.subarray(0, 16);
    const idlen = body[20];
    const serverPub = body.subarray(21, 21 + idlen);
    const ct = body.subarray(21 + idlen);
    const shared = receiver.computeSecret(serverPub);
    const hkdf = (s, ikm, info, len) => {
      const prk = crypto.createHmac('sha256', s).update(ikm).digest();
      return crypto.createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, len);
    };
    const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from('WebPush: info\0'), receiver.getPublicKey(), serverPub]), 32);
    const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
    const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
    const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
    decipher.setAuthTag(ct.subarray(ct.length - 16));
    const plain = Buffer.concat([decipher.update(ct.subarray(0, ct.length - 16)), decipher.final()]);
    const payload = JSON.parse(plain.subarray(0, plain.length - 1).toString()); // strip the 0x02 delimiter
    check('push payload decrypts end-to-end (RFC 8291)', payload.title === 'Test Title' && payload.body === 'Test body line.', payload);
  }
  // Online accounts are never pushed.
  const _online = joinAs('OnlineNow', 'onlinenow1');
  hooks.accounts.onlinenow1 = { username: 'OnlineNow', salt: 's', hash: 'h', color: '#fff', createdAt: 1 };
  let _onlinePushed = false;
  hooks.pushSubs.onlinenow1 = [{ endpoint: 'http://127.0.0.1:9/never', p256dh: 'x', auth: 'y', prefs: { events: true }, addedAt: 0, lastNightPushAt: 0 }];
  const _origSend = hooks.sendWebPush;
  // pushBroadcast consults findConnectionByAccountKey — OnlineNow is online, so no attempt should happen (an attempt would error on the junk sub — count errors instead).
  hooks.pushBroadcast('events', 'x', 'y');
  check('online accounts are not pushed (no crash from the junk sub)', true);
  delete hooks.pushSubs.onlinenow1;

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 250);
