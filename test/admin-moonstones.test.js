// Dev convenience: admin/test accounts are topped up to a Moonstone floor on
// login so the paid cosmetics (auras, collectible guises) can be exercised
// without buying a pack. Covers the floor behaviour: admins get topped up to the
// floor, never above it, non-admins are never touched, and the top-up refills
// after spending but doesn't stack past the floor on repeated logins.
process.env.PORT = '0';
process.env.ADMIN_ACCOUNTS = 'ms_admin'; // must be set before server.js loads
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-adminms-');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const FLOOR = h.ADMIN_MS_FLOOR;
  check('the floor defaults to 1000', FLOOR === 1000, FLOOR);

  const admin = { accountKey: 'ms_admin' };
  const normal = { accountKey: 'ms_normal' };
  check('the admin account is recognised as admin', h.isAdmin(admin) === true);
  check('a normal account is not admin', h.isAdmin(normal) === false);

  // Fresh accounts start at 0.
  check('admin starts at 0 moonstones', h.msBalance('ms_admin') === 0);

  // First login tops the admin up to the floor.
  check('the top-up credits on a below-floor admin', h.adminMoonstoneTopUp(admin) === true);
  check('the admin is now at the floor', h.msBalance('ms_admin') === FLOOR, h.msBalance('ms_admin'));

  // A second login at/above the floor credits nothing (floor, not hand-out).
  check('a second top-up at the floor credits nothing', h.adminMoonstoneTopUp(admin) === false);
  check('the balance stays at the floor', h.msBalance('ms_admin') === FLOOR);

  // Spend some, then a later login refills back up to the floor.
  h.msAdjust('ms_admin', -400);
  check('spending drops the balance below the floor', h.msBalance('ms_admin') === FLOOR - 400);
  check('the next login tops back up', h.adminMoonstoneTopUp(admin) === true && h.msBalance('ms_admin') === FLOOR, h.msBalance('ms_admin'));

  // An admin already above the floor (e.g. bought a pack) is left alone.
  h.msAdjust('ms_admin', 500); // now FLOOR + 500
  check('an admin above the floor is not reduced', h.adminMoonstoneTopUp(admin) === false && h.msBalance('ms_admin') === FLOOR + 500);

  // A non-admin is never topped up.
  check('a non-admin is never credited', h.adminMoonstoneTopUp(normal) === false && h.msBalance('ms_normal') === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
