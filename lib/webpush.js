// Web push subsystem (Session L) — VAPID + RFC 8291/8292. Extracted to lib/ in
// Tier 3.4 Phase B. createWebPush(deps) -> push API. crypto/http/https are Node
// builtins; persistence, serverConfig (VAPID key storage) and the online-check
// are injected. The moonrise watcher + /api/push routes stay in server.js.
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

module.exports = function createWebPush({ dataDir, persistLoad, persistSetKey, persistRegister, serverConfig, serverConfigFile, findConnectionByAccountKey }) {
  const PUSH_SUBS_FILE = path.join(dataDir, 'pushSubs.json');
  const pushSubs = persistLoad('pushSubs', PUSH_SUBS_FILE); // accountKey -> [ { endpoint, p256dh, auth, prefs, addedAt, lastNightPushAt } ]
  persistRegister('pushSubs', PUSH_SUBS_FILE, () => pushSubs);
  function savePushSubs(key) { persistSetKey('pushSubs', PUSH_SUBS_FILE, pushSubs, key); }
  const PUSH_MAX_SUBS_PER_ACCOUNT = 5;
  const PUSH_NIGHT_MIN_GAP_MS = 20 * 3600 * 1000;
  const PUSH_CONTACT = 'mailto:' + (process.env.VAPID_CONTACT_EMAIL || 'mhanavan4@gmail.com');

  function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64uToBuf(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }

  let _vapid = null; // { publicKey (b64u, 65-byte point), privateJwk, privateKeyObj }
  function getVapidKeys() {
    if (_vapid) return _vapid;
    try {
      if (!serverConfig.vapid) {
        const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
        const jwk = privateKey.export({ format: 'jwk' });
        const publicPoint = Buffer.concat([Buffer.from([4]), b64uToBuf(jwk.x), b64uToBuf(jwk.y)]);
        serverConfig.vapid = { publicKey: b64u(publicPoint), privateJwk: jwk };
        persistSetKey('serverConfig', serverConfigFile, serverConfig, 'vapid');
        console.log('web push: generated + stored a fresh VAPID key pair');
      }
      _vapid = {
        publicKey: serverConfig.vapid.publicKey,
        privateKeyObj: crypto.createPrivateKey({ key: serverConfig.vapid.privateJwk, format: 'jwk' })
      };
      return _vapid;
    } catch (e) {
      console.error('web push unavailable:', e.message);
      return null;
    }
  }

  // HKDF-SHA256 (one expand block — every length here is ≤ 32).
  function pushHkdf(salt, ikm, info, len) {
    const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
    return crypto.createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, len);
  }

  // RFC 8291 encryption: payload -> aes128gcm body for the push service.
  function encryptWebPush(sub, payloadBuf) {
    const clientPub = b64uToBuf(sub.p256dh);
    const authSecret = b64uToBuf(sub.auth);
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const serverPub = ecdh.getPublicKey();
    const shared = ecdh.computeSecret(clientPub);
    const ikm = pushHkdf(authSecret, shared, Buffer.concat([Buffer.from('WebPush: info\0'), clientPub, serverPub]), 32);
    const salt = crypto.randomBytes(16);
    const cek = pushHkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
    const nonce = pushHkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
    const record = Buffer.concat([payloadBuf, Buffer.from([2])]); // 0x02 marks the final record
    const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
    const ct = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);
    // aes128gcm header: salt(16) | record size (4, BE — 4096) | keyid len (1) | keyid (the server's public point)
    const header = Buffer.concat([salt, Buffer.from([0, 0, 16, 0]), Buffer.from([serverPub.length]), serverPub]);
    return Buffer.concat([header, ct]);
  }

  // RFC 8292 VAPID: a short-lived ES256 JWT scoped to the push service origin.
  function vapidAuthHeader(endpoint) {
    const keys = getVapidKeys();
    if (!keys) return null;
    const aud = new URL(endpoint).origin;
    const header = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const claims = b64u(Buffer.from(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: PUSH_CONTACT })));
    const unsigned = `${header}.${claims}`;
    const sig = crypto.createSign('SHA256').update(unsigned).sign({ key: keys.privateKeyObj, dsaEncoding: 'ieee-p1363' });
    return `vapid t=${unsigned}.${b64u(sig)}, k=${keys.publicKey}`;
  }

  // Fire one push. Fail-soft everywhere: a dead endpoint (404/410) prunes the
  // subscription; anything else just logs. Never throws into the game loop.
  function sendWebPush(accountKey, sub, payloadObj) {
    try {
      const auth = vapidAuthHeader(sub.endpoint);
      if (!auth) return;
      const body = encryptWebPush(sub, Buffer.from(JSON.stringify(payloadObj)));
      const url = new URL(sub.endpoint);
      const mod = url.protocol === 'http:' ? http : https; // http only ever appears in tests
      const req = mod.request(url, {
        method: 'POST',
        headers: {
          'TTL': '86400',
          'Urgency': 'normal',
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          'Content-Length': body.length,
          'Authorization': auth
        }
      }, (res) => {
        res.resume();
        if (res.statusCode === 404 || res.statusCode === 410) {
          // The browser dropped this subscription — forget it.
          if (pushSubs[accountKey]) {
            pushSubs[accountKey] = pushSubs[accountKey].filter(s => s.endpoint !== sub.endpoint);
            if (!pushSubs[accountKey].length) delete pushSubs[accountKey];
            savePushSubs(accountKey);
          }
        }
      });
      req.on('error', (e) => console.error('web push send failed:', e.message));
      req.setTimeout(10000, () => req.destroy());
      req.end(body);
    } catch (e) {
      console.error('web push error:', e.message);
    }
  }

  // kind: 'moonrise' | 'bloodmoon' | 'peddler' | 'events'. Offline accounts
  // only; night kinds rate-limited per subscription.
  function pushBroadcast(kind, title, bodyText) {
    if (!getVapidKeys()) return;
    const now = Date.now();
    const nightKind = kind === 'moonrise' || kind === 'bloodmoon';
    for (const [accountKey, subs] of Object.entries(pushSubs)) {
      if (findConnectionByAccountKey(accountKey)) continue; // playing right now — they can see the town
      let touched = false;
      for (const sub of subs) {
        if (!sub.prefs || !sub.prefs[kind]) continue;
        if (nightKind && sub.lastNightPushAt && now - sub.lastNightPushAt < PUSH_NIGHT_MIN_GAP_MS) continue;
        if (nightKind) { sub.lastNightPushAt = now; touched = true; }
        sendWebPush(accountKey, sub, { title, body: bodyText, kind, at: now });
      }
      if (touched) savePushSubs(accountKey);
    }
  }

  return {
    pushSubs, savePushSubs, getVapidKeys, encryptWebPush, vapidAuthHeader,
    sendWebPush, pushBroadcast, PUSH_MAX_SUBS_PER_ACCOUNT,
  };
};
