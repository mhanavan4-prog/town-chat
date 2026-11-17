// Macros: a chain of your own abilities on one button (data/macros.js, lib/macros.js, client/macros-panel.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const createMacros = require('../lib/macros');
const { MACROS, MACRO_BARRED_EFFECTS } = require('../data/macros');

const CAT = { strike: { name: 'Strike', effect: 'damage' }, ward: { name: 'Ward', effect: 'shield' }, mend: { name: 'Mend', effect: 'heal' }, late: { name: 'Late', effect: 'damage' },
  eye: { name: 'Third Eye', effect: 'camera' }, a5: { name: 'A5', effect: 'damage' }, a6: { name: 'A6', effect: 'damage' }, a7: { name: 'A7', effect: 'damage' } };
const make = (over = {}) => {
  const accounts = { ada: {} }; let purse = over.purse == null ? 500 : over.purse;
  const m = createMacros({ accountOf: (p) => accounts[p.accountKey] || null, catalogFor: () => CAT, unlocksFor: () => ({ late: 12 }), levelOf: (p) => p.level, balanceOf: () => purse, spend: (p, n) => { purse -= n; } });
  return { m, accounts, purse: () => purse };
};
const witch = (extra) => ({ accountKey: 'ada', charId: 0, level: 5, ...extra });

test('everyone has short macros; a chain is kept as she made it', () => {
  const { m } = make(); const w = witch();
  assert.strictEqual(m.state(w).size, MACROS.baseSteps);
  assert.deepStrictEqual(m.save(w, 0, { name: '  Opener  ', icon: '🔥', steps: ['strike', 'ward'] }), { ok: true });
  assert.deepStrictEqual(m.state(w).macros[0], { name: 'Opener', icon: '🔥', steps: ['strike', 'ward'] });
  assert.strictEqual(m.state(w).macros.length, MACROS.slots);
  assert.ok(m.save(w, 0, { steps: [] }).cleared); assert.strictEqual(m.state(w).macros[0], null);
  m.save(w, 1, { steps: ['strike', 'mend'], icon: 'nonsense', name: '<b>x</b>' });
  assert.strictEqual(m.state(w).macros[1].icon, '⛓️'); assert.ok(!/[<>]/.test(m.state(w).macros[1].name));
});

test('what is refused: too long, a repeat, one ability, not hers, not yet hers, one that asks leave, no account', () => {
  const { m } = make(); const w = witch();
  assert.match(m.save(w, 0, { steps: ['strike', 'ward', 'mend'] }).error, /hold 2/);
  assert.match(m.save(w, 0, { steps: ['strike', 'strike'] }).error, /once/);
  assert.match(m.save(w, 0, { steps: ['strike'] }).error, /two abilities or more/);
  assert.ok(m.save(w, 0, { steps: ['strike', 'fireball'] }).error);
  assert.ok(m.save(w, 0, { steps: ['strike', 'late'] }).error, 'opens at 12, she is 5');
  assert.ok(m.save(w, 0, { steps: ['strike', 'eye'] }).error, 'the camera ask is never chained');
  assert.ok(MACRO_BARRED_EFFECTS.includes('camera') && MACRO_BARRED_EFFECTS.includes('howl_location'));
  assert.ok(m.save(w, 7, { steps: ['strike', 'ward'] }).error);
  assert.match(m.save({ charId: 0, level: 5 }, 0, { steps: ['strike', 'ward'] }).error, /account/);
  assert.strictEqual(m.state({ charId: 0, level: 5 }).account, false);
});

test('longer macros are bought in turn with Moonstones, once, and the price rises', () => {
  const { m, purse } = make({ purse: 70 }); const w = witch();
  assert.deepStrictEqual(m.state(w).next, MACROS.sizes[0]);
  assert.deepStrictEqual(m.upgrade(w), { ok: true, steps: 3, cost: MACROS.sizes[0].cost });
  assert.strictEqual(purse(), 70 - MACROS.sizes[0].cost);
  assert.ok(m.save(w, 0, { steps: ['strike', 'ward', 'mend'] }).ok);
  assert.ok(m.upgrade(w).ok);                                   // 4
  assert.match(m.upgrade(w).error, /you carry/);                // cannot afford 5
  assert.strictEqual(m.state(w).size, 4);
  for (let i = 1; i < MACROS.sizes.length; i++) { assert.ok(MACROS.sizes[i].steps === MACROS.sizes[i - 1].steps + 1); assert.ok(MACROS.sizes[i].cost > MACROS.sizes[i - 1].cost); }
  const rich = make({ purse: 99999 }); const r = witch();
  for (let i = 0; i < MACROS.sizes.length; i++) assert.ok(rich.m.upgrade(r).ok);
  assert.match(rich.m.upgrade(r).error, /as long as macros go/); assert.strictEqual(rich.m.state(r).next, null);
});

test('macros are kept per class, and a step she can no longer cast is dropped from what she is shown', () => {
  const { m, accounts } = make(); const w = witch();
  m.save(w, 0, { steps: ['strike', 'ward'] });
  assert.strictEqual(m.state(witch({ charId: 3 })).macros[0], null);
  accounts.ada.macros.byChar[0][0].steps = ['strike', 'gone', 'ward'];
  assert.deepStrictEqual(m.state(w).macros[0].steps, ['strike', 'ward']);
});

test('the client lays macros in beside her abilities, picks what can be added, and casts only what is ready', async () => {
  const { withMacros, isMacroId, macroChoices, macroReady } = await import('../client/macros-panel.js');
  const cat = withMacros(CAT, { macros: [{ name: 'Opener', icon: '🔥', steps: ['strike', 'ward'] }, null, { name: 'Bad', steps: ['strike', 'gone'] }] });
  assert.ok(cat.macro_0 && cat.macro_0.kind === 'macro' && /Strike → Ward/.test(cat.macro_0.description));
  assert.ok(!cat.macro_1 && !cat.macro_2, 'an empty slot and a chain with one castable step are not buttons');
  assert.ok(!('macro_0' in CAT), 'her class catalog itself is not touched');
  assert.ok(isMacroId('macro_2') && !isMacroId('strike'));
  assert.deepStrictEqual(macroChoices(cat, ['strike'], { open: (id) => id !== 'late', barred: ['camera'] }), ['ward', 'mend', 'a5', 'a6', 'a7']);
  assert.deepStrictEqual(macroReady(['strike', 'ward', 'mend'], { has: (id) => id !== 'mend', cooling: (id) => id === 'strike' }), ['ward']);
  assert.strictEqual(withMacros(null, {}), null);
});

test('it is wired: a macro button runs a chain of ordinary casts, shows the last step\'s cooldown, and leads the bar', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(main, /if \(atk\.kind === 'macro'\) \{ runMacro\(id, aim\); return; \}/);
  assert.match(main, /castFromHotbar\(step, i === 0 \? aim : undefined\);/, 'each step is the ordinary cast');
  assert.match(main, /const remaining = actionReadyAt\(id\) - now;/);
  assert.match(main, /out\.unshift\(\.\.\.fresh\.filter\(isMacroId\)\);/);
  assert.match(server, /if \(msg\.type === 'macro_save'\) \{/);
  assert.match(server, /if \(msg\.type === 'macro_upgrade'\) \{/);
  assert.ok(!/macro/.test(server.slice(server.indexOf("if (msg.type === 'cast_attack') {"), server.indexOf("if (msg.type === 'cast_attack') {") + 400)), 'the server casts nothing for a macro');
});
