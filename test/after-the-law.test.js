// After the Law: a second stone beside the memorial, for people killed as
// witches by their neighbours after the witchcraft laws were repealed in 1736.
// Every name, date and sentence is from the record (data/memorial.js).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-afterlaw-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { AFTER_THE_LAW: A } = require('../data/memorial.js');
const { WAYMARKER_LORE } = require('../data/townDecor.js');
const { WORLD } = require('../data/world.js');
const TOWN = fs.readFileSync(path.join(__dirname, '../client/town-scene.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const t = A.text;
check('it says what changed in 1736, and what did not', /In 1736 Parliament repealed the laws against witchcraft in Great Britain/.test(t) && /only for pretending to magic/.test(t) && /the belief did not end with the law/.test(t));
check('Ruth Osborne: ducked 22 April 1751, John lived, Colley hanged 24 August 1751', /Ruth Osborne, nearly seventy/.test(t) && /22 April 1751/.test(t) && /Her husband John was ducked with her and lived/.test(t) && /Thomas Colley/.test(t) && /hanged at Gubblecut Cross on 24 August 1751/.test(t) && !/24 April/.test(t));
check('Dummy: about eighty, name never known, the brook on 3 August 1863, died 4 September, six months\' hard labour', /Dummy/.test(t) && /about eighty/.test(t) && /name was never known/.test(t) && /3 August 1863/.test(t) && /4 September/.test(t) && /six months' hard labour/.test(t));
check('Ann Tennant: seventy-nine, Long Compton, 15 September 1875, the inquest witness\'s words', /Ann Tennant, seventy-nine/.test(t) && /Long Compton on 15 September 1875/.test(t) && /"all the damned witches in Long Compton, sixteen of them"/.test(t) && /not guilty by reason of insanity/.test(t));
check('…and the man is not named, since the reports spell it two ways', !/Hayward|Haywood/.test(t));
check('Bridget Cleary: twenty-six, 15 March 1895, manslaughter', /Bridget Cleary, twenty-six/.test(t) && /15 March 1895/.test(t) && /convicted of manslaughter/.test(t));
check('it ends on who killed them', /None of them was tried as a witch\. They were killed as witches, by people who knew them\./.test(t));
check('the sources: the Act, DNB, the 1751 account, the 1864 and 1875 papers, the DIB', /Witchcraft Act 1736/.test(A.sources) && /Osborne, Ruth/.test(A.sources) && /Hone/.test(A.sources) && /Bury and Norwich Post \(15 March 1864\)/.test(A.sources) && /Stratford upon Avon Herald/.test(A.sources) && /Dictionary of Irish Biography/.test(A.sources));
check('it is read like a waymarker, with its sources', WAYMARKER_LORE.way_after_law && WAYMARKER_LORE.way_after_law.name === A.name && /Sources: Witchcraft Act 1736/.test(WAYMARKER_LORE.way_after_law.text));

// The stone itself: built beside the memorial, readable, on clear ground.
const spot = TOWN.match(/const AFTER_LAW_SPOT = \{ x: (\d+), y: (\d+) \}/);
const mem = TOWN.match(/const MEMORIAL_SPOT = \{ x: (\d+), y: (\d+) \}/);
check('the town builds it with the memorial and makes it readable', /buildAfterTheLawStone\(scene, stoneMat, cut\)/.test(TOWN) && /markerId: 'way_after_law'/.test(TOWN));
const sx = spot && +spot[1], sy = spot && +spot[2];
const dMem = spot && mem ? Math.hypot(sx - +mem[1], sy - +mem[2]) : 0;
const clear = spot && WORLD.buildings.every((b) => Math.hypot(Math.max(b.x, Math.min(sx, b.x + b.w)) - sx, Math.max(b.y, Math.min(sy, b.y + b.h)) - sy) >= 60)
  && WORLD.natureDecor.every((d) => Math.hypot(d.x - sx, d.y - sy) >= 60);
check('it stands beside the memorial (not on it) and clear of buildings and props', dMem >= 45 && dMem <= 90 && clear, { dMem });

require('../server.js');

setTimeout(() => {
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const s = makeMockSocket('Mourner'); connHandler(s);
  s.emit('message', JSON.stringify({ type: 'join', name: 'Mourner', charId: 0 }));
  s.emit('message', JSON.stringify({ type: 'read_waymarker', markerId: 'way_after_law' }));
  const d = s.lastOfType('npc_hint_dialogue');
  check('reading the stone shows its text', d && d.npcId === 'way_after_law' && /Ruth Osborne/.test(d.message) && /Bridget Cleary/.test(d.message));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
