// Mobile-layout smoke shots. Boots the real client against the running
// server with test/three-stub.js swapped in for the CDN three.js (route
// interception), joins on an iPhone-sized touch viewport, and screenshots
// the HUD in portrait + landscape (plus a desktop control shot).
// Usage: node test/mobile-shots.cjs [outDir]   (server must be on :3000)
const path = require('path');
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');

const OUT = process.argv[2] || '/tmp/mshots';
const STUB = path.join(__dirname, 'three-stub.js');

async function shoot(browser, name, opts) {
  const ctx = await browser.newContext({
    viewport: opts.viewport,
    deviceScaleFactor: 2,
    isMobile: opts.mobile,
    hasTouch: opts.mobile,
    userAgent: opts.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined
  });
  await ctx.route('**/three.min.js*', route => route.fulfill({ path: STUB, contentType: 'application/javascript' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.fill('#nameInput', name);
  await page.click('#joinBtn');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}-${name}.png` });
  if (opts.extra) await opts.extra(page, name);
  console.log(`${name}: ${errors.length} page errors${errors.length ? ' — ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
  return errors;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  await shoot(browser, 'portrait', {
    viewport: { width: 390, height: 844 }, mobile: true,
    extra: async (page, name) => {
      // Menu sheet open
      await page.tap('#menuBtn');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}-${name}-menu.png` });
      await page.tap('#menuCloseBtn');
      // Emote wheel open
      await page.tap('#btnEmote');
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${OUT}-${name}-emotes.png` });
      await page.tap('#btnEmote');
      // Floating joystick: press-and-hold in the left zone
      await page.touchscreen.tap(80, 700); // taps also exercise placement
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}-${name}-joy.png` });
    }
  });

  await shoot(browser, 'landscape', {
    viewport: { width: 844, height: 390 }, mobile: true
  });

  await shoot(browser, 'desktop', {
    viewport: { width: 1280, height: 800 }, mobile: false
  });

  await browser.close();
  console.log('done →', OUT + '-*.png');
})().catch(e => { console.error(e); process.exit(1); });
