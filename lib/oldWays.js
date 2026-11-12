// The Old Ways (data/oldWays.js): the besom, the poppet, lead-pouring, the
// bees, the brownie, sin-eating, the toad-bone, the hare, the Hand of Glory
// and the new moon's silver. One state body for the
// panel, one `act` for every button. What a witch has made or begun is kept
// on her account (acct.oldWays); what is on her for a while (a poppet's
// guard, the bone's quiet) is kept on the player and gone when she leaves.
const D = require('../data/oldWays');

module.exports = function createOldWays({ accounts, players, getInventory, countItemQty, removeItemFromAccount, addItemToAccount, ensureBankAccount, grantXP, isNightNow, playerParty, parties, playerMaxHealth, WORLD2, findBoss = () => null, send = () => {}, covenOf = () => null, holdCreatures = () => 0, moonPhase = () => ({ key: 'full', startsAt: 0 }), bossName = () => 'the boss', itemName = (id) => id, now = () => Date.now(), random = Math.random }) {
  const stateOf = (player) => {
    const a = player.accountKey && accounts[player.accountKey];
    if (!a) return null;
    if (!a.oldWays) a.oldWays = {};
    return a.oldWays;
  };
  const mins = (ms) => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 120 ? `${Math.round(m / 60)} hours` : m === 1 ? '1 minute' : `${m} minutes`; };
  const pick = (arr) => arr[Math.floor(random() * arr.length)];
  const dayIndex = (t) => Math.floor(t / 86400000);
  const outdoors = (player) => player.room === 'outside' || player.room === 'wilds';
  const where = (room) => (room === 'wilds' ? 'in the Wilds' : 'in the town, out of doors');
  const pay = (player, gold) => { if (gold > 0) ensureBankAccount(player.accountKey).balance += gold; };
  const partyNear = (player) => {
    const out = [];
    const pid = playerParty && playerParty.get(player.id), party = pid && parties.get(pid);
    if (party) for (const id of party.members) { const p = players.get(id); if (p && p.id !== player.id && p.room === player.room && !p.isDead && Math.hypot(p.x - player.x, p.y - player.y) <= D.POPPET.range) out.push(p); }
    return out;
  };

  // ── What is on a player for a while ──
  function statContrib(player, statKey) {
    if (statKey !== 'guard' || !player) return 0;
    const t = now();
    let g = 0;
    if (player.poppetGuardUntil > t) g += D.POPPET.guard;
    const s = player.accountKey && accounts[player.accountKey] && accounts[player.accountKey].oldWays;
    if (s && s.sin && s.sin.carrying) g += D.SIN.guard;
    if (player.reelBoonUntil > t) g += player.reelGuard || 0;
    return g;
  }
  // let pass by the night creatures: the toad-bone's quiet, or up on the besom
  const isCalmed = (player) => !!(player && (player.toadCalmUntil > now() || player.flyingUntil > now() || player.reelingUntil > now())); // …or in the reel

  const isHare = (player) => !!(player && player.activeStatus && player.activeStatus.type === 'hare' && player.activeStatus.expiresAt > now());
  // A blow given or taken, and she is herself again. Returns true if she was a hare.
  function endHare(player) {
    if (!isHare(player)) return false;
    player.activeStatus = null;
    return true;
  }
  const underground = (player) => typeof player.room === 'string' && player.room.startsWith('dungeon_');

  // ── The reel at the stones ── who has hold, and whether it is turning.
  const reel = { hands: new Map(), endsAt: 0, order: [] };
  const atStones = (p, range) => p.room === D.REEL.at.room && !p.isDead && Math.hypot(p.x - D.REEL.at.x, p.y - D.REEL.at.y) <= range;
  const tell = (ids, message) => { for (const id of ids) { const p = players.get(id); if (p) send(p.ws, { type: 'toast', level: 'important', always: true, message }); } };
  const reelState = (ids, turning) => {
    ids.forEach((id, i) => { const p = players.get(id); if (p) send(p.ws, turning
      ? { type: 'reel_state', turning: true, x: D.REEL.at.x, y: D.REEL.at.y, r: D.REEL.ringR, ms: reel.endsAt - now(), total: D.REEL.ms, turns: D.REEL.turns, place: i, of: ids.length }
      : { type: 'reel_state', turning: false }); });
  };
  function reelStart() {
    reel.order = [...reel.hands.keys()]; reel.endsAt = now() + D.REEL.ms;
    for (const id of reel.order) { const p = players.get(id); if (p) { p.reelingUntil = reel.endsAt; endHare(p); } }
    tell(reel.order, '💃 Hands are taken, and somebody has a trump between her teeth. "Commer go ye before, commer go ye." Round you go, against the sun.');
    reelState(reel.order, true);
  }
  function reelStop() { const ids = reel.order; for (const id of ids) { const p = players.get(id); if (p) p.reelingUntil = 0; } reel.hands.clear(); reel.order = []; reel.endsAt = 0; reelState(ids, false); }
  // A few times a second. Returns the dancers when a reel has been danced out (so it can be saved), else false.
  function tick() {
    const t = now();
    if (!reel.endsAt) {
      // before it turns: whoever has let go by walking off, leaving or dying is out of it
      for (const id of [...reel.hands.keys()]) { const p = players.get(id); if (!p || !atStones(p, D.REEL.joinRange + 120)) reel.hands.delete(id); }
      if (reel.hands.size && !isNightNow()) { tell([...reel.hands.keys()], '💃 It is getting light. The reel is not danced by day.'); reel.hands.clear(); }
      return false;
    }
    const still = reel.order.filter((id) => { const p = players.get(id); return p && atStones(p, D.REEL.joinRange + 120); });
    if (still.length < D.REEL.need) {
      tell(still, '💃 The ring breaks: there are not enough hands to hold it. It will have to be begun again.');
      reel.order = still; reelStop();
      return false;
    }
    if (still.length !== reel.order.length) { for (const id of reel.order) if (!still.includes(id)) reel.hands.delete(id); reel.order = still; }
    if (t < reel.endsAt) return false;
    // danced out
    const dancers = reel.order.map((id) => players.get(id)), n = dancers.length;
    const cv = dancers.map((p) => covenOf(p)), oneCoven = cv[0] && cv.every((c) => c && c.id === cv[0].id);
    const guard = Math.min(D.REEL.guardMax, D.REEL.guardPer * n) + (oneCoven ? D.REEL.covenGuard : 0);
    const full = !!moonPhase().isFull;
    for (const p of dancers) {
      p.reelBoonUntil = t + D.REEL.boonMs; p.reelGuard = guard;
      const xp = D.REEL.xp * (full ? D.REEL.fullMoonXp : 1);
      grantXP(p, xp);
      const s = stateOf(p);
      if (s) { const r = s.reel || (s.reel = {}); r.restUntil = t + D.REEL.restMs; r.danced = (r.danced || 0) + 1; }
      else p.reelRestUntil = t + D.REEL.restMs;
      send(p.ws, { type: 'toast', level: 'important', always: true, message: `💃 The reel is danced out, ${n} of you${oneCoven ? `, all of ${cv[0].name}` : ''}${full ? ', under a full moon' : ''}. You let go laughing and out of breath. For ${mins(D.REEL.boonMs)} blows land ${Math.round(guard * 100)}% softer on you. (+${xp} XP)` });
    }
    reelStop();
    return dancers; // those who danced it out (the server writes it in their daybooks and saves)
  }
  function reelCard(player, s, t, night, act) {
    const rest = ((s ? (s.reel || {}).restUntil : player.reelRestUntil) || 0) - t;
    const near = atStones(player, D.REEL.joinRange), mine = reel.hands.has(player.id), n = reel.hands.size;
    if (reel.endsAt) return { status: mine ? `The reel is turning (${Math.max(1, Math.ceil((reel.endsAt - t) / 1000))} seconds more). Keep in it.` : 'A reel is turning at the stones. It cannot be joined once it has begun.', actions: [] };
    if (mine) return { status: `You have hold. ${n} of you so far; the reel wants ${D.REEL.need}.`, actions: [act('loose', 'Let go', true, '')] };
    const boon = player.reelBoonUntil > t ? ` The last reel is still on you (${mins(player.reelBoonUntil - t)} more).` : '';
    return { status: (rest > 0 ? `You have danced, and your legs know it. Again in ${mins(rest)}.` : n ? `${n === 1 ? 'One witch is' : n + ' witches are'} waiting at the stones with a hand out.` : 'Nobody is at the stones.') + boon,
      actions: [act('hands', 'Take hands', rest <= 0 && night && near, rest > 0 ? `Not yet (${mins(rest)}).` : !night ? 'The reel is danced by night.' : 'At the Unbound Circle, in the west of the Wilds.')] };
  }

  // ── The panel ──
  function body(player) {
    const s = stateOf(player);
    if (!s) {
      // a guest keeps none of the old ways, but anyone may take a hand in the reel
      const gact = (id, label, enabled, why) => ({ id, label, enabled: !!enabled, why: enabled ? '' : why });
      return { isGuest: true, ways: D.OLD_WAYS.map((w) => (w.id === 'reel' ? { ...w, ...reelCard(player, null, now(), isNightNow(), gact) } : { ...w, status: 'Log into an account to keep the old ways.', actions: [] })) };
    }
    const t = now(), night = isNightNow(), inv = getInventory(player);
    const cards = {};
    const act = (id, label, enabled, why, extra) => ({ id, label, enabled: !!enabled, why: enabled ? '' : why, ...(extra || {}) });

    // besom
    const b = s.besom || {};
    if (!b.made) {
      const next = D.BESOM_STEPS.find((st) => !(b.steps || []).includes(st.id));
      const here = player.room === next.where, dark = !next.night || night;
      cards.besom = { status: `${(b.steps || []).length} of ${D.BESOM_STEPS.length} done. Next: ${next.label.toLowerCase()}, ${where(next.where)}${next.night ? ', after dark' : ''}.`,
        actions: [act('step', next.label, here && dark, !here ? `That is done ${where(next.where)}.` : 'That is done after dark.')] };
    } else {
      const rest = (b.restUntil || 0) - t;
      const ok = night && outdoors(player) && rest <= 0;
      cards.besom = { status: rest > 0 ? `The broom is resting. It will rise again in ${mins(rest)}.` : night ? 'The broom is by the door, and it is dark enough.' : 'The broom is by the door. It flies by night.',
        actions: [act('ride', 'Ride', ok, !night ? 'It flies by night.' : !outdoors(player) ? 'You need the open sky.' : `It is resting (${mins(rest)}).`,
          { choices: D.BESOM_LANDINGS.filter((l) => !(l.room === player.room && l.id === 'square' && player.room === 'outside' && Math.hypot(player.x - l.x, player.y - l.y) < 200)).map((l) => ({ id: l.id, label: l.name })) })] };
    }
    // poppet
    const pRest = (player.poppetRestUntil || 0) - t, haveFur = countItemQty(inv, D.POPPET.cost.itemId) >= D.POPPET.cost.qty;
    const who = [{ id: player.id, label: 'Yourself' }, ...partyNear(player).map((p) => ({ id: p.id, label: p.name }))];
    const pWhy = pRest > 0 ? `Your fingers want a rest from the needle (${mins(pRest)}).` : `You need ${D.POPPET.cost.qty} ${itemName(D.POPPET.cost.itemId)} to stuff it.`;
    cards.poppet = { status: player.poppetGuardUntil > t ? `A poppet is taking blows for you (${mins(player.poppetGuardUntil - t)} more).` : 'No poppet stands for you now.',
      actions: [act('guard', 'Make one to guard', pRest <= 0 && haveFur, pWhy, { choices: who }), act('mend', 'Make one to mend', pRest <= 0 && haveFur, pWhy, { choices: who }),
        ...(String(player.room || '').startsWith('dungeon_') ? [act('bind', 'Make one to bind the boss', pRest <= 0 && haveFur && !!findBoss(player, D.POPPET.bindRange), pRest > 0 || !haveFur ? pWhy : 'The boss must be alive and in sight.')] : [])] };
    // lead
    const l = s.lead || {}, poured = l.day === dayIndex(t);
    const shape = poured && D.LEAD_SHAPES.find((x) => x.key === l.key);
    cards.lead = { status: shape ? `Today's pouring: ${shape.glyph} ${shape.name}. ${shape.meaning}` : 'You have not poured today.', actions: [act('pour', 'Pour the lead', !poured, 'Once a day. The water has had its say.')] };
    // bees
    const be = s.bees;
    if (!be) {
      const have = countItemQty(inv, D.BEES.barter.itemId) >= D.BEES.barter.qty;
      cards.bees = { status: 'You keep no bees.', actions: [act('skep', `Barter for a skep (${D.BEES.barter.qty} ${itemName(D.BEES.barter.itemId)})`, have, `Bees are not bought for money. Bring ${D.BEES.barter.qty} ${itemName(D.BEES.barter.itemId)} to barter.`)] };
    } else {
      const combs = combsOf(be, t), told = t - be.toldAt < D.BEES.toldMs;
      cards.bees = { status: `${combs} of ${D.BEES.maxCombs} combs laid up. ${told ? `The bees have been told (they want telling again within ${mins(D.BEES.toldMs - (t - be.toldAt))}).` : 'The bees have not been told your news, and are sulking: nothing more will be made until they are.'}`,
        actions: [act('tell', 'Tell the bees', true), act('take', 'Take the comb', combs > 0, 'There is no comb to take yet.')] };
    }
    // brownie
    const br = s.brownie || {};
    if (br.gone) cards.brownie = { status: 'You gave it clothes, and it went. The house is only a house.', actions: [] };
    else if (br.creamAt) {
      const left = br.creamAt + D.BROWNIE.workMs - t;
      cards.brownie = { status: left > 0 ? `The cream is out. Leave it be (${mins(left)} yet).` : 'It is morning. See what was done.', actions: [act('look', 'See what was done', left <= 0, 'Do not watch for it. Come back later.')] };
    } else {
      cards.brownie = { status: br.nights ? `It has worked ${br.nights} night${br.nights === 1 ? '' : 's'} for you.` : 'Something may keep this house, if it is asked the right way.',
        actions: [act('cream', `Set out cream (${D.BROWNIE.creamGold} gold)`, night && ensureBankAccount(player.accountKey).balance >= D.BROWNIE.creamGold, night ? 'You have not the price of the cream.' : 'It is set out at night.'),
          ...(br.nights >= 3 ? [act('clothes', 'Give it a suit of clothes', true, '', { confirm: 'It will leave for good, and will not come back. Give it clothes?' })] : [])] };
    }
    // sin
    const si = s.sin || {};
    if (si.carrying) {
      const st = D.SIN.stone, at = player.room === st.room && Math.hypot(player.x - st.x, player.y - st.y) <= st.range;
      cards.sin = { status: 'You are carrying what you took. Blows land harder on you. Lay it down at the memorial stone in the town.', actions: [act('shed', 'Lay the burden down', at, 'Go to the memorial stone, north-east of the square.')] };
    } else {
      const rest = (si.restUntil || 0) - t;
      cards.sin = { status: rest > 0 ? `No one has sent for you. Perhaps in ${mins(rest)}.` : 'A house in the town has sent for a sin-eater.', actions: [act('eat', 'Take the bread and ale', rest <= 0, 'Once a day.')] };
    }
    // toad
    const to = s.toad || {};
    if (!to.bone) {
      if (!to.laidAt) cards.toad = { status: 'You have no bone.', actions: [act('lay', 'Lay a toad on an ant-hill', player.room === 'wilds', 'That is done in the Wilds.')] };
      else {
        const left = to.laidAt + D.TOAD.cleanMs - t;
        cards.toad = { status: left > 0 ? `The ants are at their work (${mins(left)} yet).` : 'The bones are clean. Carry them to running water in the Wilds, by night.',
          actions: [act('stream', 'Cast the bones on the stream', left <= 0 && night && player.room === 'wilds', left > 0 ? 'The bones are not clean yet.' : !night ? 'That is done at night.' : 'That is done in the Wilds.')] };
      }
    } else {
      const rest = (to.restUntil || 0) - t;
      cards.toad = { status: isCalmed(player) ? `The night creatures of the Wilds are letting you pass (${mins(player.toadCalmUntil - t)} more).` : rest > 0 ? `The bone is cold. It will answer again in ${mins(rest)}.` : 'The bone is in your pocket.',
        actions: [act('calm', 'Hold the bone', rest <= 0 && player.room === 'wilds', rest > 0 ? `It is cold (${mins(rest)}).` : 'It answers in the Wilds.')] };
    }
    // hare
    const ha = s.hare || {};
    if (isHare(player)) cards.hare = { status: `You are a hare (${mins(player.activeStatus.expiresAt - t)} more).`, actions: [act('back', 'Say the other charm', true, '')] };
    else {
      const rest = (ha.restUntil || 0) - t;
      cards.hare = { status: rest > 0 ? `You are yourself, and winded. The charm will take again in ${mins(rest)}.` : 'You know the words.',
        actions: [act('go', 'Say the charm', rest <= 0 && outdoors(player), rest > 0 ? `Not yet (${mins(rest)}).` : 'That is done out of doors.')] };
    }
    // the Hand of Glory
    const gl = s.glory || {};
    if (!gl.has) {
      const bal = ensureBankAccount(player.accountKey).balance;
      cards.glory = { status: 'You have no hand.', actions: [act('buy', `Buy the hand (${D.GLORY.gold} gold)`, player.room === 'outside' && bal >= D.GLORY.gold, player.room !== 'outside' ? 'The man who sells it is in the town.' : `He wants ${D.GLORY.gold} gold.`)] };
    } else {
      const rest = (gl.restUntil || 0) - t;
      cards.glory = { status: rest > 0 ? `The candle is burnt down. It will be fit to light again in ${mins(rest)}.` : 'The hand is wrapped in its cloth.',
        actions: [act('light', 'Light the hand', rest <= 0 && underground(player), rest > 0 ? `Not yet (${mins(rest)}).` : 'It is lit underground.')] };
    }
    // the new moon
    const mo = s.moon || {}, ph = moonPhase();
    const young = ph.key === D.MOON.phase, turned = young && mo.turnedAt === ph.startsAt;
    cards.moon = { status: turned ? 'You have turned your silver this moon.' : young ? (night ? 'The new moon is up, thin as a paring.' : 'The new moon will show after dark.') : 'She is not new. Wait for the young crescent.',
      actions: [act('turn', 'Bow, and turn your silver', young && !turned && night && outdoors(player), !young ? 'Only when the moon is new.' : turned ? 'Once each moon.' : !night ? 'After dark.' : 'Out of doors. Never first through glass.')] };
    cards.reel = reelCard(player, s, t, night, act);
    return { isGuest: false, night, ways: D.OLD_WAYS.map((w) => ({ ...w, ...cards[w.id] })) };
  }
  function combsOf(be, t) {
    const until = Math.min(t, be.toldAt + D.BEES.toldMs);       // untold bees lay nothing up
    return Math.min(D.BEES.maxCombs, (be.combs || 0) + Math.max(0, Math.floor((until - be.sinceAt) / D.BEES.combMs)));
  }

  // ── Every button ── returns { toast } or { error }, and sometimes { flight } for the client to fly.
  function act(player, way, action, choice) {
    const s = stateOf(player);
    if (!s && way !== 'reel') return { error: 'Log into an account to keep the old ways.' };
    if (player.isDead) return { error: 'Not as you are.' };
    const card = body(player).ways.find((w) => w.id === way), a = card && (card.actions || []).find((x) => x.id === action);
    if (!a) return { error: 'That is not to be done just now.' };
    if (!a.enabled) return { error: a.why || 'Not yet.' };
    const t = now(), inv = getInventory(player);

    if (way === 'besom') {
      const b = s.besom || (s.besom = {});
      if (action === 'step') {
        const next = D.BESOM_STEPS.find((st) => !(b.steps || []).includes(st.id));
        (b.steps || (b.steps = [])).push(next.id);
        if (b.steps.length === D.BESOM_STEPS.length) { b.made = true; grantXP(player, 60); return { toast: `🧹 ${next.done} It is a broom. Whether it is more than a broom you will know the first dark night you take it out.` }; }
        return { toast: `🧹 ${next.done}` };
      }
      const land = D.BESOM_LANDINGS.find((l) => l.id === choice);
      if (!land) return { error: 'Where to?' };
      b.restUntil = t + D.BESOM_REST_MS;
      const spot = land.spawn ? { x: WORLD2.spawn.x, y: WORLD2.spawn.y } : { x: land.x, y: land.y };
      endHare(player); // a hare does not ride
      return { toast: `🧹 ${pick(D.BESOM_SIGHTS)} You come down at ${land.name.replace(/^The /, 'the ')}.`, flight: { room: land.room, x: spot.x, y: spot.y, name: land.name } };
    }
    if (way === 'poppet' && action === 'bind') {
      const boss = findBoss(player, D.POPPET.bindRange);
      if (!boss) return { error: 'The boss must be alive and in sight.' };
      if (!removeItemFromAccount(inv, D.POPPET.cost.itemId, D.POPPET.cost.qty)) return { error: `You need ${D.POPPET.cost.qty} ${itemName(D.POPPET.cost.itemId)}.` };
      player.poppetRestUntil = t + D.POPPET.restMs;
      boss.boundUntil = t + D.POPPET.bindMs; boss.boundSlow = D.POPPET.bindSlow;
      return { toast: `🪆 You name it for ${bossName(boss)} and wind it round and round with thread, legs first. For a minute the thing itself drags as if through deep water.` };
    }
    if (way === 'poppet') {
      const target = String(choice) === String(player.id) ? player : partyNear(player).find((p) => String(p.id) === String(choice));
      if (!target) return { error: 'They must be of your party and standing by.' };
      if (!removeItemFromAccount(inv, D.POPPET.cost.itemId, D.POPPET.cost.qty)) return { error: `You need ${D.POPPET.cost.qty} ${itemName(D.POPPET.cost.itemId)}.` };
      player.poppetRestUntil = t + D.POPPET.restMs;
      const whom = target === player ? 'yourself' : target.name;
      if (action === 'guard') { target.poppetGuardUntil = t + D.POPPET.guardMs; return { toast: `🪆 You stitch it, stuff it, and name it for ${whom}. For ${mins(D.POPPET.guardMs)} it takes a tenth of every blow.`, touched: target === player ? null : target, touchedToast: `🪆 ${player.name} has made a poppet in your name. It takes a tenth of every blow for ${mins(D.POPPET.guardMs)}.` }; }
      const max = playerMaxHealth(target), heal = Math.round(max * D.POPPET.heal);
      target.health = Math.min(max, (target.health || 0) + heal);
      return { toast: `🪆 You name it for ${whom} and bind its hurts with thread. ${heal} health comes back.`, touched: target === player ? null : target, touchedToast: `🪆 ${player.name} has mended a poppet in your name. ${heal} health comes back to you.` };
    }
    if (way === 'lead') {
      const shape = pick(D.LEAD_SHAPES);
      s.lead = { day: dayIndex(t), key: shape.key };
      grantXP(player, D.LEAD_XP);
      return { toast: `🫗 The lead goes through the ring of the key with a hiss and sets as ${shape.glyph} ${shape.name}. ${shape.meaning}` };
    }
    if (way === 'bees') {
      if (action === 'skep') {
        if (!removeItemFromAccount(inv, D.BEES.barter.itemId, D.BEES.barter.qty)) return { error: 'You have not the goods to barter.' };
        s.bees = { sinceAt: t, toldAt: t, combs: 0, takes: 0 };
        return { toast: '🐝 The swarm is yours, bartered and not bought. You set the skep on its stone facing the morning, and tell them whose bees they are now.' };
      }
      const be = s.bees;
      if (action === 'tell') { be.combs = combsOf(be, t); be.sinceAt = t; be.toldAt = t; return { toast: `🐝 ${pick(D.BEE_NEWS)}` }; }
      const combs = combsOf(be, t);
      be.combs = 0; be.sinceAt = t; be.takes = (be.takes || 0) + 1;
      const gold = combs * D.BEES.combGold;
      pay(player, gold);
      let extra = '';
      if (be.takes % D.BEES.potionEvery === 0 && addItemToAccount(inv, 'healing_potion', 1)) extra = ' You keep back enough honey to make a healing draught.';
      return { toast: `🐝 You take ${combs} comb${combs === 1 ? '' : 's'}, leaving them their share, and the honey fetches ${gold} gold.${extra}` };
    }
    if (way === 'brownie') {
      const br = s.brownie || (s.brownie = {});
      if (action === 'cream') { ensureBankAccount(player.accountKey).balance -= D.BROWNIE.creamGold; br.creamAt = t; return { toast: '🥛 You set the bowl by the hearth, say nothing, and go to bed without looking back.' }; }
      if (action === 'clothes') { s.brownie = { gone: true }; grantXP(player, 30); return { toast: `🥛 ${D.BROWNIE_GONE}` }; }
      const stale = t - br.creamAt > D.BROWNIE.staleMs;
      br.creamAt = 0;
      if (stale) return { toast: '🥛 The cream has stood two days and turned. Nothing was done. It does not like to be kept waiting.' };
      br.nights = (br.nights || 0) + 1;
      const w = pick(D.BROWNIE_WORK);
      let got = '';
      if (w.gold) { const g = w.gold[0] + Math.floor(random() * (w.gold[1] - w.gold[0] + 1)); pay(player, g); got = ` (+${g} gold)`; }
      if (w.xp) grantXP(player, w.xp);
      if (w.item && addItemToAccount(inv, w.item, 1)) got = ` (+1 ${itemName(w.item)})`;
      return { toast: `🥛 ${w.text}${got}` };
    }
    if (way === 'sin') {
      const si = s.sin || (s.sin = {});
      if (action === 'eat') {
        si.carrying = true; si.restUntil = t + D.SIN.restMs;
        pay(player, D.SIN.gold); grantXP(player, D.SIN.xp);
        return { toast: `🍞 They hand you the loaf and the bowl across the coffin, and the sixpence after. You eat and drink, and say the words: the dead may rest, and need not walk. You are paid ${D.SIN.gold} gold. Nobody will meet your eye on the way out.` };
      }
      si.carrying = false; grantXP(player, D.SIN.shedXp);
      return { toast: '🍞 You stand at the stone a while and lay it down among the names. When you walk away you are only carrying yourself.' };
    }
    if (way === 'toad') {
      const to = s.toad || (s.toad = {});
      if (action === 'lay') { to.laidAt = t; return { toast: `🐸 You find a toad dead on the path, lay it on an ant-hill, and mark the place. The ants will want ${mins(D.TOAD.cleanMs)}.` }; }
      if (action === 'stream') { to.bone = true; to.laidAt = 0; grantXP(player, 80); return { toast: '🐸 You cast the bones on the water. All go down with the stream but one, a small forked bone that turns and comes up against it. You take it. Something behind you makes a great noise, and you do not look round.' }; }
      to.restUntil = t + D.TOAD.restMs; player.toadCalmUntil = t + D.TOAD.calmMs;
      return { toast: `🐸 You close your hand on the bone. For ${mins(D.TOAD.calmMs)} the night creatures of the Wilds will look through you, unless you strike first.` };
    }
    if (way === 'reel') {
      if (action === 'loose') { reel.hands.delete(player.id); return { toast: '💃 You let go and step back from the ring.' }; }
      reel.hands.set(player.id, t);
      const n = reel.hands.size;
      if (n >= D.REEL.need) { reelStart(); return { toast: '💃 That makes the ring.' }; }
      tell([...reel.hands.keys()].filter((id) => id !== player.id), `💃 ${player.name} takes a hand. ${n} of you now; the reel wants ${D.REEL.need}.`);
      return { toast: n === 1 ? `💃 You stand at the stones with a hand held out. The reel wants ${D.REEL.need}: call the others.` : `💃 You take a hand. ${n} of you now; the reel wants ${D.REEL.need}.` };
    }
    if (way === 'hare') {
      const ha = s.hare || (s.hare = {});
      if (action === 'back') { endHare(player); return { toast: '🐇 You say the other verse, and stand up on two feet, out of breath.' }; }
      ha.restUntil = t + D.HARE.restMs;
      player.activeStatus = { type: 'hare', expiresAt: t + D.HARE.ms };
      return { sfx: 'hare_go', toast: `🐇 "I shall go into a hare, with sorrow and sigh and mickle care." The ground comes up close, and everything smells. You have ${mins(D.HARE.ms)}; give a blow or take one and you are yourself again.` };
    }
    if (way === 'glory') {
      const gl = s.glory || (s.glory = {});
      if (action === 'buy') {
        ensureBankAccount(player.accountKey).balance -= D.GLORY.gold;
        gl.has = true;
        return { toast: `🕯️ He takes your ${D.GLORY.gold} gold without counting it and passes you something wrapped in a piece of old sheet. You do not ask.` };
      }
      gl.restUntil = t + D.GLORY.restMs;
      const held = holdCreatures(player, D.GLORY.range, D.GLORY.holdMs);
      return { sfx: 'glory_light', toast: held ? `🕯️ You light the candle in the dead hand. ${held === 1 ? 'One creature' : held + ' creatures'} near you ${held === 1 ? 'stands' : 'stand'} as if asleep, and will for ${Math.round(D.GLORY.holdMs / 1000)} seconds.` : '🕯️ You light the candle in the dead hand. It burns blue, and there is nothing near enough to be held by it.' };
    }
    if (way === 'moon') {
      const mo = s.moon || (s.moon = {});
      mo.turnedAt = moonPhase().startsAt;
      const acct = ensureBankAccount(player.accountKey);
      const gold = Math.max(D.MOON.min, Math.min(D.MOON.max, Math.round(acct.balance * D.MOON.share)));
      pay(player, gold); grantXP(player, D.MOON.xp);
      return { sfx: 'moon_silver', toast: `🌒 You bow to her three times and turn the coins over in your pocket without taking them out. (+${gold} gold by the time she is full.)` };
    }
    return { error: 'That is not one of the old ways.' };
  }

  return { body, act, tick, statContrib, isCalmed, isHare, endHare, combsOf, D, _reel: reel };
};
