// Boots the real server with a MOCKED `stripe` module so the whole Town
// Pass flow — /api/checkout → hosted page → success redirect →
// /api/verify-session → unlock — can be exercised end-to-end in a sandbox
// with no Stripe access. The mock "hosted checkout page" IS the success
// redirect (every session is instantly paid). Purely a test double: run
// the real server with a real STRIPE_SECRET_KEY and none of this loads.
// Run: node test/stripe-mock-server.cjs   (accepts PORT env, default 3000)
const Module = require('module');

const paidSessions = new Map();
let counter = 0;
const mockStripe = () => ({
  checkout: {
    sessions: {
      async create(opts) {
        const id = 'cs_test_mock_' + (++counter) + '_' + Math.random().toString(36).slice(2, 8);
        paidSessions.set(id, {
          id,
          payment_status: 'paid',
          created: Math.floor(Date.now() / 1000)
        });
        return { id, url: opts.success_url.replace('{CHECKOUT_SESSION_ID}', id) };
      },
      async retrieve(id) {
        const s = paidSessions.get(id);
        if (!s) throw new Error('No such checkout.session: ' + id);
        return s;
      }
    }
  }
});

const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'stripe') return mockStripe;
  return origLoad.apply(this, arguments);
};

process.env.STRIPE_SECRET_KEY = 'sk_test_mock_not_a_real_key';
console.log('STRIPE MOCK ACTIVE — every checkout session auto-pays');
require('../server.js');
