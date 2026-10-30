// Virality bot filter: the share-open counters must count distinct humans, not
// the link-preview unfurlers and crawlers that fetch the OG-tagged /u and /c
// pages. Locks isCrawlerUA so a future edit can't accidentally classify a real
// browser as a bot (under-count) or let a known unfurler through (over-count).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-viral-');
require('../server.js');
const h = global.__testHooks;

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const isBot = (uaStr) => h.isCrawlerUA({ get: (k) => (k && String(k).toLowerCase() === 'user-agent') ? uaStr : '' });

check('isCrawlerUA exposed', typeof h.isCrawlerUA === 'function');

// Real browsers are humans — must NOT be filtered.
const humans = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
];
for (const ua of humans) check('human: ' + ua.slice(0, 32), isBot(ua) === false, ua);

// Unfurlers, crawlers and bare script clients are bots — must be filtered.
const bots = [
  'Discordbot/2.0 (+https://discordapp.com)',
  'Twitterbot/1.0',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'TelegramBot (like TwitterBot)',
  'WhatsApp/2.23.20.0',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; +http://www.linkedin.com)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'redditbot/1.0',
  'curl/8.1.2',
  'python-requests/2.31.0',
  '', // no UA at all
];
for (const ua of bots) check('bot: ' + (ua || '(empty UA)').slice(0, 32), isBot(ua) === true, ua);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
