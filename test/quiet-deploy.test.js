// ops/deploy.sh must not be something players feel: client and site changes go
// live with no restart, and server changes wait for an empty town. This runs
// the real script against a throwaway git remote, with npm / systemctl / curl
// replaced by stubs that record what was asked of them.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'ops', 'deploy.sh');
const hasTools = ['git', 'bash', 'setsid'].every((t) => spawnSync('which', [t]).status === 0);

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...args],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function makeBox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-deploy-'));
  const origin = path.join(root, 'origin.git');
  const dev = path.join(root, 'dev');
  const app = path.join(root, 'app');
  const bin = path.join(root, 'bin');
  const calls = path.join(root, 'calls.log');
  const playersFile = path.join(root, 'players');
  fs.mkdirSync(origin); git(origin, 'init', '-q', '--bare');
  fs.mkdirSync(dev); git(dev, 'init', '-q');
  fs.mkdirSync(path.join(dev, 'client')); fs.mkdirSync(path.join(dev, 'ops')); fs.mkdirSync(path.join(dev, 'lib'));
  fs.writeFileSync(path.join(dev, 'server.js'), '// v1\n');
  fs.writeFileSync(path.join(dev, 'lib', 'a.js'), '// v1\n');
  fs.writeFileSync(path.join(dev, 'client', 'main.js'), '// v1\n');
  fs.copyFileSync(SCRIPT, path.join(dev, 'ops', 'deploy.sh'));
  git(dev, 'add', '-A'); git(dev, 'commit', '-qm', 'first');
  git(dev, 'branch', '-M', 'main');
  git(dev, 'remote', 'add', 'origin', origin); git(dev, 'push', '-q', 'origin', 'main');
  git(root, 'clone', '-q', '-b', 'main', origin, app);

  fs.mkdirSync(bin);
  const stub = (name, body) => { fs.writeFileSync(path.join(bin, name), '#!/usr/bin/env bash\n' + body + '\n'); fs.chmodSync(path.join(bin, name), 0o755); };
  stub('npm', `echo "npm $*" >> "${calls}"`);
  stub('systemctl', `echo "systemctl $*" >> "${calls}"`);
  stub('systemd-run', 'exit 1');
  stub('curl', `p="$(cat "${playersFile}")"; [ "$p" = "down" ] && exit 7; echo "{\\"ok\\":true,\\"store\\":\\"sqlite\\",\\"players\\":$p,\\"uptime\\":5}"`);
  fs.writeFileSync(calls, ''); fs.writeFileSync(playersFile, '0');

  const env = { ...process.env, PATH: bin + ':' + process.env.PATH, THORNREACH_APP_DIR: app,
    THORNREACH_SERVICE: 'quiet-test', DEPLOY_POLL_S: '1', DEPLOY_MAX_WAIT_S: '600' };
  delete env.SSH_ORIGINAL_COMMAND;
  return {
    root, app,
    players: (n) => fs.writeFileSync(playersFile, String(n)),
    push(file, text) {
      fs.writeFileSync(path.join(dev, file), text);
      git(dev, 'add', '-A'); git(dev, 'commit', '-qm', 'change ' + file); git(dev, 'push', '-q', 'origin', 'main');
      return git(dev, 'rev-parse', 'HEAD');
    },
    run(args = [], extraEnv = {}) {
      const r = spawnSync('bash', [path.join(app, 'ops', 'deploy.sh'), ...args], { env: { ...env, ...extraEnv }, encoding: 'utf8' });
      return { code: r.status, out: r.stdout + r.stderr };
    },
    calls: () => fs.readFileSync(calls, 'utf8'),
    restarts: () => (fs.readFileSync(calls, 'utf8').match(/systemctl restart/g) || []).length,
    head: () => git(app, 'rev-parse', 'HEAD'),
    async until(fn, ms = 20000) {
      const end = Date.now() + ms;
      while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 200)); }
      return false;
    },
    done() {
      try { const pid = fs.readFileSync(path.join(app, '.deploy-waiter.pid'), 'utf8').trim(); if (pid) process.kill(Number(pid)); } catch (e) {}
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

const opts = { skip: !hasTools && 'needs git, bash and setsid' };

test('a client-only change goes live with no restart, even with players in town', opts, () => {
  const b = makeBox();
  try {
    b.players(3);
    const rev = b.push('client/main.js', '// v2\n');
    const r = b.run();
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /no restart/);
    assert.strictEqual(b.restarts(), 0);
    assert.strictEqual(b.head(), rev);
    assert.match(b.calls(), /npm run build:client/);
    assert.doesNotMatch(b.calls(), /npm install/);
  } finally { b.done(); }
});

test('a server change restarts straight away when the town is empty', opts, () => {
  const b = makeBox();
  try {
    const rev = b.push('lib/a.js', '// v2\n');
    const r = b.run();
    assert.strictEqual(r.code, 0, r.out);
    assert.strictEqual(b.restarts(), 1);
    assert.strictEqual(b.head(), rev);
    assert.strictEqual(fs.readFileSync(path.join(b.app, '.running-rev'), 'utf8').trim(), rev);
    assert.ok(!fs.existsSync(path.join(b.app, '.deploying')), 'the heartbeat flag is cleared');
  } finally { b.done(); }
});

test('a server change waits while players are in town, then lands when it empties', opts, async () => {
  const b = makeBox();
  try {
    const before = b.head();
    b.players(2);
    const rev = b.push('server.js', '// v2\n');
    const r = b.run();
    assert.strictEqual(r.code, 0, r.out);
    assert.match(r.out, /2 player\(s\) are in town/);
    assert.strictEqual(b.restarts(), 0);
    assert.strictEqual(b.head(), before, 'nothing on disk moves under the running server');

    // A later client-only change must not slip a new client in front of the old server.
    b.push('client/main.js', '// v3\n');
    const r2 = b.run();
    assert.match(r2.out, /already waiting/);
    assert.strictEqual(b.head(), before);
    assert.strictEqual(b.restarts(), 0);

    b.players(0);
    assert.ok(await b.until(() => b.restarts() === 1), 'the waiter restarts once the town is empty');
    assert.ok(await b.until(() => b.head() !== before && b.head() !== rev), 'and it lands the newest commit');
    assert.ok(await b.until(() => !fs.existsSync(path.join(b.app, '.deploy-waiter.pid'))), 'the waiter cleans up');
    assert.strictEqual(b.restarts(), 1, 'one restart for both changes');
  } finally { b.done(); }
});

test('--now, typed or sent over the pinned SSH key, does not wait', opts, () => {
  const b = makeBox();
  try {
    b.players(4);
    b.push('server.js', '// v2\n');
    assert.strictEqual(b.run(['--now']).code, 0);
    assert.strictEqual(b.restarts(), 1);
    b.push('server.js', '// v3\n');
    assert.strictEqual(b.run([], { SSH_ORIGINAL_COMMAND: 'bash /opt/town-chat/ops/deploy.sh --now' }).code, 0);
    assert.strictEqual(b.restarts(), 2);
  } finally { b.done(); }
});

test('the wait has a ceiling', opts, async () => {
  const b = makeBox();
  try {
    b.players(5);
    b.push('server.js', '// v2\n');
    b.run([], { DEPLOY_MAX_WAIT_S: '2' });
    assert.ok(await b.until(() => b.restarts() === 1), 'it goes ahead after the ceiling');
  } finally { b.done(); }
});

test('nothing new means nothing happens, and a dead server is restarted without waiting', opts, () => {
  const b = makeBox();
  try {
    const r = b.run();
    assert.match(r.out, /nothing new/);
    assert.strictEqual(b.calls(), '');
    b.players('down');
    b.push('server.js', '// v2\n');
    b.run();
    assert.strictEqual(b.restarts(), 1);
  } finally { b.done(); }
});
