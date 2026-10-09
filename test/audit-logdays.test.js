// Unit tests for the audit module's historical day-file readers
// (logDays / readDay) that back the admin "Logs by day" console.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function freshAudit() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-audit-'));
  const audit = require('../lib/audit')({ dataDir });
  return { audit, dir: path.join(dataDir, 'security') };
}

function writeDay(dir, date, events) {
  fs.writeFileSync(path.join(dir, 'security-' + date + '.jsonl'),
    events.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

test('logDays lists only valid day files, newest first', () => {
  const { audit, dir } = freshAudit();
  writeDay(dir, '2026-01-02', [{ ts: 1, level: 'info', type: 'a' }]);
  writeDay(dir, '2026-01-10', [{ ts: 2, level: 'warn', type: 'b' }]);
  fs.writeFileSync(path.join(dir, 'not-a-log.txt'), 'ignore me');
  const days = audit.logDays();
  assert.deepStrictEqual(days.map((d) => d.date), ['2026-01-10', '2026-01-02']);
  assert.ok(days[0].bytes > 0, 'reports a byte size');
});

test('readDay returns a day newest-first with a total', () => {
  const { audit, dir } = freshAudit();
  writeDay(dir, '2026-02-01', [
    { ts: 100, level: 'info', type: 'login', ip: '1.1.1.1' },
    { ts: 200, level: 'alert', type: 'ban', account: 'baddie' },
    { ts: 300, level: 'warn', type: 'login_fail', ip: '2.2.2.2' }
  ]);
  const r = audit.readDay('2026-02-01');
  assert.strictEqual(r.total, 3);
  assert.strictEqual(r.events[0].ts, 300, 'newest event first');
  assert.strictEqual(r.events[2].ts, 100, 'oldest event last');
});

test('readDay filters by level and by free-text query', () => {
  const { audit, dir } = freshAudit();
  writeDay(dir, '2026-03-03', [
    { ts: 1, level: 'info', type: 'login', ip: '1.1.1.1' },
    { ts: 2, level: 'alert', type: 'ban', account: 'baddie' },
    { ts: 3, level: 'alert', type: 'moderation_mute', account: 'noisy' }
  ]);
  assert.strictEqual(audit.readDay('2026-03-03', { level: 'alert' }).total, 2);
  assert.strictEqual(audit.readDay('2026-03-03', { level: 'info' }).total, 1);
  assert.strictEqual(audit.readDay('2026-03-03', { q: 'baddie' }).total, 1);
  assert.strictEqual(audit.readDay('2026-03-03', { q: 'nomatch' }).total, 0);
});

test('readDay refuses non-date / path-traversal input', () => {
  const { audit } = freshAudit();
  assert.strictEqual(audit.readDay('../../etc/passwd').error, 'bad date');
  assert.strictEqual(audit.readDay('2026-1-1').error, 'bad date');
  assert.strictEqual(audit.dayFilePath('../secrets'), null);
});

test('readDay reports a missing day cleanly', () => {
  const { audit } = freshAudit();
  const r = audit.readDay('2099-12-31');
  assert.strictEqual(r.missing, true);
  assert.deepStrictEqual(r.events, []);
});

test('the n cap limits returned events but total reflects all matches', () => {
  const { audit, dir } = freshAudit();
  const many = Array.from({ length: 50 }, (_, i) => ({ ts: i + 1, level: 'info', type: 't' }));
  writeDay(dir, '2026-04-04', many);
  const r = audit.readDay('2026-04-04', { n: 10 });
  assert.strictEqual(r.total, 50);
  assert.strictEqual(r.events.length, 10);
  assert.strictEqual(r.shown, 10);
});
