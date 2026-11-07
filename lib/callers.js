// ---------------------------------------------------------------------------
// Callers at the Door — server side (blueprint proposal A).
//
// Townsfolk come to the Town Board with a real cunning-folk job. The player
// takes one, works it with the game's own tools (pendulum / cards / staves /
// bowl for the readings; garden + Hazel's cauldron for what gets handed over),
// then finishes it at the Board for pay.
//
// State lives on the account (`a.callers`):
//   { day, served: [ids served today], active: { id, done: { stepIdx: note } },
//     total, byId: { id: count } }
// Three callers a day per account, chosen deterministically from the day and
// the account (so a restart, or a second tab, sees the same three).
//
// Readings are credited from the real handlers through callerEvent(). The
// daily tarot and rune spreads are one-per-day by design, so a spread already
// laid today counts too — opening the cards to *show* the caller is the act.
// ---------------------------------------------------------------------------
const { CALLERS, TIERS, CALLERS_PER_DAY, READING_KINDS } = require('../data/callers');
const { CHARMS, WART_CHARM, WORKINGS } = require('../data/charms');
const { HALLOWEEN_RITES } = require('../data/halloween');
const { YULE_RITES } = require('../data/yule');
const { WHEEL_RITES } = require('../data/wheelRites');
const { HOUSEHOLD_RITES } = require('../data/household');
const { MARTINMAS_RITES } = require('../data/martinmas');
const { WREN_RITES } = require('../data/wrenDay');
const { AGNES_RITES } = require('../data/stAgnes');
// Every seasonal rite a caller can ask for, by key (keys are unique across seasons).
const RITES = { ...HALLOWEEN_RITES, ...YULE_RITES, ...WHEEL_RITES, ...HOUSEHOLD_RITES, ...MARTINMAS_RITES, ...WREN_RITES, ...AGNES_RITES };
// A dated caller (when: { month, from, to }) comes only on those calendar days (UTC).
function inDateWindow(w, t) {
  const d = new Date(t);
  return d.getUTCMonth() + 1 === w.month && d.getUTCDate() >= w.from && d.getUTCDate() <= w.to;
}

const BY_ID = Object.fromEntries(CALLERS.map((c) => [c.id, c]));
const DAY_MS = 86400000;

// A caller can also be dated by the Commonplace Book's own calendar, for days
// that move (when: { calendar: 'plough_monday', days: 2 }): it comes on that
// day as data/oldCalendar.js reckons it, and for `days` days from it (two, so
// an evening player in the Americas, already past midnight UTC, isn't missed).
const { OLD_CALENDAR, entryDate } = require('../data/oldCalendar');
// Plough Monday's rite (data/ploughMonday.js) is asked for by its caller too.
Object.assign(RITES, require('../data/ploughMonday').PLOUGH_RITES);
// …and St Mark's Eve's (data/stMarksEve.js).
Object.assign(RITES, require('../data/stMarksEve').MARK_RITES);
// …and Valentine's Eve's (data/valentine.js).
Object.assign(RITES, require('../data/valentine').VALENTINE_RITES);
// …and Christmas Eve's (data/christmasEve.js).
Object.assign(RITES, require('../data/christmasEve').CHRISTMAS_EVE_RITES);
// …and the Good Friday bun's (data/goodFriday.js).
Object.assign(RITES, require('../data/goodFriday').GOOD_FRIDAY_RITES);
// …and St John's Eve's fern seed (data/fernSeed.js).
Object.assign(RITES, require('../data/fernSeed').FERN_RITES);
// …and All Souls' souling (data/souling.js).
Object.assign(RITES, require('../data/souling').SOUL_RITES);
function inWhen(w, t) {
  if (!w.calendar) return inDateWindow(w, t);
  const e = OLD_CALENDAR.find((x) => x.key === w.calendar);
  if (!e) return false;
  const y = new Date(t).getUTCFullYear();
  const [m, d] = entryDate(e, y);
  const start = Date.UTC(y, m - 1, d);
  return t >= start && t < start + (w.days || 1) * DAY_MS;
}

// When a dated caller's window next opens, from t: this year's if it hasn't
// closed yet, else next year's. { start, end } in ms, UTC; null if unknown.
function nextWindow(w, t) {
  const y = new Date(t).getUTCFullYear();
  for (const yr of [y, y + 1]) {
    let start, end;
    if (w.calendar) {
      const e = OLD_CALENDAR.find((x) => x.key === w.calendar);
      if (!e) return null;
      const [m, d] = entryDate(e, yr);
      start = Date.UTC(yr, m - 1, d);
      end = start + (w.days || 1) * DAY_MS;
    } else {
      start = Date.UTC(yr, w.month - 1, w.from);
      end = Date.UTC(yr, w.month - 1, w.to) + DAY_MS;
    }
    if (end > t) return { start, end };
  }
  return null;
}
// What a dated window is called: its own label, or the old calendar's title.
function whenLabel(w) {
  if (w.label) return w.label;
  const e = w.calendar && OLD_CALENDAR.find((x) => x.key === w.calendar);
  return e ? e.title : '';
}
// The dated callers still to come within `horizonDays`, soonest first, with how
// many days off they are (by UTC date); if none is that near, just the next
// one, however far. One whose day is already here is at the door, not
// "coming", so it is left out.
function datedComing(t, horizonDays = 120) {
  const today = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate());
  const out = [];
  for (const c of CALLERS) {
    if (!c.when) continue;
    const win = nextWindow(c.when, t);
    if (!win || win.start <= t) continue;
    const inDays = Math.round((win.start - today) / DAY_MS);
    out.push({ id: c.id, label: whenLabel(c.when), inDays, start: win.start });
  }
  out.sort((a, b) => a.start - b.start);
  const near = out.filter((x) => x.inDays <= horizonDays);
  return near.length ? near : out.slice(0, 1);
}

module.exports = function createCallers(deps) {
  const {
    accounts, saveAccounts, send, getInventory, countItemQty, removeItemFromAccount,
    saveInventories, inventoryStatePayload, ensureBankAccount, saveBankAccounts,
    grantXP, itemInfo, isBrewable, mulberry32, now: nowFn, seasonKey, onRite,
  } = deps;
  const currentSeason = () => { try { return seasonKey ? seasonKey() : null; } catch (e) { return null; } };
  const clock = nowFn || (() => Date.now());

  function seedOf(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  function stateOf(player) {
    const a = player.accountKey && accounts[player.accountKey];
    if (!a) return null;
    const today = Math.floor(clock() / DAY_MS);
    const st = a.callers || (a.callers = { day: today, served: [], active: null, total: 0, byId: {} });
    if (st.day !== today) { st.day = today; st.served = []; }
    if (!Array.isArray(st.served)) st.served = [];
    if (!st.byId) st.byId = {};
    if (st.active && !BY_ID[st.active.id]) st.active = null; // a caller removed from the data
    return st;
  }

  // Today's three, stable per account per day. A caller you are mid-way
  // through stays at the door even if the day turns.
  function offeredIds(player, st) {
    const today = Math.floor(clock() / DAY_MS);
    const rand = mulberry32(seedOf(`${player.accountKey}|${today}`));
    // Seasonal callers (season: 'samhain', …) come only in their season — and
    // in it, one of them always comes, first at the door.
    // Dated callers (Martinmas week) likewise come only on their days, first of all.
    const season = currentSeason();
    const ids = CALLERS.filter((c) => !c.season && !c.when).map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const seasonal = CALLERS.filter((c) => c.season && c.season === season).map((c) => c.id);
    const dated = CALLERS.filter((c) => c.when && inWhen(c.when, clock())).map((c) => c.id);
    const firsts = [];
    if (dated.length) firsts.push(dated[Math.floor(rand() * dated.length)]);
    if (seasonal.length) firsts.push(seasonal[Math.floor(rand() * seasonal.length)]);
    const out = [...firsts, ...ids.slice(0, Math.max(0, CALLERS_PER_DAY - firsts.length))];
    if (st && st.active && !out.includes(st.active.id)) out.unshift(st.active.id);
    return out;
  }

  function stepView(player, caller, st) {
    const inv = getInventory(player);
    return caller.steps.map((s, i) => {
      if (s.kind === 'deliver') {
        const have = countItemQty(inv, s.item);
        const info = itemInfo(s.item) || {};
        return {
          kind: s.kind, label: s.label, item: s.item, qty: s.qty, have,
          icon: info.icon || '📦', name: info.name || s.item,
          // Where it comes from, so a step is never a dead end.
          where: s.item === 'hearth_loaf' ? 'bake it at your hearth' : isBrewable(s.item) ? "brew it at Hazel's cauldron" : 'grow or gather it',
          done: have >= s.qty,
        };
      }
      const note = st && st.active && st.active.id === caller.id ? st.active.done[i] : undefined;
      const view = { kind: s.kind, label: s.label, ask: s.ask || '', done: note !== undefined, note: note || '' };
      if (s.kind === 'rite') {
        const r = RITES[s.rite] || {};
        view.rite = { key: s.rite, name: r.name, icon: r.icon, how: r.how };
      }
      if (s.kind === 'knots') {
        view.count = s.count || 1;
        view.tied = (st && st.active && st.active.id === caller.id && st.active.knotsTied && st.active.knotsTied[i]) || 0;
        // A counted working: the wart knots by default, or the step names its
        // charm (the stye's nine strokes, the sprain's nine knots).
        const w = (s.charm && (WORKINGS[s.charm] || CHARMS[s.charm])) || WART_CHARM;
        view.use = s.use || w.use;
        view.verb = s.verb || 'Tie a knot';
        view.icon = s.icon || '🪢';
      }
      if (s.kind === 'charm') {
        const ch = CHARMS[s.charm] || { lines: [] };
        view.charm = { key: s.charm, title: ch.title, icon: ch.icon, lines: ch.lines, use: ch.use };
        view.said = (st && st.active && st.active.id === caller.id && st.active.charmSaid && st.active.charmSaid[i]) || 0;
      }
      if (s.kind === 'sieve' || s.kind === 'key') {
        view.suspects = s.suspects || [];
        view.tried = (st && st.active && st.active.id === caller.id && st.active.sieveTried && st.active.sieveTried[i]) || [];
      }
      return view;
    });
  }

  function callersStatePayload(player) {
    const st = stateOf(player);
    if (!st) return { type: 'callers_state', isGuest: true, offered: [], active: null, total: 0 };
    const offered = offeredIds(player, st).map((id) => {
      const c = BY_ID[id];
      return { id, caller: c.caller, icon: c.icon, title: c.title, plea: c.plea, served: st.served.includes(id), reward: c.reward };
    });
    let active = null;
    if (st.active) {
      const c = BY_ID[st.active.id];
      const steps = stepView(player, c, st);
      active = { id: c.id, caller: c.caller, icon: c.icon, title: c.title, plea: c.plea, steps, ready: steps.every((s) => s.done), reward: c.reward };
    }
    return { type: 'callers_state', isGuest: false, offered, active, total: st.total || 0 };
  }

  function push(player) { send(player.ws, callersStatePayload(player)); }

  // A reading was taken. Credit the first matching open step of the active
  // working, with a short note of what the reading said.
  function callerEvent(player, kind, note) {
    if (!READING_KINDS.includes(kind)) return false;
    const st = stateOf(player);
    if (!st || !st.active) return false;
    const c = BY_ID[st.active.id];
    const idx = c.steps.findIndex((s, i) => s.kind === kind && st.active.done[i] === undefined);
    if (idx < 0) return false;
    st.active.done[idx] = String(note || '').slice(0, 140);
    saveAccounts();
    const left = stepView(player, c, st).filter((s) => !s.done).length;
    send(player.ws, {
      type: 'toast',
      message: left
        ? `🚪 ${c.caller}'s working — "${c.steps[idx].label}" done. ${left} to go.`
        : `🚪 ${c.caller}'s working is ready — return to the Town Board to finish it.`,
    });
    push(player);
    return true;
  }

  // The sieve and shears, worked on the Board: name the step's suspects one by
  // one; the sieve hangs still until it turns at one name. Which name is fixed
  // per account per working (so asking again can't fish for a different
  // answer) — and the resolution is honest that a sieve accuses nobody.
  // Naming the suspects — two old ordeals for finding a thief, worked on the
  // Board: the SIEVE and shears, and the KEY bound in a Bible. Name them one
  // by one; it hangs still until it turns at one name. Which name is fixed per
  // account per working (asking again can't fish for another answer) — and
  // every resolution is honest that neither accuses anybody.
  const SUSPECT_ORDEALS = {
    sieve: { none: 'There is no sieve to turn for this working.', still: (n) => `🥄 You name ${n}. The sieve hangs still on the shears.`, turned: (n) => `The sieve turned at the name of ${n}.` },
    key: { none: 'There is no key and Bible for this working.', still: (n) => `🗝️ "When thou sawest a thief…" — you name ${n}. The key hangs still in the Book.`, turned: (n) => `The key turned in the Bible at the name of ${n}.` },
  };
  function nameSuspect(player, name, kind) {
    const ord = SUSPECT_ORDEALS[kind];
    const st = stateOf(player);
    if (!st) { fail(player, 'Log into an account and the town will know where to find you.'); return; }
    if (!st.active) { fail(player, 'You have no working in hand.'); return; }
    const c = BY_ID[st.active.id];
    const idx = c.steps.findIndex((s, i) => s.kind === kind && st.active.done[i] === undefined);
    if (idx < 0) { fail(player, ord.none); return; }
    const suspects = c.steps[idx].suspects || [];
    if (!suspects.includes(name)) { fail(player, 'Name one of those the caller named.'); return; }
    if (!st.active.sieveTried) st.active.sieveTried = {};
    const tried = st.active.sieveTried[idx] || (st.active.sieveTried[idx] = []);
    if (tried.includes(name)) { push(player); return; }
    const turnsAt = suspects[seedOf(`${player.accountKey}|${c.id}|${kind}`) % suspects.length];
    if (name === turnsAt) { callerEvent(player, kind, ord.turned(name)); return; }
    tried.push(name);
    saveAccounts();
    send(player.ws, { type: 'toast', message: ord.still(name) });
    push(player);
  }

  // A seasonal rite (Burns's Hallowe'en charms, the Yule customs, the other
  // festivals' customs): do it, and the sign it gives is the
  // step's note. Which sign is fixed per account per caller, like the sieve.
  function riteDo(player) {
    const st = stateOf(player);
    if (!st) { fail(player, 'Log into an account and the town will know where to find you.'); return; }
    if (!st.active) { fail(player, 'You have no working in hand.'); return; }
    const c = BY_ID[st.active.id];
    const idx = c.steps.findIndex((s, i) => s.kind === 'rite' && st.active.done[i] === undefined);
    if (idx < 0) { fail(player, 'There is no rite to work for this caller.'); return; }
    const r = RITES[c.steps[idx].rite];
    if (!r) { fail(player, 'That rite is not known here.'); return; }
    const sign = r.outcomes[seedOf(`${player.accountKey}|${c.id}|${r.key}`) % r.outcomes.length];
    const a = accounts[player.accountKey];
    if (!Array.isArray(a.ritesDone)) a.ritesDone = [];
    if (!a.ritesDone.includes(r.key)) a.ritesDone.push(r.key);
    callerEvent(player, 'rite', `${r.icon} ${r.name}: ${sign}`);
    // Some rites touch the rest of the house (the need-fire relights your own hearth).
    if (onRite) { try { onRite(player, r.key); } catch (e) { /* the rite stands either way */ } }
  }

  // The wart charm: one knot per wart, tied one at a time; the last knot
  // completes the step and the account remembers the charm.
  function knotTie(player) {
    const st = stateOf(player);
    if (!st) { fail(player, 'Log into an account and the town will know where to find you.'); return; }
    if (!st.active) { fail(player, 'You have no working in hand.'); return; }
    const c = BY_ID[st.active.id];
    const idx = c.steps.findIndex((s, i) => s.kind === 'knots' && st.active.done[i] === undefined);
    if (idx < 0) { fail(player, 'There are no knots to tie for this working.'); return; }
    const count = c.steps[idx].count || 1;
    if (!st.active.knotsTied) st.active.knotsTied = {};
    const tied = (st.active.knotsTied[idx] || 0) + 1;
    st.active.knotsTied[idx] = tied;
    if (tied < count) { saveAccounts(); push(player); return; }
    const a = accounts[player.accountKey];
    if (!Array.isArray(a.charmsSaid)) a.charmsSaid = [];
    const key = c.steps[idx].charm || WART_CHARM.key;
    if (!a.charmsSaid.includes(key)) a.charmsSaid.push(key);
    callerEvent(player, 'knots', c.steps[idx].doneNote ? `${c.steps[idx].doneNote} for ${c.caller}.` : `${count} knots tied, one touched to every wart, for ${c.caller}.`);
  }

  // A spoken charm, said line by line, in order. When the last line is said the
  // step is done, and the account remembers the charm (for the Charm Book).
  function charmSay(player, line) {
    const st = stateOf(player);
    if (!st) { fail(player, 'Log into an account and the town will know where to find you.'); return; }
    if (!st.active) { fail(player, 'You have no working in hand.'); return; }
    const c = BY_ID[st.active.id];
    const idx = c.steps.findIndex((s, i) => s.kind === 'charm' && st.active.done[i] === undefined);
    if (idx < 0) { fail(player, 'There is no charm to say for this working.'); return; }
    const ch = CHARMS[c.steps[idx].charm];
    if (!ch) { fail(player, 'You do not know those words.'); return; }
    if (!st.active.charmSaid) st.active.charmSaid = {};
    const said = st.active.charmSaid[idx] || 0;
    if (line !== said) { fail(player, `Say it in order — next: "${ch.lines[said]}"`); return; }
    st.active.charmSaid[idx] = said + 1;
    if (said + 1 < ch.lines.length) { saveAccounts(); push(player); return; }
    const a = accounts[player.accountKey];
    if (!Array.isArray(a.charmsSaid)) a.charmsSaid = [];
    if (!a.charmsSaid.includes(ch.key)) a.charmsSaid.push(ch.key);
    callerEvent(player, 'charm', `You said ${ch.name} for ${c.caller}, every line.`);
  }

  function fail(player, message) { send(player.ws, { type: 'caller_error', message }); push(player); }

  function handle(player, msg) {
    if (msg.type === 'callers_state') { push(player); return true; }
    if (msg.type === 'sieve_turn') { nameSuspect(player, String(msg.name || ''), 'sieve'); return true; }
    if (msg.type === 'key_turn') { nameSuspect(player, String(msg.name || ''), 'key'); return true; }
    if (msg.type === 'charm_say') { charmSay(player, Number(msg.line)); return true; }
    if (msg.type === 'rite_do') { riteDo(player); return true; }
    if (msg.type === 'knot_tie') { knotTie(player); return true; }
    if (msg.type !== 'caller_take' && msg.type !== 'caller_abandon' && msg.type !== 'caller_finish') return false;
    const st = stateOf(player);
    if (!st) { fail(player, 'Log into an account and the town will know where to find you.'); return true; }

    if (msg.type === 'caller_take') {
      const id = String(msg.id || '');
      if (!BY_ID[id] || !offeredIds(player, st).includes(id)) { fail(player, 'Nobody by that name is at the door today.'); return true; }
      if (st.served.includes(id)) { fail(player, 'You have already served them today.'); return true; }
      if (st.active && st.active.id !== id) { fail(player, `You are still working for ${BY_ID[st.active.id].caller}. Finish or set it aside first.`); return true; }
      if (!st.active) { st.active = { id, done: {} }; saveAccounts(); }
      push(player);
      return true;
    }
    if (msg.type === 'caller_abandon') {
      if (st.active) { st.active = null; saveAccounts(); }
      push(player);
      return true;
    }
    // caller_finish
    if (!st.active) { fail(player, 'You have no working in hand.'); return true; }
    const c = BY_ID[st.active.id];
    const steps = stepView(player, c, st);
    const open = steps.filter((s) => !s.done);
    if (open.length) { fail(player, `Not yet — still to do: ${open.map((s) => s.label).join('; ')}.`); return true; }
    // Hand the goods over. All checked above, so the removals cannot fall short.
    const inv = getInventory(player);
    for (const s of c.steps) if (s.kind === 'deliver') removeItemFromAccount(inv, s.item, s.qty);
    saveInventories();
    const account = ensureBankAccount(player.accountKey);
    account.balance += c.reward.gold;
    saveBankAccounts();
    if (c.reward.xp) grantXP(player, c.reward.xp);
    const readings = c.steps.map((s, i) => (s.kind === 'deliver' ? null : st.active.done[i])).filter(Boolean);
    st.served.push(c.id);
    st.byId[c.id] = (st.byId[c.id] || 0) + 1;
    st.total = (st.total || 0) + 1;
    st.active = null;
    saveAccounts();
    send(player.ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
    send(player.ws, {
      type: 'caller_result',
      id: c.id, caller: c.caller, icon: c.icon, title: c.title,
      readings, resolution: c.resolution, lore: c.lore,
      tier: c.tier, tierLabel: (TIERS[c.tier] || {}).label || c.tier, source: c.source,
      gold: c.reward.gold, xp: c.reward.xp || 0, balance: account.balance, total: st.total,
    });
    push(player);
    return true;
  }

  return { callersStatePayload, callerEvent, handle, offeredIds, stateOf };
};
module.exports.datedComing = datedComing;
module.exports.nextWindow = nextWindow;
module.exports.whenLabel = whenLabel;
