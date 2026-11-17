// The Deep (data/delveDeep.js, lib/delveDeep.js): steeper below the tenth floor,
// a deepest-ever record that outlasts the week, and titles for depth.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const fs = require('fs'), path = require('path');
const { DEEP, deepMult } = require('../data/delveDeep');
const { TITLES } = require('../data/titles');
const near = (a, b) => Math.abs(a - b) < 1e-9;

check('down to the tenth floor nothing has changed', [1, 2, 5, 10].every((f) => near(deepMult(f), 1 + 0.12 * (f - 1))));
check('below it every floor is harder than the old step would have made it', [11, 12, 15, 20, 30].every((f) => deepMult(f) > 1 + 0.12 * (f - 1)));
{ let ok = true, grow = true; for (let f = 2; f <= 60; f++) { if (!(deepMult(f) > deepMult(f - 1))) ok = false; if (f > 12 && !((deepMult(f) - deepMult(f - 1)) > (deepMult(f - 1) - deepMult(f - 2)))) grow = false; }
  check('it never gets easier going down', ok); check('and in the Deep the steps themselves grow', grow); }
check('floor 11 is a small step past floor 10, not a wall', deepMult(11) / deepMult(10) < 1.2);
check('floor 30 is hard but finite', deepMult(30) > 8 && deepMult(30) < 20, deepMult(30));

{
  const accounts = { ada: { username: 'Ada' }, bea: { username: 'Bea' }, cyd: { username: 'Cyd' } };
  const titles = []; let saves = 0, t = 1000;
  const D = require('../lib/delveDeep')({ accounts, grantTitle: (p, id) => titles.push(p.accountKey + ':' + id), save: () => { saves++; }, now: () => (t += 61000) });
  const P = (k) => ({ accountKey: k, name: accounts[k] ? accounts[k].username : 'guest' });
  check('a first descent is a record', D.note(P('ada'), 4) === true && accounts.ada.delveBest.depth === 4 && saves === 1);
  check('a shallower one is not', D.note(P('ada'), 3) === false && accounts.ada.delveBest.depth === 4);
  check('a guest leaves no mark', D.note({ name: 'Wren' }, 9) === false);
  check('reaching ten gives the first title, once', D.note(P('ada'), 10) && D.note(P('ada'), 11) && titles.join() === 'ada:deep_ten');
  check('a leap past two honours gives both', D.note(P('bea'), 31) && titles.slice(1).join() === 'bea:deep_ten,bea:deep_twenty,bea:deep_thirty');
  D.note(P('cyd'), 11);
  const m = D.menu(P('ada'));
  check('the panel is told her deepest and the next title', m.best === 11 && m.next === 20 && m.deepFrom === 10);
  check('the all-time board is deepest first, and of equals whoever got there first', m.top.map((e) => e.name + e.value).join() === 'Bea31,Ada11,Cyd11', m.top);
  check('with every title, there is no next', D.menu(P('bea')).next === null);
}

check('every honour has a title that exists', DEEP.honours.every((h) => TITLES[h.title]));
{
  const lib = fs.readFileSync(path.join(__dirname, '..', 'lib/delve.js'), 'utf8'), srv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  check('the Delve uses it for its creatures', /const floorMult = deepMult\(run\.floor\);/.test(lib));
  check('and says so on the eleventh floor', /run\.floor === DEEP\.from \+ 1/.test(lib) && /This is the Deep/.test(lib));
  check('the end of a run is noted, and the panel is sent the record', /delveDeep\.note\(player, depth\)/.test(srv) && /deep: delveDeep\.menu\(player\)/.test(srv));
  check('the Deep gives no power', !/grantXP|balance|addItem/.test(fs.readFileSync(path.join(__dirname, '..', 'lib/delveDeep.js'), 'utf8')));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
