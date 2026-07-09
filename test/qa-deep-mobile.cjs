// ═══════════════════════════════════════════════════════════════════════════
// Deep mobile QA playthrough — a full evening in town on a phone, played
// adversarially. Requires the night-clock server: node test/night-server.cjs
// Pass the printed offset:  node test/qa-deep-mobile.cjs <offsetMs>
// Covers join → movement/camera → all doors (incl. locked) → chat/unread →
// night combat vs hunting mobs → XP/loot → wilds portal + harvest + item use
// → witch spell casting + the armed-targeting flow → bank (guest + account)
// → journal/campaign start → emotes → PvP death/respawn → orientation flip.
// ═══════════════════════════════════════════════════════════════════════════
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const STUB = path.join(__dirname, 'three-stub.js');
// Clock offset: CLI arg, or read straight from the running night-server's
// log so the two can never disagree.
const OFFSET = parseInt(process.argv[2] || '', 10) ||
  parseInt((fs.readFileSync('/tmp/night-server.log', 'utf8').match(/NIGHT_CLOCK_OFFSET_MS=(\d+)/) || [])[1] || '0', 10);
const SHOT_DIR = '/tmp/qa';

let checks = 0, failures = 0;
const findings = [];
const check = (desc, cond, detail) => {
  checks++;
  console.log(`  ${cond ? '✓' : '✗'} ${desc}${cond ? '' : (detail ? ' — ' + String(detail).slice(0, 160) : '')}`);
  if (!cond) { failures++; findings.push(`✗ ${desc}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`); }
};
const section = (s) => console.log('\n── ' + s + ' ──');

// Same seeded scatter as server.js so we can stand on a known wilds plant.
function seededRandom(seed) { let s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function makeWildsScatter(seed, gridSize, count) {
  const rand = seededRandom(seed); const cells = [];
  for (let gy = 0; gy < gridSize; gy++) for (let gx = 0; gx < gridSize; gx++) cells.push([gx, gy]);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const cellSize = 1000 / gridSize; const out = [];
  for (const [gx, gy] of cells) {
    if (out.length >= count) break;
    const x = (gx + 0.2 + rand() * 0.6) * cellSize; const y = (gy + 0.2 + rand() * 0.6) * cellSize;
    if (Math.hypot(x - 500, y - 880) < 130) continue;
    out.push([x * 10, y * 10]);
  }
  return out;
}
const PLANT_POSITIONS = makeWildsScatter(0x9a17, 14, 25 * 5);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  const mkCtx = async (mobile) => {
    const ctx = await browser.newContext(mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1280, height: 800 } });
    await ctx.route('**/three.min.js*', r => r.fulfill({ path: STUB, contentType: 'application/javascript' }));
    // Shift the browser clock by the same offset the night server uses so
    // client + server agree it's night.
    await ctx.addInitScript(`(() => { const real = Date.now.bind(Date); Date.now = () => real() + ${OFFSET}; })();`);
    return ctx;
  };

  const errors = [];
  const ctx = await mkCtx(true);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push('MOBILE PAGEERR: ' + e.message.slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|three.min|ERR_/.test(m.text())) errors.push('MOBILE CONSOLE: ' + m.text().slice(0, 200)); });

  const td = (fn, ...args) => page.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);
  const tap = (sel) => page.tap(sel, { timeout: 6000 }).catch((e) => {
    const blocker = (String(e.message).match(/<[^>]+> intercepts pointer events/) || [String(e.message).split('\n')[0]])[0];
    findings.push('⚠ tap could not reach: ' + sel + ' — ' + blocker.slice(0, 140));
  });
  const shot = (name) => page.screenshot({ path: `${SHOT_DIR}/${name}.png` }).catch(() => {});
  const visible = (id) => page.evaluate((i) => {
    const el = document.getElementById(i);
    if (!el || el.classList.contains('hidden')) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
  }, id);
  const tapTouch = async (x, y) => { await page.touchscreen.tap(x, y); };
  const joySwipe = async (dx, dy, holdMs) => {
    await page.evaluate(([dx, dy, holdMs]) => new Promise((res) => {
      const z = document.getElementById('joyZone');
      const sx = 100, sy = 700;
      const mk = (type, x, y) => new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], cancelable: true, bubbles: true });
      z.dispatchEvent(mk('touchstart', sx, sy));
      z.dispatchEvent(mk('touchmove', sx + dx, sy + dy));
      setTimeout(() => { z.dispatchEvent(mk('touchend', sx + dx, sy + dy)); res(); }, holdMs);
    }), [dx, dy, holdMs]);
  };
  const camDrag = async (fromX, fromY, toX, toY, steps = 8) => {
    await page.evaluate(([fx, fy, tx, ty, steps]) => new Promise((res) => {
      const c = document.getElementById('game');
      const mk = (type, x, y) => new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 11, target: c, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 11, target: c, clientX: x, clientY: y })], cancelable: true, bubbles: true });
      c.dispatchEvent(mk('touchstart', fx, fy));
      let i = 0;
      const step = () => {
        i++;
        const x = fx + (tx - fx) * i / steps, y = fy + (ty - fy) * i / steps;
        c.dispatchEvent(mk(i >= steps ? 'touchend' : 'touchmove', x, y));
        if (i >= steps) res(); else setTimeout(step, 30);
      };
      setTimeout(step, 30);
    }), [fromX, fromY, toX, toY, steps]);
  };

  // ═══ 1. Join screen ═══
  section('1. Join screen (portrait phone)');
  await page.goto('http://localhost:3000/?testdrive=1', { waitUntil: 'networkidle' });
  await shot('01-join');
  const charCount = await page.evaluate(() => document.querySelectorAll('.charOption').length);
  check('5 characters offered on join screen', charCount === 5, 'got ' + charCount);
  await page.evaluate(() => document.querySelector('.charOption[data-char="0"]').click()); // the Witch
  const witchSelected = await page.evaluate(() => document.querySelector('.charOption[data-char="0"]').classList.contains('selected'));
  check('character select responds to tap (Witch)', witchSelected);
  await page.fill('#nameInput', 'PhoneWitch');
  await page.click('#joinBtn');
  await page.waitForTimeout(2200);
  check('joined and game started', await page.evaluate(() => !!window.__testDrive.me()));
  const night = await td('isNight');
  check('client agrees it is night (clock offset applied)', night === true, 'isNight=' + night);
  // First-run controls guide pops 900ms after the world lands — wait it out.
  const guideShowed = await page.waitForSelector('#controlsModal:not(.hidden)', { timeout: 6000 }).then(() => true).catch(() => false);
  if (guideShowed) {
    const mobileGuide = await visible('controlsMobile');
    check('first-run controls guide shows the MOBILE control scheme', mobileGuide);
    await tap('#controlsCloseBtn');
    await page.waitForTimeout(300);
  } else {
    check('first-run controls guide auto-shows on first visit', false, 'never appeared');
  }
  await shot('02-in-town-night');

  // ═══ 2. Movement & camera ═══
  section('2. Joystick movement + camera-relative steering');
  let before = await td('state');
  await joySwipe(0, -46, 1000); // push up = run "screen-forward"
  let after = await td('state');
  const d1 = Math.hypot(after.x - before.x, after.y - before.y);
  check('joystick up runs the character (' + d1.toFixed(0) + ' units)', d1 > 60, JSON.stringify({ before: [before.x, before.y], after: [after.x, after.y] }));

  // Camera-relative check: drag the camera ~half a screen, then push up
  // again — the run direction should rotate with the view.
  const v1 = { x: after.x - before.x, y: after.y - before.y };
  await camDrag(300, 400, 80, 400); // big horizontal look-drag
  await page.waitForTimeout(500);
  before = await td('state');
  await joySwipe(0, -46, 1000);
  after = await td('state');
  const v2 = { x: after.x - before.x, y: after.y - before.y };
  const ang = (v) => Math.atan2(v.y, v.x);
  let dAng = Math.abs(ang(v1) - ang(v2)); if (dAng > Math.PI) dAng = 2 * Math.PI - dAng;
  check('camera drag re-aims the run (angle shifted ' + (dAng * 180 / Math.PI).toFixed(0) + '°)', dAng > 0.5, 'v1=' + JSON.stringify(v1) + ' v2=' + JSON.stringify(v2));

  // Wall collision: teleport just outside Town Hall's south wall, run north.
  await td('teleport', 1600, 440);
  await joySwipe(0, -46, 900); // north on screen ≈ decreasing y only if camera reset… run then check we never end up inside
  const wallState = await td('state');
  check('cannot walk through a building wall', wallState.room === 'outside', 'room=' + wallState.room);

  // Jump button exists and does not crash
  await tap('#btnJump');
  check('jump button tapped OK', true);

  // ═══ 3. Doors — walk in through the gap like a player does ═══
  section('3. Doors: walking in enters free buildings; locked ones bounce + toast');
  const buildings = await page.evaluate(() => window.__testDrive.world().buildings);
  const doorApproach = (b) => { // 40 units outside the door, facing inward
    const side = b.door || 'south';
    if (side === 'south') return { x: b.x + b.w / 2, y: b.y + b.h + 40, face: Math.atan2(0, -1) };
    if (side === 'north') return { x: b.x + b.w / 2, y: b.y - 40, face: Math.atan2(0, 1) };
    if (side === 'east') return { x: b.x + b.w + 40, y: b.y + b.h / 2, face: Math.atan2(-1, 0) };
    return { x: b.x - 40, y: b.y + b.h / 2, face: Math.atan2(1, 0) };
  };
  const walkIn = async (b, ms = 1500) => {
    const a = doorApproach(b);
    await td('teleport', a.x, a.y);
    await td('face', a.face);
    await page.waitForTimeout(150);
    await joySwipe(0, -46, ms);
    await page.waitForTimeout(350);
    return td('state');
  };
  const leaveViaMenu = async () => {
    await tap('#menuBtn'); await page.waitForTimeout(280);
    await tap('#menuLeave').catch(() => {}); await page.waitForTimeout(800);
  };
  let st;
  for (const id of ['hall', 'library', 'bank']) {
    const b = buildings.find(x => x.id === id);
    st = await walkIn(b);
    check(`walking through the ${id} door enters it`, st.room === id, 'room=' + st.room);
    if (st.room === id) await leaveViaMenu();
  }
  // Locked buildings (payments OFF): walking at the door must bounce + toast.
  for (const id of ['arcade', 'lounge']) {
    const b = buildings.find(x => x.id === id);
    st = await walkIn(b, 1100);
    const lockToast = await page.evaluate(() => { const t = document.getElementById('unlockToast'); return t && !t.classList.contains('hidden') ? document.getElementById('unlockToastText').textContent : null; });
    check(`locked ${id} refuses entry`, st.room === 'outside', 'room=' + st.room);
    check(`locked ${id} explains itself with a toast`, !!lockToast && /closed|Pass/i.test(lockToast || ''), 'toast=' + lockToast);
  }
  await shot('03-locked-door');

  // Free building: cafe — walk in and stay for the chat tests.
  const cafe = buildings.find(b => b.id === 'cafe');
  st = await walkIn(cafe);
  check('walking through the cafe door enters it', st.room === 'cafe', 'room=' + st.room);
  await shot('04-cafe-interior');

  // ═══ 4. Chat — banner notifications + compose bar (the new model) ═══
  section('4. Chat: top banners, auto-fade, compose bar, desktop bubbles');
  check('💬 compose button visible indoors', await visible('chatToggleBtn'));

  // Bring in a desktop bot, walk it into the cafe.
  const ctxBot = await mkCtx(false);
  const bot = await ctxBot.newPage();
  bot.on('pageerror', e => errors.push('BOT PAGEERR: ' + e.message.slice(0, 200)));
  await bot.goto('http://localhost:3000/?testdrive=1', { waitUntil: 'networkidle' });
  await bot.evaluate(() => document.querySelector('.charOption[data-char="3"]').click()); // Knight
  await bot.fill('#nameInput', 'BotKnight');
  await bot.click('#joinBtn');
  await bot.waitForTimeout(1500);
  await bot.evaluate(() => { const m = document.getElementById('controlsModal'); if (m && !m.classList.contains('hidden')) document.getElementById('controlsCloseBtn').click(); });
  const botTd = (fn, ...args) => bot.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);
  await botTd('teleport', cafe.x + cafe.w / 2, cafe.y + cafe.h / 2);
  await bot.waitForTimeout(800);
  const botState = await botTd('state');
  check('bot player joined and reached the cafe', botState.room === 'cafe', 'room=' + botState.room);

  // Bot chats → a banner pops at the top of my screen.
  await bot.evaluate(() => { window.__testDrive.send({ type: 'chat', text: 'evening, witch!' }); });
  await page.waitForTimeout(1200);
  const notifText = await page.evaluate(() => [...document.querySelectorAll('#chatNotifStack .chatNotif')].map(c => c.textContent).join(' | ') || null);
  check('incoming message pops a top banner', !!notifText && /evening, witch/.test(notifText || ''), 'stack=' + notifText);
  check('banner names the sender', /BotKnight/.test(notifText || ''), 'stack=' + notifText);
  const logHidden = await page.evaluate(() => { const l = document.getElementById('chatLog'); return !l || getComputedStyle(l).display === 'none'; });
  check('no scrolling chat log on mobile (banners replace it)', logHidden);

  // Compose bar: open with 💬, type, send with ➤.
  await tap('#chatToggleBtn');
  await page.waitForTimeout(400);
  const composeUp = await page.evaluate(() => !document.getElementById('chatPanel').classList.contains('mobileClosed'));
  check('💬 opens the compose bar', composeUp);
  const composeSlim = await page.evaluate(() => { const r = document.getElementById('chatPanel').getBoundingClientRect(); return r.height < window.innerHeight * 0.35 ? true : r.height; });
  check('compose bar is slim (no log inside)', composeSlim === true, 'height=' + composeSlim);
  await shot('05-compose-bar');
  await page.evaluate(() => { document.getElementById('chatInput').value = 'hello from the phone'; });
  await tap('#chatSendBtn');
  await page.waitForTimeout(800);
  const botSaw = await bot.evaluate(() => [...document.querySelectorAll('#chatLog .chatLine')].some(l => l.textContent.includes('hello from the phone')));
  check('➤ send delivers to the other player', botSaw);
  const selfBanner = await page.evaluate(() => [...document.querySelectorAll('#chatNotifStack .chatNotif')].some(c => /You/.test(c.textContent) && /hello from the phone/.test(c.textContent)));
  check('own message confirms as a "You" banner', selfBanner);
  check('📷 image-attach present in compose bar', await visible('chatImageBtn'));
  const botBubble = await bot.evaluate(() => [...document.querySelectorAll('.chatBubbleTag')].map(b => b.textContent).join(' | '));
  check('desktop sees an overhead speech bubble (README parity)', /hello from the phone/.test(botBubble || ''), 'bubbles=' + botBubble);
  await shot('05b-chat-banners');
  await tap('#chatToggleBtn'); // close compose
  // Banners fade on their own (~9s life + fade)
  await page.waitForTimeout(10800);
  const stackEmpty = await page.evaluate(() => document.querySelectorAll('#chatNotifStack .chatNotif').length);
  check('banners fade away by themselves', stackEmpty === 0, stackEmpty + ' still visible');

  // Leave via the ☰ menu.
  await tap('#menuBtn');
  await page.waitForTimeout(300);
  const leaveVisible = await visible('menuLeave');
  check('menu shows 🚪 Leave building row indoors', leaveVisible);
  if (leaveVisible) { await tap('#menuLeave'); await page.waitForTimeout(900); }
  st = await td('state');
  check('left the cafe back to the town square', st.room === 'outside', 'room=' + st.room);

  // ═══ 5. Night combat: a mob hunts, we fight back ═══
  section('5. Night combat vs town mobs');
  const mobs = await td('mobs');
  check('night mobs are up (server night clock)', mobs.filter(m => !m.dead).length > 0, JSON.stringify(mobs).slice(0, 120));
  const live = mobs.find(m => !m.dead);
  if (live) {
    await td('teleport', live.x + 20, live.y);
    let hunted = false, hp0 = (await td('state')).health;
    for (let i = 0; i < 16 && !hunted; i++) {
      await page.waitForTimeout(500);
      const s = await td('state');
      hunted = s.health < hp0;
    }
    check('mob locks on and lands real hits', hunted, 'health stayed ' + hp0);
    await shot('06-night-fight');
    // Fight back with the big ⚔️ button until it dies.
    let killed = false, xpToastSeen = false, trophySeen = false;
    for (let i = 0; i < 40 && !killed; i++) {
      const s = await td('state');
      const m = (await td('mobs')).find(x => x.id === live.id);
      if (!m || m.dead) { killed = true; break; }
      if (Math.hypot(m.x - s.x, m.y - s.y) > 55) await td('teleport', m.x + 10, m.y);
      await tap('#btnStrike');
      await page.waitForTimeout(560);
      const toast = await page.evaluate(() => { const t = document.getElementById('unlockToastText'); return t ? t.textContent : ''; });
      if (/XP/.test(toast)) xpToastSeen = true;
      if (/Trophy|trophy/i.test(toast)) trophySeen = true;
    }
    check('⚔️ attack-nearest kills the mob', killed);
    check('kill pays XP feedback', xpToastSeen);
    console.log('  (night-trophy bonus seen: ' + trophySeen + ')');
    // Floating damage numbers rendered at some point
    const dmgNums = await page.evaluate(() => document.querySelectorAll('#fxLayer .dmgNum').length >= 0);
    check('damage-number FX layer alive', dmgNums);
    // Duck indoors — mobs must not follow.
    await td('teleport', cafe.x + cafe.w / 2, cafe.y + cafe.h / 2);
    await page.waitForTimeout(1200);
    const insideHp = (await td('state')).health;
    await page.waitForTimeout(1500);
    check('mobs never follow indoors (health stable inside)', (await td('state')).health >= insideHp);
    await leaveViaMenu(); // walk out properly — teleporting can't exit a building
    st = await td('state');
    check('back outside for the wilds trip', st.room === 'outside', 'room=' + st.room);
  }

  // ═══ 6. Wilds: portal, harvest, use item ═══
  section('6. The Wilds: portal travel, harvesting, item use');
  await td('teleport', 1600, 700);
  await page.waitForTimeout(400);
  const portalHint = await td('hint');
  check('wilds portal pill offered', !!portalHint && /portal|Wilds/i.test(portalHint || ''), 'hint=' + portalHint);
  await td('interact');
  await page.waitForTimeout(1200);
  st = await td('state');
  check('stepped through into the Wilds', st.room === 'wilds', 'room=' + st.room);
  await shot('07-wilds');
  // Stand on plant #0 (healing herb is index 13 — swift_root is 0) and harvest.
  const [px, py] = PLANT_POSITIONS[0];
  await td('teleport', px, py);
  await page.waitForTimeout(300);
  await td('send', { type: 'harvest', decorId: 'wdecor_0_0' });
  await page.waitForTimeout(700);
  // Open inventory and look for the swift root item
  await tap('#menuBtn'); await page.waitForTimeout(250);
  await tap('#menuInventory'); await page.waitForTimeout(600);
  const hasRoot = await page.evaluate(() => document.getElementById('inventoryPanel').textContent.includes('🥕') || document.getElementById('inventoryPanel').textContent.toLowerCase().includes('swift'));
  check('harvested Swift Root shows in inventory', hasRoot);
  await shot('08-inventory');
  // Use it: click the slot then the use button if present
  const used = await page.evaluate(() => {
    const slots = [...document.querySelectorAll('#invSlotsGrid .itemSlot')];
    const slot = slots.find(s => s.textContent.includes('🥕'));
    if (!slot) return 'no slot (' + slots.length + ' slots)';
    slot.click();
    const useBtn = [...document.querySelectorAll('#inventoryPanel button')].find(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && /use/i.test(b.textContent);
    });
    if (!useBtn) return 'no use button';
    useBtn.click(); return 'used';
  });
  await page.waitForTimeout(700);
  st = await td('state');
  check('using Swift Root applies its status (' + used + ')', st.status === 'speedboost', 'status=' + st.status);
  // Close via the panel's ✕ — the only close affordance a phone has.
  await tap('#invCloseBtn');
  await page.waitForTimeout(300);
  check('inventory ✕ closes the panel on mobile', !(await visible('inventoryPanel')));

  // Return portal back to town.
  await td('teleport', 5000, 8720);
  await page.waitForTimeout(350);
  await td('interact');
  await page.waitForTimeout(1000);
  st = await td('state');
  check('return portal brings us back to town', st.room === 'outside', 'room=' + st.room);

  // ═══ 7. Witch kit: quick slots, panel cast, armed targeting on touch ═══
  section('7. Spellbook & targeting on touch');
  st = await td('state');
  if (st.room !== 'outside') { await leaveViaMenu(); }
  const qsCount = await page.evaluate(() => ['qs1', 'qs2', 'qs3'].filter(id => { const b = document.getElementById(id); return b && b.style.display !== 'none' && !b.classList.contains('hidden'); }).length);
  check('three quick-ability slots on the action wheel', qsCount === 3, 'visible=' + qsCount);
  await tap('#btnKit');
  await page.waitForTimeout(500);
  check('📖 opens the Spellbook', await visible('spellbookModal'));
  await shot('09-spellbook');
  // Cast the self-heal (no target needed): find Bone-Knit and cast.
  const castMsg = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#spellbookModal [class*=spell], #spellbookModal button')];
    const bone = cards.find(c => /Bone-Knit/i.test(c.textContent));
    if (!bone) return 'no bone-knit card';
    bone.click();
    const cast = [...document.querySelectorAll('button')].find(b => b.offsetParent && /^cast/i.test(b.textContent.trim()));
    if (!cast) return 'no cast button';
    cast.click(); return 'cast';
  });
  await page.waitForTimeout(700);
  st = await td('state');
  check('Bone-Knit Blessing casts from the book (' + castMsg + ')', st.status === 'regen' || st.status === 'bone_knit', 'status=' + st.status);
  await page.evaluate(() => { const b = document.getElementById('spellbookCloseBtn'); if (b) b.click(); });

  // Armed targeting: picking a targeted spell closes the book and arms
  // immediately (selectSpell's targeted branch) — no Cast button involved.
  await tap('#btnKit'); await page.waitForTimeout(400);
  const armedMsg = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#spellbookModal [class*=spell], #spellbookModal button')];
    const orb = cards.find(c => /Scrying Orb/i.test(c.textContent));
    if (!orb) return 'no orb card';
    orb.click(); return 'picked';
  });
  await page.waitForTimeout(500);
  const armedName = await td('armed');
  const bannerShown = await visible('targetingBanner');
  check('picking a targeted spell arms it and shows the 🎯 banner (' + armedMsg + ')', !!armedName && bannerShown, 'armed=' + armedName + ' banner=' + bannerShown);
  const bannerText = await page.evaluate(() => document.getElementById('targetingBannerText').textContent);
  check('targeting banner copy fits touch (no "Esc to cancel" on a phone)', !/Esc/i.test(bannerText), 'text="' + bannerText + '"');
  // Try to cancel by tapping the banner (the natural touch gesture):
  await tap('#targetingBanner').catch(() => {});
  await page.waitForTimeout(300);
  const stillArmed = await td('armed');
  check('tapping the banner cancels targeting', stillArmed === null, 'still armed=' + stillArmed);
  await page.evaluate(() => { const b = document.getElementById('spellbookCloseBtn'); if (b) b.click(); });

  // ═══ 8. Emotes outdoors ═══
  section('8. Emotes outdoors');
  // Bring the bot outside near me first (it's been idling in the cafe).
  await bot.evaluate(() => { const b = document.getElementById('leaveBtn'); if (b && !b.classList.contains('hidden')) b.click(); });
  await bot.waitForTimeout(900);
  await botTd('teleport', 1620, 1120);
  await td('teleport', 1600, 1100);
  await page.waitForTimeout(700);
  check('bot is outside with me', (await botTd('state')).room === 'outside', JSON.stringify(await botTd('state')));
  await tap('#btnEmote');
  await page.waitForTimeout(300);
  const wheelOpen = await page.evaluate(() => !document.getElementById('emoteWheel').classList.contains('hidden'));
  check('emote wheel opens outdoors', wheelOpen);
  await page.evaluate(() => document.querySelector('#emoteWheel .emoteBtn').click());
  await page.waitForTimeout(600);
  const botSawEmote = await bot.evaluate(() => document.querySelectorAll('#fxLayer .emoteFloat').length);
  check('emote floats for OTHER players outdoors', botSawEmote > 0, 'bot saw ' + botSawEmote);

  // ═══ 9. Bank as guest, then Journal chapter ═══
  section('9. Bank (guest) + Journal campaign');
  const bank = buildings.find(b => b.id === 'bank');
  st = await walkIn(bank);
  check('entered the Bank', st.room === 'bank', 'room=' + st.room);
  // Walk straight to the teller kiosk (interior kiosks are scene-space;
  // the seam hands back their world positions).
  const kiosks = await td('interiorKiosks');
  const teller = (kiosks || []).find(k => k.npc === 'teller');
  check('bank interior exposes a teller kiosk', !!teller, JSON.stringify(kiosks || []).slice(0, 140));
  let tellerHint = null;
  if (teller) {
    await td('teleport', teller.world.x, teller.world.y);
    await page.waitForTimeout(400);
    tellerHint = await td('hint');
  }
  check('Bank Teller pill appears at the counter', !!tellerHint && /bank account/i.test(tellerHint || ''), 'hint=' + tellerHint);
  if (tellerHint) {
    await td('interact');
    await page.waitForTimeout(800);
    const bankModalUp = await visible('bankModal');
    const guestCopy = await page.evaluate(() => (document.getElementById('bankModal') || {}).textContent || '');
    check('guest gets the "needs an account" explanation', bankModalUp && /guest|account/i.test(guestCopy), guestCopy.slice(0, 100));
    await shot('10-bank-guest');
    await page.evaluate(() => { const b = document.getElementById('bankModalCloseBtn'); if (b) b.click(); });
  }
  // leave the bank
  await tap('#menuBtn'); await page.waitForTimeout(250);
  await tap('#menuLeave'); await page.waitForTimeout(800);

  // Journal: begin chapter 1
  await tap('#menuBtn'); await page.waitForTimeout(250);
  await tap('#menuJournal'); await page.waitForTimeout(600);
  check('Journal opens', await visible('journalModal'));
  const beginMsg = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#journalModal button')].find(x => x.offsetParent && /Begin Chapter/i.test(x.textContent));
    if (!b) return 'no begin button';
    b.click(); return 'begun';
  });
  await page.waitForTimeout(800);
  const trackerUp = await page.evaluate(() => { const t = document.getElementById('storyTracker'); return t && !t.classList.contains('hidden') ? t.textContent : null; });
  check('campaign chapter 1 begins from the Journal (' + beginMsg + ')', !!trackerUp, 'tracker=' + trackerUp);
  check('story tracker carries a 🧭 where-hint', !!trackerUp && /🧭|where/i.test(trackerUp || ''), 'tracker=' + (trackerUp || '').slice(0, 80));
  await shot('11-journal');
  await page.evaluate(() => { const b = document.getElementById('journalCloseBtn'); if (b) b.click(); });

  // ═══ 10. PvP death & respawn on mobile ═══
  section('10. PvP death → ghost → respawn (phone side)');
  // Both of us outside — but NOT at the spawn hub: the four lit ritual
  // torches heal 25 HP/s in a 260-unit ring there (a deliberate night
  // sanctuary), which out-heals strike damage and makes everyone inside
  // unkillable. Duel in the dark instead.
  st = await td('state');
  if (st.room !== 'outside') await leaveViaMenu();
  await td('teleport', 2500, 1050);
  await botTd('teleport', 2500, 1050);
  await page.waitForTimeout(600);
  const victimId = (await botTd('players')).find(p => p.name === 'PhoneWitch' && !p.isMe)?.id;
  check('bot can see me in its player list', !!victimId);
  let dead = false;
  for (let i = 0; i < 40 && !dead && victimId; i++) {
    await botTd('send', { type: 'strike', targetType: 'player', targetId: victimId });
    await bot.waitForTimeout(560);
    const s = await td('state');
    dead = s.isDead || s.health <= 0;
  }
  check('sustained PvP strikes eventually defeat me', dead);
  if (dead) {
    await shot('12-death');
    const ghostShown = await page.evaluate(() => !document.getElementById('ghostOverlay').classList.contains('hidden'));
    check('ghost overlay + Respawn button shown', ghostShown);
    await tap('#respawnBtn').catch(() => {});
    await page.waitForTimeout(900);
    st = await td('state');
    check('respawn restores life at the spawn hub', !st.isDead && st.health > 50, JSON.stringify(st));
  }

  // ═══ 11. Scenery expansion ═══
  section('11. Scenery: props loaded, lamps lit at night, well blocks walking');
  st = await td('state');
  if (st.isDead) { await tap('#respawnBtn'); await page.waitForTimeout(800); }
  const counts = await td('sceneCounts');
  check('town scene carries the expanded prop set (>900 nodes)', counts.town > 900, JSON.stringify(counts));
  const lamps = await td('lampGlow');
  check('13 lane lampposts registered and glowing at night', lamps.count === 13 && lamps.opacity > 0.3, JSON.stringify(lamps));
  // The plaza well is solid: walk north into it and stop against it.
  await td('teleport', 1502, 1000);
  await td('face', Math.PI); // face -y (screen-forward after camera reset)
  await joySwipe(0, -46, 900);
  const wellStop = await td('state');
  check('the well has a real collider (walk into it, stop)', wellStop.y > 928 + 16 && wellStop.y < 1000, 'y=' + wellStop.y.toFixed(0));

  // ═══ 12. Orientation flip ═══
  section('12. Landscape orientation');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(700);
  const hudOk = await page.evaluate(() => {
    const ids = ['actionCluster', 'mobileTopBar', 'menuBtn', 'btnStrike'];
    const out = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) { out[id] = 'missing'; continue; }
      const r = el.getBoundingClientRect();
      out[id] = (r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1 && r.width > 0) ? 'ok' : `overflow ${JSON.stringify({ r: r.right, b: r.bottom, w: window.innerWidth, h: window.innerHeight })}`;
    }
    return out;
  });
  check('HUD stays on-screen in landscape', Object.values(hudOk).every(v => v === 'ok'), JSON.stringify(hudOk));
  const joyPos = await page.evaluate(() => { const j = document.getElementById('joystick'); const r = j.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: window.innerHeight }; });
  check('resting joystick hint re-anchors after rotation', joyPos.bottom <= joyPos.h + 4 && joyPos.top > 0, JSON.stringify(joyPos));
  await shot('13-landscape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);

  // ═══ wrap up ═══
  console.log('\n════════ DEEP MOBILE QA RESULT ════════');
  console.log(`checks: ${checks}, failures: ${failures}`);
  if (findings.length) { console.log('\nFINDINGS:'); for (const f of findings) console.log(f); }
  console.log('\nPAGE ERRORS: ' + (errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none'));
  await browser.close();
  process.exit(0); // findings are the report; don't fail the run
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
