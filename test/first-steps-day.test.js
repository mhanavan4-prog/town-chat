// client/newcomer.js: someone who arrives by day is not left waiting on the
// one First Step that can only be done after dark.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const N = new Function(read('client/newcomer.js').replace(/^export /gm, '') + '\nreturn { firstStepNow, firstStepHintNow, newcomerNextStep, firstStepHint };')();
const ids = ['struck', 'talked', 'ability', 'story', 'killed', 'harvested'];
const steps = (done) => ids.map((id) => ({ id, label: id, icon: '*', done: done.includes(id) }));
const day = { night: false, msToNight: 7 * 60000 }, night = { night: true, msToNight: 0 };

check('the steps come in order', N.firstStepNow(steps([]), day).id === 'struck' && N.firstStepNow(steps(['struck']), night).id === 'talked');
check('by night the creature step is shown in its turn', N.firstStepNow(steps(['struck', 'talked', 'ability', 'story']), night).id === 'killed');
check('by day she is pointed past it to what can be done', N.firstStepNow(steps(['struck', 'talked', 'ability', 'story']), day).id === 'harvested');
check('when it is the last thing left by day, it is shown', N.firstStepNow(steps(['struck', 'talked', 'ability', 'story', 'harvested']), day).id === 'killed');
check('and says how long till dark, not to go and strike one', /Night falls in about 7 minutes/.test(N.firstStepHintNow('killed', false, day)) && !/press R/.test(N.firstStepHintNow('killed', false, day)));
check('one minute is said as one minute, and never as none', /about 1 minute:/.test(N.firstStepHintNow('killed', false, { night: false, msToNight: 5000 })));
check('by night the hint is the ordinary one', N.firstStepHintNow('killed', false, night) === N.firstStepHint('killed', false));
check('other steps are worded the same by day and night', N.firstStepHintNow('struck', true, day) === N.firstStepHint('struck', true));
check('all done, nothing to point at', N.firstStepNow(steps(ids), day) === null);
const line = N.newcomerNextStep({ steps: steps(['struck', 'talked', 'ability', 'story']), done: false, touch: true, card: false, when: day });
check('the phone line follows the same rule', line && line.id === 'harvested' && /4\/6/.test(line.title));
{
  const main = read('client/main.js');
  check('the card uses it, and re-draws as the clock moves', /const current = firstStepNow\(steps, fsWhen\(\)\);/.test(main) && /setInterval\(\(\) => \{ if \(firstStepsState && !firstStepsState\.done\) renderFirstSteps\(\); \}, 30000\);/.test(main));
  const srv = read('server.js');
  check('the server still lists the creature step before the harvest, so this rule is needed', srv.indexOf("id: 'killed'") < srv.indexOf("id: 'harvested'"));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
