// Security-events unit coverage (Session M+). Locks in the two library hooks
// the audit system leans on: persistence.onError (a storage failure must never
// pass silently) and moonstones.onAnomaly (an impossible balance change must be
// surfaced). Runs the libs directly — no server boot needed.
process.env.PERSIST_FORCE_JSON = '1'; // exercise the JSON write path deterministically

const os = require('os');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }

// ── persistence.onError fires on a write failure ──────────────────────────
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-secev-'));
const errors = [];
const persistence = require('../lib/persistence')({
  dataDir,
  onError: (info) => errors.push(info)
});

// A good save succeeds quietly (no error reported).
persistence.persistSave('okStore', path.join(dataDir, 'ok.json'), { a: 1 });
check('a healthy save reports no error', errors.length === 0);

// A save into a non-existent directory fails — onError MUST fire.
persistence.persistSave('badStore', path.join(dataDir, 'no', 'such', 'dir', 'x.json'), { a: 1 });
check('a failed save fires onError', errors.length === 1);
check('onError carries the op + file', errors[0] && errors[0].op === 'atomicWriteJson' && /x\.json$/.test(errors[0].file || ''));
check('onError carries a message', !!(errors[0] && errors[0].message));

// ── moonstones.onAnomaly fires only on an impossible delta ────────────────
const anomalies = [];
const ms = require('../lib/moonstones')({
  dataDir,
  persistLoad: () => ({}),
  persistSave: () => {},
  persistRegister: () => {},
  onAnomaly: (info) => anomalies.push(info)
});

ms.msAdjust('alice', 50);   // ordinary reward — fine
ms.msAdjust('alice', -20);  // ordinary spend — fine
check('normal moonstone changes raise no anomaly', anomalies.length === 0);

ms.msAdjust('mallory', 10 ** 9); // absurd credit — must flag
check('an impossible moonstone delta fires onAnomaly', anomalies.length === 1);
check('anomaly names the account and delta', anomalies[0] && anomalies[0].key === 'mallory' && anomalies[0].delta === 10 ** 9);
check('anomaly reports the ceiling it exceeded', !!(anomalies[0] && anomalies[0].ceiling > 0));

try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
