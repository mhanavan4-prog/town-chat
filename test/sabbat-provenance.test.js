// How old is the Wheel of the Year, really? (folk-magic blueprint §2, §4)
//
// The game used to present all eight sabbats flatly. Rule 1 of the blueprint:
// name the tier, never present a modern revival as ancient. These checks hold
// that: every sabbat carries a provenance with a tier and a source; the three
// modern names (Ostara, Litha, Mabon) are marked as revivals and the five old
// festivals as genuinely old; the wheel as a whole is marked modern; and the
// scrying bowl — where the wheel is shown — carries both to the client.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-sabbat-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { SABBATS, WHEEL_PROVENANCE } = require('../data/seasons');

check('all eight sabbats carry a provenance', SABBATS.length === 8 && SABBATS.every((s) => s.provenance && s.provenance.line && s.provenance.source));
const tiers = Object.fromEntries(SABBATS.map((s) => [s.key, s.provenance.tier]));
check('Ostara, Litha and Mabon are marked modern revivals', ['ostara', 'litha', 'mabon'].every((k) => tiers[k] === 'revival'), tiers);
check('the four Gaelic quarter-days and Yule are marked genuinely old', ['imbolc', 'beltane', 'lughnasadh', 'samhain', 'yule'].every((k) => tiers[k] === 'record'), tiers);
check('the wheel itself is marked a modern assembly, with its dates', WHEEL_PROVENANCE.tier === 'revival' && /1958/.test(WHEEL_PROVENANCE.line) && /1970s/.test(WHEEL_PROVENANCE.line));
check('…and is sourced', /Hutton/.test(WHEEL_PROVENANCE.source));
check("Samhain's 'witches' new year' is called a modern framing", /modern framing/.test(SABBATS.find((s) => s.key === 'samhain').provenance.line));

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
require('../server.js');
setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Seer'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Seer', charId: 0 }));
  s.emit('message', JSON.stringify({ type: 'scry' }));
  const r = s.lastOfType('scry_reading');
  const live = SABBATS.find((x) => x.key === (r && r.wheel.seasonKey));
  check("the scrying bowl shows the live sabbat's provenance", r && r.wheel.provenance && live && r.wheel.provenance.tier === live.provenance.tier, r && r.wheel);
  check('…and the wheel\'s', r && r.wheel.wheelProvenance && r.wheel.wheelProvenance.tier === 'revival');
  const cal = s.lastOfType('calendar_state');
  check('the calendar season carries it too', cal && cal.calendar.season && cal.calendar.season.provenance && cal.calendar.season.provenance.tier);
  void h;
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
