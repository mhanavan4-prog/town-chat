// Exercises the July feature batch against the real server.js handlers:
//  - Town Pass: two locked buildings, server-authoritative door gate,
//    pass grants/expiry, Stripe session bookkeeping (no live Stripe here —
//    grants go through the same grantForSession the verify endpoint uses).
//  - Town mob combat: night aggro/strike via the real tickWildlife loop.
//  - Hard Drive media + countermeasures: voice-clip evasion with proximity
//    broadcast, selfie disguises, snapshots, and the regulars discount.
process.env.PORT = '0';

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
  else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const hooks = global.__testHooks;

  const join = (name, charId = 3) => {
    const s = makeMockSocket(name);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name, charId }));
    const id = s.lastOfType('init').id;
    return { s, id, p: hooks.players.get(id) };
  };

  // ─── Town Pass ────────────────────────────────────────────────────────
  const { s: buyer, p: buyerP } = join('Buyer');
  const init = buyer.lastOfType('init');
  check('init carries townPass config', init.townPass &&
    Array.isArray(init.townPass.lockedRooms) && init.townPass.priceCents === hooks.TOWN_PASS_PRICE_CENTS);
  check('lounge and arcade are the locked rooms',
    hooks.LOCKED_ROOMS.has('lounge') && hooks.LOCKED_ROOMS.has('arcade') && hooks.LOCKED_ROOMS.size === 2);
  check('default price is $0.99 for a 24h day pass',
    hooks.TOWN_PASS_PRICE_CENTS === 99 && hooks.TOWN_PASS_HOURS === 24);

  buyer.emit('message', JSON.stringify({ type: 'move', x: 100, y: 100, room: 'arcade' }));
  let locked = buyer.lastOfType('room_locked');
  check('entering a locked building without a pass is rejected server-side',
    !!locked && locked.room === 'arcade' && buyerP.room !== 'arcade');
  buyer.emit('message', JSON.stringify({ type: 'move', x: 100, y: 100, room: 'lounge' }));
  check('lounge is locked too', buyer.lastOfType('room_locked').room === 'lounge' && buyerP.room !== 'lounge');
  buyer.emit('message', JSON.stringify({ type: 'move', x: 100, y: 100, room: 'cafe' }));
  check('free buildings stay free', buyerP.room === 'cafe');
  buyer.emit('message', JSON.stringify({ type: 'move', x: 100, y: 100, room: 'outside' }));

  // Grant through the same path /api/verify-session uses.
  const expiresAt = hooks.grantForSession('cs_test_abc123', Date.now());
  check('a paid session grants 24 hours', Math.abs(expiresAt - Date.now() - 24 * 3600 * 1000) < 5000);
  check('replaying the same session id never stacks hours',
    hooks.grantForSession('cs_test_abc123', Date.now() + 999999) === expiresAt);

  buyerP.passUntil = expiresAt;
  buyer.emit('message', JSON.stringify({ type: 'move', x: 100, y: 100, room: 'arcade' }));
  check('a valid pass opens the locked door', buyerP.room === 'arcade');
  buyer.emit('message', JSON.stringify({ type: 'move', x: 100, y: 100, room: 'outside' }));

  buyerP.passUntil = Date.now() - 1000; // expired
  buyer.emit('message', JSON.stringify({ type: 'move', x: 100, y: 100, room: 'lounge' }));
  check('an expired pass locks the door again', buyerP.room !== 'lounge' && !!buyer.lastOfType('room_locked'));

  // A rejoin with a known session id restores the pass without Stripe.
  const rejoin = makeMockSocket('Rejoiner');
  connHandler(rejoin);
  rejoin.emit('message', JSON.stringify({ type: 'join', name: 'Rejoiner', charId: 0, passSession: 'cs_test_abc123' }));
  const rejoinInit = rejoin.lastOfType('init');
  check('rejoining with a known Checkout receipt restores the pass',
    rejoinInit.townPass.passUntil === expiresAt);

  // ─── Town mob combat (real tickWildlife, night forced) ────────────────
  const realNow = Date.now;
  // Session L note: every 13th night is a Blood Moon (mobs deliberately hit
  // ~25% harder), so this base-contract block pins itself to an ORDINARY
  // night; the Blood Moon's own strike math is asserted right after it.
  let baseNightIdx = Math.floor(realNow() / hooks.CYCLE_MS);
  if (baseNightIdx % hooks.BLOOD_MOON_EVERY_NIGHTS === 0) baseNightIdx += 1;
  const nightBase = baseNightIdx * hooks.CYCLE_MS + hooks.DAY_MS + 60000; // 1min into a normal night
  let fakeNow = nightBase;
  Date.now = () => fakeNow;
  try {
    check('forced clock reads as night', hooks.isNightNow());
    check('forced night is NOT a blood moon (base contract)', !hooks.bloodMoonActive());
    const { s: prey, p: preyP } = join('Prey', 4);
    const mob = hooks.mobs[0];
    mob.dead = false; mob.health = 50; mob.scaredUntil = 0; mob.lastHitAt = 0;
    // Stand the player right on the mob.
    preyP.x = mob.x; preyP.y = mob.y; preyP.room = 'outside';
    hooks.tickWildlife(0.1);
    const struck = prey.lastOfType('struck');
    check('a town mob now strikes an adjacent player at night',
      !!struck && struck.mobId === mob.id && struck.damage >= 4 && struck.damage <= 9);
    check('being struck stamps lastAttackedAt (countermeasure window)',
      Date.now() - preyP.lastAttackedAt < 1000);
    check('mob strikes honor the hit cooldown', (() => {
      const before = prey.allOfType('struck').length;
      hooks.tickWildlife(0.1); // same instant — cooldown not elapsed
      return prey.allOfType('struck').length === before;
    })());

    // Chase: put the player at the aggro edge and watch the mob close in.
    preyP.x = mob.x + 100; preyP.y = mob.y;
    const beforeX = mob.x;
    hooks.tickWildlife(0.5);
    check('an aggroed mob chases toward the player', mob.x > beforeX);

    // Evasion: an evading player is neither chased nor hit.
    preyP.evasionUntil = Date.now() + 4000;
    preyP.x = mob.x; preyP.y = mob.y;
    mob.lastHitAt = 0;
    const hitsBefore = prey.allOfType('struck').length;
    hooks.tickWildlife(0.2);
    check('an evading player cannot be struck', prey.allOfType('struck').length === hitsBefore);
    preyP.evasionUntil = 0;

    // Scare: a scared mob runs AWAY.
    mob.scaredUntil = Date.now() + 8000;
    preyP.x = mob.x + 20; preyP.y = mob.y;
    const scaredBeforeX = mob.x;
    hooks.tickWildlife(0.5);
    check('a routed (scared) mob flees the player', mob.x < scaredBeforeX);
    mob.scaredUntil = 0;

    // Death by mob: hammer ticks until the prey drops.
    preyP.health = 5; preyP.x = mob.x; preyP.y = mob.y;
    mob.lastHitAt = 0;
    for (let i = 0; i < 6 && !preyP.isDead; i++) { fakeNow += 2000; hooks.tickWildlife(0.1); }
    check('a mob can bring a player down (you_died)', preyP.isDead && !!prey.lastOfType('you_died'));

    // Town mob kills pay XP now.
    const { s: hunter, p: hunterP } = join('Hunter', 1);
    hunterP.room = 'outside';
    const prey2 = hooks.mobs[1];
    prey2.dead = false; prey2.health = 1;
    hunterP.x = prey2.x; hunterP.y = prey2.y;
    const xpBefore = hooks.getProgress(hunterP).xp;
    const res = hooks.applyDamage(hunterP, 'mob', prey2.id, 10, 100);
    check('killing a town mob pays XP', res.ok && res.dead &&
      hooks.getProgress(hunterP).xp >= xpBefore + hooks.TOWN_MOB_XP);
    check('first hunt of the night pays the trophy bonus',
      !!hunter.lastOfType('trophy_bonus') &&
      hooks.getProgress(hunterP).xp >= xpBefore + hooks.TOWN_MOB_XP + 25);

    // ─── Blood Moon strike math (Session L) ─────────────────────────────
    // Jump the fake clock to the next blood-moon night: strikes multiply
    // ×1.25 (so up to ~11, past the ordinary 9 cap) and kill XP pays ×1.5.
    const bloodIdx = (Math.floor(fakeNow / hooks.CYCLE_MS) - (Math.floor(fakeNow / hooks.CYCLE_MS) % hooks.BLOOD_MOON_EVERY_NIGHTS)) + hooks.BLOOD_MOON_EVERY_NIGHTS;
    fakeNow = bloodIdx * hooks.CYCLE_MS + hooks.DAY_MS + 60000;
    check('jumped clock reads as a blood moon night', hooks.isNightNow() && hooks.bloodMoonActive());
    const { s: bloodPrey, p: bloodPreyP } = join('BloodPrey', 3);
    // Strip any random starter gear — guard stats would absorb the strike
    // below the raw amplified range this asserts on.
    for (const f of ['equippedWeapon', 'equippedHead', 'equippedChest', 'equippedFeet', 'equippedRing']) bloodPreyP[f] = null;
    const bloodMob = hooks.mobs[2];
    bloodMob.dead = false; bloodMob.health = 50; bloodMob.scaredUntil = 0; bloodMob.lastHitAt = 0;
    bloodPreyP.x = bloodMob.x; bloodPreyP.y = bloodMob.y; bloodPreyP.room = 'outside';
    hooks.tickWildlife(0.1);
    const bloodStruck = bloodPrey.lastOfType('struck');
    check('blood moon strikes are amplified but bounded (5–12)',
      !!bloodStruck && bloodStruck.damage >= 5 && bloodStruck.damage <= 12,
      { struck: bloodStruck, mob: { dead: bloodMob.dead, health: bloodMob.health, lastHitAt: bloodMob.lastHitAt, x: bloodMob.x, y: bloodMob.y }, prey: { x: bloodPreyP.x, y: bloodPreyP.y, room: bloodPreyP.room, dead: bloodPreyP.isDead, hp: bloodPreyP.health }, died: bloodPrey.lastOfType('you_died') });
    const bmMobKill = hooks.mobs[3];
    bmMobKill.dead = false; bmMobKill.health = 1;
    const { s: bmHunter, p: bmHunterP } = join('BloodHunter', 1);
    bmHunterP.room = 'outside'; bmHunterP.x = bmMobKill.x; bmHunterP.y = bmMobKill.y;
    const bmXpBefore = hooks.getProgress(bmHunterP).xp;
    hooks.applyDamage(bmHunterP, 'mob', bmMobKill.id, 10, 100);
    check('blood moon kills pay half again the XP',
      hooks.getProgress(bmHunterP).xp >= bmXpBefore + Math.round(hooks.TOWN_MOB_XP * 1.5));

    // ─── Hard Drive media + countermeasures ─────────────────────────────
    // The hard drive item is required — grant one the same way level-up does.
    const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(200);
    const AUD = 'data:audio/webm;base64,' + 'B'.repeat(200);

    const { s: dj, p: djP } = join('DJ', 2);
    dj.emit('message', JSON.stringify({ type: 'harddrive_save_clip', audio: AUD, label: 'My Howl' }));
    check('media needs the Hard Drive item', !!dj.lastOfType('harddrive_error'));

    hooks.grantXP(djP, 150); // first level-up awards the 💽
    dj.emit('message', JSON.stringify({ type: 'harddrive_save_clip', audio: AUD, label: 'My Howl' }));
    let hdState = dj.lastOfType('harddrive_state');
    check('a voice clip saves to the drive', hdState && hdState.clips.length === 1 && hdState.clips[0].label === 'My Howl');

    dj.emit('message', JSON.stringify({ type: 'harddrive_save_selfie', image: IMG }));
    hdState = dj.lastOfType('harddrive_state');
    check('a selfie saves to the drive, tagged as your own face',
      hdState && hdState.selfies.length === 1 && hdState.selfies[0].of === 'DJ');

    // cm_voice requires an actual attack in the last few seconds.
    djP.lastAttackedAt = 0;
    dj.emit('message', JSON.stringify({ type: 'cm_voice', clipId: hdState.clips[0].id }));
    check('cm_voice without a live attack is rejected', !!dj.lastOfType('cm_error'));

    // Put the DJ under attack, with one player near and one far.
    const { s: near, p: nearP } = join('NearBy', 0);
    const { s: far, p: farP } = join('FarAway', 0);
    djP.room = 'outside'; djP.x = 1000; djP.y = 1000;
    nearP.room = 'outside'; nearP.x = 1150; nearP.y = 1000;   // inside 320
    farP.room = 'outside'; farP.x = 2500; farP.y = 2000;       // way outside
    const mobNear = hooks.mobs[2];
    mobNear.dead = false; mobNear.scaredUntil = 0;
    mobNear.x = 1030; mobNear.y = 1000;
    djP.lastAttackedAt = Date.now();

    dj.emit('message', JSON.stringify({ type: 'cm_voice', clipId: hdState.clips[0].id }));
    check('cm_voice grants the evasion window', hooks.isEvading(djP));
    check('the clip broadcasts to players in earshot (and the DJ)',
      !!near.lastOfType('voice_cm') && !!dj.lastOfType('voice_cm') &&
      near.lastOfType('voice_cm').audio === AUD &&
      near.lastOfType('voice_cm').from === 'DJ');
    check('players out of earshot hear nothing', !far.lastOfType('voice_cm'));
    check('mobs in earshot are routed', mobNear.scaredUntil > Date.now());

    dj.emit('message', JSON.stringify({ type: 'cm_voice', clipId: hdState.clips[0].id }));
    check('cm_voice enforces its cooldown', !!dj.lastOfType('cm_error') &&
      /rewinding/.test(dj.lastOfType('cm_error').message));

    // PvP swings miss an evading player, with a telling message.
    nearP.lastStrikeAt = 0;
    nearP.x = djP.x + 40; nearP.y = djP.y; // inside STRIKE_RANGE (70)
    const djHpBeforeStrike = djP.health; // (starter gear can raise this above 100 now)
    near.emit('message', JSON.stringify({ type: 'strike', targetType: 'player', targetId: djP.id }));
    check('PvP strikes miss during evasion (with the echo message)',
      djP.health === djHpBeforeStrike && !!near.lastOfType('attack_result') &&
      /slips your strike/.test(near.lastOfType('attack_result').message));

    // ─── Disguise + snapshot + regulars discount ────────────────────────
    // The DJ saves a selfie that shows the NEAR player's face (as if from
    // a note they were sent) by pushing it through a real inbox note.
    const noteToDj = { id: 'note_test_1', fromId: nearP.id, fromName: 'NearBy', text: 'my selfie', image: IMG };
    djP.inbox.push(noteToDj);
    dj.emit('message', JSON.stringify({ type: 'harddrive_save_selfie_from_note', noteId: 'note_test_1' }));
    hdState = dj.lastOfType('harddrive_state');
    const borrowed = hdState.selfies.find(s => s.of === 'NearBy');
    check('an image note can be copied to the drive, tagged with its subject', !!borrowed);

    dj.emit('message', JSON.stringify({ type: 'cm_disguise', selfieId: borrowed.id }));
    check('wearing a selfie sets the disguise', djP.disguise && djP.disguise.name === 'NearBy');
    const dState = near.lastOfType('disguise_state');
    check('disguise broadcasts once with the image', dState && dState.id === djP.id && dState.image === IMG);

    // Snapshot of the disguised DJ shows the mask, not the player.
    nearP.x = djP.x + 50; nearP.y = djP.y;
    near.emit('message', JSON.stringify({ type: 'snap_player', targetId: djP.id }));
    const snapNote = near.lastOfType('note_received');
    check('a snapshot of a masked player captures the DISGUISE',
      snapNote && snapNote.note.snapOf === 'NearBy' && snapNote.note.image === IMG && snapNote.note.isSnap);
    check('the subject is told their picture was taken',
      !!dj.lastOfType('cm_result') && /took your picture/.test(dj.lastOfType('cm_result').message));

    // Regulars discount: an account that finished a shopkeeper's quest gets
    // 15% off — and so does anyone wearing their face.
    const npcId = 'npc_armorer';
    const questId = hooks.QUEST_BY_NPC[npcId][0]; // an NPC carries a LIST of jobs now (Session M) — any one earns regular status
    // Fake an account identity 'nearby' having done the quest.
    const acctSetup = require('../server.js'); // already loaded — no-op
    check('armorer has a side quest to be a regular of', !!questId);
    const ownProg = hooks.getProgress(nearP);
    ownProg.questsDone = { [questId]: true };
    check('finishing the quest yourself earns the discount',
      hooks.shopDiscountFor(nearP, npcId) === 0.15);
    check('a guest disguised as a guest earns nothing (no durable identity)',
      hooks.shopDiscountFor(djP, npcId) === 0);

    // Death clears the mask.
    djP.isDead = true;
    dj.emit('message', JSON.stringify({ type: 'respawn' }));
    check('the mask slips on respawn', djP.disguise === null);

    // ─── Emotes, hunt streaks, hit_fx (the mobile/fun batch) ────────────
    const { s: waver, p: waverP } = join('Waver', 0);
    const { s: watcher, p: watcherP } = join('Watcher', 1);
    waverP.room = 'outside'; watcherP.room = 'outside';
    waver.emit('message', JSON.stringify({ type: 'emote', emote: '👋' }));
    const seenEmote = watcher.lastOfType('emote_fx');
    check('an emote broadcasts to the room', seenEmote && seenEmote.emote === '👋' && seenEmote.id === waverP.id);
    waver.emit('message', JSON.stringify({ type: 'emote', emote: '<script>' }));
    check('only catalog emotes are accepted', watcher.allOfType('emote_fx').length === 1);
    waver.emit('message', JSON.stringify({ type: 'emote', emote: '💃' }));
    check('emotes are rate-limited', watcher.allOfType('emote_fx').length === 1);
    fakeNow += 1500;
    waver.emit('message', JSON.stringify({ type: 'emote', emote: '💃' }));
    check('the emote limiter recovers after its window', watcher.allOfType('emote_fx').length === 2);

    // Streaks: chained kills within the window build the counter; a gap
    // resets it. Kills go through the real applyDamage path.
    const { s: chainer, p: chainerP } = join('Chainer', 3);
    chainerP.room = 'outside';
    const killMob = (i) => {
      const m = hooks.mobs[i % hooks.mobs.length];
      m.dead = false; m.health = 1;
      chainerP.x = m.x; chainerP.y = m.y;
      return hooks.applyDamage(chainerP, 'mob', m.id, 10, 100);
    };
    killMob(3); fakeNow += 2000;
    killMob(4); fakeNow += 2000;
    killMob(5);
    let streakMsg = chainer.lastOfType('streak');
    check('chained kills build a hunt streak', streakMsg && streakMsg.count === 3);
    fakeNow += 2000; killMob(6); fakeNow += 2000; killMob(7);
    streakMsg = chainer.lastOfType('streak');
    check('the fifth chained kill pays a streak bonus', streakMsg && streakMsg.count === 5 && streakMsg.bonus === 10);
    fakeNow += hooks.STREAK_WINDOW_MS + 3000;
    killMob(8);
    check('a gap past the window resets the streak (no ×2 message)',
      chainer.lastOfType('streak').count === 5);
    fakeNow += 2000; killMob(9);
    check('the next chained kill starts again at ×2', chainer.lastOfType('streak').count === 2);

    // hit_fx: everyone in the room sees the number, dead flag and caster id.
    const fx = watcher.allOfType('hit_fx');
    check('hits broadcast hit_fx to the room', fx.length > 0);
    const lastFx = fx[fx.length - 1];
    // dmg is now the FINAL amount after the attacker's power skills/gear scale
    // the base roll, so it's >= the 10 passed in (the chainer's starter gear
    // adds a little); the target/dead/caster fields are still exact.
    check('hit_fx carries target, damage, death and caster',
      lastFx.targetType === 'mob' && lastFx.dmg >= 10 && lastFx.dead === true && lastFx.casterId === chainerP.id);

    // ─── Pacing: the campaign cannot be beaten in under ~2 hours ────────
    // Structural facts first:
    const gates = hooks.CHAPTER_LEVEL_GATES;
    check('chapter gates are non-decreasing and end at level 8',
      gates.every((g, i) => i === 0 || g >= gates[i - 1]) && gates[gates.length - 1] === 8);
    check('every storyline got the gates applied',
      Object.values(hooks.STORYLINES).every(l => l.chapters[5].requiresLevel === 8));
    const xpForL8 = hooks.XP_THRESHOLDS[7];
    check('level 8 needs 3000 cumulative XP', xpForL8 === 3000);

    // The campaign chapters alone must come nowhere near the finale gate — the
    // story can't hand you the ending; you clear the gate through open-world
    // play. And every side quest is EARNED through that play (a kill or a
    // harvest), never just handed over, so the ~2h time-floor below is the real
    // guarantee regardless of how big the quest catalog grows. (Session M added
    // 12 creature-hunt quests; the old "all quests once < gate" proxy no longer
    // holds and shouldn't — doing 30+ hunts/harvests IS the required playtime.)
    const knightChXp = hooks.STORYLINES[3].chapters.slice(0, 5).reduce((a, c) => a + c.xpReward, 0);
    const allQuestXp = Object.values(hooks.QUEST_CATALOG).reduce((a, q) => a + q.xpReward, 0);
    check('campaign chapters alone come nowhere near the finale gate (≤ a third of it)',
      knightChXp * 3 < xpForL8, { knightChXp, xpForL8 });
    check('every side quest is earned through open-world play, never just handed over',
      Object.values(hooks.QUEST_CATALOG).every(q => ['kill_mob', 'kill_creature', 'harvest_plant', 'harvest_specific'].includes(q.type)),
      Object.values(hooks.QUEST_CATALOG).filter(q => !['kill_mob', 'kill_creature', 'harvest_plant', 'harvest_specific'].includes(q.type)).map(q => q.type));

    // Time-floor model, deliberately generous to the player (documented so
    // the numbers can be argued with):
    //  - Combat ceiling: one kill per 22s sustained (approach + ~5 strikes
    //    on a 500ms cooldown + retarget) at an average 12.5 XP across town
    //    (10) and Wilds (15) prey, but night-gated mobs are only up half
    //    the time and dungeons pay 8 XP to a low-level character who can
    //    actually survive them → ceiling ≈ 163 kills/h ≈ 1,500 XP/h.
    //  - Quests: the whole catalog is worth allQuestXp once per 24h, and
    //    doing them costs travel time that comes OUT of combat time; being
    //    generous, count them as pure bonus on top at +400 XP/h while they
    //    last (≈1.5h to clear the catalog even rushing).
    //  → generous combined ceiling ≈ 1,900 XP/h.
    const CEILING_XP_PER_HOUR = 1900;
    // Serial, non-XP time a run cannot skip: reading/starting 6 chapters,
    // walking to 6 chapter objectives (talks, visits, the cave twice), the
    // finale's own 12 kills at combat pace… ≈ 25 minutes, floor 20.
    const SERIAL_CHAPTER_MINUTES = 20;
    const grindMinutes = ((xpForL8 - knightChXp) / CEILING_XP_PER_HOUR) * 60;
    const floorMinutes = grindMinutes + SERIAL_CHAPTER_MINUTES;
    console.log(`  pacing model: ${Math.round(grindMinutes)}min grind + ${SERIAL_CHAPTER_MINUTES}min chapters = ${Math.round(floorMinutes)}min floor`);
    check('even a ceiling-speed player needs ~2 hours to beat a campaign', floorMinutes >= 100);
    check('a typical player (60% of ceiling) needs well over 2 hours',
      (((xpForL8 - knightChXp) / (CEILING_XP_PER_HOUR * 0.6)) * 60) + SERIAL_CHAPTER_MINUTES >= 150);
  } finally {
    Date.now = realNow;
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 150);
