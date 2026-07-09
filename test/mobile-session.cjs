// A scripted mobile "play session" against the real client UI (stubbed
// renderer). Walks, talks, quests, chats, opens every panel, emotes, and
// reports any page errors. Run: node test/mobile-session.cjs (server on :3000)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');
const STUB = path.join(__dirname, 'three-stub.js');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('**/three.min.js*', r => r.fulfill({ path: STUB, contentType: 'application/javascript' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0, 140)));
  const log = (s) => console.log('· ' + s);

  await page.goto('http://localhost:3000/?testdrive=1', { waitUntil: 'networkidle' });
  await page.fill('#nameInput', 'PlayBot');
  await page.click('#joinBtn');
  await page.waitForTimeout(2400);

  const ctl = await page.evaluate(() => !document.getElementById('controlsModal').classList.contains('hidden'));
  log('controls guide auto-shown: ' + ctl);
  if (ctl) await page.tap('#controlsCloseBtn');

  const before = await page.evaluate(() => window.__testDrive.me());
  await page.evaluate(() => {
    const z = document.getElementById('joyZone');
    const mk = (type, x, y) => new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 9, target: z, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 9, target: z, clientX: x, clientY: y })], cancelable: true, bubbles: true });
    z.dispatchEvent(mk('touchstart', 100, 700));
    z.dispatchEvent(mk('touchmove', 100, 655));
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const z = document.getElementById('joyZone');
    const t = new Touch({ identifier: 9, target: z, clientX: 100, clientY: 655 });
    z.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], cancelable: true, bubbles: true }));
  });
  const after = await page.evaluate(() => window.__testDrive.me());
  const moved = Math.hypot(after.x - before.x, after.y - before.y);
  log(`joystick walk moved ${moved.toFixed(0)} units: ${moved > 30 ? 'OK' : 'FAIL'}`);

  await page.evaluate(() => {
    const k = window.__testDrive.kiosks().find(x => x.npc === 'npc');
    window.__testDrive.teleport(k.x + 5, k.z + 5);
  });
  await page.waitForTimeout(400);
  const pillText = await page.evaluate(() => {
    const h = document.getElementById('interactHint');
    return h.classList.contains('hidden') ? null : document.getElementById('interactHintText').textContent;
  });
  log('NPC pill: ' + pillText);
  await page.tap('#interactHint');
  await page.waitForTimeout(500);
  const shopOpen = await page.evaluate(() =>
    !document.getElementById('npcShopModal').classList.contains('hidden') ||
    !document.getElementById('questDialogue').classList.contains('hidden'));
  log('tapping pill opened NPC dialogue/shop: ' + shopOpen);
  const qBtn = await page.evaluate(() => {
    const b = document.getElementById('npcShopQuestBtn');
    if (b && b.offsetParent) { b.click(); return true; }
    return false;
  });
  await page.waitForTimeout(500);
  if (qBtn) {
    const accepted = await page.evaluate(() => {
      const a = document.getElementById('questAcceptBtn');
      if (a && a.offsetParent) { a.click(); return true; }
      return false;
    });
    await page.waitForTimeout(400);
    if (accepted) {
      const tracker = await page.evaluate(() => !document.getElementById('questTracker').classList.contains('hidden'));
      log('quest accepted via UI, tracker shown: ' + tracker);
    } else log('quest accept button not visible after Ask-for-quest');
  }
  await page.evaluate(() => {
    for (const id of ['npcShopCloseBtn', 'questCloseBtn', 'questDeclineBtn']) {
      const b = document.getElementById(id);
      if (b && b.offsetParent) b.click();
    }
  });

  await page.evaluate(() => {
    const w = window.__testDrive.world();
    const cafe = w.buildings.find(b => b.id === 'cafe');
    window.__testDrive.teleport(cafe.x + cafe.w / 2, cafe.y + cafe.h / 2);
  });
  await page.waitForTimeout(900);
  const inCafe = await page.evaluate(() => window.__testDrive.me().room);
  log('walked into building, room = ' + inCafe);

  const chatBtnVisible = await page.evaluate(() => !document.getElementById('chatToggleBtn').classList.contains('hidden'));
  log('chat toggle visible indoors: ' + chatBtnVisible);
  if (chatBtnVisible) {
    await page.tap('#chatToggleBtn');
    await page.waitForTimeout(300);
    const sent = await page.evaluate(() => {
      const inp = document.getElementById('chatInput');
      if (!inp) return 'no input';
      inp.value = 'hello from the QA bot';
      const send = document.getElementById('chatSendBtn');
      if (send) { send.click(); return 'clicked'; }
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return 'entered';
    });
    await page.waitForTimeout(300);
    const gotChat = await page.evaluate(() => document.querySelectorAll('#chatLog .chatLine').length > 0);
    log(`chat send (${sent}) rendered a line: ` + gotChat);
    await page.screenshot({ path: '/tmp/qa-chat.png' });
    await page.tap('#chatToggleBtn');
  }

  const rows = [
    ['menuInventory', 'inventoryPanel'],
    ['menuJournal', 'journalModal'],
    ['menuKit', null],
    ['menuDrive', 'inventoryPanel'],
    ['menuPass', 'passModal'],
  ];
  for (const [row, panelId] of rows) {
    await page.tap('#menuBtn');
    await page.waitForTimeout(250);
    await page.tap('#' + row);
    await page.waitForTimeout(350);
    const ok = await page.evaluate((pid) => {
      if (pid) return !document.getElementById(pid).classList.contains('hidden');
      return !document.getElementById('attackModal').classList.contains('hidden')
        || !document.getElementById('spellbookModal').classList.contains('hidden');
    }, panelId);
    log(`menu → ${row}: ${ok ? 'opens' : 'FAIL'}`);
    await page.evaluate(() => {
      for (const id of ['inventoryCloseBtn', 'journalCloseBtn', 'attackCloseBtn', 'spellbookCloseBtn', 'passModalCloseBtn']) {
        const b = document.getElementById(id);
        if (b && b.offsetParent) b.click();
      }
      document.getElementById('menuSheet').classList.add('hidden');
    });
    await page.waitForTimeout(150);
  }

  await page.tap('#btnEmote');
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('#emoteWheel .emoteBtn').click());
  await page.waitForTimeout(400);
  const emoteFloat = await page.evaluate(() => document.querySelectorAll('#fxLayer .emoteFloat').length);
  log('emote fired, float rendered: ' + (emoteFloat > 0));
  await page.tap('#btnStrike');
  await page.waitForTimeout(250);
  log('strike button tapped (no crash)');

  await page.screenshot({ path: '/tmp/qa-final.png' });
  console.log('\nERRORS: ' + (errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none'));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e.message); process.exit(1); });
