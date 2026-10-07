// Thornreach transactional email (Session N) — password-reset links, etc.
// Uses Resend's HTTP API over Node's built-in https, so there are no new npm
// dependencies and no SMTP to manage. If it isn't configured (no RESEND_API_KEY),
// every send is a logged no-op and the rest of the app keeps working — handy for
// local/dev and for hosts that simply don't send mail.
//
//   const mailer = require('./lib/mailer')({ apiKey, from, audit });
//   await mailer.send({ to, subject, text, html });
//
// Config (env, read by server.js):
//   RESEND_API_KEY   re_...  (Resend → API Keys)
//   MAIL_FROM        e.g. "Thornreach <noreply@thornreach.com>" (verified domain)
const https = require('https');

module.exports = function createMailer({ apiKey = '', from = '', audit = null } = {}) {
  const enabled = !!(apiKey && from);

  function send({ to, subject, text, html }) {
    return new Promise((resolve) => {
      if (!enabled) {
        if (audit) audit.log({ level: 'warn', type: 'email_skipped', detail: { to: redact(to), subject, reason: 'mailer_not_configured' } });
        return resolve({ ok: false, skipped: true });
      }
      if (!to || !subject) return resolve({ ok: false, error: 'missing to/subject' });

      const body = JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, text, html });
      const req = https.request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer ' + apiKey,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: 10000,
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          let id = null; try { id = JSON.parse(data).id; } catch (e) {}
          if (audit) audit.log({ level: ok ? 'info' : 'warn', type: ok ? 'email_sent' : 'email_error',
            detail: { to: redact(to), subject, status: res.statusCode, id: id || undefined } });
          resolve(ok ? { ok: true, id } : { ok: false, status: res.statusCode, body: data.slice(0, 300) });
        });
      });
      req.on('error', (err) => {
        if (audit) audit.log({ level: 'warn', type: 'email_error', detail: { to: redact(to), subject, error: err.message } });
        resolve({ ok: false, error: err.message });
      });
      req.on('timeout', () => { req.destroy(); });
      req.write(body);
      req.end();
    });
  }

  // Never write a full address into the log; keep just enough to correlate.
  function redact(to) {
    const addr = Array.isArray(to) ? to[0] : to;
    const s = String(addr || '');
    const at = s.indexOf('@');
    if (at <= 1) return '***';
    return s[0] + '***' + s.slice(at);
  }

  return { send, enabled };
};
