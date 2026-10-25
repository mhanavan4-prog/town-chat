// Stripe webhook fulfilment (/api/stripe-webhook). A paid checkout whose success
// redirect never completes must still grant the purchase from Stripe's own
// event, exactly once, and a bad signature must grant nothing.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-whk-');
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_webhook';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_grant';
delete process.env.RESEND_API_KEY;
const http = require('http');
const Stripe = require('stripe');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const stripe = Stripe('sk_test_dummy_webhook');
function postEvent(port, event, { secret = 'whsec_test_webhook_grant' } = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(event);
    const sig = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const req = http.request({ host: '127.0.0.1', port, path: '/api/stripe-webhook', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'Stripe-Signature': sig } }, (res) => {
      let b = ''; res.on('data', (d) => { b += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}
function checkoutEvent(id, { metadata = {}, client_reference_id, payment_status = 'paid', created } = {}) {
  return { id: 'evt_' + id, object: 'event', type: 'checkout.session.completed',
    data: { object: { id, object: 'checkout.session', payment_status, metadata,
      client_reference_id: client_reference_id || null, created: created || Math.floor(Date.now() / 1000) } } };
}

require('../server.js');

(async () => {
  try {
    const h = global.__testHooks;
    const server = h.server;
    let port = 0;
    for (let i = 0; i < 40 && !port; i++) { const a = server && server.address(); port = (a && a.port) || 0; if (!port) await new Promise(r => setTimeout(r, 50)); }
    check('server bound a real port', port > 0);

    const packId = Object.keys(h.MS_PACKS)[0];
    const packMs = h.MS_PACKS[packId].ms;
    const before = h.msBalance('whk_alice');

    // 1. A paid Moonstone checkout whose redirect never ran is credited from the webhook.
    let r = await postEvent(port, checkoutEvent('cs_whk_ms1', { metadata: { ms_pack: packId }, client_reference_id: 'whk_alice' }));
    check('webhook accepts a signed moonstone event', r.status === 200, r);
    check('moonstones credited from webhook', h.msBalance('whk_alice') === before + packMs, { before, after: h.msBalance('whk_alice') });

    // 2. Stripe retries the same event: no second credit.
    r = await postEvent(port, checkoutEvent('cs_whk_ms1', { metadata: { ms_pack: packId }, client_reference_id: 'whk_alice' }));
    check('retried event accepted', r.status === 200);
    check('retried event does not double-credit', h.msBalance('whk_alice') === before + packMs, h.msBalance('whk_alice'));

    // 3. Unpaid sessions grant nothing.
    const beforeUnpaid = h.msBalance('whk_alice');
    r = await postEvent(port, checkoutEvent('cs_whk_unpaid', { metadata: { ms_pack: packId }, client_reference_id: 'whk_alice', payment_status: 'unpaid' }));
    check('unpaid session grants nothing', h.msBalance('whk_alice') === beforeUnpaid, h.msBalance('whk_alice'));

    // 4. A Town Pass checkout with an account attaches the pass to that account.
    const now = Date.now();
    r = await postEvent(port, checkoutEvent('cs_whk_pass1', { metadata: { town_pass: '1' }, client_reference_id: 'whk_bob', created: Math.floor(now / 1000) }));
    check('town pass event accepted', r.status === 200);
    check('town pass attached to the buying account', h.townPasses['whk_bob'] > now, h.townPasses['whk_bob']);
    check('town pass receipt cached for guest joins too', h.passSessions.has('cs_whk_pass1'));

    // 5. A paid session that isn't a Town Pass and has no product metadata is ignored.
    r = await postEvent(port, checkoutEvent('cs_whk_other', { client_reference_id: 'whk_carol' }));
    check('unrelated paid session grants no pass', !h.townPasses['whk_carol'] && !h.passSessions.has('cs_whk_other'));

    // 6. A forged signature is rejected and grants nothing.
    const beforeForged = h.msBalance('whk_mallory');
    r = await postEvent(port, checkoutEvent('cs_whk_forged', { metadata: { ms_pack: packId }, client_reference_id: 'whk_mallory' }), { secret: 'whsec_wrong' });
    check('bad signature rejected', r.status === 400, r.status);
    check('bad signature grants nothing', h.msBalance('whk_mallory') === beforeForged);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
