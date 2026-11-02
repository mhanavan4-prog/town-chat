// Bring a tea (hosting gift) — while visiting a cottage you brew a cup from your
// own herbs and leave it for the host; they accept it from home for the buff + an
// almanac entry. Covers the leave gate (visiting someone else's cottage, herbs
// spent), the gift landing on the host, the host's home_state carrying it, and
// claiming (buff applied, tea recorded, gift cleared).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-bringtea-');

const { TEAS } = require('../data/teas.js');

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

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; }
    return { s, p };
  }
  const invCount = (p, id) => { const inv = h.getInventory(p); let n = 0; for (const it of (inv.slots || inv)) if (it && it.itemId === id) n += (it.qty || 1); return n; };
  // A plain planetary tea (no capstone/sabbat gate).
  const tea = TEAS.find((t) => !t.requires && !t.sabbat && t.herbs && t.herbs.length);

  const guest = join('Guest', 'teaguest');
  const host = join('Host', 'teahost');
  const stock = () => { for (const ing of tea.herbs) h.grantLoot([{ kind: 'item', itemId: ing.id, qty: ing.qty * 2 }], guest.p); };

  // ── Can't leave a tea outside a cottage ─────────────────────────────────────
  guest.p.room = 'outside'; guest.p.instance = '';
  stock();
  guest.s.emit('message', JSON.stringify({ type: 'leave_tea', teaId: tea.id }));
  check('leaving a tea outside a cottage is refused', !!guest.s.lastOfType('tea_error') && !(h.accounts.teahost.teaGifts || []).length);

  // ── Can't leave a tea in your OWN cottage ───────────────────────────────────
  guest.p.room = 'cottage'; guest.p.instance = 'home_teaguest';
  guest.s.emit('message', JSON.stringify({ type: 'leave_tea', teaId: tea.id }));
  check('leaving a tea in your own cottage is refused', /your own/i.test((guest.s.lastOfType('tea_error') || {}).message || ''));

  // ── Visiting the host: leave a cup (spends the herbs, lands on the host) ─────
  guest.p.room = 'cottage'; guest.p.instance = 'home_teahost';
  const before = invCount(guest.p, tea.herbs[0].id);
  guest.s.emit('message', JSON.stringify({ type: 'leave_tea', teaId: tea.id }));
  check('leaving a cup spends the herb', invCount(guest.p, tea.herbs[0].id) === before - tea.herbs[0].qty, { before, after: invCount(guest.p, tea.herbs[0].id) });
  const gifts = h.accounts.teahost.teaGifts || [];
  check('the gift lands on the host, tagged with the giver', gifts.length === 1 && gifts[0].teaId === tea.id && gifts[0].from, gifts);
  check('the online host is notified', /left you a cup/i.test((host.s.lastOfType('toast') || {}).message || ''));

  // ── The host's home_state carries the waiting gift ──────────────────────────
  const hs = h.homeStateBody(host.p);
  check('the host home_state lists the waiting tea with its name', hs.teaGifts.length === 1 && hs.teaGifts[0].teaName && hs.teaGifts[0].from, hs.teaGifts);

  // ── The host accepts it from home: buff applied, tea recorded, gift cleared ──
  host.p.room = 'cottage'; host.p.instance = 'home_teahost';
  host.s.emit('message', JSON.stringify({ type: 'claim_tea_gift', index: 0 }));
  const buff = h.accounts.teahost.teaBuff;
  check('accepting applies the tea buff', buff && buff.id === tea.id && buff.until > Date.now());
  check('a received cup enters the host almanac', (h.accounts.teahost.teasBrewed || []).indexOf(tea.id) !== -1);
  check('the gift is cleared after accepting', (h.accounts.teahost.teaGifts || []).length === 0);
  check('the giver is thanked', /accepted your cup/i.test((guest.s.lastOfType('toast') || {}).message || ''));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
