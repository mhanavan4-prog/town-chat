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

const BY_ID = Object.fromEntries(CALLERS.map((c) => [c.id, c]));
const DAY_MS = 86400000;

module.exports = function createCallers(deps) {
  const {
    accounts, saveAccounts, send, getInventory, countItemQty, removeItemFromAccount,
    saveInventories, inventoryStatePayload, ensureBankAccount, saveBankAccounts,
    grantXP, itemInfo, isBrewable, mulberry32, now: nowFn,
  } = deps;
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
    const ids = CALLERS.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const out = ids.slice(0, CALLERS_PER_DAY);
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
          where: isBrewable(s.item) ? "brew it at Hazel's cauldron" : 'grow or gather it',
          done: have >= s.qty,
        };
      }
      const note = st && st.active && st.active.id === caller.id ? st.active.done[i] : undefined;
      return { kind: s.kind, label: s.label, done: note !== undefined, note: note || '' };
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

  function fail(player, message) { send(player.ws, { type: 'caller_error', message }); push(player); }

  function handle(player, msg) {
    if (msg.type === 'callers_state') { push(player); return true; }
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
