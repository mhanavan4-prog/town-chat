const globals = require('globals');

// Bug-catching rules. Errors have ~zero false positives on real code; the rest
// are a non-blocking warning backlog to burn down over time.
const bugRules = {
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-unreachable': 'error',
  'no-cond-assign': ['error', 'always'],
  'no-constant-condition': ['warn', { checkLoops: false }], // legacy toggles like `x || true` — surface, don't block
  'no-self-assign': 'error',
  'no-unsafe-negation': 'error',
  'valid-typeof': 'error',
  // Unused vars are informational. Ignore catch params + function args (common,
  // harmless) and _-prefixed intentionals; the rest are a backlog, not a gate.
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
};

module.exports = [
  {
    ignores: [
      'node_modules/**', '_to_delete/**',
      'public/three.min.js', 'public/face-api.min.js',
      'public/GLTFLoader.js', 'public/SkeletonUtils.js', 'public/fx.js',
      'test/three-stub.js',
    ],
  },
  // Server — pure Node. A browser global here WOULD be a real bug, so node-only.
  {
    files: ['server.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
  // Test + QA scripts. They drive a headless browser via Playwright, so their
  // page-context callbacks legitimately use browser globals (document/window/
  // localStorage/Touch/...). Give them BOTH node and browser.
  {
    files: ['test/**/*.js', 'test/**/*.cjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
  // ESM smoke/harness scripts — same browser-via-Playwright situation.
  {
    files: ['test/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
  // Browser client — one big global <script>; leans on bundled-script globals
  // (THREE, fx.js -> FX/LEGEND_FX, face-api -> faceapi). no-undef stays 'warn'
  // (whitelist then flip to 'error'); the load-crash class is caught by the smoke test.
  {
    files: ['public/client.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser, THREE: 'readonly', faceapi: 'readonly', FX: 'readonly', LEGEND_FX: 'readonly' },
    },
    rules: { ...bugRules, 'no-undef': 'warn' },
  },
];
