// Account + Bank + Auction House on a phone: register on the join screen's
// Account tab, enter town, open the teller and auctioneer, and make sure
// the economy UI actually fits/works at 390px.
// Run: node test/qa-account-bank.cjs   (any server on :3000)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const STUB = path.join(__dirname, 'three-stub.js');
const OFFSET = parseInt((fs.existsSync('/tmp/night-server.log') && (fs.readFileSync('/tmp/night-server.log', 'utf8').match(/NIGHT_CLOCK_OFFSET_MS=(\d+)/) || [])[1]) || '0', 10);

let checks = 0, failures = 0;
const check = (desc, cond, detail) => {
  checks++;
  console.log(`  ${cond ? '✓' : '✗'} ${desc}${cond ? '' : (detail ? ' — ' + String(detail).slice(0, 160) : '')}`);
  if (!cond) failures++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('**/three.min.js*', r => r.fulfill({ path: STUB, contentType: 'application/javascript' }));
  await ctx.addInitScript(`(() => { const real = Date.now.bind(Date); Date.now = () => real() + ${OFFSET}; })();`);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0, 180)));
  const td = (fn, ...args) => page.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);

  console.log('── Account registration on the join screen ──');
  await page.goto('http://localhost:3000/?testdrive=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tc_controls_seen', '1'));
  const user = 'banker' + Math.floor(Math.random() * 100000);
  // switch to the Account tab
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('#joinModeTabs button')];
    const acct = tabs.find(t => /account/i.test(t.textContent));
    if (acct) acct.click();
  });
  await page.waitForTimeout(300);
  const acctVisible = await page.evaluate(() => { const i = document.getElementById('accountUserInput'); return i && i.getBoundingClientRect().height > 0; });
  check('Account tab shows the username/password form', acctVisible);
  await page.fill('#accountUserInput', user);
  await page.fill('#accountPassInput', 'hunter2222');
  await page.evaluate(() => document.getElementById('accountRegisterBtn').click());
  await page.waitForTimeout(900);
  const status = await page.evaluate(() => (document.getElementById('accountStatus') || {}).textContent || '');
  check('registration succeeds and reports logged-in', /logged in|registered|welcome/i.test(status), 'status=' + status);
  await page.click('#joinBtn');
  await page.waitForTimeout(1800);
  check('joined the town as the account', !!(await td('me')));

  console.log('── Bank teller with a real account ──');
  const buildings = await page.evaluate(() => window.__testDrive.world().buildings);
  const bank = buildings.find(b => b.id === 'bank');
  // walk in through the north door
  await td('teleport', bank.x + bank.w / 2, bank.y - 40);
  await td('face', Math.atan2(0, 1));
  await page.evaluate(() => new Promise((res) => {
    const z = document.getElementById('joyZone');
    const mk = (type, x, y) => new TouchEvent(type, { touches: type === 'touchend' ? [] : [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 7, target: z, clientX: x, clientY: y })], cancelable: true, bubbles: true });
    z.dispatchEvent(mk('touchstart', 100, 700));
    z.dispatchEvent(mk('touchmove', 100, 654));
    setTimeout(() => { z.dispatchEvent(mk('touchend', 100, 654)); res(); }, 1500);
  }));
  await page.waitForTimeout(400);
  check('inside the bank', (await td('state')).room === 'bank', 'room=' + (await td('state')).room);
  const kiosks = await td('interiorKiosks');
  const teller = (kiosks || []).find(k => k.npc === 'teller');
  await td('teleport', teller.world.x, teller.world.y);
  await page.waitForTimeout(400);
  await td('interact');
  await page.waitForTimeout(900);
  const bankUp = await page.evaluate(() => !document.getElementById('bankModal').classList.contains('hidden'));
  check('teller opens the bank account modal', bankUp);
  const balance = await page.evaluate(() => (document.getElementById('bankBalance') || {}).textContent || '');
  check('first visit opens an account with 100 starting gold', balance.trim() === '100', 'balance=' + balance);
  const slotInfo = await page.evaluate(() => {
    const slots = [...document.querySelectorAll('#bankModal .itemSlot, #bankModal [class*=slot]')];
    const filled = slots.filter(s => s.textContent.trim().length > 0);
    return { total: slots.length, filled: filled.length };
  });
  check('24 bank slots render, 3 starter items inside', slotInfo.total >= 24 && slotInfo.filled >= 3, JSON.stringify(slotInfo));
  const fits = await page.evaluate(() => {
    const card = document.getElementById('bankCard') || document.querySelector('#bankModal .card');
    if (!card) return 'no card';
    const r = card.getBoundingClientRect();
    return (r.width <= window.innerWidth + 1 && r.height <= window.innerHeight + 1) ? true : JSON.stringify(r);
  });
  check('bank modal fits a 390×844 phone screen', fits === true, String(fits));
  await page.screenshot({ path: '/tmp/qa/14-bank-account.png' });
  await page.evaluate(() => document.getElementById('bankModalCloseBtn').click());
  await page.waitForTimeout(300);

  console.log('── Auction house ──');
  const auct = (kiosks || []).find(k => k.npc === 'auctioneer');
  check('auctioneer kiosk exists', !!auct);
  if (auct) {
    await td('teleport', auct.world.x, auct.world.y);
    await page.waitForTimeout(400);
    await td('interact');
    await page.waitForTimeout(800);
    const aUp = await page.evaluate(() => { const m = document.getElementById('auctionModal'); return m && !m.classList.contains('hidden'); });
    check('auction house modal opens', aUp);
    if (aUp) {
      const hasListBtn = await page.evaluate(() => [...document.querySelectorAll('#auctionModal button')].some(b => /list an item/i.test(b.textContent)));
      check('“+ List an item” is offered', hasListBtn);
      await page.evaluate(() => document.getElementById('auctionModalCloseBtn').click());
    }
  }

  console.log(`\nchecks: ${checks}, failures: ${failures}`);
  console.log('PAGE ERRORS: ' + (errors.length ? [...new Set(errors)].join(' | ') : 'none'));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
