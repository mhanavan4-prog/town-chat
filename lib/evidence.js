// Thornreach image evidence store (Session M).
// Every user-posted image is fingerprinted (SHA-256), PRESERVED to a locked-down
// quarantine folder (never web-served, never displayed), and recorded as
// metadata only. This exists so that if something unlawful is posted, you can
// (a) trace it to an account + IP + time, and (b) generate a report and hand the
// preserved file to the proper authority — without ever viewing or re-sharing it.
//
// Nothing here renders or returns image bytes to the admin console by design.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function createEvidence({ dataDir, audit, ring = 600 } = {}) {
  const dir = path.join(dataDir, 'evidence');
  try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); } catch (e) {}
  try { fs.chmodSync(dir, 0o700); } catch (e) {}
  const indexFile = path.join(dir, 'index.jsonl');
  const recentArr = [];

  function parse(dataUrl) {
    const m = /^data:(image\/[a-z]+);base64,([\s\S]*)$/i.exec(dataUrl || '');
    if (!m) return null;
    try { return { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], 'base64') }; }
    catch (e) { return null; }
  }

  // Record one posted image. Returns { sha } or null. Writes the bytes once
  // (deduped by hash), appends a durable metadata line, and logs an audit event
  // — metadata only; the image itself goes ONLY to the quarantine folder.
  function record({ dataUrl, surface, account, ip, ua, context }) {
    const p = parse(dataUrl);
    if (!p) return null;
    const sha = crypto.createHash('sha256').update(p.buf).digest('hex');
    const ext = (p.mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '');
    const file = path.join(dir, sha + '.' + ext);
    try { if (!fs.existsSync(file)) fs.writeFileSync(file, p.buf, { mode: 0o600 }); } catch (e) {}
    const rec = {
      ts: Date.now(), sha, surface: surface || 'unknown',
      account: account || null, ip: ip || null, ua: ua || null,
      bytes: p.buf.length, mime: p.mime, context: context || {}, file: path.basename(file)
    };
    recentArr.push(rec); if (recentArr.length > ring) recentArr.shift();
    try { fs.appendFileSync(indexFile, JSON.stringify(rec) + '\n'); } catch (e) {}
    if (audit) audit.log({ level: 'info', type: 'image_posted', ip, account,
      detail: { surface: rec.surface, sha, bytes: rec.bytes, mime: rec.mime } });
    return rec;
  }

  function recent(n, opts) {
    opts = opts || {};
    let out = recentArr.slice(-(Math.min(Number(n) || 100, recentArr.length))).reverse();
    if (opts.account) { const a = String(opts.account).toLowerCase(); out = out.filter((r) => (r.account || '').toLowerCase() === a); }
    if (opts.surface) out = out.filter((r) => r.surface === opts.surface);
    return out;
  }
  function get(sha) { return recentArr.find((r) => r.sha === sha) || null; }
  function all() { return recentArr.slice(); }

  return { record, recent, get, all, dir, indexFile };
};
