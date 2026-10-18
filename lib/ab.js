// A/B experiment harness (server-side, deterministic). Each visitor gets a
// stable random id (the tr_ab cookie); a visitor's variant for an experiment is
// a pure hash of (id + experiment name), so it never flips between visits and
// needs no storage. Exposure and conversion are counted as plain PII-free
// analytics counters: exp.<name>.<variant>.view and .signup.
//
// To run a test: add it here, then have the serving code read variantFor() and
// vary what it renders (see the 'cta' experiment wired into the landing hero).
// To stop one, delete it — past counters remain on the dashboard for reading.
const crypto = require('crypto');

const EXPERIMENTS = {
  // Landing hero button copy: the current wording vs a value-prop wording.
  cta: { variants: ['enter', 'playfree'] }
};

// Deterministic variant for a visitor id within an experiment. Even split:
// the first hash byte (0–255) mod the variant count. Returns null for an
// unknown experiment or a missing id (caller then uses the control path).
function variantFor(exp, abId) {
  const def = EXPERIMENTS[exp];
  if (!def || !abId) return null;
  const b = crypto.createHash('sha1').update(String(abId) + ':' + exp).digest()[0];
  return def.variants[b % def.variants.length];
}

module.exports = { EXPERIMENTS, variantFor };
