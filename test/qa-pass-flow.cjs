// Town Pass end-to-end on a phone, against test/stripe-mock-server.cjs:
// buy → redirect → verify → unlock → walk into the Arcade and the Lounge,
// play a cabinet, check the Text tab, confirm replay-proofing.
// Run: node test/qa-pass-flow.cjs   (mock server on :3000)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');
const STUB = path.join(__dirname, 'three-stub.js');

let checks = 0, failures = 0;
const findings = [];
const check = (desc, cond, detail) => {
  checks++;
  console.log(`  ${cond ? '✓' : '✗'} ${desc}${cond ? '' : (detail ? ' — ' + String(detail).slice(0, 160) : '')}`);
  if (!cond) { failures++; findings.push(`✗ ${desc}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`); }
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('**/three.min.js*', r => r.fulfill({ path: STUB, contentType: 'application/javascript' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0, 180)));

  const td = (fn, ...args) => page.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);
  const join = async (name) => {
    await page.goto('http://localhost:3000/?testdrive=1', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('tc_controls_seen', '1'));
    await page.fill('#nameInput', name);
    await page.click('#joinBtn');
    await page.waitForTimeout(1600);
  };

  console.log('── Town Pass purchase flow (mocked Stripe) ──');
  await join('PassBuyer');
  const cfgOn = await page.evaluate(() => fetch('/api/config').then(r => r.json()));
  check('server reports payments enabled', cfgOn.paymentsEnabled === true, JSON.stringify(cfgOn));

  // Pass modal shows a real price and a working buy button.
  await page.tap('#menuBtn'); await page.waitForTimeout(300);
  await page.tap('#menuPass'); await page.waitForTimeout(500);
  const passCopy = await page.evaluate(() => (document.getElementById('passModal') || {}).textContent || '');
  check('pass modal quotes the price', /\$0\.99/.test(passCopy), passCopy.slice(0, 120));

  // Buy: /api/checkout hands back the (mock) hosted page URL, which IS the
  // success redirect. Follow it like the browser would.
  const checkout = await page.evaluate(() => fetch('/api/checkout', { method: 'POST' }).then(r => r.json()));
  check('/api/checkout returns a checkout URL', !!checkout.url, JSON.stringify(checkout));
  const sessionId = (checkout.url.match(/pass_session=([^&]+)/) || [])[1];
  await page.goto(checkout.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // client verifies + stores the receipt
  const receipt = await page.evaluate(() => localStorage.getItem('tc_pass_session'));
  check('receipt stored in localStorage after verified return', receipt === sessionId, 'receipt=' + receipt);

  // Fresh load presenting the stored receipt (also proves the receipt path).
  await join('PassBuyer');
  const _passState = await page.evaluate(() => document.getElementById('menuPassState') ? document.getElementById('menuPassState').textContent : '');
  await page.tap('#menuBtn'); await page.waitForTimeout(300);
  const passText = await page.evaluate(() => (document.getElementById('menuPassState') || {}).textContent || '');
  check('menu shows an active pass with time left', /left/.test(passText), 'menuPassState=' + passText);
  await page.evaluate(() => document.getElementById('menuCloseBtn').click());

  // Replay-proofing: re-verifying the same session must not extend expiry.
  const v1 = await page.evaluate((sid) => fetch('/api/verify-session?session_id=' + sid).then(r => r.json()), sessionId);
  await page.waitForTimeout(1200);
  const v2 = await page.evaluate((sid) => fetch('/api/verify-session?session_id=' + sid).then(r => r.json()), sessionId);
  check('re-presenting the receipt never stacks hours', v1.unlocked && v2.unlocked && v1.expiresAt === v2.expiresAt, JSON.stringify({ v1, v2 }));

  // ── Arcade: door opens, cabinet plays, Text tab exists ──
  console.log('\n── Arcade with a pass ──');
  const buildings = await page.evaluate(() => window.__testDrive.world().buildings);
  const arcade = buildings.find(b => b.id === 'arcade');
  // east door: approach from outside, face west, walk in
  await td('teleport', arcade.x + arcade.w + 40, arcade.y + arcade.h / 2);
  await td('face', Math.atan2(-1, 0));
  await page.evaluate(() => new Promise((res) => {
    const z = document.getElementById('joyZone');
    const mk = (type, x, y) => new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], cancelable: true, bubbles: true });
    z.dispatchEvent(mk('touchstart', 100, 700));
    z.dispatchEvent(mk('touchmove', 100, 654));
    setTimeout(() => { z.dispatchEvent(mk('touchend', 100, 654)); res(); }, 1500);
  }));
  await page.waitForTimeout(500);
  let st = await td('state');
  check('pass holder walks straight into the Arcade', st.room === 'arcade', 'room=' + st.room);

  if (st.room === 'arcade') {
    const kiosks = await td('interiorKiosks');
    const snake = (kiosks || []).find(k => k.game === 'snake');
    check('Snake cabinet kiosk present', !!snake, JSON.stringify((kiosks || []).map(k => k.game || k.npc || k.exitDoor)));
    if (snake) {
      await td('teleport', snake.world.x, snake.world.y);
      await page.waitForTimeout(400);
      const hint = await td('hint');
      check('cabinet pill offers Snake', !!hint && /Snake/i.test(hint || ''), 'hint=' + hint);
      await td('interact');
      await page.waitForTimeout(600);
      const gameUp = await page.evaluate(() => { const m = document.getElementById('arcadeModal'); return m && !m.classList.contains('hidden'); });
      check('Snake opens in the cabinet modal', gameUp);
      const helpTouch = await page.evaluate(() => (document.getElementById('arcadeHelp') || {}).textContent || '');
      check('cabinet instructions speak touch, not arrow keys', /swipe|thumb|tap/i.test(helpTouch), 'help=' + helpTouch);
      // Steer by swiping — must not throw (pageerror listener is watching).
      await page.evaluate(() => {
        const cv = document.getElementById('arcadeCanvas');
        const r = cv.getBoundingClientRect();
        const mk = (type, x, y) => new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 3, target: cv, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 3, target: cv, clientX: x, clientY: y })], cancelable: true, bubbles: true });
        cv.dispatchEvent(mk('touchstart', r.left + r.width / 2, r.top + r.height / 2));
        cv.dispatchEvent(mk('touchmove', r.left + r.width / 2, r.top + r.height / 2 + 40));
        cv.dispatchEvent(mk('touchend', r.left + r.width / 2, r.top + r.height / 2 + 40));
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => { const b = document.getElementById('arcadeCloseBtn'); if (b) b.click(); });
      await page.waitForTimeout(300);
    }
    // Breakout: the paddle should land under the thumb — assert by pixel.
    const breakout = (kiosks || []).find(k => k.game === 'breakout');
    if (breakout) {
      await td('teleport', breakout.world.x, breakout.world.y);
      await page.waitForTimeout(400);
      await td('interact');
      await page.waitForTimeout(500);
      const paddleFollows = await page.evaluate(() => {
        const cv = document.getElementById('arcadeCanvas');
        const r = cv.getBoundingClientRect();
        const mk = (type, x, y) => new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 4, target: cv, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 4, target: cv, clientX: x, clientY: y })], cancelable: true, bubbles: true });
        const readPaddleX = () => {
          const ctx = cv.getContext('2d');
          const row = ctx.getImageData(0, 302, 320, 1).data; // paddle row (y=300..308)
          for (let x = 0; x < 320; x++) {
            const [rr, gg, bb] = [row[x * 4], row[x * 4 + 1], row[x * 4 + 2]];
            if (rr > 220 && gg > 180 && bb < 160) return x; // #ffd27a
          }
          return -1;
        };
        return new Promise((res) => {
          cv.dispatchEvent(mk('touchstart', r.left + r.width * 0.06, r.top + r.height * 0.9));
          setTimeout(() => {
            const leftPos = readPaddleX();
            cv.dispatchEvent(mk('touchmove', r.left + r.width * 0.94, r.top + r.height * 0.9));
            setTimeout(() => {
              const rightPos = readPaddleX();
              cv.dispatchEvent(mk('touchend', r.left + r.width * 0.94, r.top + r.height * 0.9));
              res({ leftPos, rightPos });
            }, 250);
          }, 250);
        });
      });
      check('Breakout paddle rides the thumb (pixel-verified)',
        paddleFollows.leftPos >= 0 && paddleFollows.rightPos > paddleFollows.leftPos + 100,
        JSON.stringify(paddleFollows));
      await page.evaluate(() => { const b = document.getElementById('arcadeCloseBtn'); if (b) b.click(); });
      await page.waitForTimeout(300);
    }
    // Text tab: in the arcade the chat compose bar gains the 📱 Text tab.
    await page.tap('#chatToggleBtn').catch(() => {});
    await page.waitForTimeout(400);
    const tabsShown = await page.evaluate(() => { const t = document.getElementById('chatTabs'); return t && !t.classList.contains('hidden'); });
    check('Arcade compose bar shows the Chat|Text tabs', tabsShown);
    if (tabsShown) {
      await page.tap('#chatTabText').catch(() => {});
      await page.waitForTimeout(300);
      const twilioForm = await page.evaluate(() => { const f = document.getElementById('twilioLoginFields'); if (!f) return false; const r = f.getBoundingClientRect(); return r.height > 0 && r.bottom <= window.innerHeight + 2; });
      check('Text tab shows the Twilio login form, on-screen', twilioForm === true, 'form=' + twilioForm);
      await page.tap('#chatTabChat').catch(() => {});
    }
    await page.tap('#chatToggleBtn').catch(() => {});
    // leave via menu
    await page.tap('#menuBtn'); await page.waitForTimeout(250);
    await page.tap('#menuLeave'); await page.waitForTimeout(800);
  }

  // ── Lounge: two floors ──
  console.log('\n── Rooftop Lounge with a pass ──');
  const lounge = buildings.find(b => b.id === 'lounge');
  await td('teleport', lounge.x - 40, lounge.y + lounge.h / 2);
  await td('face', Math.atan2(1, 0));
  await page.evaluate(() => new Promise((res) => {
    const z = document.getElementById('joyZone');
    const mk = (type, x, y) => new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], cancelable: true, bubbles: true });
    z.dispatchEvent(mk('touchstart', 100, 700));
    z.dispatchEvent(mk('touchmove', 100, 654));
    setTimeout(() => { z.dispatchEvent(mk('touchend', 100, 654)); res(); }, 1500);
  }));
  await page.waitForTimeout(500);
  st = await td('state');
  check('pass opens the Lounge too (one pass, both doors)', st.room === 'lounge', 'room=' + st.room);
  if (st.room === 'lounge') {
    // find a seat pill somewhere on the ground floor
    const kiosksL = await td('interiorKiosks');
    check('lounge exposes its exit door kiosk', (kiosksL || []).some(k => k.exitDoor));
    await page.tap('#menuBtn'); await page.waitForTimeout(250);
    await page.tap('#menuLeave'); await page.waitForTimeout(700);
  }

  // ═══ Seamless checkout return (resume tokens) ═══
  // The redirect to Stripe kills the page; these scenarios prove the
  // player comes back as the same character in the same spot — after a
  // successful payment AND after a canceled one — and that a dead token
  // falls back to the join screen instead of a silent fresh guest.
  const mkPhone = async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await c.route('**/three.min.js*', r => r.fulfill({ path: STUB, contentType: 'application/javascript' }));
    const p = await c.newPage();
    p.setDefaultTimeout(9000);
    p.on('pageerror', e => errors.push('RESUME PAGEERR: ' + e.message.slice(0, 180)));
    return { c, p };
  };
  const joinAs = async (p, name) => {
    await p.goto('http://localhost:3000/?testdrive=1', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.setItem('tc_controls_seen', '1'));
    await p.fill('#nameInput', name);
    await p.click('#joinBtn');
    await p.waitForTimeout(1500);
  };
  const tdOf = (p) => (fn, ...args) => p.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);
  const walkInOn = async (p, b, face) => {
    const t = tdOf(p);
    await t('face', face);
    await p.waitForTimeout(120);
    await p.evaluate(() => new Promise((res) => {
      const z = document.getElementById('joyZone');
      const mk = (type, x, y) => new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], cancelable: true, bubbles: true });
      z.dispatchEvent(mk('touchstart', 100, 700));
      z.dispatchEvent(mk('touchmove', 100, 654));
      setTimeout(() => { z.dispatchEvent(mk('touchend', 100, 654)); res(); }, 1500);
    }));
    await p.waitForTimeout(400);
  };
  const buyViaUi = async (p) => {
    await p.tap('#menuBtn'); await p.waitForTimeout(300);
    await p.tap('#menuPass'); await p.waitForTimeout(400);
    await Promise.all([
      p.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }),
      p.evaluate(() => document.getElementById('roomPassBuyBtn').click())
    ]);
  };

  console.log('\n── Resume A: buy mid-quest from inside the Cafe ──');
  {
    const { c, p } = await mkPhone();
    // Keep the harness seam alive across the redirect: the success URL has
    // no ?testdrive=1, so append it to whatever /api/checkout returns.
    await c.route('**/api/checkout', async (route) => {
      const resp = await route.fetch();
      const body = await resp.json();
      if (body.url) body.url += '&testdrive=1';
      await route.fulfill({ json: body });
    });
    const t = tdOf(p);
    await joinAs(p, 'ResumeRita');
    // A live side quest, then walk into the cafe.
    await t('send', { type: 'quest_talk', npcId: 'npc_mara', npcName: 'Ranger Mara' });
    await p.waitForTimeout(300);
    await t('send', { type: 'quest_accept', npcId: 'npc_mara' });
    await p.waitForTimeout(500);
    const trackerBefore = await p.evaluate(() => { const q = document.getElementById('questTracker'); return q && !q.classList.contains('hidden') ? q.textContent : null; });
    check('quest accepted before checkout (tracker up)', !!trackerBefore, 'tracker=' + trackerBefore);
    const cafe = (await p.evaluate(() => window.__testDrive.world().buildings)).find(b => b.id === 'cafe');
    await t('teleport', cafe.x + cafe.w + 40, cafe.y + cafe.h / 2);
    await walkInOn(p, cafe, Math.atan2(-1, 0));
    const before = await t('state');
    check('inside the cafe before checkout', before.room === 'cafe', 'room=' + before.room);

    await buyViaUi(p);
    // Auto-resume: the seam comes back once init lands — no join screen.
    await p.waitForFunction(() => window.__testDrive && !!window.__testDrive.me(), null, { timeout: 12000 }).catch(() => {});
    const after = await t('state').catch(() => null);
    check('auto-rejoined without the join screen', !!after, 'no me() after return');
    if (after) {
      check('same room after payment (cafe)', after.room === 'cafe', 'room=' + after.room);
      check('same spot after payment', Math.hypot(after.x - before.x, after.y - before.y) < 4, `moved ${Math.hypot(after.x - before.x, after.y - before.y).toFixed(1)}`);
      const meName = (await t('players')).find(x => x.isMe)?.name;
      check('same character name', meName === 'ResumeRita', 'name=' + meName);
      const trackerAfter = await p.evaluate(() => { const q = document.getElementById('questTracker'); return q && !q.classList.contains('hidden') ? q.textContent : null; });
      check('quest tracker restored after resume', !!trackerAfter && /Cull|creature/i.test(trackerAfter), 'tracker=' + trackerAfter);
      // Pass landed on the live connection (join receipt or claim_pass race-closer).
      let passText = '';
      for (let i = 0; i < 10; i++) {
        await p.waitForTimeout(400);
        passText = await p.evaluate(() => (document.getElementById('menuPassState') || {}).textContent || '');
        if (/left/.test(passText)) break;
      }
      check('pass active on the resumed connection', /left/.test(passText), 'menuPassState=' + passText);
    }
    await c.close();
  }

  console.log('\n── Resume B: canceled checkout still comes home ──');
  {
    const { c, p } = await mkPhone();
    // Simulate the player backing out on Stripe's page: the "checkout"
    // navigates straight to the cancel URL.
    await c.route('**/api/checkout', async (route) => {
      await route.fulfill({ json: { url: 'http://localhost:3000/?pass_cancel=1&testdrive=1' } });
    });
    const t = tdOf(p);
    await joinAs(p, 'CancelCarl');
    await t('teleport', 2500, 700);
    await p.waitForTimeout(400);
    await buyViaUi(p);
    await p.waitForFunction(() => window.__testDrive && !!window.__testDrive.me(), null, { timeout: 12000 }).catch(() => {});
    const after = await t('state').catch(() => null);
    check('canceled checkout auto-rejoins too', !!after);
    if (after) {
      check('back outside at the same spot', after.room === 'outside' && Math.hypot(after.x - 2500, after.y - 700) < 4, JSON.stringify({ room: after.room, x: after.x, y: after.y }));
      const passText = await p.evaluate(() => (document.getElementById('menuPassState') || {}).textContent || '');
      check('no pass granted on cancel', !/left/.test(passText), 'menuPassState=' + passText);
      const toast = await p.evaluate(() => (document.getElementById('unlockToastText') || {}).textContent || '');
      check('cancel toast explains (no charge)', /cancel/i.test(toast), 'toast=' + toast);
    }
    await c.close();
  }

  console.log('\n── Resume C: dead token falls back to the join screen ──');
  {
    const { c, p } = await mkPhone();
    await p.goto('http://localhost:3000/?testdrive=1', { waitUntil: 'networkidle' });
    await p.evaluate(() => {
      localStorage.setItem('tc_controls_seen', '1');
      sessionStorage.setItem('tc_resume', JSON.stringify({ token: 'garbage-token', name: 'GhostGwen', at: Date.now() }));
    });
    await p.goto('http://localhost:3000/?pass_cancel=1&testdrive=1', { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const fallback = await p.evaluate(() => {
      const card = document.querySelector('#joinScreen .card');
      const err = (document.getElementById('joinErr') || {}).textContent || '';
      const name = (document.getElementById('nameInput') || {}).value || '';
      return { cardShown: !!card && card.style.display !== 'none', err, name };
    });
    check('dead token shows the join screen again (no silent fresh guest)', fallback.cardShown, JSON.stringify(fallback));
    check('fallback explains itself and prefills the name', /passed|step back/i.test(fallback.err) && fallback.name === 'GhostGwen', JSON.stringify(fallback));
    await c.close();
  }

  // ── No-pass door math is already covered by qa-deep-mobile (locked toast) ──

  console.log('\n════════ PASS FLOW RESULT ════════');
  console.log(`checks: ${checks}, failures: ${failures}`);
  if (findings.length) { console.log('FINDINGS:'); for (const f of findings) console.log(f); }
  console.log('PAGE ERRORS: ' + (errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none'));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
